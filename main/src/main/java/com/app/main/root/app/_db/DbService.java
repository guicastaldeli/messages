package com.app.main.root.app._db;
import com.app.main.root.app._utils.ColorConverter;
import org.springframework.stereotype.Service;
import javax.sql.DataSource;

@Service
public class DbService {
    private final UsersConfig usersConfig;
    private final MessagesConfig messagesConfig;
    private final GroupsConfig groupsConfig;
    private final ColorConverter colorConverter;

    public DbService(DataSource dataSource, ColorConverter colorConverter) {
        this.usersConfig = new UsersConfig(dataSource);
        this.messagesConfig = new MessagesConfig(dataSource);
        this.groupsConfig = new GroupsConfig(dataSource);
        this.colorConverter = colorConverter;
    }

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