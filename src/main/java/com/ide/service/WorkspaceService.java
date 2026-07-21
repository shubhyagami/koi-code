package com.ide.service;

import com.ide.model.FileNode;
import com.ide.model.FileRecord;
import com.ide.repository.FileRecordRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class WorkspaceService {

    @Value("${ide.workspace.path:${user.home}/ide-workspace}")
    private String workspacePath;

    private Path workspaceDir;

    @Autowired
    private FileRecordRepository fileRepository;

    @PostConstruct
    public void init() throws IOException {
        workspaceDir = Paths.get(workspacePath).toAbsolutePath().normalize();
        Files.createDirectories(workspaceDir);
        
        syncDatabaseAndFileSystem();
    }

    private void syncDatabaseAndFileSystem() throws IOException {
        if (fileRepository.count() == 0) {
            // DB is empty, import from filesystem
            if (Files.exists(workspaceDir)) {
                try (var stream = Files.walk(workspaceDir)) {
                    stream.forEach(path -> {
                        if (path.equals(workspaceDir)) return;
                        if (path.getFileName().toString().startsWith(".")) return;
                        
                        String relPath = workspaceDir.relativize(path).toString().replace("\\", "/");
                        boolean isDir = Files.isDirectory(path);
                        String content = null;
                        if (!isDir && path.toString().endsWith(".java")) {
                            try {
                                content = Files.readString(path);
                            } catch (IOException e) {
                                e.printStackTrace();
                            }
                        }
                        fileRepository.save(new FileRecord(relPath, content, isDir));
                    });
                }
            }
            if (fileRepository.count() == 0) {
                createDefaultProject();
            }
        } else {
            // DB has data, overwrite filesystem to ensure sync
            List<FileRecord> records = fileRepository.findAll();
            for (FileRecord record : records) {
                Path filePath = workspaceDir.resolve(record.getPath());
                Files.createDirectories(filePath.getParent());
                if (record.isDirectory()) {
                    Files.createDirectories(filePath);
                } else if (record.getContent() != null) {
                    Files.writeString(filePath, record.getContent());
                }
            }
        }
    }

    private void createDefaultProject() throws IOException {
        Path projectDir = workspaceDir.resolve("MyProject");
        Files.createDirectories(projectDir);
        fileRepository.save(new FileRecord("MyProject", null, true));
        
        Path srcDir = projectDir.resolve("src");
        Files.createDirectories(srcDir);
        fileRepository.save(new FileRecord("MyProject/src", null, true));

        String defaultCode = "public class Main {\n" +
                "    public static void main(String[] args) {\n" +
                "        System.out.println(\"Hello from Java IDE!\");\n" +
                "        \n" +
                "    }\n" +
                "}\n";

        Files.writeString(srcDir.resolve("Main.java"), defaultCode);
        fileRepository.save(new FileRecord("MyProject/src/Main.java", defaultCode, false));
    }

    public FileNode getWorkspaceTree() {
        // Build tree from DB
        List<FileRecord> records = fileRepository.findAll();
        FileNode root = new FileNode();
        root.setName("MyProject");
        root.setPath("MyProject");
        root.setDirectory(true);
        root.setChildren(new ArrayList<>());
        
        // Quick map
        Map<String, FileNode> nodeMap = new HashMap<>();
        nodeMap.put("MyProject", root);
        
        // Sort to ensure parents come before children
        records.sort(Comparator.comparing(FileRecord::getPath));
        
        for (FileRecord record : records) {
            if (record.getPath().equals("MyProject")) continue;
            
            FileNode node = new FileNode();
            String[] parts = record.getPath().split("/");
            node.setName(parts[parts.length - 1]);
            node.setPath(record.getPath());
            node.setDirectory(record.isDirectory());
            node.setContent(record.getContent());
            if (node.isDirectory()) node.setChildren(new ArrayList<>());
            
            nodeMap.put(record.getPath(), node);
            
            // find parent
            int lastSlash = record.getPath().lastIndexOf('/');
            String parentPath = lastSlash >= 0 ? record.getPath().substring(0, lastSlash) : "MyProject";
            if (parentPath.isEmpty()) parentPath = "MyProject";
            
            FileNode parent = nodeMap.get(parentPath);
            if (parent != null) {
                parent.getChildren().add(node);
            } else {
                root.getChildren().add(node);
            }
        }
        return root;
    }

    public String getFileContent(String relativePath) {
        return fileRepository.findById(relativePath).map(FileRecord::getContent).orElse("");
    }

    public void saveFile(String relativePath, String content) throws IOException {
        Path filePath = resolvePath(relativePath);
        Files.createDirectories(filePath.getParent());
        Files.writeString(filePath, content);
        
        FileRecord record = fileRepository.findById(relativePath).orElse(new FileRecord(relativePath, content, false));
        record.setContent(content);
        fileRepository.save(record);
    }

    public FileNode createFile(String relativePath) throws IOException {
        Path filePath = resolvePath(relativePath);
        Files.createDirectories(filePath.getParent());
        
        String content = "";
        if (Files.notExists(filePath)) {
            Files.createFile(filePath);
            String className = extractClassName(filePath.getFileName().toString());
            content = "public class " + className + " {\n" +
                    "    public static void main(String[] args) {\n" +
                    "        \n" +
                    "    }\n" +
                    "}\n";
            Files.writeString(filePath, content);
        } else {
            content = Files.readString(filePath);
        }
        
        fileRepository.save(new FileRecord(relativePath, content, false));

        FileNode node = new FileNode();
        node.setName(filePath.getFileName().toString());
        node.setPath(relativePath);
        node.setDirectory(false);
        node.setContent(content);
        return node;
    }

    public void deleteFile(String relativePath) throws IOException {
        Path filePath = resolvePath(relativePath);
        if (Files.isDirectory(filePath)) {
            // Delete physically recursively
            try (var stream = Files.walk(filePath)) {
                stream.sorted(Comparator.reverseOrder())
                      .forEach(p -> { try { Files.deleteIfExists(p); } catch (IOException e) {} });
            }
            // Delete from DB
            List<FileRecord> children = fileRepository.findByPathStartingWith(relativePath);
            fileRepository.deleteAll(children);
        } else {
            Files.deleteIfExists(filePath);
            fileRepository.deleteById(relativePath);
        }
    }

    public FileNode createDirectory(String relativePath) throws IOException {
        Path dirPath = resolvePath(relativePath);
        Files.createDirectories(dirPath);
        fileRepository.save(new FileRecord(relativePath, null, true));

        FileNode node = new FileNode();
        node.setName(dirPath.getFileName().toString());
        node.setPath(relativePath);
        node.setDirectory(true);
        return node;
    }

    public Path getProjectRoot() {
        return workspaceDir;
    }

    private Path resolvePath(String relativePath) {
        Path resolved = workspaceDir.resolve(relativePath).normalize();
        if (!resolved.startsWith(workspaceDir)) {
            throw new SecurityException("Path traversal detected: " + relativePath);
        }
        return resolved;
    }

    private String extractClassName(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(0, dot) : filename;
    }
}
