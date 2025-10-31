package com.app.main.root.app._db;
import javax.sql.DataSource;
import org.sqlite.SQLiteDataSource;
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
    private static final String DATA_DIR = "./src/main/java/com/app/main/root/app/_db/data/";
    private static final String SQL_DIR = "./src/main/java/com/app/main/root/app/_db/src/";

    public void verify() {
        System.out.println("Database Manager initialized...");
    }

    /*
    * Init 
    */
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
            throw new RuntimeException("Failed to initialize databses", err);
        }

        return dataSources;
    }

    /*
    * Discover 
    */
    private Map<String, String> discoverSqlFiles() throws Exception {
        Map<String, String> sqlFiles = new HashMap<>();
        Path sqlPath = Paths.get(SQL_DIR);

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
                    System.out.println("Discovered Sql file: " + fileName + " -> DB: " + dbName);
                });
        }

        return sqlFiles;
    }

    /*
    * Create and Init 
    */
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
            System.out.println("Initializing database: " + dbName);
            try(
                Connection conn = dataSource.getConnection();
                Statement stmt = conn.createStatement();
            ) {
                String sqlContent = readSqlFile(sqlFileName);
                executeSqlStmt(stmt, sqlContent, dbName);
            } catch(Exception err) {
                throw new SQLException("Failed to init db: " + dbFileName, err);
            }
        } else {
            System.out.println("Using existing db: " + dbName);
        }

        return dataSource;
    }

    /*
    * Read Sql 
    */
    private String readSqlFile(String fileName) throws Exception {
        Path filePath = Paths.get(SQL_DIR + fileName);
        if(!Files.exists(filePath)) throw new Exception("SQL file not found: " + fileName);
        return Files.readString(filePath);
    }

    /*
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

    /*
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

    /*
    * Ensure Directory 
    */
    private void ensureDir() throws Exception {
        Files.createDirectories(Paths.get(DATA_DIR));
        Files.createDirectories(Paths.get(SQL_DIR));
    }
}
