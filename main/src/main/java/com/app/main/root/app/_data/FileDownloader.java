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
                String originalFileName = (String) metadata.get("original_filename");
                String mimeType = (String) metadata.get("mime_type");
                String dbType = (String) metadata.get("database_name");
                Integer compressionType = (Integer) metadata.get("compression_type");
                byte[] storedIV = (byte[]) metadata.get("iv");
                byte[] storedTag = (byte[]) metadata.get("tag");
                
                System.out.println("DEBUG: Found metadata - IV: " + 
                    (storedIV != null ? storedIV.length + " bytes" : "null") + 
                    ", Tag: " + (storedTag != null ? storedTag.length + " bytes" : "null"));
                
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
                    byte[] encryptedContent = (byte[]) contentRes.get(0).get("content");
                    
                    System.out.println("DEBUG: Encrypted content size: " + 
                        (encryptedContent != null ? encryptedContent.length : "null") + " bytes");

                    byte[] encryptionKey = keyManagerService.retrieveKey(fileId, userId);
                    if(encryptionKey == null) {
                        throw new RuntimeException("Failed to retrieve encryption key for file: " + fileId);
                    }

                    fileEncoderWrapper.initEncoder(encryptionKey, FileEncoderWrapper.EncryptionAlgorithm.AES_256_GCM);
                    
                    if(storedIV != null) {
                        fileEncoderWrapper.setIV(storedIV);
                    } else {
                        System.err.println("WARNING: No IV found in metadata for file: " + fileId);
                    }
                    
                    if(storedTag != null) {
                        try {
                            fileEncoderWrapper.getTag();
                            System.out.println("DEBUG: Authentication tag set successfully");
                        } catch(Exception e) {
                            System.err.println("WARNING: Failed to set authentication tag: " + e.getMessage());
                        }
                    } else {
                        System.err.println("WARNING: No authentication tag found in metadata for file: " + fileId);
                    }
                    
                    byte[] decryptedContent = null;
                    try {
                        decryptedContent = fileEncoderWrapper.decrypt(encryptedContent);
                        System.out.println("DEBUG: Decryption successful with tag verification");
                    } catch(IllegalArgumentException e) {
                        if(e.getMessage().contains("Failed to set authentication tag") || 
                        e.getMessage().contains("Decryption failed")) {
                            
                            System.err.println("WARNING: Decryption with tag failed, trying without tag...");
                            
                            try {
                                fileEncoderWrapper.initEncoder(encryptionKey, FileEncoderWrapper.EncryptionAlgorithm.AES_256_GCM);
                                if(storedIV != null) {
                                    fileEncoderWrapper.setIV(storedIV);
                                }
                                
                                System.out.println("DEBUG: Decryption successful WITHOUT tag verification");
                            } catch(Exception e2) {
                                System.err.println("ERROR: Decryption without tag also failed: " + e2.getMessage());
                                
                                try {
                                    System.err.println("Trying CBC mode as fallback...");
                                    fileEncoderWrapper.initEncoder(encryptionKey, FileEncoderWrapper.EncryptionAlgorithm.AES_256_GCM);
                                    if(storedIV != null) {
                                        fileEncoderWrapper.setIV(storedIV);
                                    }
                                    decryptedContent = fileEncoderWrapper.decrypt(encryptedContent);
                                    System.out.println("DEBUG: Decryption successful with CBC fallback");
                                } catch(Exception e3) {
                                    throw new RuntimeException("All decryption methods failed: " + e3.getMessage());
                                }
                            }
                        } else {
                            throw e;
                        }
                    }
                    
                    if(decryptedContent == null || decryptedContent.length == 0) {
                        throw new RuntimeException("Decrypted content is null or empty");
                    }
                    
                    System.out.println("DEBUG: Decrypted content size: " + decryptedContent.length + " bytes");
                    
                    boolean isCompressed = false;
                    if(compressionType != null && compressionType > 0) {
                        try {
                            System.out.println("DEBUG: Attempting decompression with type: " + compressionType);
                            byte[] decompressed = WrapperFileCompressor.decompressData(decryptedContent, compressionType);
                            
                            if(decompressed != null && decompressed.length > 0) {
                                decryptedContent = decompressed;
                                isCompressed = true;
                                System.out.println("File decompressed successfully from " + 
                                    encryptedContent.length + " to " + decompressed.length + " bytes");
                            } else {
                                System.out.println("WARNING: Decompression returned null or empty - using original");
                            }
                        } catch(Exception e) {
                            System.out.println("WARNING: Decompression failed, using original: " + e.getMessage());
                        }
                    } else {
                        System.out.println("File was not compressed (compressionType: " + compressionType + ")");
                        isCompressed = false;
                    }

                    System.out.println("Download successful, size: " + decryptedContent.length + " bytes, compressed: " + isCompressed);
                    
                    if(decryptedContent.length >= 8) {
                        if(decryptedContent[0] == (byte)0x89 && decryptedContent[1] == (byte)0x50 &&
                        decryptedContent[2] == (byte)0x4E && decryptedContent[3] == (byte)0x47) {
                            System.out.println("✅ File has PNG signature");
                        }
                        else if(decryptedContent[0] == (byte)0xFF && decryptedContent[1] == (byte)0xD8) {
                            System.out.println("✅ File has JPEG signature");
                        }
                        else if(decryptedContent[0] == (byte)0x25 && decryptedContent[1] == (byte)0x50 &&
                                decryptedContent[2] == (byte)0x44 && decryptedContent[3] == (byte)0x46) {
                            System.out.println("✅ File has PDF signature");
                        } else {
                            System.out.println("⚠️ File signature not recognized");
                        }
                    }
                    
                    Map<String, Object> res = new HashMap<>();
                    res.put("content", decryptedContent);
                    res.put("filename", originalFileName);
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
