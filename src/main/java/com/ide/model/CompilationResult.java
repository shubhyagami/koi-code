package com.ide.model;

import java.util.ArrayList;
import java.util.List;

public class CompilationResult {
    private boolean success;
    private String output;
    private String errors;
    private String executionTime;
    private List<CompilationError> errorDetails;

    public CompilationResult() {
        this.errorDetails = new ArrayList<>();
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getOutput() { return output; }
    public void setOutput(String output) { this.output = output; }

    public String getErrors() { return errors; }
    public void setErrors(String errors) { this.errors = errors; }

    public String getExecutionTime() { return executionTime; }
    public void setExecutionTime(String executionTime) { this.executionTime = executionTime; }

    public List<CompilationError> getErrorDetails() { return errorDetails; }
    public void setErrorDetails(List<CompilationError> errorDetails) { this.errorDetails = errorDetails; }

    public static class CompilationError {
        private int line;
        private int column;
        private String message;
        private String type;

        public int getLine() { return line; }
        public void setLine(int line) { this.line = line; }

        public int getColumn() { return column; }
        public void setColumn(int column) { this.column = column; }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
    }
}
