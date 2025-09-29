package com.app.main.root.app._types;
import java.sql.Timestamp;

public class _User {
    private String id;
    private String username;
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
    * Username 
    */
    public void setUsername(String username) {
        this.username = username;
    }
    public String getUsername() {
        return username;
    }

    /*
    * Created At 
    */
    public void setCreatedAt(Timestamp createdAt) {
        this.createdAt = createdAt;
    }
    public Timestamp getCreatedAt() {
        return createdAt;
    }
}
