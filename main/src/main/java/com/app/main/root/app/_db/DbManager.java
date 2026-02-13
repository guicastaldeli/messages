package com.app.main.root.app._db;
import org.sqlite.SQLiteDataSource;
import javax.sql.DataSource;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.stream.Stream;
import java.util.*;

public class DbManager {
    private static final String DATA_DIR = getDataDir();
    private static final String SQL_DIR = getSqlDir();
    
    private static String getDataDir() {
        String dir = System.getenv("DB_DATA_DIR");
        if (dir == null || dir.isEmpty()) {
            dir = "./src/main/java/com/app/main/root/app/_db/data/";
        }
        return dir.endsWith("/") ? dir : dir + "/";
    }
    
    private static String getSqlDir() {
        String dir = System.getenv("DB_SQL_DIR");
        if (dir == null || dir.isEmpty()) {
            dir = "./src/main/java/com/app/main/root/app/_db/src/";
        }
        return dir.endsWith("/") ? dir : dir + "/";
    }

    public void verify() {
        System.out.println("Database Manager initialized...");
        System.out.println("DATA_DIR: " + DATA_DIR);
        System.out.println("SQL_DIR: " + SQL_DIR);
    }

    public Map<String, DataSource> initAllDatabases() {
        Map<String, DataSource> dataSources = new HashMap<>();

        try {
            ensureDir();
            Map<String, String> sqlFiles = discoverSqlFiles();

            for(Map.Entry<String, String> entry : sqlFiles.entrySet()) {
                String dbName = entry.getKey();
                String sqlFileName = entry.getValue();
                String dbFileName = dbName + ".db";
                SQLiteDataSource dataSource = createAndInitDb(
                    dbName,
                    dbFileName,
                    sqlFileName
                );
                dataSources.put(dbName, dataSource);
                System.out.println("Initialized: " + dbName + " -> " + dbFileName);
            }

            System.out.println("Total databases: " + dataSources.size());
        } catch(Exception err) {
            System.err.println("ERROR initializing databases: " + err.getMessage());
            err.printStackTrace();
            throw new RuntimeException("Failed to initialize databases", err);
        }

        return dataSources;
    }

    /**
     * Discover Files
     */
    private Map<String, String> discoverSqlFiles() throws Exception {
        Map<String, String> sqlFiles = new HashMap<>();
        Path sqlPath = Paths.get(SQL_DIR);

        System.out.println("Looking for SQL files in: " + sqlPath.toAbsolutePath());
        
        if(!Files.exists(sqlPath)) {
            Files.createDirectories(sqlPath);
            System.out.println("Created SQL directory: " + SQL_DIR);
            return sqlFiles;
        }
        
        try(Stream<Path> paths = Files.list(sqlPath)) {
            paths.filter(Files::isRegularFile)
                .filter(path -> path.toString().endsWith(".sql"))
                .forEach(path -> {
                    String fileName = path.getFileName().toString();
                    String dbName = fileName.replace(".sql", "").replace("-service", "");
                    sqlFiles.put(dbName, fileName);
                    System.out.println("Discovered SQL file: " + fileName + " -> DB: " + dbName);
                });
        }

        if (sqlFiles.isEmpty()) {
            System.err.println("WARNING: No SQL files found in " + sqlPath.toAbsolutePath());
        }

        return sqlFiles;
    }

    private SQLiteDataSource createAndInitDb(
        String dbName,
        String dbFileName,
        String sqlFileName
    ) throws SQLException {
        String dbPath = DATA_DIR + dbFileName;
        SQLiteDataSource dataSource = new SQLiteDataSource();
        dataSource.setUrl("jdbc:sqlite:" + dbPath);

        File dbFile = new File(dbPath);
        boolean shouldInit = !dbFile.exists() || dbFile.length() == 0 || !isValidDatabase(dbFile);
        if(shouldInit) {
            System.out.println("Initializing database: " + dbName + " at " + dbPath);
            try(
                Connection conn = dataSource.getConnection();
                Statement stmt = conn.createStatement();
            ) {
                String sqlContent = readSqlFile(sqlFileName);
                executeSqlStmt(stmt, sqlContent, dbName);
            } catch(Exception err) {
                System.err.println("Failed to initialize database: " + dbFileName);
                err.printStackTrace();
                throw new SQLException("Failed to init db: " + dbFileName, err);
            }
        } else {
            System.out.println("Using existing db: " + dbName + " at " + dbPath);
        }

        return dataSource;
    }

    /**
     * Read Sql
     */
    private String readSqlFile(String fileName) throws Exception {
        Path filePath = Paths.get(SQL_DIR + fileName);
        System.out.println("Reading SQL file: " + filePath.toAbsolutePath());
        if(!Files.exists(filePath)) {
            throw new Exception("SQL file not found: " + filePath.toAbsolutePath());
        }
        return Files.readString(filePath);
    }

    /**
     * Execute Statement
     */
    private void executeSqlStmt(
        Statement stmt,
        String sqlContent,
        String dbName
    ) throws SQLException {
        String[] statements = sqlContent.split(";");
        int successCount = 0;

        for(String statement : statements) {
            String trimmed = statement.trim();
            if(!trimmed.isEmpty()) {
                try {
                    stmt.execute(trimmed);
                    successCount++;
                } catch(SQLException err) {
                    if(!err.getMessage().contains("Already exists")) {
                        System.out.println("Error in " + dbName + ": " + err.getMessage());
                        throw err;
                    }
                }
            }
        }

        System.out.println(dbName + ": executed " + successCount + " statements");
    }

    /**
     * Validate
     */
    private boolean isValidDatabase(File dbFile) {
        if(!dbFile.exists() || dbFile.length() == 0) return false;

        try(
            Connection conn = DriverManager.getConnection("jdbc:sqlite:" + dbFile.getPath());
            Statement stmt = conn.createStatement();
        ) {
            String query = CommandQueryManager.VALIDATE_DATABASE.get();
            stmt.executeQuery(query);
            return true;
        } catch(SQLException err) {
            return false;
        }
    }

    private void ensureDir() throws Exception {
        Path dataPath = Paths.get(DATA_DIR);
        Path sqlPath = Paths.get(SQL_DIR);
        
        Files.createDirectories(dataPath);
        Files.createDirectories(sqlPath);
        
        System.out.println("Ensured directories exist:");
        System.out.println("  Data: " + dataPath.toAbsolutePath());
        System.out.println("  SQL: " + sqlPath.toAbsolutePath());
    }
}