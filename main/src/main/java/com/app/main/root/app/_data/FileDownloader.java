package com.app.main.root.app._data;
import com.app.main.root.app._crypto.file_encoder.FileEncoderWrapper;
import com.app.main.root.app._crypto.file_encoder.KeyManagerService;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._service.FileService;
import com.app.main.root.app.file_compressor.WrapperFileCompressor;

import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;

public class FileDownloader {  
    private final FileService fileService;
    private final Map<String, JdbcTemplate> jdbcTemplates;
    private final FileEncoderWrapper fileEncoderWrapper;
    private final KeyManagerService keyManagerService;

    private String downloadUrl;

    public FileDownloader(
        FileService fileService, 
        Map<String, JdbcTemplate> jdbcTemplates,
        FileEncoderWrapper fileEncoderWrapper,
        KeyManagerService keyManagerService
    ) {
        this.fileService = fileService;
        this.jdbcTemplates = jdbcTemplates;
        this.fileEncoderWrapper = fileEncoderWrapper;
        this.keyManagerService = keyManagerService;
    }

    public void setDownloadUrl(String url) {
        this.downloadUrl = url;
    }
    public String getDownloadUrl() {
        return downloadUrl;
    }

    /**
     * Download File
     */
    public Map<String, Object> download(String userId, String fileId) {
        String query = CommandQueryManager.GET_FILE_INFO.get();
        System.out.println("DOWNLOADING WITH METADATA fileId: " + fileId + ", userId: " + userId);
        String metadataDb = FileService.METADATA_DB;
        
        try {
            List<Map<String, Object>> metadataTemplate = jdbcTemplates
                .get(metadataDb)
                .queryForList(
                    query,
                    fileId,
                    userId
                );

            if(!metadataTemplate.isEmpty()) {
                Map<String, Object> metadata = metadataTemplate.get(0);
                String originalFilename = (String) metadata.get("original_filename");
                String mimeType = (String) metadata.get("mime_type");
                String dbType = (String) metadata.get("database_name");
                Integer compressionType = (Integer) metadata.get("compression_type"); // Get compression type
                
                if(dbType == null || dbType.isEmpty()) {
                    dbType = fileService.getDatabaseForMimeType(mimeType);
                }
                
                if(compressionType == null) {
                    compressionType = 0;
                }
                
                String contentQuery = getContent(dbType);
                List<Map<String, Object>> contentRes = jdbcTemplates
                    .get(dbType)
                    .queryForList(contentQuery, fileId);

                if(!contentRes.isEmpty()) {
                    byte[] content = (byte[]) contentRes.get(0).get("content");

                    int ivLength = 12;
                    byte[] iv = Arrays.copyOfRange(content, 0, ivLength);
                    byte[] encryptedContent = Arrays.copyOfRange(content, ivLength, content.length);

                    byte[] encryptionKey = keyManagerService.retrieveKey(fileId, userId);
                    if(encryptionKey == null) throw new RuntimeException("Failed to retrieve encryption key for file: " + fileId);

                    fileEncoderWrapper.initEncoder(encryptionKey, FileEncoderWrapper.EncryptionAlgorithm.AES_256_GCM);
                    fileEncoderWrapper.setIV(iv);
                    byte[] decryptedContent = fileEncoderWrapper.decrypt(encryptedContent);

                    boolean isCompressed = false;
                    if(compressionType > 0) {
                        try {
                            System.out.println("DEBUG: Attempting decompression with type: " + compressionType);
                            byte[] decompressed = WrapperFileCompressor.decompressData(decryptedContent, compressionType);
                            
                            if(decompressed != null && decompressed.length > 0) {
                                decryptedContent = decompressed;
                                isCompressed = true;
                                System.out.println("File decompressed successfully from " + 
                                    encryptedContent.length + " to " + decompressed.length + " bytes");
                            } else {
                                System.out.println("WARNING: Decompression returned null or empty");
                            }
                        } catch(Exception e) {
                            System.out.println("WARNING: Decompression failed, using original: " + e.getMessage());
                            e.printStackTrace();
                        }
                    } else {
                        System.out.println("File was not compressed");
                    }

                    System.out.println("Download successful, size: " + decryptedContent.length + " bytes, compressed: " + isCompressed);
                    
                    Map<String, Object> res = new HashMap<>();
                    res.put("content", decryptedContent);
                    res.put("filename", originalFilename);
                    res.put("mimeType", mimeType);
                    res.put("fileSize", decryptedContent.length);
                    res.put("wasCompressed", isCompressed);
                    return res;
                } else {
                    throw new RuntimeException("File content not found in " + dbType);
                }
            } else {
                throw new RuntimeException("File not found for fileId: " + fileId + ", userId: " + userId);
            }
        } catch(Exception e) {
            System.err.println("Download error: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Download failed: " + e.getMessage());
        }
    }

    /**
     * Get Content
     */
    public String getContent(String dbType) {
        switch(dbType) {
            case FileService.IMAGE_DB:
                return CommandQueryManager.GET_IMAGE.get();
            case FileService.VIDEO_DB:
                return CommandQueryManager.GET_VIDEO.get();
            case FileService.AUDIO_DB:
                return CommandQueryManager.GET_AUDIO.get();
            case FileService.DOCUMENT_DB:
                return CommandQueryManager.GET_DOCUMENT.get();
            default:
                return CommandQueryManager.GET_DOCUMENT.get();
        }
    }
}
