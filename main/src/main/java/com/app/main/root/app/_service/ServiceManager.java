package com.app.main.root.app._service;
import com.app.main.root.app._db.DbService;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

@Service
@Component
public class ServiceManager {
    private final DbService dbService;
    private final MessageService messageService;
    private final SystemMessageService systemMessageService;
    private final UserService userService;
    private final DirectService directService;
    private final GroupService groupService;

    public ServiceManager(
        DbService dbService,
        @Lazy MessageService messageService,
        @Lazy SystemMessageService systemMessageService,
        UserService userService,
        DirectService directService,
        GroupService groupService
    ) {
        this.dbService = dbService;
        this.messageService = messageService;
        this.systemMessageService = systemMessageService;
        this.userService = userService;
        this.directService = directService;
        this.groupService = groupService;
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
    * Group Service 
    */
    public GroupService getGroupService() {
        return groupService;
    }
}