package com.app.main.root.app.__controllers;
import com.app.main.root.app._cache.CacheService;
import com.app.main.root.app._data.FileUploader;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.app._service.SessionService;
import com.app.main.root.app._types.File;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
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

    private String getAuthenticatedUserId(HttpServletRequest request) {
        String sessionId = serviceManager.getSessionService().extractSessionId(request);
        if(sessionId != null) {
            //System.out.println("DEBUG - Found sessionId: " + sessionId);
            
            if(serviceManager.getSessionService().validateSession(sessionId)) {
                SessionService.SessionData sessionData = serviceManager.getSessionService().getSession(sessionId);
                if(sessionData != null) {
                    String userId = sessionData.getUserId();
                   // System.out.println("DEBUG - Found userId from session data: " + userId);
                    return userId;
                }
            } else {
                System.out.println("DEBUG - Session is invalid or expired");
            }
        }
        
        HttpSession httpSession = request.getSession(false);
        if(httpSession != null) {
            String userId = (String) httpSession.getAttribute("userId");
            if(userId != null) {
                //System.out.println("DEBUG - Found userId from HTTP session: " + userId);
                return userId;
            }
        }
        
        String userIdFromCookies = extractUserIdFromCookies(request);
        if(userIdFromCookies != null) {
            //System.out.println("DEBUG - Found userId from cookies: " + userIdFromCookies);
            return userIdFromCookies;
        }
        
        //System.out.println("DEBUG - No userId found in session, HTTP session, or cookies");
        return null;
    }

    private String extractUserIdFromCookies(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if(cookies != null) {
            //System.out.println("DEBUG - Found " + cookies.length + " cookies");
            
            String[] cookieNames = {"USER_INFO", "userId", "user_id", "AUTH_USER"};
            
            for(Cookie cookie : cookies) {
                //System.out.println("DEBUG - Cookie: " + cookie.getName() + " = " + cookie.getValue());
                
                for(String cookieName : cookieNames) {
                    if(cookieName.equals(cookie.getName())) {
                        try {
                            String value = cookie.getValue();
                            
                            if(cookieName.equals("USER_INFO")) {
                                String[] parts = value.split(":");
                                if(parts.length >= 2) {
                                    String userId = parts[1];
                                    //System.out.println("DEBUG - Extracted userId from USER_INFO: " + userId);
                                    return userId;
                                }
                            } else {
                                System.out.println("DEBUG - Found direct userId in cookie: " + value);
                                return value;
                            }
                        } catch(Exception e) {
                            System.err.println("DEBUG - Error parsing cookie " + cookieName + ": " + e.getMessage());
                        }
                    }
                }
            }
        } else {
            System.out.println("DEBUG - No cookies found in request");
        }
        return null;
    }

    /**
     * Upload
     */
    @PostMapping("/upload/{userId}/{chatId}")
    public ResponseEntity<?> uploadFile(
        @RequestParam("file") MultipartFile file,
        @PathVariable String userId,
        @PathVariable String chatId,
        HttpServletRequest request
    ) {
        try {
            String authenticatedUserId = getAuthenticatedUserId(request);
            if(authenticatedUserId == null || !authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "success", false,
                        "error", "Unauthorized access",
                        "message", "You can only upload files for your own account"
                    ));
            }
            
            FileUploader res = serviceManager.getFileService()
                .getFileUploader().upload(
                    userId, 
                    file, 
                    chatId
                );

                cacheService.getFileCache().invalidateFileCache(userId, chatId);

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
    @GetMapping("/download/{userId}/{fileId}")
    public ResponseEntity<byte[]> downloadFile(
        @PathVariable String userId, 
        @PathVariable String fileId,
        HttpServletRequest request
    ) {
        try {
            String authenticatedUserId = getAuthenticatedUserId(request);
            if(authenticatedUserId == null || !authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            
            System.out.println("Starting download for fileId: " + fileId + ", userId: " + userId);
            
            Map<String, Object> data = serviceManager.getFileService()
                .getFileDownloader()
                .download(userId, fileId);

            byte[] content = (byte[]) data.get("content");
            String filename = (String) data.get("filename");
            String mimeType = (String) data.get("mimeType");
            
            if(content == null || content.length == 0) {
                System.err.println("ERROR: Downloaded content is null or empty for fileId: " + fileId);
                return ResponseEntity.notFound().build();
            }
            
            System.out.println("Content validated: " + content.length + " bytes");
            
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
            
            System.out.println("Sending file: " + filenameData + 
                            ", Content-Length: " + content.length + 
                            ", MIME: " + mimeType);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(mimeType));
            headers.setContentDisposition(ContentDisposition.parse(contentDisposition));
            headers.setContentLength(content.length);
            headers.setCacheControl(CacheControl.noCache().getHeaderValue());
            headers.set("Access-Control-Expose-Headers", "Content-Disposition, Content-Length");
            
            System.out.println("Response headers set, returning content");
            
            return new ResponseEntity<>(content, headers, HttpStatus.OK);
            
        } catch(Exception err) {
            System.err.println("Download error for fileId " + fileId + ": " + err.getMessage());
            err.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Delete File
     */
    @DeleteMapping("/delete/{userId}/{chatId}/{fileId}")
    public ResponseEntity<?> deleteFile(
        @PathVariable String userId,
        @PathVariable String chatId, 
        @PathVariable String fileId,
        HttpServletRequest request
    ) {
        try {
            String authenticatedUserId = getAuthenticatedUserId(request);
            if(authenticatedUserId == null || !authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "success", false,
                        "error", "Unauthorized access"
                    ));
            }
            
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
        @PathVariable String fileId,
        HttpServletRequest request
    ) {
        try {
            String authenticatedUserId = getAuthenticatedUserId(request);
            if(authenticatedUserId == null || !authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "success", false,
                        "error", "Unauthorized access"
                    ));
            }
            
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
     * List Files
     */
    @GetMapping("/list")
    public ResponseEntity<?> listFiles(
        @RequestParam String userId,
        @RequestParam String chatId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "5") int pageSize,
        HttpServletRequest request
    ) {
        try {
            String authenticatedUserId = getAuthenticatedUserId(request);
            if(authenticatedUserId == null || !authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "success", false,
                        "error", "Unauthorized access"
                    ));
            }

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
    public ResponseEntity<?> getStorageUsage(
        @PathVariable String userId,
        HttpServletRequest request
    ) {
        try {
            String authenticatedUserId = getAuthenticatedUserId(request);
            if(authenticatedUserId == null || !authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "success", false,
                        "error", "Unauthorized access"
                    ));
            }
            
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
        @RequestParam String chatId,
        HttpServletRequest request
    ) {
        try {
            String authenticatedUserId = getAuthenticatedUserId(request);
            if(authenticatedUserId == null || !authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "success", false,
                        "error", "Unauthorized access"
                    ));
            }
            
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
        @RequestParam(defaultValue = "5") int pageSize,
        HttpServletRequest request
    ) {
        try {
            String authenticatedUserId = getAuthenticatedUserId(request);
            if(authenticatedUserId == null || !authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "success", false,
                        "error", "Unauthorized access"
                    ));
            }
            
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
        @RequestParam(defaultValue = "0") int page,
        HttpServletRequest request
    ) {
        try {
            String authenticatedUserId = getAuthenticatedUserId(request);
            if(authenticatedUserId == null || !authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "success", false,
                        "error", "Unauthorized access"
                    ));
            }
            
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
        @RequestParam(defaultValue = "20") int pageSize,
        HttpServletRequest request
    ) {
        try {
            String authenticatedUserId = getAuthenticatedUserId(request);
            if(authenticatedUserId == null || !authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "success", false,
                        "error", "Unauthorized access"
                    ));
            }

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
    @GetMapping("/recent/{userId}/{chatId}/count")
    public ResponseEntity<?> getRecentFilesCount(
        @PathVariable String userId,
        @PathVariable String chatId,
        HttpServletRequest request
    ) {
        try {
            String authenticatedUserId = getAuthenticatedUserId(request);
            if(authenticatedUserId == null || !authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "success", false,
                        "error", "Unauthorized access"
                    ));
            }
            
            int totalFiles = serviceManager.getFileService().countTotalFiles(userId, chatId);
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