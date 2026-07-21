package com.ide.controller;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/music")
public class MusicController {

    private final Path musicDir = Paths.get("D:/Program Files/java-ide/src/main/resources/Music");

    @GetMapping("/list")
    public ResponseEntity<List<String>> listMusic() {
        if (!Files.exists(musicDir) || !Files.isDirectory(musicDir)) {
            return ResponseEntity.ok(List.of());
        }

        try (var stream = Files.list(musicDir)) {
            List<String> files = stream
                    .filter(p -> !Files.isDirectory(p))
                    .map(p -> p.getFileName().toString())
                    .filter(name -> name.toLowerCase().endsWith(".mp3") || 
                                    name.toLowerCase().endsWith(".m4a") || 
                                    name.toLowerCase().endsWith(".wav"))
                    .sorted()
                    .collect(Collectors.toList());
            return ResponseEntity.ok(files);
        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/stream")
    public ResponseEntity<Resource> streamMusic(@RequestParam("file") String fileName) {
        if (fileName == null || fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            return ResponseEntity.badRequest().build();
        }

        Path filePath = musicDir.resolve(fileName);
        if (!Files.exists(filePath) || Files.isDirectory(filePath)) {
            return ResponseEntity.notFound().build();
        }

        Resource resource = new FileSystemResource(filePath.toFile());
        
        HttpHeaders headers = new HttpHeaders();
        // Determine content type based on extension
        String lowerName = fileName.toLowerCase();
        if (lowerName.endsWith(".mp3")) {
            headers.setContentType(MediaType.parseMediaType("audio/mpeg"));
        } else if (lowerName.endsWith(".m4a")) {
            headers.setContentType(MediaType.parseMediaType("audio/mp4"));
        } else if (lowerName.endsWith(".wav")) {
            headers.setContentType(MediaType.parseMediaType("audio/wav"));
        } else {
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        }
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(resource);
    }
}
