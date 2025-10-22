package com.app.main.root.app._server;
import com.app.main.root.app._data.ConfigSocketEvents;
import com.app.main.root.EnvConfig;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.main._messages_config.MessageTracker;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.app._service.SessionService;
import com.app.main.root.app._data.SocketMethods;
import com.app.main.root.app._utils.ColorConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.support.SimpAnnotationMethodMessageHandler;
import org.springframework.web.socket.WebSocketSession;

@Component
public class Server implements CommandLineRunner {
    private static Server instance;
    private final EventRegistry eventRegistry;
    private final EventTracker eventTracker;
    private final MessageTracker messageTracker;
    private final ServiceManager serviceManager;
    private final SessionService sessionService;
    private final SocketMethods socketMethods;
    private final SimpMessagingTemplate messagingTemplate;
    private final ConnectionTracker connectionTracker;
    private final ConfigSocketEvents configSocketEvents;
    private final ColorConverter colorConverter;
    private WebSocketSession webSocketSession;
    @Autowired private SimpAnnotationMethodMessageHandler messageHandler;

    private String url;
    private String webUrl = EnvConfig.get("WEB_URL");
    private String apiUrl = EnvConfig.get("API_URL");

    public Server(
        ServiceManager serviceManager,
        SessionService sessionService,
        EventTracker eventTracker,
        EventRegistry eventRegistry,
        SimpMessagingTemplate messagingTemplate,
        MessageTracker messageTracker,
        SocketMethods socketMethods,
        ConnectionTracker connectionTracker, 
        ConfigSocketEvents configSocketEvents,
        ColorConverter colorConverter
    ) {
        this.eventRegistry = eventRegistry;
        this.eventTracker = eventTracker;
        this.messageTracker = MessageTracker.getInstance();
        this.serviceManager = serviceManager;
        this.sessionService = new SessionService();
        this.messagingTemplate = messagingTemplate;
        this.socketMethods = new SocketMethods(messagingTemplate, eventTracker);
        this.connectionTracker = connectionTracker;
        this.configSocketEvents = configSocketEvents;
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

    public ConnectionTracker getConnectionTracker() {
        return connectionTracker;
    }
}