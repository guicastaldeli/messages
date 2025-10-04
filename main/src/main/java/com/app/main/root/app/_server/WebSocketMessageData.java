package com.app.main.root.app._server;

public class WebSocketMessageData {
    private final String event;
    private final Object data;

    public WebSocketMessageData(String event, Object data) {
        this.event = event;
        this.data = data;
    }

    /*
    * Event 
    */
    public String getEvent() {
        return event;
    }

    /*
    * Data 
    */
    public Object getData() {
        return data;
    }
}