package com.app.main.root.app._data;
import com.app.main.root.app._server.SocketClient;
import com.app.main.root.app._server.SocketEmitter;
import com.app.main.root.app._server.SocketEmitter.EventHandler;
import com.app.main.root.app._server.SocketEmitter.EmitHandler;
import org.springframework.web.socket.WebSocketSession;
import java.util.Arrays;
import org.springframework.stereotype.Component;

@Component
public class ConfigSocketClientEvents {
    private final MessageTracker messageTracker;

    public ConfigSocketClientEvents(MessageTracker messageTracker) {
        this.messageTracker = messageTracker;
    }

    public void configSocketClientEvents(SocketClient socketClient, WebSocketSession session) {
        if(session == null) throw new IllegalArgumentException("WebSocket session cannot be null");
        SocketEmitter socketEmitter = SocketEmitter.getInstance(session);

        /*
        **
        *** Event Handler
        ** 
        */
        EventHandler[] eventHandlers = {
            /*
            * Update 
            */
            new EventHandler() {
                @Override
                public String getEventName() {
                    return "update";
                }
                @Override
                public void handle(Object data) {
                    messageTracker.trackMessage("update", data, "received");
                    socketClient.emitEvent("update", data);
                }
                @Override
                public boolean isAutoRegister() {
                    return true;
                }
            },

            /*
            * Chat 
            */
            new EventHandler() {
                @Override
                public String getEventName() {
                    return "chat";
                }
                @Override
                public void handle(Object data) {
                    messageTracker.trackMessage("update", data, "received");
                    socketClient.emitEvent("chat", data);
                }
                @Override
                public boolean isAutoRegister() {
                    return true;
                }
            }
        };

        /*
        **
        *** Emit Handler
        ** 
        */
        EmitHandler[] emitHandlers = {
            /*
            * New User 
            */
            new EmitHandler() {
                @Override
                public String getEventName() {
                    return "new-user";
                }
                @Override
                public void emit(Object data) {
                    String username = (String) data;
                    String sessionId = session.getId();

                    messageTracker.trackMessage("new-user", username, "sent", sessionId, username);
                    socketEmitter.emit("new-user", username);
                }
            },

            /*
            * Exit User 
            */
            new EmitHandler() {
                @Override
                public String getEventName() {
                    return "exit-user";
                }
                @Override
                public void emit(Object data) {
                    String username = (String) data;
                    String sessionId = session.getId();

                    messageTracker.trackMessage("exit-user", username, "sent", sessionId, username);
                    socketEmitter.emit("exit-user", username);
                }
            },

            /*
            * Chat 
            */
            new EmitHandler() {
                @Override
                public String getEventName() {
                    return "chat";
                }
                @Override
                public void emit(Object data) {
                    Map<String, Object> messageData = (Map<String, Object>) data;
                    String content = (String) messageData.get("content");
                    String username = (String) messageData.get("username");
                    String sessionId = session.getId();

                    messageTracker.trackMessage("chat", content, "sent", sessionId, username);
                    socketEmitter.emit("chat", data);
                }
            }
        };

        socketEmitter.registerAllEventsHandlers(Arrays.asList(eventHandlers));
        socketEmitter.registerAllEmitHandlers(Arrays.asList(emitHandlers));
        socketEmitter.registerAllEvents(socketClient::emitEvent);
    }
}