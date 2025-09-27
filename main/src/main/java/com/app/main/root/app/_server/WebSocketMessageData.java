package com.app.main.root.app._server;

public class WebSocketMessageData {
    private final String event;
    private final String data;

    public WebSocketMessageData(String event, String data) {
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