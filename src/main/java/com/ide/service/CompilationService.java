package com.ide.service;

import com.ide.model.CompilationResult;
import com.ide.model.CompilationResult.CompilationError;
import org.springframework.stereotype.Service;

import javax.tools.*;
import java.io.*;
import java.net.URI;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class CompilationService {

    private static final long EXECUTION_TIMEOUT_MS = 10000;
    private static final Pattern ERROR_PATTERN = Pattern.compile(
            "([\\w/]+\\.java):(\\d+):\\s*(error|warning):\\s*(.*?)(?:\\s*\\[.*?])?$",
            Pattern.MULTILINE
    );
    private static final Pattern ERROR_PATTERN2 = Pattern.compile(
            "([\\w/]+\\.java):(\\d+):\\s*(error|warning):\\s*(.*)",
            Pattern.MULTILINE
    );

    public CompilationResult compileAndRun(Path sourceDir, String mainClass, String stdin) {
        CompilationResult result = new CompilationResult();
        long startTime = System.currentTimeMillis();

        try {
            Path outputDir = Files.createTempDirectory("ide-classes-");
            List<Path> javaFiles = findJavaFiles(sourceDir);

            if (javaFiles.isEmpty()) {
                result.setSuccess(false);
                result.setErrors("No Java files found to compile.");
                return result;
            }

            boolean compiled = compileJavaFiles(javaFiles, outputDir, result);
            long compileEnd = System.currentTimeMillis();
            result.setExecutionTime("Compile: " + (compileEnd - startTime) + "ms");

            if (!compiled) {
                return result;
            }

            String executionOutput = executeMainClass(outputDir, mainClass, stdin);
            long execEnd = System.currentTimeMillis();
            result.setOutput(executionOutput);
            result.setExecutionTime("Compile: " + (compileEnd - startTime) + "ms, Run: " + (execEnd - compileEnd) + "ms");
            result.setSuccess(true);

            cleanup(outputDir);

        } catch (Exception e) {
            result.setSuccess(false);
            result.setErrors("Internal error: " + e.getMessage());
            e.printStackTrace();
        }

        return result;
    }

    private List<Path> findJavaFiles(Path dir) throws IOException {
        List<Path> files = new ArrayList<>();
        try (var stream = Files.walk(dir)) {
            stream.filter(p -> p.toString().endsWith(".java"))
                  .forEach(files::add);
        }
        return files;
    }

    private boolean compileJavaFiles(List<Path> javaFiles, Path outputDir, CompilationResult result) {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) {
            result.setSuccess(false);
            result.setErrors("Java compiler not found. Ensure JDK is installed (not just JRE).");
            return false;
        }

        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
        StandardJavaFileManager fileManager = compiler.getStandardFileManager(diagnostics, null, null);

        try {
            fileManager.setLocation(StandardLocation.CLASS_OUTPUT, List.of(outputDir.toFile()));

            List<String> options = List.of("-d", outputDir.toString());

            Iterable<? extends JavaFileObject> compilationUnits = fileManager.getJavaFileObjectsFromPaths(javaFiles);

            JavaCompiler.CompilationTask task = compiler.getTask(
                    null, fileManager, diagnostics, options, null, compilationUnits
            );

            boolean success = task.call();

            if (!success || diagnostics.getDiagnostics().stream()
                    .anyMatch(d -> d.getKind() == Diagnostic.Kind.ERROR)) {
                result.setSuccess(false);
                StringBuilder errorBuilder = new StringBuilder();
                List<CompilationError> errors = new ArrayList<>();

                for (Diagnostic<? extends JavaFileObject> diagnostic : diagnostics.getDiagnostics()) {
                    if (diagnostic.getKind() == Diagnostic.Kind.ERROR ||
                        diagnostic.getKind() == Diagnostic.Kind.WARNING) {
                        String source = diagnostic.getSource() != null
                                ? diagnostic.getSource().getName() : "unknown";
                        long line = diagnostic.getLineNumber();
                        long column = diagnostic.getColumnNumber();
                        String message = diagnostic.getMessage(null);
                        String kind = diagnostic.getKind().name().toLowerCase();

                        CompilationError err = new CompilationError();
                        err.setLine((int) line);
                        err.setColumn((int) column);
                        err.setMessage(message.replace('\n', ' ').trim());
                        err.setType(kind);
                        errors.add(err);

                        errorBuilder.append(source)
                                .append(":").append(line)
                                .append(": ").append(kind)
                                .append(": ").append(message.replace('\n', ' ').trim())
                                .append("\n");
                    }
                }

                result.setErrors(errorBuilder.toString());
                result.setErrorDetails(errors);
                return false;
            }

            return true;

        } catch (Exception e) {
            result.setSuccess(false);
            result.setErrors("Compilation error: " + e.getMessage());
            return false;
        } finally {
            try {
                fileManager.close();
            } catch (Exception ignored) {}
        }
    }

    private String executeMainClass(Path outputDir, String mainClass, String stdin) {
        StringBuilder output = new StringBuilder();
        ExecutorService executor = Executors.newSingleThreadExecutor();

        try {
            Future<String> future = executor.submit(() -> {
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                PrintStream ps = new PrintStream(baos, true, StandardCharsets.UTF_8);
                PrintStream originalOut = System.out;
                PrintStream originalErr = System.err;
                InputStream originalIn = System.in;

                try {
                    System.setOut(ps);
                    System.setErr(ps);
                    if (stdin != null && !stdin.isEmpty()) {
                        System.setIn(new ByteArrayInputStream(stdin.getBytes(StandardCharsets.UTF_8)));
                    } else {
                        System.setIn(new ByteArrayInputStream(new byte[0]));
                    }

                    try (URLClassLoader classLoader = URLClassLoader.newInstance(
                            new URL[]{outputDir.toUri().toURL()},
                            ClassLoader.getSystemClassLoader().getParent())) {

                        Thread.currentThread().setContextClassLoader(classLoader);
                        Class<?> mainClassLoaded = Class.forName(mainClass, true, classLoader);
                        var method = mainClassLoaded.getMethod("main", String[].class);
                        method.invoke(null, (Object) new String[]{});
                    }
                } catch (Exception e) {
                    StringWriter sw = new StringWriter();
                    PrintWriter pw = new PrintWriter(sw);
                    e.printStackTrace(pw);
                    ps.print("Runtime Error: " + sw);
                } finally {
                    System.setOut(originalOut);
                    System.setErr(originalErr);
                    System.setIn(originalIn);
                    ps.flush();
                }

                return baos.toString(StandardCharsets.UTF_8);
            });

            return future.get(EXECUTION_TIMEOUT_MS, TimeUnit.MILLISECONDS);

        } catch (TimeoutException e) {
            return "Execution timed out after " + (EXECUTION_TIMEOUT_MS / 1000) + " seconds.";
        } catch (Exception e) {
            StringWriter sw = new StringWriter();
            PrintWriter pw = new PrintWriter(sw);
            e.printStackTrace(pw);
            return "Execution error: " + sw;
        } finally {
            executor.shutdownNow();
        }
    }

    public String findMainClass(Path sourceDir) throws IOException {
        try (var stream = Files.walk(sourceDir)) {
            return stream.filter(p -> p.toString().endsWith(".java"))
                    .filter(p -> {
                        try {
                            String content = Files.readString(p);
                            return content.contains("public static void main");
                        } catch (IOException e) {
                            return false;
                        }
                    })
                    .findFirst()
                    .map(p -> {
                        String fileName = p.getFileName().toString();
                        return fileName.substring(0, fileName.lastIndexOf('.'));
                    })
                    .orElse("Main");
        }
    }

    public CompilationResult quickCompile(String code, String className) {
        CompilationResult result = new CompilationResult();
        long startTime = System.currentTimeMillis();

        try {
            Path tempDir = Files.createTempDirectory("ide-quick-");
            Path sourceFile = tempDir.resolve(className + ".java");
            Files.writeString(sourceFile, code);

            Path outputDir = Files.createTempDirectory("ide-quick-classes-");

            JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
            if (compiler == null) {
                result.setSuccess(false);
                result.setErrors("Java compiler not found. Ensure JDK is installed.");
                return result;
            }

            DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
            StandardJavaFileManager fileManager = compiler.getStandardFileManager(diagnostics, null, null);
            fileManager.setLocation(StandardLocation.CLASS_OUTPUT, List.of(outputDir.toFile()));

            List<String> options = List.of("-d", outputDir.toString());
            Iterable<? extends JavaFileObject> compilationUnits = fileManager.getJavaFileObjects(sourceFile.toFile());

            boolean success = compiler.getTask(null, fileManager, diagnostics, options, null, compilationUnits).call();
            fileManager.close();

            long compileTime = System.currentTimeMillis() - startTime;
            result.setExecutionTime(compileTime + "ms");

            if (!success || hasErrors(diagnostics)) {
                result.setSuccess(false);
                StringBuilder sb = new StringBuilder();
                List<CompilationError> errList = new ArrayList<>();
                for (var d : diagnostics.getDiagnostics()) {
                    if (d.getKind() == Diagnostic.Kind.ERROR || d.getKind() == Diagnostic.Kind.WARNING) {
                        CompilationError err = new CompilationError();
                        err.setLine((int) d.getLineNumber());
                        err.setColumn((int) d.getColumnNumber());
                        err.setMessage(d.getMessage(null).replace('\n', ' ').trim());
                        err.setType(d.getKind().name().toLowerCase());
                        errList.add(err);
                        sb.append("Line ").append(d.getLineNumber()).append(": ")
                                .append(d.getMessage(null).replace('\n', ' ').trim()).append("\n");
                    }
                }
                result.setErrors(sb.toString());
                result.setErrorDetails(errList);
                return result;
            }

            String output = executeMainClass(outputDir, className, "");
            result.setSuccess(true);
            result.setOutput(output);
            result.setErrors("");

            long execTime = System.currentTimeMillis() - startTime;
            result.setExecutionTime(execTime + "ms");

        } catch (Exception e) {
            result.setSuccess(false);
            result.setErrors("Error: " + e.getMessage());
        }

        return result;
    }

    private boolean hasErrors(DiagnosticCollector<JavaFileObject> diagnostics) {
        return diagnostics.getDiagnostics().stream()
                .anyMatch(d -> d.getKind() == Diagnostic.Kind.ERROR);
    }

    private void cleanup(Path dir) {
        try {
            if (dir != null && Files.exists(dir)) {
                try (var stream = Files.walk(dir)) {
                    stream.sorted(Comparator.reverseOrder())
                            .forEach(p -> {
                                try { Files.deleteIfExists(p); } catch (IOException ignored) {}
                            });
                }
            }
        } catch (IOException ignored) {}
    }

}
