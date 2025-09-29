package com.app.main.root.app._server;
import com.app.main.root.app._data.ConfigSocketEvents;
import com.app.main.root.app.main.MessageTracker;
import com.app.main.root.app._db.DbService;
import com.app.main.root.app._data.SocketMethods;
import com.app.main.root.app._utils.ColorConverter;
import org.springframework.boot.CommandLineRunner;
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
    private final MessageTracker messageTracker;
    private final DbService dbService;
    private final SocketMethods socketMethods;
    private final SimpMessagingTemplate messagingTemplate;
    private final ConnectionTracker connectionTracker;
    private final ConfigSocketEvents configSocketEvents;
    private final ColorConverter colorConverter;
    private WebSocketSession webSocketSession;

    private String url;
    private String port;

    public Server(
        DbService dbService,
        MessageTracker messageTracker,
        SocketMethods socketMethods,
        SimpMessagingTemplate messagingTemplate,
        ConnectionTracker connectionTracker, 
        ConfigSocketEvents configSocketEvents,
        ColorConverter colorConverter
    ) {
        this.messageTracker = MessageTracker.getInstance();
        this.dbService = dbService;
        this.socketMethods = new SocketMethods();
        this.messagingTemplate = messagingTemplate;
        this.connectionTracker = ConnectionTracker.getInstance();
        this.socketHandler = new SocketHandler(messagingTemplate, connectionTracker, webSocketSession);
        this.configSocketEvents = new ConfigSocketEvents(
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

    public void init(String port) {
        this.port = port;
        this.url = "http://localhost:" + port;
    }

    @Override
    public void run(String... args) throws Exception {
        configSockets();

        if(this.port == null) {
            String envPort = System.getenv("PORT");
            if(envPort != null && !envPort.trim().isEmpty()) {
                init(envPort);
            } else {
                init("3001");
            }
        }

        configSocketEvents.configSocketEvents();
    }

    public void alert() {
        String content =
        colorConverter.style("Server running...", "bgBlue", "italic");
        /*
        System.out.println("endpoint avaliable at: " + this.url + "/ws");
        System.out.println("Server components initialized!");
        System.out.println("Connection tracker ready: " + (connectionTracker != null));
        System.out.println("Message template ready: " + (messagingTemplate != null));
        */
        System.out.println(content);
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(this.socketHandler, "/ws").setAllowedOrigins("*");
    }

    private void configSockets() {
        configSocketEvents.configSocketEvents();
    }

    public ConnectionTracker getConnectionTracker() {
        return connectionTracker;
    }
}