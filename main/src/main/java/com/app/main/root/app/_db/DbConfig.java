package com.app.main.root.app._db;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.sqlite.SQLiteDataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import javax.sql.DataSource;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

@Configuration
public class DbConfig {
    private static final String DATA_DIR = "./src/main/java/com/app/main/root/app/_db/data/";
    private final String file = "db.db";

    @Bean
    public DataSource dataSource() {
        SQLiteDataSource dataSource = new SQLiteDataSource();

        try {
            cleanupCorruptedFiles();
            ensureDataDir();

            String dbPath = DATA_DIR + file;
            dataSource.setUrl("jdbc:sqlite:" + dbPath);
            initDb(dataSource);
        } catch(Exception err) {
            throw new RuntimeException("Failed to initalize database", err);
        }

        return dataSource;
    }

    @Bean
    public JdbcTemplate template(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    private void cleanupCorruptedFiles() throws Exception {
        File dataDir = new File(DATA_DIR);
        if(!dataDir.exists()) {
            dataDir.mkdirs();
            return;
        }

        File[] dbFiles = dataDir.listFiles((dir, name) -> name.endsWith(".db"));
        if(dbFiles != null) {
            for(File dbFile : dbFiles) {
                if(dbFile.length() == 0 || !isValidDatabase(dbFile)) {
                    System.out.println("REMOVING CORRUPTED FILE: " + dbFile.getPath());
                    Files.deleteIfExists(dbFile.toPath());
                }
            }
        }
    }

    private boolean isValidDatabase(File dbFile) {
        if(!dbFile.exists() || dbFile.length() == 0) return false;

        try(
            Connection conn = DriverManager.getConnection("jdbc:sqlite:" + dbFile.getPath());
            Statement stmt = conn.createStatement();
        ) {
            String query = CommandQueryManager.VALIDATE_DATABASE.get();
            stmt.execute(query);
            return true;
        } catch(SQLException err) {
            return false;
        }
    }

    private void ensureDataDir() throws Exception {
        Files.createDirectories(Paths.get(DATA_DIR));
    }

    private void initDb(DataSource dataSource) {
        try(
            Connection conn = dataSource.getConnection();
            Statement stmt = conn.createStatement();
        ) {            
            FileManager manager = new FileManager();
            manager.initDb(stmt);    
        } catch(SQLException err) {
            throw new RuntimeException("Failed to initialize database", err);
        } catch(IOException err) {
            throw new RuntimeException("Failed to read SQL files", err);
        }
    }
}