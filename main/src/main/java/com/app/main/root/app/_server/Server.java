package com.app.main.root.app._server;
import com.app.main.root.app._data.ConfigSocketEvents;
import com.app.main.root.EnvConfig;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.main._messages_config.MessageTracker;
import com.app.main.root.app._db.DbService;
import com.app.main.root.app._service.SessionService;
import com.app.main.root.app._data.SocketMethods;
import com.app.main.root.app._utils.ColorConverter;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Component;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.support.SimpAnnotationMethodMessageHandler;
import org.springframework.web.socket.WebSocketSession;

@Component
public class Server implements CommandLineRunner {
    private static Server instance;
    private SocketHandler socketHandler;
    private final SimpAnnotationMethodMessageHandler messageHandler;
    private final EventRegistry eventRegistry;
    private final EventTracker eventTracker;
    private final MessageTracker messageTracker;
    private final DbService dbService;
    private final SessionService sessionService;
    private final SocketMethods socketMethods;
    private final SimpMessagingTemplate messagingTemplate;
    private final ConnectionTracker connectionTracker;
    private final ConfigSocketEvents configSocketEvents;
    private final ColorConverter colorConverter;
    private WebSocketSession webSocketSession;

    private String url;
    private String webUrl = EnvConfig.get("WEB_URL");
    private String apiUrl = EnvConfig.get("API_URL");

    public Server(
        DbService dbService,
        SessionService sessionService,
        SimpAnnotationMethodMessageHandler messageHandler,
        EventRegistry eventRegistry,
        EventTracker eventTracker,
        SimpMessagingTemplate messagingTemplate,
        MessageTracker messageTracker,
        SocketMethods socketMethods,
        ConnectionTracker connectionTracker, 
        ConfigSocketEvents configSocketEvents,
        ColorConverter colorConverter
    ) {
        this.messageHandler = messageHandler;
        this.eventRegistry = new EventRegistry();
        this.eventTracker = EventTracker.getInstance();
        this.messageTracker = MessageTracker.getInstance();
        this.dbService = dbService;
        this.sessionService = new SessionService();
        this.messagingTemplate = messagingTemplate;
        this.socketMethods = new SocketMethods(messagingTemplate, eventTracker);
        this.connectionTracker = connectionTracker;
        this.configSocketEvents = new ConfigSocketEvents(
            messageHandler,
            eventRegistry,
            eventTracker, 
            messageTracker,
            connectionTracker, 
            dbService,
            socketMethods
        );
        this.colorConverter = colorConverter;
        instance = this;
    }

    public static Server getInstance(String url, Object timeStream) {
        return instance;
    }

    public void init(String url) {
        this.url = url;
    }

    @Override
    public void run(String... args) throws Exception {
    }

    public void alert() {
        String content =
        colorConverter.style("Server running...", "bgBlue", "italic");
        System.out.println("Connection tracker ready: " + (connectionTracker != null));
        System.out.println("Message template ready: " + (messagingTemplate != null));
        System.out.println(content);
    }

    @Bean
    public SocketHandler socketHandler() {
        return this.socketHandler = new SocketHandler(messagingTemplate, connectionTracker, webSocketSession);
    }

    public ConnectionTracker getConnectionTracker() {
        return connectionTracker;
    }
}