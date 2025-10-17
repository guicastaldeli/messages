package com.app.main.root.app._db;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.sql.Statement;
import java.sql.SQLException;
import java.util.List;

@Component
public class FileManager {
    private final List<String> tables = List.of(
        "./user-service.sql",
        "./group-service.sql",
        "./group-members-service.sql",
        "./message-service.sql"
    );

    public void initDb(Statement stmt) throws SQLException, IOException {
        for(String file : tables) {
            execFile(stmt, file);
        }
    }

    private void execFile(Statement stmt, String file) throws SQLException, IOException {
        ClassPathResource resource = new ClassPathResource(file);
        String content = new String(resource.getInputStream().readAllBytes());
        String[] statements = content.split(";");
        for(String sql : statements) {
            sql = sql.trim();
            if(!sql.isEmpty()) {
                stmt.execute(sql);
            }
        }
        System.out.println("Executed File: " + file);
    }
}
