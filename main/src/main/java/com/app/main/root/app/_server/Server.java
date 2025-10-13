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
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.WebSocketSession;

@Component
@EnableWebSocket
public class Server implements WebSocketConfigurer, CommandLineRunner {
    private static Server instance;
    private SocketHandler socketHandler;
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
        EventTracker eventTracker,
        MessageTracker messageTracker,
        SocketMethods socketMethods,
        SimpMessagingTemplate messagingTemplate,
        ConnectionTracker connectionTracker, 
        ConfigSocketEvents configSocketEvents,
        ColorConverter colorConverter
    ) {
        this.eventTracker = EventTracker.getInstance();
        this.messageTracker = MessageTracker.getInstance();
        this.dbService = dbService;
        this.sessionService = new SessionService();
        this.socketMethods = new SocketMethods(eventTracker);
        this.messagingTemplate = messagingTemplate;
        this.connectionTracker = connectionTracker;
        this.configSocketEvents = new ConfigSocketEvents(
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
        configSockets();
        configSocketEvents.configSocketEvents();
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

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(socketHandler(), "/ws-direct").setAllowedOrigins(webUrl, apiUrl);
        registry.addHandler(socketHandler(), "").setAllowedOrigins(webUrl, apiUrl).withSockJS();
    }

    private void configSockets() {
        configSocketEvents.configSocketEvents();
    }

    public ConnectionTracker getConnectionTracker() {
        return connectionTracker;
    }
}