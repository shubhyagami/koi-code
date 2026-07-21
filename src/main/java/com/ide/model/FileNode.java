package com.ide.model;

import java.util.ArrayList;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonProperty;

public class FileNode {
    private String name;
    private String path;
    private boolean directory;
    private String content;
    private List<FileNode> children;

    public FileNode() {}

    public FileNode(String name, String path, boolean directory) {
        this.name = name;
        this.path = path;
        this.directory = directory;
        this.children = new ArrayList<>();
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }

    @JsonProperty("isDirectory")
    public boolean isDirectory() { return directory; }
    @JsonProperty("isDirectory")
    public void setDirectory(boolean directory) { this.directory = directory; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public List<FileNode> getChildren() { return children; }
    public void setChildren(List<FileNode> children) { this.children = children; }
}
