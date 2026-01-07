package com.app.main.root.app._types;
import java.sql.Timestamp;

public class User {
    private String id;
    private String username;
    private String email;
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
     * Username
     */
    public void setUsername(String username) {
        this.username = username;
    }
    public String getUsername() {
        return username;
    }

    /**
     * Email 
     */
    public void setEmail(String email) {
        this.email = email;
    }
    public String getEmail() {
        return email;
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
