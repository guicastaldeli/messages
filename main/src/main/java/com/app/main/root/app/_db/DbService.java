package com.app.main.root.app._db;
import com.app.main.root.app._utils.ColorConverter;
import org.springframework.stereotype.Service;
import javax.sql.DataSource;
import org.springframework.web.client.RestTemplate;

@Service
public class DbService {
    private final RestTemplate restTemplate;
    private final String apiUrl;

    public final UsersConfig usersConfig;
    public final MessagesConfig messagesConfig;
    public final GroupsConfig groupsConfig;
    public final ColorConverter colorConverter;

    public DbService(DataSource dataSource, ColorConverter colorConverter) {
        this.restTemplate = new RestTemplate();
        this.apiUrl = System.getenv().getOrDefault("API_URL", "http://localhost:3001");

        this.usersConfig = new UsersConfig(dataSource);
        this.messagesConfig = new MessagesConfig(dataSource);
        this.groupsConfig = new GroupsConfig(dataSource);
        this.colorConverter = colorConverter;
    }

    public void alert() {
        System.out.println(
            colorConverter.style("ALERT", "red", "italic") + ", " +
            colorConverter.style("Database initialized :)", "orange", "bold") +
            colorConverter.style("\nServices connected to API at: " + apiUrl, "green", "italic")
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