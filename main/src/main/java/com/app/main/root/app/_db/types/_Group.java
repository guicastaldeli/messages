package com.app.main.root.app._db.types;
import java.sql.Timestamp;

public class _Group {
    private String id;
    private String name;
    private String creatorId;
    private Timestamp createdAt;

    /*
    * ID 
    */
    public void setId(String id) {
        this.id = id;
    }
    public String getId() {
        return id;
    }

    /*
    * Name 
    */
    public void setName(String name) {
        this.name = name;
    }
    public String getName() {
        return name;
    }

    /*
    * Creator ID 
    */
    public void setCreatorId(String creatorId) {
        this.creatorId = creatorId;
    }
    public String getCreatorId() {
        return creatorId;
    }

    /*
    * CreatedAt 
    */
    public void setCreatedAt(Timestamp createdAt) {
        this.createdAt = createdAt;
    }
    public Timestamp getCreatedAt() {
        return createdAt;
    }
}
