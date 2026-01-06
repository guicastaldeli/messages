package com.app.main.root.app._data;
import com.app.main.root.app._server.MessageRouter;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.EnvConfig;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app._crypto.file_encoder.FileEncoderWrapper;
import com.app.main.root.app._crypto.file_encoder.KeyManagerService;
import com.app.main.root.app._crypto.message_encoder.SecureMessageService;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._server.ConnectionTracker;
import com.app.main.root.app._types.File;
import com.app.main.root.app._types.Message;
import com.app.main.root.app._types.User;
import com.app.main.root.app.main.chat.messages.MessageTracker;
import com.app.main.root.app._server.ConnectionInfo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import java.util.concurrent.ConcurrentHashMap;
import java.sql.Timestamp;
import java.util.*;

@Component
public class EventList {
    private final ServiceManager serviceManager;
    private final EventTracker eventTracker;
    private final ConnectionTracker connectionTracker;
    private final SocketMethods socketMethods;
    private final MessageTracker messageTracker;
    private final MessageRouter messageRouter;
    private final MessageAnalyzer messageAnalyzer;
    private final SimpMessagingTemplate messagingTemplate;
    @Autowired @Lazy private SecureMessageService secureMessageService;
    @Autowired @Lazy private KeyManagerService keyManagerService;

    private final Map<String, Long> activeDecryptionRequests = new ConcurrentHashMap<>();
    private final Object decryptionLock = new Object();

    public EventList(
        ServiceManager serviceManager,
        EventTracker eventTracker,
        SimpMessagingTemplate messagingTemplate,
        ConnectionTracker connectionTracker,
        SocketMethods socketMethods,
        MessageTracker messageTracker,
        MessageRouter messageRouter,
        MessageAnalyzer messageAnalyzer
    ) {
        this.eventTracker = eventTracker;
        this.serviceManager = serviceManager;
        this.messagingTemplate = messagingTemplate;
        this.connectionTracker = connectionTracker;
        this.socketMethods = socketMethods;
        this.messageTracker = messageTracker;
        this.messageRouter = messageRouter;
        this.messageAnalyzer = messageAnalyzer;
    }

    public Map<String, EventConfig> list() {
        Map<String, EventConfig> configs = new HashMap<>();

        /* Socket Id */
        configs.put("get-socket-id", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                long time = System.currentTimeMillis();

                eventTracker.track(
                    "get-socket-id",
                    payload,
                    EventDirection.RECEIVED,
                    sessionId,
                    sessionId
                );

                Map<String, Object> res = new HashMap<>();
                res.put("socketId", sessionId);
                res.put("timestamp", time);
                res.put("status", "success");
                return res;
            },
            "/queue/socket-id",
            false
        ));
        /* New User */
        configs.put("new-user", new EventConfig(
            (sessionId, payload, headerAccess) -> {
                long time = System.currentTimeMillis();
                Map<String, Object> data = (Map<String, Object>) payload;
                String username = (String) data.get("username");
                String userId = (String) data.get("userId");

                //System.out.print("USERID " + userId + " username" + username);
                eventTracker.track(
                    "new-user",
                    username,
                    EventDirection.RECEIVED,
                    sessionId,
                    username
                );
                connectionTracker.updateUsername(sessionId, userId, username);

                try {
                    serviceManager.getUserService().addUser(userId, username, sessionId);
                    ConnectionInfo connectionInfo = connectionTracker.getConnection(sessionId);
                    if(connectionInfo != null) connectionTracker.logUsernameSet(connectionInfo, username);
                    serviceManager.getUserService().linkUserSession(userId, sessionId);
                } catch(Exception err) {
                    System.out.println("Failed to add user: " + err.getMessage());
                }

                Map<String, Object> res = new HashMap<>();
                res.put("type", "USER_JOINED");
                res.put("userId", userId);
                res.put("username", username);
                res.put("sessionId", sessionId);
                res.put("timestamp", time);
                return res;
            },
            "/topic/user",
            true
        ));
        /* User Id */
        configs.put("get-user-id", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                long time = System.currentTimeMillis();
                String userId = serviceManager.getUserService().getUserIdBySession(sessionId);

                eventTracker.track(
                    "get-user-id",
                    payload,
                    EventDirection.RECEIVED,
                    sessionId,
                    sessionId
                );

                Map<String, Object> res = new HashMap<>();
                res.put("userId", userId);
                res.put("timestamp", time);
                res.put("status", "success");
                return res;
            },
            "/queue/user-id",
            false
        ));
        /* Get Username */
        configs.put("get-username", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                long time = System.currentTimeMillis();
                String username = serviceManager.getUserService().getUsernameBySessionId(sessionId);

                eventTracker.track(
                    "get-username",
                    payload,
                    EventDirection.RECEIVED,
                    sessionId,
                    sessionId
                );

                Map<String, Object> res = new HashMap<>();
                res.put("username", username);
                res.put("timestamp", time);
                res.put("status", "success");
                return res;
            },
            "/queue/username",
            false
        ));
        /* Send Contact Request */
        configs.put("send-contact-request", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String fromUserId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    String toUsername = (String) data.get("username");

                    Map<String, Object> res = serviceManager.getContactService()
                        .sendContactRequest(fromUserId, toUsername);

                    eventTracker.track(
                        "send-contact-request",
                        res,
                        EventDirection.RECEIVED,
                        sessionId,
                        fromUserId
                    );
                    return res;
                } catch(Exception err) {
                    Map<String, Object> error = new HashMap<>();
                    error.put("error", "CONTACT_REQUEST_FAILED");
                    error.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/contact-request-err", error);
                    return Collections.emptyMap();
                }
            },
            "/queue/contact-request-scss",
            false
        ));
        /* Response Contact Request */
        configs.put("response-contact-request", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String requestId = (String) data.get("requestId");
                    boolean accept = (Boolean) data.get("accept");
                    String userId = serviceManager.getUserService().getUserIdBySession(sessionId);

                    Map<String, Object> res = serviceManager.getContactService()
                        .responseContactRequest(requestId, userId, accept);

                    eventTracker.track(
                        "response-contact-request",
                        res,
                        EventDirection.RECEIVED,
                        sessionId,
                        userId
                    );

                    return res;
                } catch(Exception err) {
                    Map<String, Object> error = new HashMap<>();
                    error.put("error", "CONTACT_RESPONSE_FAILED");
                    error.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/contact-response-err", error);
                    return Collections.emptyMap();
                }
            },
            "/queue/contact-response-scss",
                false
        ));
        /* Get Contacts */
        configs.put("get-contacts", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    String userId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    List<Map<String, Object>> contacts = serviceManager.getContactService().getContacts(userId);

                    Map<String, Object> res = new HashMap<>();
                    res.put("contacts", contacts);
                    res.put("count", contacts.size());

                    eventTracker.track(
                        "get-contacts",
                        res,
                        EventDirection.RECEIVED,
                        sessionId,
                        userId
                    );

                    return res;
                } catch(Exception err) {
                    Map<String, Object> error = new HashMap<>();
                    error.put("error", "LOAD_CONTACTS_FAILED");
                    error.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/contacts-err", error);
                    return Collections.emptyMap();
                }
            },
            "/queue/contacts-scss",
            false
        ));
        /* Get Pending Contacts */
        configs.put("get-pending-requests", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    String userId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    List<Map<String, Object>> requests = serviceManager.getContactService()
                        .getPendingContactRequests(userId);

                    Map<String, Object> res = new HashMap<>();
                    res.put("requests", requests);
                    res.put("count", requests.size());

                    eventTracker.track(
                        "get-pending-requests",
                        res,
                        EventDirection.RECEIVED,
                        sessionId,
                        userId
                    );

                    return res;
                } catch(Exception err) {
                    Map<String, Object> error = new HashMap<>();
                    error.put("error", "LOAD_PENDING_REQUESTS_FAILED");
                    error.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/pending-requests-err", error);
                    return Collections.emptyMap();
                }
            },
            "/queue/pending-requests-scss",
            false
        ));
        /* Remove Contact */
        configs.put("remove-contact", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String userId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    String contactId = (String) data.get("contactId");
                    boolean success = serviceManager.getContactService().removeContact(userId, contactId);

                    Map<String, Object> res = new HashMap<>();
                    res.put("success", success);
                    res.put("contactId", contactId);

                    eventTracker.track(
                        "remove-contact",
                        res,
                        EventDirection.RECEIVED,
                        sessionId,
                        userId
                    );

                    return res;
                } catch(Exception err) {
                    Map<String, Object> error = new HashMap<>();
                    error.put("error", "REMOVE_CONTACT_FAILED");
                    error.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/remove-contact-err", error);
                    return Collections.emptyMap();
                }
            },
            "/queue/remove-contact-scss",
            false
        ));
        configs.put("stream-user-chats", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String userId = (String) data.get("userId");
                    int page = (int) data.getOrDefault("page", 0);
                    int pageSize = (int) data.getOrDefault("pageSize", 20);

                    List<Map<String, Object>> chats = 
                        serviceManager
                        .getChatService()
                        .getUserChats(userId, page, pageSize);

                    List<Map<String, Object>> allChats =
                        serviceManager
                        .getChatService()
                        .getChats(userId);
                    int totalCount = allChats.size();

                    for(Map<String, Object> chat : chats) {
                        Map<String, Object> chatEvent = new HashMap<>();
                        chatEvent.put("type", "CHAT_DATA");
                        chatEvent.put("chat", chat);
                        chatEvent.put("page", page);
                        chatEvent.put("total", totalCount);

                        socketMethods.send(sessionId, "/queue/user-chats-stream", chatEvent);
                    }

                    Map<String, Object> completionEvent = new HashMap<>();
                    completionEvent.put("type", "STREAM_COMPLETE");
                    completionEvent.put("userId", userId);
                    completionEvent.put("page", page);
                    completionEvent.put("total", totalCount);

                    return completionEvent;
                } catch(Exception err) {
                    Map<String, Object> errorEvent = new HashMap<>();
                    errorEvent.put("type", "STREAM_ERROR");
                    errorEvent.put("error", err.getMessage());
                    
                    socketMethods.send(sessionId, "/queue/user-chats-stream-err", errorEvent);
                    return Collections.emptyMap();
                }
            },
            "/queue/user-chats-stream",
            false
        ));
        /* Stream Chat Data  */
        configs.put("stream-chat-data", new EventConfig(
            (sessionId, payload, headerAcessor) -> {
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String chatId = (String) data.get("chatId");
                    String userId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    int page = (int) data.getOrDefault("page", 0);
                    int pageSize = (int) data.getOrDefault("pageSize", 20);
                    boolean includeFiles = (boolean) data.getOrDefault("includeFiles", false);
                    boolean includeMessages = (boolean) data.getOrDefault("includeMessages", true);

                    /* Messages */
                    if(includeMessages) {
                        List<Message> messages = 
                            serviceManager
                            .getMessageService()
                            .getMessagesByChatId(chatId, page, pageSize);

                        for(Message message : messages) {
                            Map<String, Object> messageEvent = new HashMap<>();
                            messageEvent.put("type", "MESSAGE_DATA");
                            messageEvent.put("chatId", chatId);
                            messageEvent.put("message", message);
                            messageEvent.put("page", page);
                            messageEvent.put("total", messages.size());

                            socketMethods.send(sessionId, "/queue/chat-data-stream", messageEvent);
                        }
                    }
                    /* Files */
                    if(includeFiles) {
                        List<File> files = 
                            serviceManager
                                .getFileService()
                                .getFilesByChatId(
                                    userId, 
                                    chatId, 
                                    page, 
                                    pageSize
                                );

                        for(File file : files) {
                            Map<String, Object> fileEvent = new HashMap<>();
                            fileEvent.put("type", "FILE_DATA");
                            fileEvent.put("chatId", chatId);
                            fileEvent.put("file", file);
                            fileEvent.put("page", page);
                            fileEvent.put("total", files.size());

                            socketMethods.send(sessionId, "/queue/chat-data-stream", fileEvent);
                        }
                    }

                    Map<String, Object> completionEvent = new HashMap<>();
                    completionEvent.put("type", "STREAM_COMPLETE");
                    completionEvent.put("chatId", chatId);
                    completionEvent.put("page", page);
                    return completionEvent;
                } catch(Exception err) {
                    Map<String, Object> errorEvent = new HashMap<>();
                    errorEvent.put("type", "STREAM_ERROR");
                    errorEvent.put("error", err.getMessage());
                    
                    socketMethods.send(sessionId, "/queue/chat-data-stream-err", errorEvent);
                    return Collections.emptyMap();
                }
            },
            "/queue/chat-data-stream",
            false
        ));
        /* Chat */
        configs.put("chat", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> payloadData = (Map<String, Object>) payload;
                    messageAnalyzer.organizeAndRoute(sessionId, payloadData);
                    eventTracker.track(
                        "chat",
                        payloadData,
                        EventDirection.RECEIVED,
                        sessionId,
                        "client"
                    );
                } catch(Exception err) {
                    eventTracker.track(
                        "chat-error",
                        Map.of("error", err.getMessage(), "payload", payload),
                        EventDirection.RECEIVED,
                        sessionId,
                        "client"
                    );
                }

                return Collections.emptyMap();
            },
            "/queue/messages",
            false
        ));
        /* File Message */
        configs.put("file", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> payloadData = (Map<String, Object>) payload;
                    String chatId = (String) payloadData.get("chatId");
                    String userId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    String username = (String) payloadData.get("username");
                    
                    eventTracker.track(
                        "FILE_MESSAGE",
                        payloadData,
                        EventDirection.RECEIVED,
                        sessionId,
                        userId
                    );

                    boolean isGroupChat = chatId != null && chatId.startsWith("group_");
                    boolean isDirectChat = chatId != null && chatId.startsWith("direct_");
                    
                    Map<String, Object> fileMessage = new HashMap<>();
                    fileMessage.put("chatId", chatId);
                    fileMessage.put("messageId", payloadData.get("messageId"));
                    fileMessage.put("userId", userId);
                    fileMessage.put("senderId", userId);
                    fileMessage.put("username", username);
                    fileMessage.put("content", payloadData.get("content"));
                    fileMessage.put("type", "file");
                    fileMessage.put("timestamp", System.currentTimeMillis());
                    fileMessage.put("fileData", payloadData.get("fileData"));
                    
                    Map<String, Object> routingMetadata = new HashMap<>();
                    routingMetadata.put("messageType", isGroupChat ? "FILE_MESSAGE" : "DIRECT_FILE_MESSAGE");
                    routingMetadata.put("type", "file");
                    routingMetadata.put("sessionId", sessionId);
                    routingMetadata.put("userId", userId);
                    routingMetadata.put("priority", "NORMAL");
                    routingMetadata.put("isDirect", isDirectChat);
                    routingMetadata.put("isGroup", isGroupChat);
                    fileMessage.put("routingMetadata", routingMetadata);
                    
                    if(isGroupChat) {
                        String destination = "/user/queue/messages/group/" + chatId;
                        List<User> groupMembers = serviceManager.getGroupService().getGroupMembers(chatId);
                        
                        for(User member : groupMembers) {
                            String memberSessionId = serviceManager.getUserService().getSessionByUserId(member.getId());
                            if(memberSessionId != null) {
                                socketMethods.send(memberSessionId, destination, fileMessage);
                            }
                        }
                    } else if(isDirectChat) {
                        String destination = "/user/queue/messages/direct/" + chatId;
                        socketMethods.send(sessionId, destination, fileMessage);
                        
                        String recipientId = (String) payloadData.get("targetUserId");
                        if(recipientId != null) {
                            String recipientSession = serviceManager.getUserService().getSessionByUserId(recipientId);
                            if(recipientSession != null) {
                                socketMethods.send(recipientSession, destination, fileMessage);
                            }
                        }
                    }
                    
                    return Collections.emptyMap();
                } catch(Exception err) {
                    err.printStackTrace();
                    eventTracker.track(
                        "FILE_MESSAGE_ERROR",
                        Map.of("error", err.getMessage(), "payload", payload),
                        EventDirection.RECEIVED,
                        sessionId,
                        "client"
                    );
                    
                    Map<String, Object> error = new HashMap<>();
                    error.put("error", "FILE_MESSAGE_FAILED");
                    error.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/file-message-err", error);
                    return Collections.emptyMap();
                }
            },
            "/queue/messages",
            false
        ));
        /* Get Decrypted Messages */
        configs.put("get-decrypted-messages", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    List<Map<String, Object>> encryptedMessages = (List<Map<String, Object>>) data.get("messages");
                    String chatId = (String) data.get("chatId");
                    List<Map<String, Object>> decryptedMessages = new ArrayList<>();
                    
                    for(Map<String, Object> encryptedMessage : encryptedMessages) {
                        Map<String, Object> decryptedMessage = new HashMap<>(encryptedMessage);
                        
                        if(encryptedMessage.containsKey("contentBytes")) {
                            Object contentBytesObj = encryptedMessage.get("contentBytes");
                            byte[] contentBytes;
                            
                            if(contentBytesObj instanceof String) {
                                String base64Content = (String) contentBytesObj;
                                contentBytes = Base64.getDecoder().decode(base64Content);
                            } else if(contentBytesObj instanceof byte[]) {
                                contentBytes = (byte[]) contentBytesObj;
                            } else {
                                throw new IllegalArgumentException("err");
                            }
                            
                            String decryptedContent = secureMessageService.decryptMessage(chatId, contentBytes);
                            decryptedMessage.put("content", decryptedContent);
                        }
                        
                        decryptedMessages.add(decryptedMessage);
                    }
                    
                    Map<String, Object> response = new HashMap<>();
                    response.put("messages", decryptedMessages);
                    return response;
                } catch(Exception err) {
                    err.printStackTrace();
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "LOAD_DECRYPTED_MESSAGES_FAILED");
                    errRes.put("message", err.getMessage() != null ? err.getMessage() : "Unknown error");
                    socketMethods.send(sessionId, "/queue/decrypted-messages-err", errRes);
                    return Collections.emptyMap();
                }
            },
            "/queue/decrypted-messages-scss",
            false
        ));
        /* Get Decrypted Files */
        configs.put("get-decrypted-files", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                synchronized (decryptionLock) {
                    Long requestTime = activeDecryptionRequests.get(sessionId);
                    if(requestTime != null) {
                        long currentTime = System.currentTimeMillis();
                        if(currentTime - requestTime < 30000) {
                            return Collections.emptyMap();
                        } else {
                            activeDecryptionRequests.remove(sessionId);
                        }
                    }
                    
                    activeDecryptionRequests.put(sessionId, System.currentTimeMillis());
                }
                
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    Object filesObj = data.get("files");
                    String chatId = (String) data.get("chatId");
                    String currentUserId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    List<Map<String, Object>> processedFiles = new ArrayList<>();
                    
                    List<Map<String, Object>> fileMaps = new ArrayList<>();
                    if(filesObj instanceof List) {
                        fileMaps = (List<Map<String, Object>>) filesObj;
                    } else if(filesObj instanceof Map) {
                        fileMaps.add((Map<String, Object>) filesObj);
                        System.out.println("Converted single file object to list");
                    } else {
                        System.err.println("Unexpected files type: " + (filesObj != null ? filesObj.getClass().getName() : "null"));
                        Map<String, Object> errRes = new HashMap<>();
                        errRes.put("error", "INVALID_FILES_FORMAT");
                        errRes.put("message", "Files must be an array or object");
                        errRes.put("success", false);
                        socketMethods.send(sessionId, "/queue/decrypted-files-err", errRes);
                        return Collections.emptyMap();
                    }
                    
                    int maxFilesPerRequest = 3;
                    if(fileMaps.size() > maxFilesPerRequest) {
                        System.out.println("Limiting files from " + fileMaps.size() + " to " + maxFilesPerRequest);
                        fileMaps = fileMaps.subList(0, maxFilesPerRequest);
                    }
                    
                    int processedCount = 0;
                    int totalFiles = fileMaps.size();
                    
                    System.out.println("Starting file decryption for " + totalFiles + " files for session " + sessionId);
                    
                    for(Map<String, Object> fileMap : fileMaps) {
                        try {
                            Map<String, Object> processedFile = new HashMap<>(fileMap);
                            
                            String fileId = (String) fileMap.get("fileId");
                            if(fileId == null) {
                                fileId = (String) fileMap.get("file_id");
                            }
                            if(fileId == null) {
                                fileId = (String) fileMap.get("id");
                            }
                            
                            String originalFileName = (String) fileMap.get("originalFileName");
                            if(originalFileName == null) {
                                originalFileName = (String) fileMap.get("original_file_name");
                            }
                            
                            Boolean isDecrypted = (Boolean) fileMap.get("isDecrypted");
                            if(isDecrypted != null && isDecrypted) {
                                processedFiles.add(processedFile);
                                processedCount++;
                                continue;
                            }
                            
                            if(originalFileName == null || originalFileName.isEmpty()) {
                                processedFile.put("decryptionError", "Missing original filename");
                                processedFiles.add(processedFile);
                                processedCount++;
                                continue;
                            }
                            
                            if(fileId == null) {
                                processedFile.put("decryptionError", "Missing file ID");
                                processedFiles.add(processedFile);
                                processedCount++;
                                continue;
                            }
                            
                            Runtime runtime = Runtime.getRuntime();
                            long usedMemory = runtime.totalMemory() - runtime.freeMemory();
                            long maxMemory = runtime.maxMemory();
                            double memoryUsage = (double) usedMemory / maxMemory;
                            
                            if(memoryUsage > 0.7) {
                                System.out.println("High memory usage (" + (memoryUsage * 100) + "%), skipping file: " + originalFileName);
                                processedFile.put("decryptionError", "Server memory limit exceeded");
                                processedFiles.add(processedFile);
                                processedCount++;
                                continue;
                            }
                            
                            byte[] encryptedBytes = serviceManager.getFileService().getEncryptedFileContent(fileId, currentUserId);
                            if(encryptedBytes == null || encryptedBytes.length == 0) {
                                processedFile.put("decryptionError", "No encrypted content found");
                                processedFiles.add(processedFile);
                                processedCount++;
                                continue;
                            }
                            
                            if(encryptedBytes.length > 1024 * 1024) {
                                System.out.println("File too large: " + originalFileName + " (" + (encryptedBytes.length / 1024 / 1024) + "MB)");
                                processedFile.put("decryptionError", "File too large for decryption: " + (encryptedBytes.length / 1024 / 1024) + "MB");
                                processedFiles.add(processedFile);
                                processedCount++;
                                continue;
                            }
                            
                            byte[] encryptionKey = keyManagerService.retrieveKey(fileId, currentUserId);
                            if(encryptionKey == null) {
                                processedFile.put("decryptionError", "Encryption key not found");
                                processedFiles.add(processedFile);
                                processedCount++;
                                continue;
                            }
                            
                            FileEncoderWrapper fileEncoder = new FileEncoderWrapper();
                            try {
                                fileEncoder.initEncoder(encryptionKey, FileEncoderWrapper.EncryptionAlgorithm.AES_256_GCM);
                                
                                if(encryptedBytes.length < 28) {
                                    processedFile.put("decryptionError", "Encrypted data too small");
                                    processedFiles.add(processedFile);
                                    processedCount++;
                                    continue;
                                }
                                
                                byte[] decryptedBytes = fileEncoder.decrypt(encryptedBytes);
                                if(decryptedBytes == null) {
                                    processedFile.put("decryptionError", "Decryption returned null");
                                    processedFiles.add(processedFile);
                                    processedCount++;
                                    continue;
                                }
                                
                                processedFile.put("content", decryptedBytes);
                                processedFile.put("isDecrypted", true);
                                processedFile.put("decryptedSize", decryptedBytes.length);
                                System.out.println("Successfully decrypted file: " + originalFileName + " (" + decryptedBytes.length + " bytes)");
                            } finally {
                                fileEncoder.cleanup();
                            }
                            
                            processedFiles.add(processedFile);
                            processedCount++;
                            
                            System.gc();
                            Thread.sleep(1000);
                        } catch (Exception fileErr) {
                            System.err.println("Error decrypting file: " + fileErr.getMessage());
                            fileErr.printStackTrace();
                            Map<String, Object> errorFile = new HashMap<>(fileMap);
                            errorFile.put("decryptionError", fileErr.getMessage());
                            errorFile.put("isDecrypted", false);
                            processedFiles.add(errorFile);
                            processedCount++;
                        }
                    }
                    
                    Map<String, Object> response = new HashMap<>();
                    response.put("files", processedFiles);
                    response.put("count", processedFiles.size());
                    response.put("success", true);
                    response.put("processedCount", processedCount);
                    response.put("totalFiles", totalFiles);
                    response.put("limited", fileMaps.size() < totalFiles);
                    
                    System.out.println("File decryption completed for session " + sessionId + ": " + processedCount + "/" + totalFiles + " files processed");
                    
                    eventTracker.track(
                        "get-decrypted-files",
                        Map.of("count", processedFiles.size(), "chatId", chatId, "processedCount", processedCount),
                        EventDirection.SENT,
                        sessionId,
                        "system"
                    );
                    
                    return response;
                } catch (Exception err) {
                    err.printStackTrace();
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "LOAD_DECRYPTED_FILES_FAILED");
                    errRes.put("message", err.getMessage() != null ? err.getMessage() : "Unknown error");
                    errRes.put("success", false);
                    
                    eventTracker.track(
                        "get-decrypted-files-error",
                        Map.of("error", err.getMessage(), "payload", payload),
                        EventDirection.SENT,
                        sessionId,
                        "system"
                    );
                    
                    socketMethods.send(sessionId, "/queue/decrypted-files-err", errRes);
                    return Collections.emptyMap();
                } finally {
                    synchronized (decryptionLock) {
                        activeDecryptionRequests.remove(sessionId);
                    }
                }
            },
            "/queue/decrypted-files-scss",
            false
        ));
        configs.put("direct", new EventConfig(
            (sessionId, payload, headerAcessor) -> {
                try {
                    Map<String, Object> payloadData = (Map<String, Object>) payload;
                    messageAnalyzer.organizeAndRoute(sessionId, payloadData);
                    eventTracker.track(
                        "DIRECT_MESSAGE",
                        payloadData,
                        EventDirection.RECEIVED,
                        sessionId,
                        "client"
                    );
                    String chatId = (String) payloadData.get("chatId");
                    String recipientId = (String) payloadData.get("recipientId");
                    String currentUserId = serviceManager.getUserService().getUserIdBySession(sessionId);

                    String routeType = messageAnalyzer.extractRouteType(sessionId, payloadData);
                    if(chatId != null && chatId.startsWith("direct_")) {
                        String destination = "/user/queue/messages/direct/" + chatId;
                        Object data = serviceManager.getMessageService().payload(
                            routeType, 
                            payloadData, 
                            chatId, 
                            sessionId, 
                            currentUserId
                        );
                        socketMethods.send(sessionId, destination, data);

                        String recipientSession = serviceManager.getUserService().getSessionByUserId(recipientId);
                        if(recipientSession != null) {
                            Object recipientData = serviceManager.getMessageService().payload(
                                routeType, 
                                payloadData, 
                                chatId, 
                                sessionId, 
                                currentUserId
                            );
                            socketMethods.send(recipientSession, destination, recipientData);
                        }
                    }

                    return Collections.emptyMap();
                } catch(Exception err) {
                    eventTracker.track(
                        "DIRECT_MESSAGE_ERR",
                        Map.of("error", err.getMessage(), "payload", payload),
                        EventDirection.RECEIVED,
                        sessionId,
                        "client"
                    );
                }

                return Collections.emptyMap();
            },
            "",
            false
        ));
        configs.put("get-direct-chat-id", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String currentUserId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    String contactId = (String) data.get("contactId");

                    Map<String, Object> res = serviceManager.getDirectService()
                        .getChatId(currentUserId, contactId);
                        
                    eventTracker.track(
                        "get-direct-chat-id",
                        res,
                        EventDirection.RECEIVED,
                        sessionId,
                        currentUserId
                    );

                    return res;
                } catch(Exception err) {
                    err.getStackTrace();
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "CHAT_ID_GENERATION_FAILED");
                    errRes.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/direct-chat-id-err", errRes);
                    return Collections.emptyMap();
                }
            },
            "/queue/direct-chat-id-scss",
            false
        ));
        configs.put("group", new EventConfig(
            (sessionId, payload, headerAcessor) -> {
                try {
                    Map<String, Object> payloadData = (Map<String, Object>) payload;
                    messageAnalyzer.organizeAndRoute(sessionId, payloadData);
                    eventTracker.track(
                        "GROUP_MESSAGE",
                        payloadData,
                        EventDirection.RECEIVED,
                        sessionId,
                        "client"
                    );
                    String chatId = (String) payloadData.get("chatId");
                    String groupId = (String) payloadData.get("groupId");
                    String actualGroupId = chatId != null ? chatId : groupId;
                    String currentUserId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    String routeType = messageAnalyzer.extractRouteType(sessionId, payloadData);
                    Map<String, Object> messageWithPerspective = messageAnalyzer.applyPerspective(sessionId, payloadData);

                    if(actualGroupId != null && actualGroupId.startsWith("group_")) {
                        String destination = "/user/queue/messages/group/" + actualGroupId;
                        Object data = serviceManager.getMessageService().payload(
                            routeType, 
                            messageWithPerspective, 
                            actualGroupId, 
                            sessionId,
                            currentUserId
                        );
                        socketMethods.send(sessionId, destination, data);
                    }
                } catch(Exception err) {
                    eventTracker.track(
                        "GROUP_MESSAGE_ERR",
                        Map.of("error", err.getMessage(), "payload", payload),
                        EventDirection.RECEIVED,
                        sessionId,
                        "client"
                    );
                }

                return Collections.emptyMap();
            },
            "",
            false
        ));
        /* Create Group */
        configs.put("create-group", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> groupData = serviceManager.getGroupService().parseData(payload);
                    String format = UUID.randomUUID().toString().substring(0, 7);
                    String id = "group_" + System.currentTimeMillis() + "_" + format;
                    String creator = (String) groupData.get("creator");
                    String creatorId = (String) groupData.get("creatorId");
                    String groupName = (String) groupData.get("groupName");

                    Map<String, Object> creationResult = serviceManager.getGroupService()
                        .createGroup(id, groupName, creatorId, creator, sessionId);

                    Object createdAtObj = creationResult.get("createdAt");
                    long creationTime;
                    if(createdAtObj instanceof Timestamp) {
                        creationTime = ((Timestamp) createdAtObj).getTime();
                    } else if(createdAtObj instanceof Long) {
                        creationTime = (Long) createdAtObj;
                    } else {
                        creationTime = System.currentTimeMillis();
                    }

                    Map<String, Object> newGroup = new HashMap<>();
                    newGroup.put("id", id);
                    newGroup.put("chatId", id);
                    newGroup.put("groupId", id);
                    newGroup.put("name", groupName);
                    newGroup.put("creator", creator);
                    newGroup.put("creatorId", creatorId);
                    newGroup.put("members", creationResult.get("members"));
                    newGroup.put("createdAt", creationResult.get("createdAt"));
                    newGroup.put("sessionId", sessionId);
                    newGroup.put("verificationResult", creationResult.get("verificationStatus"));

                    eventTracker.track(
                        "create-group", 
                        newGroup, 
                        EventDirection.RECEIVED, 
                        sessionId, 
                        creator
                    );
                    serviceManager.getUserService().sendMessageToUser(
                        sessionId,
                        "group-creation-scss",
                        newGroup
                    );
                    
                    Map<String, Object> systemMessageData = new HashMap<>();
                    systemMessageData.put("groupName", groupName);
                    systemMessageData.put("creator", creator);
                    systemMessageData.put("creatorId", creatorId);
                    systemMessageData.put("groupId", id);
                    systemMessageData.put("timestamp", creationTime);
                    
                    serviceManager.getSystemMessageService().createAndSaveMessage(
                        "GROUP_CREATED", 
                        systemMessageData, 
                        sessionId, 
                        sessionId,
                        id
                    );
                    
                    return Collections.emptyMap();
                } catch(Exception err) {
                    serviceManager.getUserService().sendMessageToUser(sessionId, "group-creation-err", err.getMessage());
                    return Collections.emptyMap();
                }
            },
            "/user/queue/group-creation-scss",
            false
        ));
        /* Join Group */
        configs.put("join-group", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    long time = System.currentTimeMillis();
                    Map<String, Object> data = serviceManager.getGroupService().parseData(payload);
                    String userId = (String) data.get("userId");
                    String inviteCode = (String) data.get("inviteCode");
                    String username = (String) data.get("username");

                    String groupId = serviceManager.getGroupService().getInviteCodes().findGroupByCode(inviteCode);
                    Map<String, Object> groupInfo = serviceManager.getGroupService().getGroupInfo(groupId);
                    List<User> groupMembers = serviceManager.getGroupService().getGroupMembers(groupId);
                    
                    if(groupId == null) throw new Exception("Group Id is required!");
                    if(userId == null) throw new Exception("User Id is required!");
                    if(username == null || username.trim().isEmpty()) throw new Exception("Username is required!");

                    boolean isValid = serviceManager.getGroupService().getInviteCodes().validateInviteCode(inviteCode);
                    if(!isValid) throw new Exception("Invalid invite code");

                    boolean success = serviceManager.getGroupService().addUserToGroup(groupId, userId, username);
                    if(!success) throw new Exception("Failed to join group :(");
                    serviceManager.getGroupService().addUserToGroupMapping(userId, groupId, sessionId);

                    eventTracker.track(
                        "join-group",
                        data,
                        EventDirection.RECEIVED,
                        sessionId,
                        userId
                    );

                    /* Event Response */
                    Map<String, Object> res = new HashMap<>();
                    res.put("id", groupId);
                    res.put("name", groupInfo.get("name"));
                    res.put("userId", userId);
                    res.put("joined", true);
                    res.put("timestamp", time);
                    res.put("members", groupInfo.get("members"));
                    res.put("sessionId", sessionId);
                    serviceManager.getUserService().sendMessageToUser(sessionId, "join-group-scss", res);

                    /* System Message */
                    for(User member : groupMembers) {
                        String memberSessionId = serviceManager.getUserService().getSessionByUserId(member.getId());
                        if(memberSessionId != null) {
                            Map<String, Object> systemMessageData = new HashMap<>(data);
                            systemMessageData.put("timestamp", time);
                            
                            Map<String, Object> systemMessage = serviceManager.getSystemMessageService().createAndSaveMessage(
                                "USER_JOINED_GROUP", 
                                systemMessageData, 
                                sessionId, 
                                memberSessionId,
                                groupId
                            );
                            systemMessage.put("groupId", groupId);
                            systemMessage.put("chatId", groupId);
                            systemMessage.put("chatType", "GROUP");
                            systemMessage.put("timestamp", time);

                            data.put("userId", userId);
                            data.put("username", username);
                            data.put("targetSessionid", memberSessionId);
                            data.put("isAboutCurrentUser", memberSessionId.equals(sessionId));
                            
                            String destination = "/user/queue/messages/group/" + groupId;
                            socketMethods.send(sessionId, destination, systemMessage);
                            messageRouter.routeMessage(sessionId, payload, systemMessage, new String[]{"GROUP"});
                        }
                    }
                    return Collections.emptyMap();
                } catch(Exception err) {
                    err.printStackTrace();
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "JOIN_FAILED");
                    errRes.put("message", err.getMessage());
                    serviceManager.getUserService().sendMessageToUser(sessionId, "join-group-err", errRes);
                    return Collections.emptyMap();
                }
            },
            "/user/queue/join-group-scss",
            false
        ));
        /* Exit User */
        configs.put("exit-group", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    System.out.println("DEBUG - Exit Group Request received:");
                    System.out.println("  Session ID: " + sessionId);
                    System.out.println("  Payload: " + payload);
                    
                    long time = System.currentTimeMillis();
                    Map<String, Object> data = serviceManager.getGroupService().parseData(payload);
                    
                    String userId = (String) data.get("userId");
                    if(userId == null || userId.trim().isEmpty()) {
                        userId = serviceManager.getUserService().getUserIdBySession(sessionId);
                        System.out.println("  WARNING: Using userId from session lookup: " + userId);
                    }
                    
                    String username = (String) data.get("username");
                    String groupId = (String) data.get("groupId");
                    String groupName = (String) data.get("groupName");

                    if(userId == null) {
                        throw new Exception("User ID is required!");
                    }
                    if(groupId == null) {
                        throw new Exception("Group ID is required!");
                    }

                    boolean isMember = serviceManager.getGroupService().isUserGroupMember(groupId, userId);
                    if(!isMember) {
                        System.out.println("User is not a member of the group, but proceeding...");
                    }
                    
                    boolean success = serviceManager.getGroupService().removeUserFromGroup(groupId, userId);
                    if(!success) {
                        System.out.println("removeUserFromGroup returned false");
                        throw new Exception("Failed to exit group");
                    }

                    serviceManager.getGroupService().removeUserFromGroupMapping(userId, groupId);
                    List<User> groupMembers = serviceManager.getGroupService().getGroupMembers(groupId);
                    
                    eventTracker.track(
                        "exit-group", 
                        data, 
                        EventDirection.RECEIVED, 
                        sessionId, 
                        username
                    );

                    /* Event Response */
                    Map<String, Object> res = new HashMap<>();
                    res.put("id", groupId);
                    res.put("name", groupName);
                    res.put("userId", userId);
                    res.put("joined", false);
                    res.put("timestamp", time);
                    res.put("sessionId", sessionId);
                    serviceManager.getUserService().sendMessageToUser(sessionId, "exit-group-scss", res);

                    /* System Message */
                    for(User member : groupMembers) {
                        String memberSessionId = serviceManager.getUserService().getSessionByUserId(member.getId());
                        if(memberSessionId != null) {
                            Map<String, Object> systemMessageData = new HashMap<>(data);
                            systemMessageData.put("timestamp", time);
                            
                            Map<String, Object> systemMessage = serviceManager.getSystemMessageService().createAndSaveMessage(
                                "USER_LEFT_GROUP", 
                                systemMessageData,
                                sessionId, 
                                memberSessionId,
                                groupId
                            );
                            systemMessage.put("groupId", groupId);
                            systemMessage.put("chatId", groupId);
                            systemMessage.put("chatType", "GROUP");
                            systemMessage.put("timestamp", time);

                            String destination = "/user/queue/messages/group/" + groupId;
                            socketMethods.send(sessionId, destination, systemMessage);
                            messageRouter.routeMessage(sessionId, payload, systemMessage, new String[]{"GROUP"});
                        }
                    }

                    return Collections.emptyMap();
                } catch(Exception err) {
                    System.out.println("ERROR in exit-group: " + err.getMessage());
                    err.printStackTrace();
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "EXIT_FAILED");
                    errRes.put("message", err.getMessage());
                    serviceManager.getUserService().sendMessageToUser(sessionId, "exit-group-err", errRes);
                    return Collections.emptyMap();
                }
            },
            "/user/queue/exit-group-scss",
            false
        ));
        /* Add User Group */
        configs.put("add-user-group", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    long time = System.currentTimeMillis();
                    Map<String, Object> data = serviceManager.getGroupService().parseData(payload);
                    String userId = (String) data.get("userId");
                    String username = (String) data.get("username");
                    String groupId = (String) data.get("groupId");

                    String inviterUserId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    String inviterUsername = serviceManager.getUserService().getUsernameBySessionId(sessionId);

                    Map<String, Object> groupInfo = serviceManager.getGroupService().getGroupInfo(groupId);
                    List<User> groupMembers = serviceManager.getGroupService().getGroupMembers(groupId);
                    
                    if(groupId == null) throw new Exception("Group Id is required!");
                    if(userId == null) throw new Exception("User Id is required!");
                    if(username == null || username.trim().isEmpty()) throw new Exception("Username is required!");

                    boolean success = serviceManager.getGroupService().addUserToGroup(groupId, userId, username);
                    if(!success) throw new Exception("Failed to add user to group :(");
                    serviceManager.getGroupService().addUserToGroupMapping(userId, groupId, sessionId);

                    eventTracker.track(
                        "add-user-group",
                        data,
                        EventDirection.RECEIVED,
                        sessionId,
                        inviterUserId
                    );

                    /* Event Response */
                    Map<String, Object> res = new HashMap<>();
                    res.put("id", groupId);
                    res.put("name", groupInfo.get("name"));
                    res.put("userId", userId);
                    res.put("joined", true);
                    res.put("timestamp", time);
                    res.put("members", groupInfo.get("members"));
                    res.put("sessionId", sessionId);
                    res.put("addedBy", inviterUsername);
                    serviceManager.getUserService().sendMessageToUser(sessionId, "add-user-group-scss", res);

                    /* System Message */
                    for(User member : groupMembers) {
                        String memberSessionId = serviceManager.getUserService().getSessionByUserId(member.getId());
                        if(memberSessionId != null) {
                            Map<String, Object> systemMessageData = new HashMap<>();
                            systemMessageData.put("groupName", groupInfo.get("name"));
                            systemMessageData.put("username", username);
                            systemMessageData.put("userId", userId);
                            systemMessageData.put("inviterUsername", inviterUsername);
                            systemMessageData.put("inviterUserId", inviterUserId);
                            systemMessageData.put("timestamp", time);
                            
                            Map<String, Object> systemMessage = serviceManager.getSystemMessageService()
                                .createAndSaveMessage(
                                    "USER_ADDED_GROUP",
                                    systemMessageData, 
                                    sessionId, 
                                    memberSessionId,
                                    groupId
                                );
                            systemMessage.put("chatId", groupId);
                            systemMessage.put("groupId", groupId);
                            systemMessage.put("id", groupId);
                            
                            String destination = "/user/queue/messages/group/" + groupId;
                            socketMethods.send(memberSessionId, destination, systemMessage);
                        }
                    }
                    return Collections.emptyMap();
                } catch(Exception err) {
                    err.printStackTrace();
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "ADD_FAILED");
                    errRes.put("message", err.getMessage());
                    serviceManager.getUserService().sendMessageToUser(sessionId, "add-user-group-err", errRes);
                    return Collections.emptyMap();
                }
            },
            "/user/queue/add-user-group-scss",
            false
        ));
        /* Remove User Group */
        configs.put("remove-user-group", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    long time = System.currentTimeMillis();
                    Map<String, Object> data = serviceManager.getGroupService().parseData(payload);
                    String userId = (String) data.get("userId");
                    String username = (String) data.get("username");
                    String groupId = (String) data.get("groupId");

                    String inviterUserId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    String inviterUsername = serviceManager.getUserService().getUsernameBySessionId(sessionId);

                    Map<String, Object> groupInfo = serviceManager.getGroupService().getGroupInfo(groupId);
                    List<User> groupMembers = serviceManager.getGroupService().getGroupMembers(groupId);
                    
                    if(groupId == null) throw new Exception("Group Id is required!");
                    if(userId == null) throw new Exception("User Id is required!");
                    if(username == null || username.trim().isEmpty()) throw new Exception("Username is required!");

                    boolean success = serviceManager.getGroupService().removeUserFromGroup(groupId, userId);
                    if(!success) throw new Exception("Failed to remove user of group :(");
                    serviceManager.getGroupService().removeUserFromGroupMapping(userId, groupId);

                    eventTracker.track(
                        "remove-user-group",
                        data,
                        EventDirection.RECEIVED,
                        sessionId,
                        inviterUserId
                    );

                    /* Event Response */
                    Map<String, Object> res = new HashMap<>();
                    res.put("id", groupId);
                    res.put("name", groupInfo.get("name"));
                    res.put("userId", userId);
                    res.put("joined", true);
                    res.put("timestamp", time);
                    res.put("members", groupInfo.get("members"));
                    res.put("sessionId", sessionId);
                    res.put("removedBy", inviterUsername);
                    serviceManager.getUserService().sendMessageToUser(sessionId, "remove-user-group-scss", res);

                    /* System Message */
                    for(User member : groupMembers) {
                        String memberSessionId = serviceManager.getUserService().getSessionByUserId(member.getId());
                        if(memberSessionId != null) {
                            Map<String, Object> systemMessageData = new HashMap<>();
                            systemMessageData.put("username", username);
                            systemMessageData.put("userId", userId);
                            systemMessageData.put("inviterUsername", inviterUsername);
                            systemMessageData.put("inviterUserId", inviterUserId);
                            systemMessageData.put("groupName", groupInfo.get("name"));
                            systemMessageData.put("timestamp", time);

                            Map<String, Object> systemMessage = serviceManager.getSystemMessageService().createAndSaveMessage(
                                "USER_REMOVED_GROUP",
                                systemMessageData, 
                                sessionId, 
                                memberSessionId,
                                groupId
                            );
                            
                            systemMessage.put("chatId", groupId);
                            systemMessage.put("groupId", groupId);
                            systemMessage.put("id", groupId);
                            
                            String destination = "/user/queue/messages/group/" + groupId;
                            socketMethods.send(memberSessionId, destination, systemMessage);
                        }
                    }
                    return Collections.emptyMap();
                } catch(Exception err) {
                    err.printStackTrace();
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "REMOVE_FAILED");
                    errRes.put("message", err.getMessage());
                    serviceManager.getUserService().sendMessageToUser(sessionId, "remove-user-group-err", errRes);
                    return Collections.emptyMap();
                }
            },
            "/user/queue/remove-user-group-scss",
            false
        ));
        /* Get User Groups */
        configs.put("get-user-chats", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String userId = (String) data.get("userId");
                    if(userId == null || userId.trim().isEmpty()) {
                        throw new IllegalArgumentException("User ID is required!");
                    }

                    List<Map<String, Object>> userChats = serviceManager
                        .getChatService()
                        .getChats(userId);
                        
                    Map<String, Object> res = new HashMap<>();
                    res.put("userId", userId);
                    res.put("chats", userChats);
                    res.put("count", userChats.size());
                    res.put("status", "success");

                    eventTracker.track(
                        "get-user-chats",
                        Map.of("userId", userId, "chatCount", userChats.size()),
                        EventDirection.RECEIVED,
                        sessionId,
                        userId
                    );

                    return res;
                } catch(Exception err) {
                    err.getStackTrace();
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "LOAD_CHATS_FAILED");
                    errRes.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/user-chats-err", errRes);
                    return Collections.emptyMap();
                }
            },
            "/queue/user-chats-scss",
            false
        ));
        /* Generate Group Link */
        configs.put("generate-invite-link", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                Map<String, Object> res = new HashMap<>();

                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String groupId = (String) data.get("groupId");
                    String userId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    System.out.println(serviceManager.getUserService().getUserIdBySession(sessionId));
                    boolean isMember = serviceManager.getGroupService().isUserGroupMember(groupId, userId);
                    if(!isMember) {
                        throw new Exception("User: " + userId + " is not a member!");
                    }
                    if(groupId == null || groupId.trim().isEmpty()) {
                        throw new IllegalArgumentException("Group Id is required");
                    }
                    if(userId == null || userId.trim().isEmpty()) {
                        throw new IllegalArgumentException("User Id is required");
                    }
                    if(!isMember) {
                        throw new SecurityException("User: " + userId + ", is not a member of group: " + groupId);
                    }

                    String webUrl = EnvConfig.get("WEB_URL");
                    String inviteCode = UUID.randomUUID().toString().substring(0, 16);
                    String inviteLink = webUrl + "/join?c=" + inviteCode;
                    long expireTime = System.currentTimeMillis() + (24 * 60 * 60 * 1000);
                    serviceManager.getGroupService().getInviteCodes().storeInviteCode(groupId, inviteCode, userId, userId);
                    
                    res.put("userId", userId);
                    res.put("inviteLink", inviteLink);
                    res.put("inviteCode", inviteCode);
                    res.put("groupId", groupId);
                    res.put("expiresAt", expireTime);
                } catch(Exception err) {
                    err.printStackTrace();
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "LINK_FAILED");
                    errRes.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/invite-link-err", errRes);

                    res.put("status", "error");
                    res.put("error", err.getMessage());
                }

                return res;
            },
            "/queue/invite-link-scss",
            false
        ));
        /* Get Group Info */
        configs.put("get-group-info", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String inviteCode = (String) data.get("inviteCode");
                    String groupId = serviceManager.getGroupService().getInviteCodes().findGroupByCode(inviteCode);
                    Map<String, Object> groupInfo = serviceManager.getGroupService().getGroupInfo(groupId);
                    Object creator = groupInfo.get("creator") != null ? groupInfo.get("creator") : groupInfo.get("creatorId");
                    List<User> members = serviceManager.getGroupService().getGroupMembers(groupId);
                    List<String> memberNames = new ArrayList<>();
                    List<String> memberIds = new ArrayList<>();
                    for(User member : members) {
                        memberNames.add(member.getUsername());
                        memberIds.add(member.getId());
                    }
                    
                    if(inviteCode == null || inviteCode.trim().isEmpty()) throw new Exception("Invite code is required");
                    if(groupId == null) throw new Exception("Invalid or expired invite code");

                    Map<String, Object> res = new HashMap<>();
                    res.put("id", groupId);
                    res.put("name", groupInfo.get("name"));
                    res.put("creator", creator);
                    res.put("creatorId", groupInfo.get("creatorId"));
                    res.put("members", memberNames);
                    res.put("memberIds", memberIds);
                    res.put("member", members.size());
                    res.put("status", "success");

                    eventTracker.track(
                        "get-group-info",
                        data,
                        EventDirection.RECEIVED,
                        sessionId,
                        groupId
                    );

                    return res;
                } catch(Exception err) {
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "GROUP_INFO_FAILED");
                    errRes.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/group-info-err", errRes);
                    return Collections.emptyMap();
                }
            },
            "/queue/group-info-scss",
            false
        ));
        /* Get Group Members */
        configs.put("get-group-members", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String groupId = (String) data.get("groupId");

                    List<User> groupMembers = serviceManager.getGroupService().getGroupMembers(groupId);
                    List<Map<String, Object>> members = new ArrayList<>();

                    for(User member : groupMembers) {
                        Map<String, Object> memberInfo = new HashMap<>();
                        memberInfo.put("id", member.getId());
                        memberInfo.put("username", member.getUsername());
                        members.add(memberInfo);
                        System.out.println(memberInfo);
                    }
                    System.out.println(members);
                    Map<String, Object> res = new HashMap<>();
                    res.put("members", members);
                    res.put("count", members.size());
                    res.put("groupId", groupId);

                    return res;
                } catch(Exception err) {
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "LOAD_GROUP_MEMBERS_FAILED");
                    errRes.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/group-members-err", errRes);
                    return Collections.emptyMap();
                }
            },
            "/queue/group-members-scss",
            false
        ));   

        return configs;
    }

    private Long convertToLong(Object obj) {
        if(obj == null) return null;
        if(obj instanceof Long) return (Long) obj;
        if(obj instanceof Integer) return ((Integer) obj).longValue();
        if(obj instanceof Number) return ((Number) obj).longValue();
        return null;
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }
}