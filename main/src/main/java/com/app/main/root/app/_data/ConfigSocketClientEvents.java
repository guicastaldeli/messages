package com.app.main.root.app._data;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._server.SocketClient;
import com.app.main.root.app._server.SocketEmitter;
import com.app.main.root.app._server.SocketEmitter.EventHandler;
import com.app.main.root.app._server.SocketEmitter.EmitHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Map;
import java.util.Arrays;

@Component
public class ConfigSocketClientEvents {
    private final EventTracker eventTracker;

    public ConfigSocketClientEvents(EventTracker eventTracker) {
        this.eventTracker = eventTracker;
    }

    public void configSocketClientEvents(SocketClient socketClient, WebSocketSession session) {
        if(session == null) throw new IllegalArgumentException("WebSocket session cannot be null");
        SocketEmitter socketEmitter = SocketEmitter.getInstance(session);

        /*
        **
        *** Event Handler
        ** 
        */
        List<EventHandler> eventHandlers = Arrays.asList(
            /*
            * Update 
            */
            new EventHandler(
                "update",
                data -> {
                    String username = (String) data;
                    String sessionId = session.getId();

                    eventTracker.track(
                        "update", 
                        data, 
                        EventDirection.RECEIVED,
                        sessionId,
                        username
                    );
                    socketClient.emitEvent("update", data);
                },
                true
            ),

            /*
            * Chat 
            */
            new EventHandler(
                "chat",
                data -> {
                    String username = (String) data;
                    String sessionId = session.getId();

                    eventTracker.track(
                        "chat", 
                        data, 
                        EventDirection.RECEIVED,
                        sessionId,
                        username
                    );
                    socketClient.emitEvent("chat", data);
                },
                true
            )
        );

        /*
        **
        *** Emit Handler
        ** 
        */
        List<EmitHandler> emitHandlers = Arrays.asList(
            /*
            * New User 
            */
            new EmitHandler(
                "new-user",
                data -> {
                    String username = (String) data;
                    String sessionId = session.getId();

                    eventTracker.track(
                        "new-user",
                        username,
                        EventDirection.SENT,
                        sessionId,
                        username
                    );
                    socketEmitter.emit("new-user", username);
                }
            ),

            /*
            * Exit User 
            */
            new EmitHandler(
                "exit-user",
                data -> {
                    String username = (String) data;
                    String sessionId = session.getId();

                    eventTracker.track(
                        "exit-user",
                        username,
                        EventDirection.SENT,
                        sessionId,
                        username
                    );
                    socketEmitter.emit("exit-user", username);
                }
            ),

            /*
            * Chat 
            */
            new EmitHandler(
                "chat",
                data -> {
                    Map<String, Object> messageData = (Map<String, Object>) data;
                    String content = (String) messageData.get("content");
                    String username = (String) messageData.get("username");
                    String sessionId = session.getId();

                    eventTracker.track(
                        "chat",
                        content,
                        EventDirection.SENT,
                        sessionId,
                        username
                    );
                    socketEmitter.emit("chat", data);
                }
            )
        );

        socketEmitter.registerAllEventsHandlers(eventHandlers);
        socketEmitter.registerAllEmitHandlers(emitHandlers);
        socketEmitter.registerAllEvents(socketClient::emitEvent);
    }
}