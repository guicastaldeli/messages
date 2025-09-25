package com.app.main.root.app._data;
import org.springframework.web.socket.WebSocketSession;

public class SocketMethods {
    /*
    **
    *** Session Id
    ** 
    */
    public String getSessionId(Object socket) {
        if(socket instanceof WebSocketSession) {
            return ((WebSocketSession) socket).getId();
        }
        return "unknown";
    }

    /*
    **
    *** Set Socket Username
    ** 
    */
    public void setSocketUsername(Object socket, String username) {
        if(socket instanceof WebSocketSession) {
            WebSocketSession session = (WebSocketSession) socket;
            session.getAttributes().put("username", username);
        }
    }

    /*
    **
    *** Get Socket Username
    ** 
    */
    public String getSocketUsername(Object socket) {
        if(socket instanceof WebSocketSession) {
            WebSocketSession session = (WebSocketSession) socket;
            return (String) session.getAttributes().getOrDefault("username", "Anonymous");
        }
        return "Anonymous";
    }
}
