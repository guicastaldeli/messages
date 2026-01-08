package com.app.main.root.app._types;
import java.sql.Timestamp;

public class Group {
    private String id;
    private String name;
    private String creatorId;
    private Timestamp createdAt;

    /**
     * Id
     */
    public void setId(String id) {
        this.id = id;
    }
    public String getId() {
        return id;
    }

    /**
     * Name
     */
    public void setName(String name) {
        this.name = name;
    }
    public String getName() {
        return name;
    }

    /**
     * Creator Id
     */
    public void setCreatorId(String creatorId) {
        this.creatorId = creatorId;
    }
    public String getCreatorId() {
        return creatorId;
    }

    /**
     * Created At
     */
    public void setCreatedAt(Timestamp createdAt) {
        this.createdAt = createdAt;
    }
    public Timestamp getCreatedAt() {
        return createdAt;
    }
}
