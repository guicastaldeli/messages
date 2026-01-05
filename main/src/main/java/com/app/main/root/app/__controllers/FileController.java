package com.app.main.root.app.__controllers;
import com.app.main.root.app._cache.CacheService;
import com.app.main.root.app._data.FileUploader;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.app._types.File;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.ResponseEntity;
import java.net.URLEncoder;
import java.util.*;

@RestController
@RequestMapping("/api/files")
public class FileController {
    private final ServiceManager serviceManager;
    private final CacheService cacheService;

    public FileController(@Lazy ServiceManager serviceManager, @Lazy CacheService cacheService) {
        this.serviceManager = serviceManager;
        this.cacheService = cacheService;
    }

    /**
     * Upload
     */
    @PostMapping("/upload/{userId}/{chatId}")
    public ResponseEntity<?> uploadFile(
        @RequestParam("file") MultipartFile file,
        @PathVariable String userId,
        @PathVariable String chatId
    ) {
        try {
            FileUploader res = serviceManager.getFileService()
                .getFileUploader().upload(
                    userId, 
                    file, 
                    chatId
                );

            return ResponseEntity.ok(Map.of(
                "success", true,
                "fileId", res.getFileId(),
                "filename", res.getFileName(),
                "senderId", res.getSenderId(),
                "size", res.getSize(),
                "mimeType", res.getMimeType(),
                "fileType", res.getFileType(),
                "database", res.getDatabase(),
                "uploadedAt", res.getUploadedAt(),
                "message", "File uploaded to " + res.getDatabase() 
            ));
        } catch(Exception err) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", err.getMessage()
            ));
        }
    }

    /**
     * Download
     */
    @GetMapping("/download/{userId}/{chatId}/{fileId}")
    public ResponseEntity<byte[]> downloadFile(@PathVariable String userId, @PathVariable String fileId) {
        try {
            Map<String, Object> data = serviceManager.getFileService()
                .getFileDownloader()
                .download(userId, fileId);

            byte[] content = (byte[]) data.get("content");
            String filename = (String) data.get("filename");
            String mimeType = (String) data.get("mimeType");
            String filenameData = filename != null && !filename.isEmpty()
                ? filename
                : fileId;

            String contentDisposition = "attachment; filename=\"" + filenameData + "\"";
            String regex = ".*[^\\x00-\\x7F].*";
            if(filenameData.matches(regex)) {
                contentDisposition = 
                    "attachment; filename=\"" + 
                    filenameData + "\"; " +            
                    "filename*=UTF-8''" + 
                    URLEncoder.encode(filenameData, "UTF-8").replace("+", "%20");
            }
            return ResponseEntity.ok()
                .header("Content-Type", mimeType)
                .header("Content-Disposition", contentDisposition)
                .header("Content-Length", String.valueOf(content.length))
                .header("Access-Control-Expose-Headers", "Content-Disposition, Content-Length")
                .body(content);
        } catch(Exception err) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Delete File
     */
    @DeleteMapping("/delete/{userId}/{chatId}/{fileId}")
    public ResponseEntity<?> deleteFile(
        @PathVariable String userId,
        @PathVariable String chatId, 
        @PathVariable String fileId
    ) {
        try {
            boolean deleted = serviceManager.getFileService().deleteFile(userId, chatId, fileId);
            return ResponseEntity.ok(Map.of(
                "success", deleted,
                "message", deleted ? "file deleted!" : "file not found"
            ));
        } catch(Exception err) {
            err.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", err.getMessage()
            ));
        }
    }

    /**
     * Info
     */
    @GetMapping("/info/{userId}/{chatId}/{fileId}")
    public ResponseEntity<?> getFileInfo( 
        @PathVariable String userId,
        @PathVariable String chatId,
        @PathVariable String fileId
    ) {
        try {
            String database = serviceManager.getFileService().findFileDatabase(userId, chatId, fileId);
            if(database != null) {
                return ResponseEntity.ok(Map.of(
                    "fileId", fileId,
                    "database", database,
                    "location", "Stored in " + database
                ));
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch(Exception err) {
            return ResponseEntity.status(500).body(Map.of(
                "error", err.getMessage()
            ));
        }
    }

    /**
     * List FIles
     */
    @GetMapping("/list")
    public ResponseEntity<?> listFiles(
        @RequestParam String userId,
        @RequestParam String chatId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "5") int pageSize
    ) {
        try {
            if(userId == null || userId.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "User Id is required!"
                ));
            }

            List<File> files = serviceManager.getFileService()
                .listFiles(
                    userId, 
                    chatId, 
                    page, 
                    pageSize
                );
            
            List<Map<String, Object>> fileMaps = new ArrayList<>();
            for(File file : files) {
                Map<String, Object> fileMap = new HashMap<>();
                fileMap.put("fileId", file.getFileId());
                fileMap.put("senderId", file.getSenderId());
                fileMap.put("originalFileName", file.getOriginalFileName());
                fileMap.put("fileSize", file.getFileSize());
                fileMap.put("mimeType", file.getMimeType());
                fileMap.put("fileType", file.getFileType());
                fileMap.put("chatId", file.getChatId());
                fileMap.put("uploadedAt", file.getUploadedAt());
                fileMap.put("lastModified", file.getLastModified());
                fileMaps.add(fileMap);
            }
            
            int totalFiles = serviceManager.getFileService().countTotalFiles(userId, chatId);
            Map<String, Object> pagination = new HashMap<>();
            pagination.put("currentPage", page);
            pagination.put("pageSize", pageSize);
            pagination.put("totalFiles", totalFiles);
            pagination.put("totalPages", (int) Math.ceil((double) totalFiles / pageSize));
            pagination.put("hasMore", (page + 1) * pageSize < totalFiles);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", fileMaps,
                "pagination", pagination
            ));
        } catch(Exception err) {
            err.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", err.getMessage()
            ));
        }
    }

    /**
     * Storage Usage
     */
    @GetMapping("/storage/{userId}")
    public ResponseEntity<?> getStorageUsage(@PathVariable String userId) {
        try {
            Map<String, Object> usage = serviceManager.getFileService().getStorageUsage(userId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", usage
            ));
        } catch(Exception err) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", err.getMessage()
            ));
        }
    }

    /**
     * Count Files
     */
    @GetMapping("/count")
    public ResponseEntity<?> countFiles(
        @RequestParam String userId,
        @RequestParam String chatId
    ) {
        try {
            int totalFiles = serviceManager.getFileService().countTotalFiles(userId, chatId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "total", totalFiles,
                "chatId", chatId
            ));
        } catch(Exception err) {
            return ResponseEntity.status(500).body(Map.of(
                "success", true,
                "error", err.getMessage()
            ));
        }
    }

    /**
     * Count Pages
     */
    @GetMapping("/count-pages")
    public ResponseEntity<?> countPages(
        @RequestParam String userId,
        @RequestParam String chatId,
        @RequestParam(defaultValue = "5") int pageSize
    ) {
        try {
            int totalFiles = serviceManager.getFileService().countTotalFiles(userId, chatId);
            int totalPages = (int) Math.ceil((double) totalFiles / pageSize);
            int currentPage = 0;

            return ResponseEntity.ok(Map.of(
                "success", true,
                "current", currentPage,
                "total", totalPages,
                "hasMore", totalPages > currentPage,
                "pageSize", pageSize
            ));
        } catch(Exception err) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", err.getMessage()
            ));
        }
    }

    /**
     * Get Cache Key
     */
    @GetMapping("/cache-key")
    public ResponseEntity<?> getCacheKey(
        @RequestParam String userId,
        @RequestParam String chatId,
        @RequestParam(defaultValue = "0") int page
    ) {
        try {
            String cacheKey = serviceManager.getFileService().getCacheKey(userId, chatId, page);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "cacheKey", cacheKey,
                "userId", userId,
                "chatId", chatId,
                "page", page
            ));
        } catch(Exception err) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", err.getMessage()
            ));
        }
    }

    /**
     * Get Recent Files
     */
    @GetMapping("/recent/{userId}")
    public ResponseEntity<?> getRecentFiles(
        @PathVariable String userId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        try {
            if(userId == null || userId.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "User Id is required!"
                ));
            }

            List<Map<String, Object>> allChats = serviceManager.getChatService().getChats(userId);
            List<Map<String, Object>> chatsWithFiles = new ArrayList<>();
            for(Map<String, Object> chat : allChats) {
                String chatId = (String) chat.get("id");
                int fileCount = serviceManager.getFileService().countTotalFiles(userId, chatId);
                if(fileCount > 0) {
                    Map<String, Object> chatInfo = new HashMap<>();
                    chatInfo.put("id", chatId);
                    chatInfo.put("chatId", chatId);
                    chatInfo.put("name", chat.get("name"));
                    chatInfo.put("type", chat.get("type"));
                    chatInfo.put("fileCount", fileCount);
                    chatInfo.put("lastMessageTime", chat.get("lastMessageTime"));
                    chatsWithFiles.add(chatInfo);
                }
            }
            
            int startIndex = page * pageSize;
            int endIndex = Math.min(startIndex + pageSize, chatsWithFiles.size());
            List<Map<String, Object>> paginatedChats = startIndex < chatsWithFiles.size() 
                ? chatsWithFiles.subList(startIndex, endIndex)
                : new ArrayList<>();
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "chats", paginatedChats,
                "currentPage", page,
                "pageSize", pageSize,
                "totalChats", chatsWithFiles.size(),
                "totalPages", Math.ceil((double) chatsWithFiles.size() / pageSize),
                "hasMore", endIndex < chatsWithFiles.size()
            ));
        } catch(Exception err) {
            err.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", err.getMessage()
            ));
        }
    }

    /**
     * Get Files Count
     */
    @GetMapping("/recent/{userId}/count")
    public ResponseEntity<?> getRecentFilesCount(@PathVariable String userId) {
        try {
            int totalFiles = serviceManager.getFileService().countTotalFiles(userId, "root");
            return ResponseEntity.ok(Map.of(
                "success", true,
                "count", totalFiles
            ));
        } catch(Exception err) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", err.getMessage()
            ));
        }
    }
}
