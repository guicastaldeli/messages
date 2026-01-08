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
        
        try (Connection userConn = dataSourceService.setDb("user_service").getConnection();
            PreparedStatement stmt = userConn.prepareStatement(getUserQuery)) {
            
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
                "success", true,
                "message", "If an account exists, a reset link has been sent"
            );
        }

        String token = UUID.randomUUID().toString();
        String tokenId = UUID.randomUUID().toString();
        LocalDateTime expiresAt = LocalDateTime.now().plusHours(24);
        
        String createTokenQuery = CommandQueryManager.CREATE_PASSWORD_RESET_TOKEN.get();
        try(Connection passwordResetConn = dataSourceService.setDb("password_reset").getConnection();
            PreparedStatement stmt = passwordResetConn.prepareStatement(createTokenQuery)) {
            
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
            "success", true,
            "message", "Password reset link sent"
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
    public Map<String, Object> resetPassword(String token, String newPassword) {
        try {
            Map<String, Object> validation = validateResetToken(token);
            System.out.println("Token validation result: " + validation);
            
            if(!(Boolean) validation.get("valid")) {
                System.out.println("Token is invalid!");
                return Map.of(
                    "success", false,
                    "error", "Invalid or expired token"
                );
            }

            String userId = (String) validation.get("userId");
            System.out.println("User ID from token: " + userId);
            
            if(newPassword == null || newPassword.trim().isEmpty()) {
                System.out.println("New password is empty!");
                return Map.of(
                    "success", false, 
                    "error", "New password is required"
                );
            }
            
            if(!passwordEncoderWrapper.isPasswordStrong(newPassword)) {
                System.out.println("Password is not strong enough!");
                return Map.of(
                    "success", false, 
                    "error", "Password does not meet strength requirements"
                );
            }

            String hashedPassword = passwordEncoderWrapper.encode(newPassword);
            System.out.println("Password hashed successfully");
            
            Connection userConn = null;
            Connection passwordResetConn = null;
            try {
                userConn = dataSourceService.setDb("user_service").getConnection();
                passwordResetConn = getConnection();
                
                userConn.setAutoCommit(false);
                passwordResetConn.setAutoCommit(false);
                
                String updatePasswordQuery = CommandQueryManager.UPDATE_USER_PASSWORD.get();
                System.out.println("Updating password for user: " + userId + " in user_service database");
                try(PreparedStatement stmt = userConn.prepareStatement(updatePasswordQuery)) {
                    stmt.setString(1, hashedPassword);
                    stmt.setString(2, userId);
                    int rowsUpdated = stmt.executeUpdate();
                    System.out.println("Rows updated in users table: " + rowsUpdated);
                    
                    if(rowsUpdated == 0) {
                        throw new SQLException("No user found with ID: " + userId);
                    }
                }

                String markTokenQuery = CommandQueryManager.MARK_TOKEN_USED.get();
                System.out.println("Marking token as used in password_reset database");
                try(PreparedStatement stmt = passwordResetConn.prepareStatement(markTokenQuery)) {
                    stmt.setString(1, token);
                    int rowsUpdated = stmt.executeUpdate();
                    System.out.println("Rows updated in password_reset table: " + rowsUpdated);
                }

                userConn.commit();
                passwordResetConn.commit();
                System.out.println("Transactions committed successfully");
                
                User user = getUserById(userId);
                if(user != null) {
                    System.out.println("Sending password changed email to: " + user.getEmail());
                    serviceManager
                        .getEmailService()
                        .getEmailData()
                        .passwordChanged(
                            user.getEmail(),
                            user.getUsername()
                        );
                } else {
                    System.out.println("User not found for ID: " + userId);
                }

                System.out.println("Password reset successful!");
                return Map.of(
                    "success", true, 
                    "message", "Password reset successfully"
                );
            } catch(SQLException err) {
                System.err.println("SQL Error during password reset: " + err.getMessage());
                err.printStackTrace();
                
                if(userConn != null) {
                    try { userConn.rollback(); } catch (SQLException e) {}
                }
                if(passwordResetConn != null) {
                    try { passwordResetConn.rollback(); } catch (SQLException e) {}
                }
                
                throw err;
            } finally {
                if(userConn != null) {
                    try {
                        userConn.setAutoCommit(true);
                        userConn.close();
                    } catch (SQLException e) {}
                }
                if(passwordResetConn != null) {
                    try {
                        passwordResetConn.setAutoCommit(true);
                        passwordResetConn.close();
                    } catch (SQLException e) {}
                }
            }
        } catch(Exception err) {
            System.err.println("Error in resetPassword: " + err.getMessage());
            err.printStackTrace();
            return Map.of(
                "success", false,
                "error", "Failed to reset password: " + err.getMessage()
            );
        }
    }

    /**
     * Get User by Id
     */
    private User getUserById(String userId) throws SQLException {
        String query = CommandQueryManager.GET_USER_BY_ID.get();
        try (Connection userConn = dataSourceService.setDb("user_service").getConnection();
            PreparedStatement stmt = userConn.prepareStatement(query)) {
            
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
