package com.ide.repository;

import com.ide.model.FileRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FileRecordRepository extends JpaRepository<FileRecord, String> {
    List<FileRecord> findByPathStartingWith(String prefix);
}
