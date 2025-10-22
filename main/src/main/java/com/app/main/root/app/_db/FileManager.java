package com.app.main.root.app._db;
import org.springframework.stereotype.Component;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.sql.Statement;
import java.sql.SQLException;
import java.util.List;

@Component
public class FileManager {
    private static final String BASE_PATH = "./src/main/java/com/app/main/root/app/_db/src/";
    private final List<String> tables = List.of(
        BASE_PATH + "user-service.sql",
        BASE_PATH + "group-service.sql",
        BASE_PATH + "group-members-service.sql",
        BASE_PATH + "message-service.sql",
        BASE_PATH + "invite-codes.sql",
        BASE_PATH + "system-messages.sql"
    );

    public void verify() {
        System.out.println("File Manager initialized...");
    }

    public void initDb(Statement stmt) throws SQLException, IOException {
        for(String file : tables) {
            execFile(stmt, file);
        }
    }

    private void execFile(Statement stmt, String file) throws SQLException, IOException {
        File f = new File(file);
        if(!f.exists()) throw new IOException("File not found: " + f.getAbsolutePath());
        String content = Files.readString(f.toPath());
        String[] statements = content.split(";");
        for(String sql : statements) {
            sql = sql.trim();
            if(!sql.isEmpty()) stmt.execute(sql);
        }
    }
}
