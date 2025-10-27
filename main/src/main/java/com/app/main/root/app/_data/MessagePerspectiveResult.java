package com.app.main.root.app._data;
import java.util.*;

public class MessagePerspectiveResult {
    private String direction;
    private String perpspectiveType;
    private Map<String, Object> renderConfig;
    private Map<String, Object> metadata;

    public MessagePerspectiveResult() {
        this.renderConfig = new HashMap<>();
        this.metadata = new HashMap<>();
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
    public void setRenderConfig(Map<String, Object> config) {
        this.renderConfig = config;
    }

    public Map<String, Object> getRenderConfig() {
        return renderConfig;
    }

    /*
    * Metadata 
    */
    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }
    public Map<String, Object> getMetadata() {
        return metadata;
    }
}
