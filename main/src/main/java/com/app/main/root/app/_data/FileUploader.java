package com.app.main.root.app._data;
import com.app.main.root.app._crypto.file_encoder.FileEncoderWrapper;
import com.app.main.root.app._crypto.file_encoder.KeyManagerService;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._service.FileService;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.app.file_compressor.WithCompressionResult;
import com.app.main.root.app.file_compressor.WrapperFileCompressor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.io.InputStream;
import java.sql.Timestamp;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public class FileUploader {
    private final FileService fileService;
    private final Map<String, JdbcTemplate> jdbcTemplates;
    private final ServiceManager serviceManager;
    private final FileEncoderWrapper fileEncoderWrapper;
    private final KeyManagerService keyManagerService;

    private String fileId;
    private String fileName;
    private String senderId;
    private long size;
    private String mimeType;
    private String fileType;
    private String database;
    private Timestamp uploadedAt;
    private boolean compressed;

    public FileUploader(
        FileService fileService, 
        Map<String, JdbcTemplate> jdbcTemplates,
        ServiceManager serviceManager,
        FileEncoderWrapper fileEncoderWrapper,
        KeyManagerService keyManagerService
    ) {
        this.fileService = fileService;
        this.jdbcTemplates = jdbcTemplates;
        this.serviceManager = serviceManager;
        this.fileEncoderWrapper = fileEncoderWrapper;
        this.keyManagerService = keyManagerService;
    } 

    /**
     * Upload File
     */
    public FileUploader upload(
        String userId,
        MultipartFile file,
        String chatId
    ) throws SQLException {
        try {            
            if(fileEncoderWrapper == null) {
                throw new RuntimeException("fileEncoderWrapper is null!");
            }
            if(keyManagerService == null) {
                throw new RuntimeException("keyManagerService is null!");
            }

            String query = CommandQueryManager.UPLOAD_FILE.get();

            String fileId = generateFileId();
            String originalFileName = file.getOriginalFilename();
            String mimeType = file.getContentType();
            long fileSize = file.getSize();
            
            Instant now = Instant.now();
            Timestamp uploadedAt = Timestamp.from(now);
            
            String fileType = getFileType(mimeType);
            String targetDb = fileService.getDatabaseForMimeType(mimeType);

            System.out.println("DEBUG: Uploading file:");
            System.out.println("  fileId: " + fileId);
            System.out.println("  userId: " + userId);
            System.out.println("  originalFileName: " + originalFileName);
            System.out.println("  fileSize: " + fileSize);
            System.out.println("  mimeType: " + mimeType);
            System.out.println("  fileType: " + fileType);
            System.out.println("  targetDb: " + targetDb);
            System.out.println("  chatId: " + chatId);
            System.out.println("  uploadedAt: " + uploadedAt);
            
            JdbcTemplate metadataTemplate = jdbcTemplates.get("files_metadata");
                if(metadataTemplate == null) {
                System.err.println("ERROR: No files_metadata database configured");
                throw new SQLException("No files_metadata database configured");
            }
            JdbcTemplate jdbcTemplate = jdbcTemplates.get(targetDb);
            if(jdbcTemplate == null) {
                System.err.println("ERROR: No database configured for type: " + targetDb);
                throw new SQLException("No database configured for type: " + targetDb);
            }

            byte[] fileBytes = file.getBytes();
            int compressionType = 0;
            boolean shouldCompress = fileService.shouldCompress(fileSize, mimeType);
            if(shouldCompress) {
                try {
                    System.out.println("DEBUG: Starting compression...");
                    
                    if(fileSize > 50 * 1024 * 1024) {
                        System.out.println("DEBUG: Large file detected, using streaming compression");
                        
                        InputStream inputStream = file.getInputStream();
                        WithCompressionResult compressionResult = 
                            WrapperFileCompressor.compressStream(inputStream, fileSize, mimeType);
                        
                        fileBytes = compressionResult.getData();
                        compressionType = compressionResult.getCompressionType();
                        
                        long compressedSize = fileBytes.length;
                        double ratio = (double) compressedSize / fileSize;
                        
                        if(compressionType == 10 && ratio < 0.95) {
                            this.compressed = true;
                            System.out.println("  Using stream-compressed data");
                        } else {
                            this.compressed = false;
                            compressionType = 0;
                            System.out.println("  Streaming compression not beneficial");
                        }
                    } else {
                        System.out.println("DEBUG: Using normal compression");
                        fileBytes = file.getBytes();
                        WithCompressionResult compressionResult = 
                            WrapperFileCompressor.compress(fileBytes);
                        
                        byte[] compressedData = compressionResult.getData();
                        compressionType = compressionResult.getCompressionType();
                        
                        long compressedSize = compressedData.length;
                        double ratio = (double) compressedSize / fileSize;
                        
                        if(compressionType > 0 && ratio < 0.95) {
                            fileBytes = compressedData;
                            this.compressed = true;
                            System.out.println("  Using compressed data, type: " + compressionType);
                        } else {
                            this.compressed = false;
                            compressionType = 0;
                            System.out.println("  Compression not beneficial, using original");
                        }
                    }
                } catch(Exception e) {
                    System.err.println("WARNING: Compression failed: " + e.getMessage());
                    e.printStackTrace();
                    this.compressed = false;
                    compressionType = 0;
                    fileBytes = file.getBytes();
                }
            } else {
                fileBytes = file.getBytes();
                this.compressed = false;
                compressionType = 0;
            }

            byte[] encryptionKey = FileEncoderWrapper.generateKey(32);
            fileEncoderWrapper.initEncoder(encryptionKey, FileEncoderWrapper.EncryptionAlgorithm.AES_256_GCM);

            byte[] encryptedContent = fileEncoderWrapper.encrypt(fileBytes);
            insertFileContent(targetDb, fileId, encryptedContent, mimeType);
            
            byte[] iv = fileEncoderWrapper.generateIV();
            byte[] tag = fileEncoderWrapper.getTag();

            byte[] ivEncrypted = new byte[iv.length + encryptedContent.length];
            System.arraycopy(iv, 0, ivEncrypted, 0, iv.length);
            System.arraycopy(encryptedContent, 0, ivEncrypted, iv.length, encryptedContent.length);

            metadataTemplate.update(
                query,
                fileId,
                userId,
                originalFileName,
                fileSize,
                mimeType,
                fileType, 
                targetDb,
                chatId,
                uploadedAt,
                iv,
                tag
            );
            keyManagerService.storeKey(
                fileId, 
                userId, 
                encryptionKey
            );

            if(serviceManager.getCacheService() != null) {
                serviceManager.getCacheService().getFileCache().invalidateFileCache(userId, chatId);
            }
    
            FileUploader res = this;
            res.setFileId(fileId);
            res.setSenderId(userId);
            res.setFileName(originalFileName);
            res.setSize(fileSize);
            res.setMimeType(mimeType);
            res.setFileType(fileType);
            res.setDatabase(targetDb);
            res.setUploadedAt(uploadedAt);
            return res;
        } catch(IOException err) {
            err.printStackTrace();
            System.out.println(err);
            return null;
        }
    }

    /**
     * Insert File Content
     */
    private void insertFileContent(
        String dbType,
        String fileId,
        byte[] content,
        String mimeType
    ) {
        String query;
        switch(dbType) {
            case FileService.IMAGE_DB:
                query = CommandQueryManager.ADD_IMAGE.get();
                break;
            case FileService.VIDEO_DB:
                query = CommandQueryManager.ADD_VIDEO.get();
                break;
            case FileService.AUDIO_DB:
                query = CommandQueryManager.ADD_AUDIO.get();
                break;
            case FileService.DOCUMENT_DB:
                query = CommandQueryManager.ADD_DOCUMENT.get();
                break;
            default:
                query = CommandQueryManager.ADD_DOCUMENT.get();
        }

        jdbcTemplates.get(dbType).update(query, fileId, content);
    }

    /**
     * Get File Type
     */
    public String getFileType(String mimeType) {
        if(mimeType == null) {
            return "other";
        }

        String lowerMime = mimeType.toLowerCase();
        if(lowerMime.startsWith("image/")) {
            return "image";
        } else if(lowerMime.startsWith("video/")) {
            return "video";
        } else if(lowerMime.startsWith("audio/")) {
            return "audio";
        } else if(lowerMime.startsWith("text/")) {
            return "document";
        } else if(lowerMime.contains("pdf") || 
                lowerMime.contains("document") || 
                lowerMime.contains("msword") ||
                lowerMime.contains("officedocument")) {
            return "document";
        } else if(lowerMime.contains("zip") || 
                lowerMime.contains("rar") || 
                lowerMime.contains("compressed")) {
            return "document";
        } else {
            return "other";
        }
    }

    /**
     * Generate File Id
     */
    private String generateFileId() {
        String rand = UUID.randomUUID().toString();
        return rand;
    }

    /**
     * File Id
     */
    public void setFileId(String id) {
        this.fileId = id;
    }
    public String getFileId() {
        return fileId;
    }

    /**
     * File Name
     */
    public void setFileName(String name) {
        this.fileName = name;
    }
    public String getFileName() {
        return fileName;
    }

    /**
     * Sender Id
     */
    public void setSenderId(String senderId) {
        this.senderId = senderId;
    }
    public String getSenderId() {
        return senderId;
    }

    /**
     * Size
     */
    public void setSize(long size) {
        this.size = size;
    }
    public long getSize() {
        return size;
    }

    /**
     * Mime Type
     */
    public void setMimeType(String type) {
        this.mimeType = type;
    }
    public String getMimeType() {
        return mimeType;
    }

    /**
     * File Type
     */
    public void setFileType(String type) {
        this.fileType = type;
    }
    public String getFileType() {
        return fileType;
    }

    /**
     * Database
     */
    public void setDatabase(String db) {
        this.database = db;
    }
    public String getDatabase() {
        return database;
    }

    /**
     * Uploaded At
     */
    public void setUploadedAt(Timestamp date) {
        this.uploadedAt = date;
    }
    public Timestamp getUploadedAt() {
        return uploadedAt;
    }
}
