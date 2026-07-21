package com.ide.controller;

import com.ide.model.CompilationResult;
import com.ide.model.FileNode;
import com.ide.service.CompilationService;
import com.ide.service.WorkspaceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.util.*;

@Controller
public class IdeController {

    @Autowired
    private WorkspaceService workspaceService;

    @Autowired
    private CompilationService compilationService;

    @GetMapping("/")
    public String ide(Model model) {
        try {
            FileNode tree = workspaceService.getWorkspaceTree();
            model.addAttribute("workspaceTree", tree);
            model.addAttribute("activeFile", findFirstJavaFile(tree));
        } catch (Exception e) {
            model.addAttribute("workspaceTree", new FileNode());
            model.addAttribute("error", "Could not load workspace: " + e.getMessage());
        }
        return "ide";
    }

    @GetMapping("/api/tree")
    @ResponseBody
    public ResponseEntity<FileNode> getFileTree() {
        try {
            return ResponseEntity.ok(workspaceService.getWorkspaceTree());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/api/file")
    @ResponseBody
    public ResponseEntity<Map<String, String>> getFile(@RequestParam String path) {
        try {
            String content = workspaceService.getFileContent(path);
            return ResponseEntity.ok(Map.of("content", content));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/api/file/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveFile(@RequestBody Map<String, String> body) {
        try {
            String path = body.get("path");
            String content = body.get("content");
            workspaceService.saveFile(path, content);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/api/file/create")
    @ResponseBody
    public ResponseEntity<FileNode> createFile(@RequestBody Map<String, String> body) {
        try {
            String path = body.get("path");
            FileNode node = workspaceService.createFile(path);
            return ResponseEntity.ok(node);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/api/file/delete")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteFile(@RequestBody Map<String, String> body) {
        try {
            String path = body.get("path");
            workspaceService.deleteFile(path);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/api/directory/create")
    @ResponseBody
    public ResponseEntity<FileNode> createDirectory(@RequestBody Map<String, String> body) {
        try {
            String path = body.get("path");
            FileNode node = workspaceService.createDirectory(path);
            return ResponseEntity.ok(node);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/api/run")
    @ResponseBody
    public ResponseEntity<CompilationResult> runProject(@RequestBody(required = false) Map<String, String> body) {
        try {
            Path projectRoot = workspaceService.getProjectRoot();
            String mainClass = null;
            if (body != null && body.containsKey("activeFilePath") && body.get("activeFilePath") != null) {
                String activePath = body.get("activeFilePath");
                if (activePath.endsWith(".java")) {
                    Path p = Path.of(activePath);
                    String fileName = p.getFileName().toString();
                    mainClass = fileName.substring(0, fileName.lastIndexOf('.'));
                    Path fullPath = projectRoot.resolve(activePath);
                    if (java.nio.file.Files.exists(fullPath)) {
                        String content = java.nio.file.Files.readString(fullPath);
                        if (!content.contains("public static void main")) {
                            mainClass = null;
                        }
                    }
                }
            }
            if (mainClass == null) {
                mainClass = compilationService.findMainClass(projectRoot);
            }
            String stdin = (body != null && body.containsKey("stdin")) ? body.get("stdin") : "";
            CompilationResult result = compilationService.compileAndRun(projectRoot, mainClass, stdin);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            CompilationResult err = new CompilationResult();
            err.setSuccess(false);
            err.setErrors("Error: " + e.getMessage());
            return ResponseEntity.ok(err);
        }
    }

    @PostMapping("/api/compile/quick")
    @ResponseBody
    public ResponseEntity<CompilationResult> quickCompile(@RequestBody Map<String, String> body) {
        try {
            String code = body.get("code");
            String className = body.getOrDefault("className", "Main");
            CompilationResult result = compilationService.quickCompile(code, className);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            CompilationResult err = new CompilationResult();
            err.setSuccess(false);
            err.setErrors("Error: " + e.getMessage());
            return ResponseEntity.ok(err);
        }
    }

    private Map<String, String> findFirstJavaFile(FileNode node) {
        if (node == null) return null;
        if (!node.isDirectory() && node.getName().endsWith(".java")) {
            return Map.of("path", node.getPath(), "content", node.getContent() != null ? node.getContent() : "");
        }
        if (node.getChildren() != null) {
            for (FileNode child : node.getChildren()) {
                Map<String, String> found = findFirstJavaFile(child);
                if (found != null) return found;
            }
        }
        return null;
    }
}
