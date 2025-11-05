package com.app.main.root.app._service;
import com.app.main.root.app._db.DbService;
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

    public ServiceManager(
        DbService dbService,
        @Lazy MessageService messageService,
        @Lazy SystemMessageService systemMessageService,
        @Lazy MessagePerspectiveService messagePerspectiveService,
        UserService userService,
        @Lazy DirectService directService,
        ContactService contactService,
        @Lazy GroupService groupService,
        @Lazy EmailService emailService
    ) {
        this.dbService = dbService;
        this.messageService = messageService;
        this.systemMessageService = systemMessageService;
        this.messagePerspectiveService = messagePerspectiveService;
        this.userService = userService;
        this.contactService = contactService;
        this.directService = directService;
        this.groupService = groupService;
        this.emailService = emailService;
    }

    /*
    * Db Service 
    */
    public DbService getDbService() {
        return dbService;
    }

    /*
    * Message Service 
    */
    public MessageService getMessageService() {
        return messageService;
    }

    /*
    * Message Service 
    */
    public SystemMessageService getSystemMessageService() {
        return systemMessageService;
    }

    /*
    * Message Perspective Service 
    */
    public MessagePerspectiveService getMessagePerspectiveService() {
        return messagePerspectiveService;
    }

    /*
    * User Service 
    */
    public UserService getUserService() {
        return userService;
    }

    /*
    * Direct Service 
    */
    public DirectService getDirectService() {
        return directService;
    }

    /*
    * Contact Service 
    */
    public ContactService getContactService() {
        return contactService;
    }

    /*
    * Group Service 
    */
    public GroupService getGroupService() {
        return groupService;
    }

    /*
    * Email Service 
    */
    public EmailService getEmailService() {
        return emailService;
    }
}