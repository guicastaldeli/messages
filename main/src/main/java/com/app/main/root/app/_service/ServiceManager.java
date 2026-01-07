package com.app.main.root.app._service;
import com.app.main.root.app._db.DbService;
import com.app.main.root.app._auth.TokenService;
import com.app.main.root.app._cache.CacheService;
import com.app.main.root.app._crypto.file_encoder.KeyManagerService;
import com.app.main.root.app.main.email_service.EmailService;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

@Service
@Component
public class ServiceManager {
    private final DbService dbService;
    private final MessageService messageService;
    private final SystemMessageService systemMessageService;
    private final MessagePerspectiveService messagePerspectiveService;
    private final UserService userService;
    private final DirectService directService;
    private final ContactService contactService;
    private final GroupService groupService;
    private final EmailService emailService;
    private final ChatService chatService;
    private final NotificationService notificationService;
    private final SessionService sessionService;
    private final TokenService tokenService;
    private final CookieService cookieService;
    private final FileService fileService;
    private final KeyManagerService keyManagerService;
    private final CacheService cacheService;

    public ServiceManager(
        DbService dbService,
        @Lazy MessageService messageService,
        @Lazy SystemMessageService systemMessageService,
        @Lazy MessagePerspectiveService messagePerspectiveService,
        @Lazy ChatService chatService,
        @Lazy NotificationService notificationService,
        UserService userService,
        @Lazy DirectService directService,
        ContactService contactService,
        @Lazy GroupService groupService,
        @Lazy EmailService emailService,
        @Lazy SessionService sessionService,
        @Lazy TokenService tokenService,
        @Lazy CookieService cookieService,
        @Lazy FileService fileService,
        @Lazy KeyManagerService keyManagerService,
        @Lazy CacheService cacheService
    ) {
        this.dbService = dbService;
        this.messageService = messageService;
        this.systemMessageService = systemMessageService;
        this.messagePerspectiveService = messagePerspectiveService;
        this.chatService = chatService;
        this.notificationService = notificationService;
        this.userService = userService;
        this.contactService = contactService;
        this.directService = directService;
        this.groupService = groupService;
        this.emailService = emailService;
        this.sessionService = sessionService;
        this.tokenService = tokenService;
        this.cookieService = cookieService;
        this.fileService = fileService;
        this.keyManagerService = keyManagerService;
        this.cacheService = cacheService;
    }

    /**
     * Database Service
     */
    public DbService getDbService() {
        return dbService;
    }

    /**
     * Message Service 
     */
    public MessageService getMessageService() {
        return messageService;
    }

    /**
     * System Message Service 
     */
    public SystemMessageService getSystemMessageService() {
        return systemMessageService;
    }

    /**
     * Message Perspective Service
     */
    public MessagePerspectiveService getMessagePerspectiveService() {
        return messagePerspectiveService;
    }

    /**
     * Get Chat Service
     */
    public ChatService getChatService() {
        return chatService;
    }

    /**
     * User Service
     */
    public UserService getUserService() {
        return userService;
    }

    public NotificationService getNotificationService() {
        return notificationService;
    }

    /**
     * Direct Service 
     */
    public DirectService getDirectService() {
        return directService;
    }

    /**
     * Contact Service 
     */
    public ContactService getContactService() {
        return contactService;
    }

    /**
     * Group Service 
     */
    public GroupService getGroupService() {
        return groupService;
    }

    /**
     * Email Service 
     */
    public EmailService getEmailService() {
        return emailService;
    }

    /**
     * Session Service
     */
    public SessionService getSessionService() {
        return sessionService;
    }

    /**
     * Token Service
     */
    public TokenService getTokenService() {
        return tokenService;
    }

    /**
     * Cookie Service
     */
    public CookieService getCookieService() {
        return cookieService;
    }

    /**
     * File Service
     */
    public FileService getFileService() {
        return fileService;
    }

    /**
     * Key Manager Service
     */
    public KeyManagerService getKeyManagerService() {
        return keyManagerService;
    }

    /**
     * Cache Service
     */
    public CacheService getCacheService() {
        return cacheService;
    }
}