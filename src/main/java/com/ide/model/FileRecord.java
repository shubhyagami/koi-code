package com.ide.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Column;

@Entity
public class FileRecord {

    @Id
    private String path;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String content;

    private boolean isDirectory;

    public FileRecord() {}

    public FileRecord(String path, String content, boolean isDirectory) {
        this.path = path;
        this.content = content;
        this.isDirectory = isDirectory;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public boolean isDirectory() {
        return isDirectory;
    }

    public void setDirectory(boolean directory) {
        isDirectory = directory;
    }
}
