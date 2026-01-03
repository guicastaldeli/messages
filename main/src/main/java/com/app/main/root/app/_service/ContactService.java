package com.app.main.root.app._service;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._db.DataSourceService;
import com.app.main.root.app._server.ConnectionTracker;
import com.app.main.root.app._types._User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.*;

@Component
public class ContactService {
    private final ServiceManager serviceManager;
    private final DataSourceService dataSourceService;
    @Autowired @Lazy private ConnectionTracker connectionTracker;
    
    public ContactService(
        @Lazy ServiceManager serviceManager,
        DataSourceService dataSourceService
    ) {
        this.serviceManager = serviceManager;
        this.dataSourceService = dataSourceService;
    }

    private Connection getConnection() throws SQLException {
        return dataSourceService.setDb("user").getConnection();
    }

    /*
    * Send Contact Request 
    */
    public Map<String, Object> sendContactRequest(String fromUserId, String toUsername) throws SQLException {
        _User toUser = serviceManager.getUserService().getUserByUsername(toUsername);
        if(toUser == null) throw new IllegalArgumentException("User not found");
        if(fromUserId.equals(toUser.getId())) throw new IllegalArgumentException("Cannot add yourself");
        if(isContact(fromUserId, toUser.getId())) throw new IllegalArgumentException("User is already in your contacts");

        //Check Request
        String crQuery = CommandQueryManager.CHECK_CONTACT_PENDING_REQUEST.get();
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(crQuery);
        ) {
            stmt.setString(1, fromUserId);
            stmt.setString(2, toUser.getId());
            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    throw new IllegalArgumentException("Contact request already sent!");
                }
            }
        }

        //Insert Request
        String requestId = "contact_req_" + System.currentTimeMillis() + 
            "_" + UUID.randomUUID().toString().substring(0, 12);
        String irQuery = CommandQueryManager.ADD_CONTACT_REQUEST.get();
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(irQuery);
        ) {
            stmt.setString(1, requestId);
            stmt.setString(2, fromUserId);
            stmt.setString(3, toUser.getId());
            stmt.executeUpdate();
        }

        //Notify Target User
        String toUserSession = serviceManager.getUserService().getSessionByUserId(toUser.getId());
        long time = System.currentTimeMillis();

        if(toUserSession != null) {
            Map<String, Object> notification = new HashMap<>();
            notification.put("type", "contact_request");
            notification.put("requestId", requestId);
            notification.put("fromUserId", fromUserId);

            String fromUsername = serviceManager.getUserService().getUsernameByUserId(fromUserId);
            notification.put("fromUsername", fromUsername);
            notification.put("timestamp", time);
            serviceManager.getUserService().sendMessageToUser(toUserSession, "contact-request", notification);
        }

        //Result
        Map<String, Object> result = new HashMap<>();
        result.put("requestId", requestId);
        result.put("toUserId", toUser.getId());
        result.put("toUsername", toUser.getUsername());
        result.put("status", "pending");
        return result;
    }

    /*
    * Response Contact Request 
    */
    public Map<String, Object> responseContactRequest(String requestId, String userId, boolean accept) throws SQLException {
        String status = accept ? "accepted" : "rejected";

        try(Connection conn = getConnection()) {
            conn.setAutoCommit(false);
            try {
                String fromUserId;
                String toUserId;

                String vQuery = CommandQueryManager.VERIFY_REQUEST.get();
                try(PreparedStatement stmt = conn.prepareStatement(vQuery)) {
                    stmt.setString(1, requestId);
                    stmt.setString(2, userId);
                    try(ResultSet rs = stmt.executeQuery()) {
                        if(!rs.next()) throw new IllegalArgumentException("Contact request not found");
                        fromUserId = rs.getString("from_user_id");
                        toUserId = rs.getString("to_user_id");
                    }
                }

                String uQuery = CommandQueryManager.UPDATE_CONTACT_STATUS.get();
                try(PreparedStatement updateStmt = conn.prepareStatement(uQuery)) {
                    updateStmt.setString(1, status);
                    updateStmt.setString(2, requestId);
                    updateStmt.executeUpdate();
                }

                if(accept) {
                    addContact(conn, fromUserId, toUserId);
                    addContact(conn, toUserId, fromUserId);
                }
                conn.commit();
                if(accept) notifyContactAdded(fromUserId, toUserId);

                String fromUserSession = serviceManager.getUserService().getSessionByUserId(fromUserId);
                if(fromUserSession != null) {
                    Map<String, Object> notification = new HashMap<>();
                    notification.put("type", "contact_request_response");
                    notification.put("requestId", requestId);
                    notification.put("accepted", accept);
                    notification.put("respondentId", userId);
                    notification.put("respondentUsername", serviceManager.getUserService().getUsernameByUserId(userId));
                    serviceManager.getUserService().sendMessageToUser(fromUserSession, "contact-request-response", notification);
                }

                Map<String, Object> result = new HashMap<>();
                result.put("requestId", requestId);
                result.put("accepted", accept);
                result.put("fromUserId", fromUserId);
                return result;
            } catch(SQLException err) {
                conn.rollback();
                System.err.println("Transaction rolled back: " + err.getMessage());
                throw err;
            }
        }
    }

    /*
    * Add Contact 
    */
    private void addContact(Connection conn, String userId, String contactId) throws SQLException {
        String contactEntryId = 
            "contact_" + System.currentTimeMillis() + "_" + 
            UUID.randomUUID().toString().substring(0, 12);
        String query = CommandQueryManager.ADD_CONTACT.get();

        try(PreparedStatement stmt = conn.prepareStatement(query)) {
            stmt.setString(1, contactEntryId);
            stmt.setString(2, userId);
            stmt.setString(3, contactId);
            stmt.executeUpdate();
        }
    }

    /*
    * Is Contact 
    */
    public boolean isContact(String userId, String contactId) throws SQLException {
        String query = CommandQueryManager.IS_CONTACT.get();
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, userId);
            stmt.setString(2, contactId);
            try(ResultSet rs = stmt.executeQuery()) {
                return rs.next();
            }
        }
    }

    /*
    * Remove Contact 
    */
    public boolean removeContact(String userId, String contactId) throws SQLException {
        String query = CommandQueryManager.REMOVE_CONTACT.get();
        try(Connection conn = getConnection()) {
            conn.setAutoCommit(false);
            try {
                String userUsername = serviceManager.getUserService().getUsernameByUserId(userId);
                String contactUsername = serviceManager.getUserService().getUsernameByUserId(contactId);

                try(PreparedStatement stmt = conn.prepareStatement(query)) {
                    stmt.setString(1, userId);
                    stmt.setString(2, contactId);
                    stmt.executeUpdate();
                }

                try(PreparedStatement stmt = conn.prepareStatement(query)) {
                    stmt.setString(1, contactId);
                    stmt.setString(2, userId);
                    stmt.executeUpdate();
                }

                conn.commit();
                notifyContactRemoved(userId, contactId, userUsername, contactUsername);
                return true;
            } catch(SQLException err) {
                conn.rollback();
                System.err.println("Failed to remove contact: " + err.getMessage());
                throw err;
            }
        }
    }

    /*
    **
    *** Get Contacts
    ** 
    */
    public List<Map<String, Object>> getContacts(String userId) throws SQLException {
        String query = CommandQueryManager.GET_CONTACTS.get();
        List<Map<String, Object>> contacts = new ArrayList<>();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, userId);
            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    Map<String, Object> contact = new HashMap<>();
                    String contactId = rs.getString("id");
                    Boolean isOnline = contactOnline(contactId);
                    
                    contact.put("id", contactId);
                    contact.put("username", rs.getString("username"));
                    contact.put("email", rs.getString("email"));
                    contact.put("isOnline", isOnline);
                    contact.put("addedAt", rs.getTimestamp("created_at"));
                    contacts.add(contact);
                }
            }
        }

        return contacts;
    }

    /*
    **
    *** Get Pending Contacts
    ** 
    */
    public List<Map<String, Object>> getPendingContactRequests(String userId) throws SQLException {
        String query = CommandQueryManager.GET_PENDING_CONTACTS.get();
        List<Map<String, Object>> requests = new ArrayList<>();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, userId);
            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    Map<String, Object> request = new HashMap<>();
                    request.put("requestId", rs.getString("id"));
                    request.put("fromUserId", rs.getString("from_user_id"));
                    request.put("fromUsername", rs.getString("username"));
                    request.put("createdAt", rs.getTimestamp("created_at"));
                    requests.add(request);
                }
            }
        }

        return requests;
    }

    /*
    **
    *** Notifications
    ** 
    */
    private void notifyContactAdded(String fUserId, String sUserId) {
        String[] userIds = { fUserId, sUserId };
        long time = System.currentTimeMillis();

        for(String userId : userIds) {
            String sessionId = serviceManager.getUserService().getSessionByUserId(userId);
            if(sessionId != null) {
                Map<String, Object> notification = new HashMap<>();
                notification.put("type", "contact_added");
                notification.put("timestamp", time);
                serviceManager.getUserService().sendMessageToUser(sessionId, "contact-added", notification);
            }
        }
    }

    private boolean contactOnline(String contactId) {
        String contactSessionId = serviceManager.getUserService().getSessionByUserId(contactId);
        if(contactSessionId == null) return false;

        boolean isOnline = connectionTracker.getActiveConnections()
            .stream()
            .anyMatch(
                connInfo -> contactSessionId.equals(connInfo.sessionId)
            );
        return isOnline;
    }

    private void notifyContactRemoved(
        String userId,
        String contactId,
        String userUsername,
        String contactUsername
    ) {
        String[] userIds = { userId, contactId };
        long time = System.currentTimeMillis();

        for(String currentUserId : userIds) {
            String sessionId = serviceManager.getUserService().getSessionByUserId(currentUserId);
            if(sessionId != null) {
                Map<String, Object> notification = new HashMap<>();
                notification.put("type", "contact_removed");
                notification.put("timestamp", time);

                if(currentUserId.equals(userId)) {
                    notification.put("removedUser", contactUsername);
                    notification.put("action", "you_removed");
                } else {
                    notification.put("removedUser", userUsername);
                    notification.put("action", "removed_you");
                }

                serviceManager.getUserService().sendMessageToUser(sessionId, "contact-removed", notification);
            }
        }
    }
}
