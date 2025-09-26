package com.app.main.root.app._db;
import com.app.main.root.app._utils.ColorConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import javax.sql.DataSource;

@Service
public class DbService {
    private final DataSource dataSource;
    private final UsersConfig usersConfig;
    private final MessagesConfig messagesConfig;
    private final GroupsConfig groupsConfig;
    private final ColorConverter colorConverter;

    @Autowired
    public DbService(DataSource dataSource, ColorConverter colorConverter) {
        this.dataSource = dataSource;
        this.usersConfig = new UsersConfig(dataSource);
        this.messagesConfig = new MessagesConfig(dataSource);
        this.groupsConfig = new GroupsConfig(dataSource);
        this.colorConverter = colorConverter;
    }

    @PostConstruct
    public void alert() {
        System.out.println(
            colorConverter.style("ALERT", "red", "italic") + ", " +
            colorConverter.style("Database initialized :)", "orange", "bold")
        );
    }

    public UsersConfig getUsersConfig() {
        return usersConfig;
    }

    public MessagesConfig getMessagesConfig() {
        return messagesConfig;
    }

    public GroupsConfig getGroupsConfig() {
        return groupsConfig;
    }
}