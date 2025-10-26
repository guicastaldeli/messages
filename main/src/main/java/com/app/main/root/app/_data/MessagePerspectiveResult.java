package com.app.main.root.app._data;
import java.util.*;

public class MessagePerspectiveResult {
    private String direction;
    private String perpspectiveType;
    private Map<String, Object> renderConifig;
    private Map<String, Object> meatdata;

    public MessagePerspectiveResult() {
        this.renderConifig = new HashMap<>();
        this.meatdata = new HashMap<>();
    }

    /*
    * Direction 
    */
    public void setDirection(String direction) {
        this.direction = direction;
    }
    public String getDirection() {
        return direction;
    }

    /*
    * Perpspective Type 
    */
    public void setPerpspectiveType(String type) {
        this.perpspectiveType = type;
    }
    public String getPerpspectiveType() {
        return perpspectiveType;
    }

    /*
    * Render Config 
    */
    public Map<String, Object> getRenderConfig() {
        return renderConifig;
    }

    /*
    * Metadata 
    */
    public Map<String, Object> getMetadata() {
        return meatdata;
    }
}
