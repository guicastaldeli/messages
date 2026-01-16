package com.app.main.root.app._service;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._db.DbManager;
import com.app.main.root.app._types.File;
import com.app.main.root.app.file_compressor.WrapperFileCompressor;
import com.app.main.root.app._cache.CacheService;
import com.app.main.root.app._crypto.file_encoder.FileEncoderWrapper;
import com.app.main.root.app._crypto.file_encoder.KeyManagerService;
import com.app.main.root.app._data.FileDownloader;
import com.app.main.root.app._data.FileUploader;
import com.app.main.root.app._data.MimeToDb;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Lazy;
import org.springframework.jdbc.core.JdbcTemplate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.sql.*;
import java.sql.Date;

@Service
public class FileService {
    private final Map<String, JdbcTemplate> jdbcTemplates;
    private final DbManager dbManager;
    private final ServiceManager serviceManager;
    private final CacheService cacheService;
    public FileEncoderWrapper fileEncoderWrapper;
    private KeyManagerService keyManagerService;
    private WrapperFileCompressor fileCompressor;

    private FileUploader fileUploader;
    private FileDownloader fileDownloader;

    public static final String METADATA_DB = "files_metadata";
    public static final String IMAGE_DB = "image_data";
    public static final String VIDEO_DB = "video_data";
    public static final String AUDIO_DB = "audio_data";
    public static final String DOCUMENT_DB = "document_data";

    private static final long COMPRESSION_MIN_SIZE = 1024 * 100;
    private static final long COMPRESSION_MAX_SIZE = 1024 * 1024 * 500;

    public FileService(
        Map<String, JdbcTemplate> jdbcTemplates,
        @Lazy ServiceManager serviceManager,
        @Lazy DbManager dbManager,
        CacheService cacheService
    ) {
        this.jdbcTemplates = jdbcTemplates;
        this.serviceManager = serviceManager;
        this.dbManager = dbManager;
        this.cacheService = cacheService;
        this.fileCompressor = new WrapperFileCompressor();
        this.fileEncoderWrapper = new FileEncoderWrapper();
        this.keyManagerService = new KeyManagerService(jdbcTemplates);
        this.fileUploader = new FileUploader(
            this, 
            jdbcTemplates, 
            serviceManager,
            fileEncoderWrapper, 
            keyManagerService
        );
        this.fileDownloader = new FileDownloader(
            this, 
            jdbcTemplates, 
            fileEncoderWrapper, 
            keyManagerService
        );
    }

    /**
     * Get Files By Chat Id
     */
    public List<File> getFilesByChatId(String userId, String chatId, int page, int pageSize) throws SQLException {
        try {
            JdbcTemplate metadataTemplate = jdbcTemplates.get(METADATA_DB);
            if(metadataTemplate == null) {
                throw new RuntimeException("files_metadata database not available");
            }
            
            String query = CommandQueryManager.GET_FILES.get();
            List<Map<String, Object>> rows = metadataTemplate.queryForList(
                query, 
                chatId, 
                pageSize, 
                page * pageSize
            );
            
            //System.out.println("Found " + rows.size() + " files for chat " + chatId);
            return convertToFileList(rows);
        } catch(Exception e) {
            System.err.println("Error getting files for chat " + chatId + ": " + e.getMessage());
            e.printStackTrace();
            return new ArrayList<>();
        }
    }

    public List<File> getFilesByChatId(String chatId, int page) {
        String defaultUserId = "unknown";
        int defaultPageSize = 20;
        return listFiles(defaultUserId, chatId, page, defaultPageSize);
    }

    /**
     * List Files
     */
    public List<File> listFiles(
        String userId,
        String chatId,
        int page,
        int pageSize
    ) {
        List<Map<String, Object>> cachedFiles = 
            cacheService
                .getFileCache()
                .getCachedFilesPage(
                    userId, 
                    chatId, 
                    page
                );
        if(cachedFiles != null) {
            return convertToFileList(cachedFiles);
        }

        JdbcTemplate metadataTemplate = jdbcTemplates.get(METADATA_DB);
        if(metadataTemplate == null) throw new RuntimeException("files_metadata database not available");

        String query = CommandQueryManager.GET_ALL_FILES.get();
        int offset = page * pageSize;
        
        List<Map<String, Object>> files = metadataTemplate.queryForList(
            query,
            userId,
            chatId,
            pageSize,
            offset
        );
        
        cacheService.getFileCache().cacheFilesPage(
            userId, 
            chatId, 
            page, 
            files
        );

        return convertToFileList(files);
    }

    /**
     * Get Storage Usage
     */
    public Map<String, Object> getStorageUsage(String userId) {
        JdbcTemplate metadataTemplate = jdbcTemplates.get(METADATA_DB);
        if(metadataTemplate == null) throw new RuntimeException("files_metadata database not available");

        Map<String, Object> usage = new HashMap<>();
        String totalSizeQuery = CommandQueryManager.GET_FILE_SIZE.get();
        Long totalSize = metadataTemplate.queryForObject(
            totalSizeQuery,
            Long.class,
            userId
        );

        String countQuery = CommandQueryManager.GET_TOTAL_FILES.get();
        Integer totalFiles = metadataTemplate.queryForObject(
            countQuery,
            Integer.class,
            userId
        );

        String typeQuery = CommandQueryManager.GET_TYPE_FILES.get();
        List<Map<String, Object>> types = metadataTemplate.queryForList(
            typeQuery,
            userId
        );

        usage.put("total_size", totalSize != null ? totalSize : 0);
        usage.put("total_files", totalFiles != null ? totalFiles : 0);
        usage.put("types", types);
        return usage;
    }

    /**
     * Delete File
     */
    public boolean deleteFile(String userId, String chatId, String fileId) {
        JdbcTemplate metadataTemplate = jdbcTemplates.get(METADATA_DB);
        if(metadataTemplate == null) throw new RuntimeException("files_metadata database not available");

        String getInfoQuery = CommandQueryManager.GET_FILE_INFO.get();
        try {
            keyManagerService.deleteKey(fileId, userId);
            
            List<Map<String, Object>> infoList = metadataTemplate.queryForList(
                getInfoQuery,
                fileId,
                userId
            );
            if(infoList.isEmpty()) {
                System.out.println("DEBUG: File not found - fileId: " + fileId + ", userId: " + userId);
                return false;
            }
            Map<String, Object> info = infoList.get(0);
            
            String deleteQuery = CommandQueryManager.DELETE_FILE.get();
            int rowsAffected = metadataTemplate.update(
                deleteQuery,
                fileId,
                userId
            );
            
            String parentchatId = (String) info.get("parent_folder_id");
            boolean res = rowsAffected > 0;
            if(res) {
                System.out.println("DEBUG: Cache invalidated for folder: " + parentchatId);
            }

            cacheService.getFileCache().invalidateFileCache(userId, chatId);
            return res;
        } catch(Exception err) {
            System.err.println("Error deleting file: " + err.getMessage());
            err.printStackTrace();
            return false;
        }
    }

    /**
     * Count Files
     */
    private int countFiles(String userId) {
        int total = 0;
        for(String dbName : jdbcTemplates.keySet()) {
            String query = CommandQueryManager.GET_TOTAL_FILES.get();
            Integer count = jdbcTemplates
                .get(dbName)
                .queryForObject(
                    query,
                    Integer.class,
                    userId
                );
            total += count != null ? count : 0;
        }
        return total;
    }

    /**
     * Get Database for Mime Type
     */
    public String getDatabaseForMimeType(String type) {
        return MimeToDb.List.getOrDefault(type, DOCUMENT_DB);
    }

    /* Get File Uploader */
    public FileUploader getFileUploader() {
        return fileUploader;
    }

    /* Get File Downloader */
    public FileDownloader getFileDownloader() {
        return fileDownloader;
    }

    /**
     * Find File Database
     */
    public String findFileDatabase(String userId, String chatId, String fileId) {
        JdbcTemplate metadataTemplate = jdbcTemplates.get(METADATA_DB);
        if(metadataTemplate == null) throw new RuntimeException("files_metadata database not available");

        String query = CommandQueryManager.GET_DB_NAME_FILES.get();
        try {
            String dbName = metadataTemplate.queryForObject(
                query,
                String.class,
                fileId,
                userId 
            );
            return dbName;
        } catch(Exception err) {
            System.out.println("Could not find database for file " + fileId + ": " + err.getMessage());
            return null;
        }
    }

    /**
     * Create Response
     */
    private Map<String, Object> createRes(
        List<Map<String, Object>> files,
        int page,
        int pageSize,
        String userId,
        String chatId,
        boolean fromCache
    ) {
        Map<String, Object> res = new HashMap<>();
        res.put("files", files);
        res.put("pagination", Map.of(
            "page", page,
            "pageSize", pageSize,
            "total", countTotalFiles(userId, chatId),
            "hasMore", hasMoreFiles(userId, chatId, page, pageSize),
            "fromCache", fromCache
        ));
        return res;
    }

    public String getCacheKey(String userId, String chatId, int page) {
        return chatId + "_page_" + page;
    }
    
    public int countTotalFiles(String userId, String chatId) {
        JdbcTemplate metadataTemplate = jdbcTemplates.get(METADATA_DB);
        if(metadataTemplate == null) return 0;

        String query = CommandQueryManager.GET_TOTAL_FILES_FOLDER.get();
        Integer count = metadataTemplate.queryForObject(
            query,
            Integer.class,
            userId,
            chatId
        );

        Integer res = count != null ? count : 0; 
        return res;
    }

    private boolean hasMoreFiles(
        String userId,
        String chatId,
        int currentPage,
        int pageSize
    ) {
        int totalFiles = countTotalFiles(userId, chatId);
        return ((currentPage + 1) * pageSize) < totalFiles;
    }

    public WrapperFileCompressor getFileCompressor() {
        return fileCompressor;
    }

    /**
     * Should Compress
     */
    public boolean shouldCompress(long fileSize, String mimeType) {
        if(mimeType != null && mimeType.toLowerCase().contains("video")) {
            System.out.println("DEBUG: Skipping compression for video file: " + mimeType);
            return false;
        }
        if(fileSize > 100 * 1024 * 1024) {
            System.out.println("DEBUG: File too large for compression: " + fileSize + " bytes");
            return false;
        }
        if(fileSize < COMPRESSION_MIN_SIZE || fileSize > COMPRESSION_MAX_SIZE) {
            return false;
        }

        String lowerMime = mimeType.toLowerCase();
        if(lowerMime.contains("zip") || 
            lowerMime.contains("rar") ||
            lowerMime.contains("gzip") ||
            lowerMime.contains("png") ||
            lowerMime.contains("jpg") ||
            lowerMime.contains("jpeg") ||
            lowerMime.contains("mp4") ||
            lowerMime.contains("mp3") ||
            lowerMime.contains("avi") ||
            lowerMime.contains("webp") ||
            lowerMime.contains("wmv") ||
            lowerMime.contains("flv") ||
            lowerMime.contains("mkv") ||
            lowerMime.contains("mpeg") ||
            lowerMime.contains("quicktime") ||
            lowerMime.contains("x-msvideo")
        ) {
            System.out.println("DEBUG: Skipping compression for already-compressed format: " + mimeType);
            return false;
        }
        
        return lowerMime.contains("text/") ||
            lowerMime.contains("json") ||
            lowerMime.contains("xml") ||
            lowerMime.contains("csv") ||
            lowerMime.contains("log") ||
            lowerMime.contains("plain") ||
            lowerMime.contains("html") ||
            lowerMime.contains("css") ||
            lowerMime.contains("javascript");
    }

    /**
     * Get Encrypted File Content
     */
    public byte[] getEncryptedFileContent(String fileId, String userId) {
        try {
            File fileInfo = getFileInfo(fileId, userId);
            if(fileInfo == null) {
                System.err.println("File info not found for: " + fileId);
                return null;
            }

            String dbName = findFileDatabase(userId, null, fileId);
            if(dbName == null) {
                System.err.println("Could not find database for file: " + fileId);
                return null;
            }

            JdbcTemplate dbTemplate = jdbcTemplates.get(dbName);
            if(dbTemplate == null) {
                System.err.println("Database template not found: " + dbName);
                return null;
            }

            String query = String.format(
                CommandQueryManager.GET_ENCRYPTED_FILE_CONTENT.get(),
                dbName
            );
            try {
                byte[] encryptedContent = dbTemplate.queryForObject(
                    query,
                    byte[].class,
                    fileId
                );
                if(encryptedContent == null) {
                    System.err.println("No encrypted content found for file: " + fileId);
                    return null;
                }
                return encryptedContent;
            } catch(Exception err) {
                System.err.println("Error retrieving encrypted content for file " + fileId + ": " + err.getMessage());
                return null;
            }
        } catch(Exception err) {
            System.err.println("Error in getEncryptedFileContent for file " + fileId + ": " + err.getMessage());
            err.printStackTrace();
            return null;
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for(byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }

    public File getFileInfo(String fileId, String userId) {
        JdbcTemplate metadataTemplate = jdbcTemplates.get(METADATA_DB);
        if(metadataTemplate == null) return null;

        String query = CommandQueryManager.GET_FILE_INFO.get();
        try {
            List<Map<String, Object>> rows = metadataTemplate.queryForList(
                query,
                fileId,
                userId
            );
            
            if(rows.isEmpty()) {
                return null;
            }
            
            return convertToFileList(rows).get(0);
        } catch(Exception err) {
            System.err.println("Error getting file info for " + fileId + ": " + err.getMessage());
            return null;
        }
    }

    private List<File> convertToFileList(List<Map<String, Object>> rows) {
        List<File> files = new ArrayList<>();
        for(Map<String, Object> row : rows) {
            File file = new File();
            
            file.setFileId((String) row.get("file_id"));
            file.setSenderId((String) row.get("user_id"));
            file.setOriginalFileName((String) row.get("original_filename"));
            file.setFileSize(convertToLong(row.get("file_size")));
            file.setMimeType((String) row.get("mime_type"));
            file.setFileType((String) row.get("file_type"));
            file.setChatId((String) row.get("chat_id"));
            convertToTimestamp(file, row.get("uploaded_at"));
            file.setLastModified(convertToLong(row.get("last_modified")));
            file.setIv((byte[]) row.get("iv"));
            file.setTag((byte[]) row.get("tag"));
            
            files.add(file);
        }
        return files;
    }

    private Timestamp convertToTimestamp(File file, Object obj) {
        Timestamp timestamp = null;
        
        if(obj instanceof Timestamp) {
            timestamp = (Timestamp) obj;
        } else if(obj instanceof Date) {
            Date sqlDate = (Date) obj;
            timestamp = new Timestamp(sqlDate.getTime());
        } else if(obj instanceof String) {
            try {
                timestamp = Timestamp.valueOf((String) obj);
            } catch(Exception e) {
                timestamp = new Timestamp(System.currentTimeMillis());
            }
        } else if(obj instanceof Long) {
            timestamp = new Timestamp((Long) obj);
        } else {
            timestamp = new Timestamp(System.currentTimeMillis());
        }
        
        file.setUploadedAt(timestamp);
        return timestamp;
    }

    private Long convertToLong(Object obj) {
        if(obj == null) return null;
        if(obj instanceof Long) return (Long) obj;
        if(obj instanceof Integer) return ((Integer) obj).longValue();
        if(obj instanceof Number) return ((Number) obj).longValue();
        if(obj instanceof String) {
            String str = (String) obj;
            try {
                return Long.parseLong(str);
            } catch(NumberFormatException e1) {
                try {
                    if(str.contains("T")) {
                        try {
                            LocalDateTime dateTime = LocalDateTime.parse(str);
                            return dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                        } catch(DateTimeParseException e2) {
                            str = str.substring(0, str.indexOf('.'));
                            LocalDateTime dateTime = LocalDateTime.parse(str);
                            return dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                        }
                    } else {
                        String pattern = "yyyy- dd HH:mm:ss";

                        try {
                            LocalDateTime dateTime = LocalDateTime.parse(str, DateTimeFormatter.ofPattern(pattern));
                            return dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                        } catch(DateTimeParseException e3) {
                            if(str.contains(".")) {
                                String[] parts = str.split("\\.");
                                String datePart = parts[0];
                                LocalDateTime dateTime = LocalDateTime.parse(datePart, DateTimeFormatter.ofPattern(pattern));
                                return dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                            }
                        }
                    }
                } catch(Exception err) {
                    System.err.println("Failed to parse timestamp string: " + str + " - " + err.getMessage());
                    return null;
                }
            }
        }

        return null;
    }

    public long extractTimestamp(File file) {
        Object uploadedAt = file.getUploadedAt();
        
        if(uploadedAt instanceof Timestamp) {
            return ((Timestamp) uploadedAt).getTime();
        } else if(uploadedAt instanceof Long) {
            return (Long) uploadedAt;
        } else if(uploadedAt instanceof String) {
            try {
                return Timestamp.valueOf((String) uploadedAt).getTime();
            } catch(Exception e1) {
                try {
                    LocalDateTime dateTime = LocalDateTime.parse(
                        (String) uploadedAt, 
                        DateTimeFormatter.ISO_LOCAL_DATE_TIME
                    );
                    return Timestamp.valueOf(dateTime).getTime();
                } catch(Exception e2) {
                    try {
                        return Long.parseLong((String) uploadedAt);
                    } catch(Exception e3) {
                        return System.currentTimeMillis();
                    }
                }
            }
        } else if(uploadedAt instanceof Integer) {
            return ((Integer) uploadedAt).longValue();
        } else if(uploadedAt instanceof Date) {
            return ((Date) uploadedAt).getTime();
        }
        
        return System.currentTimeMillis();
    }

}
