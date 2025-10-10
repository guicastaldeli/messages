package com.app.main.root.app._db;
import com.app.main.root.app._service.GroupService;
import com.app.main.root.app._service.MessageService;
import com.app.main.root.app._service.UserService;
import com.app.main.root.app._utils.ColorConverter;
import org.springframework.stereotype.Service;
import javax.sql.DataSource;
import org.springframework.web.client.RestTemplate;

@Service
public class DbService {
    private final RestTemplate restTemplate;
    private final String apiUrl;

    public final UserService userService;
    public final MessageService messageService;
    public final GroupService groupService;
    public final ColorConverter colorConverter;

    public DbService(DataSource dataSource, ColorConverter colorConverter) {
        this.restTemplate = new RestTemplate();
        this.apiUrl = System.getenv().getOrDefault("API_URL", "http://localhost:3002");

        this.userService = new UserService(dataSource);
        this.messageService = new MessageService(dataSource);
        this.groupService = new GroupService(dataSource);
        this.colorConverter = colorConverter;
    }

    public void alert() {
        System.out.println(
            colorConverter.style("ALERT", "red", "italic") + ", " +
            colorConverter.style("Database initialized :)", "orange", "bold") +
            colorConverter.style("\nServices connected to API at: ", "green", "italic") +
            colorConverter.style(apiUrl, "brightGreen", "italic")
        );
    }

    public UserService getUserService() {
        return userService;
    }

    public MessageService getMessageService() {
        return messageService;
    }

    public GroupService getGroupService() {
        return groupService;
    }
}