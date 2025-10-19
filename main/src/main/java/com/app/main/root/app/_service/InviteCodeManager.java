package com.app.main.root.app._service;
import com.app.main.root.app._db.CommandQueryManager;
import java.sql.Connection;
import java.sql.Statement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import javax.sql.DataSource;
import java.util.*;

public class InviteCodeManager {
    private final DataSource dataSource;

    public InviteCodeManager(DataSource dataSource) {
        this.dataSource = dataSource;
        this.createIdx();
    }

    /*
    * Create Indexes 
    */
    public void createIdx() {
        String groupInviteCode = CommandQueryManager.EXEC_INDEX_GROUP_INVITE_CODE.get();
        String inviteExpires = CommandQueryManager.EXEC_INDEX_INVITE_EXPIRES.get();
        String inviteCodeUsed = CommandQueryManager.EXEC_INDEX_INVITE_USED.get();

        try(
            Connection conn = dataSource.getConnection();
            Statement stmt = conn.createStatement();
        ) {
            stmt.execute(groupInviteCode);
            stmt.execute(inviteExpires);
            stmt.execute(inviteCodeUsed);
        } catch(Exception err) {
            err.printStackTrace();
            System.err.println("Idx Error");
        }  
    }

    /*
    * Store 
    */
    public void storeInviteCode(
        String groupId,
        String inviteCode,
        String createdBy
    ) throws SQLException {
        String query = CommandQueryManager.STORE_INVITE_CODE.get();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            LocalDateTime expiresAt = LocalDateTime.now().plusHours(24);
            stmt.setString(1, groupId);
            stmt.setString(2, inviteCode);
            stmt.setString(3, createdBy);
            stmt.setTimestamp(4, Timestamp.valueOf(expiresAt));
            stmt.executeUpdate();
        }
    }

    /*
    * Validate
    */
    public boolean validateInviteCode(String code) throws SQLException {
        String groupId = findGroupByCode(code);
        if(groupId == null) throw new RuntimeException("Group id is null");

        String query = CommandQueryManager.VALIDATE_INVITE_CODE.get();
        Timestamp timestamp = Timestamp.valueOf(LocalDateTime.now());

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, groupId);
            stmt.setString(2, code);
            stmt.setTimestamp(3, timestamp);

            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    return rs.getInt(1) > 0;
                }
            }
        }

        return false;
    }

    /*
    * Mark as Used 
    */
    public void markInviteCodeAsUsed(String code) throws SQLException {
        String groupId = findGroupByCode(code);
        if(groupId == null) throw new RuntimeException("Group id is null");
        
        String query = CommandQueryManager.INVITE_CODE_IS_USED.get();
        Timestamp timestamp = Timestamp.valueOf(LocalDateTime.now());

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setTimestamp(1, timestamp);
            stmt.setString(2, groupId);
            stmt.setString(3, code);
            stmt.executeUpdate();
        }
    }

    /*
    * Get Active Code 
    */
    public List<Map<String, Object>> getActiveInviteCodes(String groupId) throws SQLException {
        String query = CommandQueryManager.GET_ACTIVE_INVITE_CODES.get();
        Timestamp timestamp = Timestamp.valueOf(LocalDateTime.now());
        List<Map<String, Object>> codes = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, groupId);
            stmt.setTimestamp(2, timestamp);

            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    Map<String, Object> codeInfo = new HashMap<>();
                    codeInfo.put("inviteCode", rs.getString("invite_code"));
                    codeInfo.put("createdBy", rs.getString("created_by"));
                    codeInfo.put("createdAt", rs.getString("created_at"));
                    codeInfo.put("expiresAt", rs.getString("expires_at"));
                    codes.add(codeInfo);
                }
            }
        }

        return codes;
    }

    /*
    * Find Group by Code 
    */
    public String findGroupByCode(String inviteCode) throws SQLException {
        String query = CommandQueryManager.FIND_GROUP_ID_BY_INVITE_CODE.get();
        Timestamp currentTime = Timestamp.valueOf(LocalDateTime.now());

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, inviteCode);
            stmt.setTimestamp(2, currentTime);

            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    return rs.getString("group_id");
                }
            }
        }

        return null;
    }
}
