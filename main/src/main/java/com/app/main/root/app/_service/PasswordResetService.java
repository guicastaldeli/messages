package com.app.main.root.app._service;
import com.app.main.root.app._crypto.password_encoder.PasswordEncoderWrapper;
import com.app.main.root.app._data.MessagePerspectiveDetector;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._db.DataSourceService;
import com.app.main.root.app._types.User;

import org.springframework.stereotype.Service;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class PasswordResetService {

    private final MessagePerspectiveDetector messagePerspectiveDetector;

    private final PasswordEncoderWrapper passwordEncoderWrapper;
    private final DataSourceService dataSourceService;
    private final ServiceManager serviceManager;

    public PasswordResetService(DataSourceService dataSourceService, ServiceManager serviceManager, PasswordEncoderWrapper passwordEncoderWrapper, MessagePerspectiveDetector messagePerspectiveDetector) {
        this.dataSourceService = dataSourceService;
        this.serviceManager = serviceManager;
        this.passwordEncoderWrapper = passwordEncoderWrapper;
        this.messagePerspectiveDetector = messagePerspectiveDetector;
    }

    private Connection getConnection() throws SQLException {
        return dataSourceService.setDb("password_reset").getConnection();
    }

    /**
     * Request Password Reset
     */
    public Map<String, Object> requestPasswordReset(String email) throws SQLException {
        String getUserQuery = CommandQueryManager.GET_USER_BY_EMAIL.get();
        User user = null;
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(getUserQuery);
        ) {
            stmt.setString(1, email.toLowerCase().trim());
            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    user = new User();
                    user.setId(rs.getString("id"));
                    user.setEmail(rs.getString("email"));
                    user.setUsername(rs.getString("username"));
                }
            }
        }

        if(user == null) {
            return Map.of(
                "success",
                true,
                "message",
                "Reset link sent"
            );
        }

        String token = UUID.randomUUID().toString();
        String tokenId = UUID.randomUUID().toString();
        LocalDateTime expiresAt = LocalDateTime.now().plusHours(24);
        
        String createTokenQuery = CommandQueryManager.CREATE_PASSWORD_RESET_TOKEN.get();
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(createTokenQuery);
        ) {
            stmt.setString(1, tokenId);
            stmt.setString(2, user.getId());
            stmt.setString(3, token);
            stmt.setTimestamp(4, Timestamp.valueOf(expiresAt));
            stmt.executeUpdate();
        }

        serviceManager
            .getEmailService()
            .getEmailData()
            .passwordReset(
            user.getEmail(), 
            user.getUsername(), 
            token
        );

        return Map.of(
            "success",
            true,
            "message",
            "Password reset link sended"
        );
    }

    /**
     * Validate Reset Token
     */
    public Map<String, Object> validateResetToken(String token) throws SQLException {
        String query = CommandQueryManager.GET_PASSWORD_RESET_TOKEN.get();
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, token);
            stmt.setTimestamp(2, Timestamp.valueOf(LocalDateTime.now()));
            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    return Map.of(
                        "valid", true,
                        "userId", rs.getString("user_id"),
                        "expiresAt", rs.getTimestamp("expires_at")
                    );
                }
            }
        }
        return Map.of(
            "valid", false,
            "error",
            "Invalid or expired token"
        );
    }

    /**
     * Reset Password
     */
    public Map<String, Object> resetPassword(String token, String newPassword) throws SQLException {
        Map<String, Object> validaton = validateResetToken(token);
        if(!(Boolean) validaton.get("valid")) {
            return Map.of(
                "success", false,
                "error",
                "Invalid or expired token"
            );
        }

        String userId = (String) validaton.get("userId");
        if(!passwordEncoderWrapper.isPasswordStrong(newPassword)) {
            return Map.of(
                "success", false, 
                "error", 
                "Password does not meet strength requirements"
            );
        }

        String hashedPassword = passwordEncoderWrapper.encode(newPassword);
        Connection conn = getConnection();
        try {
            conn.setAutoCommit(false);

            String updatePasswordQuery = CommandQueryManager.UPDATE_USER_PASSWORD.get();
            try(PreparedStatement stmt = conn.prepareStatement(updatePasswordQuery)) {
                stmt.setString(1, hashedPassword);
                stmt.setString(2, userId);
                stmt.executeUpdate();
            }

            String markTokenQuery = CommandQueryManager.MARK_TOKEN_USED.get();
            try(PreparedStatement stmt = conn.prepareStatement(markTokenQuery)) {
                stmt.setString(1, userId);
                stmt.executeUpdate();
            }

            conn.commit();
            
            User user = getUserById(userId);
            if(user != null) {
                serviceManager
                    .getEmailService()
                    .getEmailData()
                    .passwordChanged(
                        user.getEmail(),
                        user.getUsername()
                    );
            }

            return Map.of(
                "success", true, 
                "message", 
                "Password reset successfully"
            );
        } catch(SQLException err) {
            conn.rollback();
            throw err;
        } finally {
            conn.setAutoCommit(true);
            conn.close();
        }
    }

    /**
     * Get User by Id
     */
    private User getUserById(String userId) throws SQLException {
        String query = CommandQueryManager.GET_USER_BY_ID.get();
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, userId);
            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    User user = new User();
                    user.setId(rs.getString("id"));
                    user.setEmail(rs.getString("email"));
                    user.setUsername(rs.getString("username"));
                    return user;
                }
            }
        }
        return null;
    }
}
