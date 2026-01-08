package com.app.main.root.app._data;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._service.GroupService;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import java.sql.*;
import java.util.*;

@Component
public class MemberVerifier {
    private final DataSource dataSource;
    private final EventTracker eventTracker;
    private final GroupService groupService;
    private final Map<String, VerificationResult> verificationCache = new ConcurrentHashMap<>();

    public MemberVerifier(
        DataSource dataSource,
        EventTracker eventTracker,
        @Lazy GroupService groupService
    ) {
        this.dataSource = dataSource;
        this.eventTracker = eventTracker;
        this.groupService = groupService;
    }

    /*
    **
    *** Verification Result
    **  
    */
    public static class VerificationResult {
        private final boolean success;
        private final String groupId;
        private final String userId;
        private final String username;
        private final String message;
        private List<String> currentMembers;
        private final Timestamp verifiedAt;

        public VerificationResult(
            boolean success,
            String groupId,
            String userId,
            String username,
            String message,
            List<String> currentMembers
        ) {
            this.success = success;
            this.groupId = groupId;
            this.userId = userId;
            this.username = username;
            this.message = message;
            this.currentMembers = currentMembers != null ? currentMembers : new ArrayList<>();
            this.verifiedAt = new Timestamp(System.currentTimeMillis());
        }

        public boolean isSuccess() {
            return success;
        }
        public String getGroupId() {
            return groupId;
        }
        public String getUserId() {
            return userId;
        }
        public String getUsername() {
            return username;
        }
        public String getMessage() {
            return message;
        }
        public List<String> getCurrentMembers() {
            return currentMembers;
        }
        public Timestamp getVerifiedAt() {
            return verifiedAt;
        }
        public boolean isUserMember() {
            return currentMembers.contains(userId);
        }
    }

    /*
    **
    *** Batch Verification Result
    **  
    */
    public static class BatchVerificationResult {
        private final String groupId;
        private final Map<String, VerificationResult> userResults;
        private final boolean allSuccessful;
        private final List<String> failedUsers;

        public BatchVerificationResult(
            String groupId,
            Map<String, VerificationResult> userResults
        ) {
            this.groupId = groupId;
            this.userResults = userResults;
            this.failedUsers = userResults.entrySet().stream()
                .filter(entry -> !entry.getValue().isSuccess())
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
            this.allSuccessful = failedUsers.isEmpty();
        }

        public String getGroupId() {
            return groupId;
        }
        public Map<String, VerificationResult> getUserResults() {
            return userResults;
        }
        public boolean isAllSuccessful() {
            return allSuccessful;
        }
        public List<String> getFailedUsers() {
            return failedUsers;
        }
        public List<String> getSuccessfulUsers() {
            return userResults.entrySet().stream()
                .filter(entry -> entry.getValue().isSuccess())
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
        }
    }

    /**
     * Verify Member
     */
    public VerificationResult verifyMember(String groupId, String userId, String username) {
        String cacheKey = groupId + ":" + userId;
        long time = System.currentTimeMillis();

        VerificationResult cached = verificationCache.get(cacheKey);
        if(
            cached != null &&
            time - cached.getVerifiedAt().getTime() < 30000
        ) {
            return cached;
        }

        try {
            List<String> currentMembers = getGroupMemberIds(groupId);
            boolean isMember = currentMembers.contains(userId);

            String message = isMember ?
                String.format("User %s (%s) verified as member of group %s", username, userId, groupId) :
                String.format("User %s (%s) NOT found in group %s", username, userId, groupId);

            VerificationResult result = new VerificationResult(
                isMember, 
                groupId, 
                userId, 
                username, 
                message, 
                currentMembers
            );
            verificationCache.put(cacheKey, result);

            eventTracker.track(
                "member-verification",
                Map.of(
                    "groupId", groupId,
                    "userId", userId,
                    "username", username,
                    "isMember", isMember,
                    "totalMembers", currentMembers.size(),
                    "cacheHit", false
                ),
                EventDirection.INTERNAL,
                "system",
                "MemberVerifier"
            );

            return result;
        } catch(SQLException err) {
            String errorMsg = String.format(
                "Database error verifying user %s in group %s: %s", 
                userId, groupId, err.getMessage()
            );

            eventTracker.track(
                "member-verification-error",
                Map.of(
                    "groupId", groupId,
                    "userId", userId,
                    "username", username,
                    "error", err.getMessage()
                ),
                EventDirection.INTERNAL,
                "system",
                "MemberVerifier"
            );
            return new VerificationResult(false, groupId, userId, username, errorMsg, new ArrayList<>());
        }
    }

    public BatchVerificationResult verifyMembers(String groupId, Map<String, String> users) {
        Map<String, VerificationResult> results = new HashMap<>();
        for(Map.Entry<String, String> userEntry : users.entrySet()) {
            String userId = userEntry.getKey();
            String username = userEntry.getValue();
            results.put(userId, verifyMember(groupId, userId, username));
        }
        return new BatchVerificationResult(groupId, results);
    }

    /**
     * Group Creator Verification
     */
    public VerificationResult verifyCreator(
        String groupId,
        String creatorId,
        String creatorName
    ) {
        VerificationResult result = verifyMember(groupId, creatorId, creatorName);
        if(!result.isSuccess()) {
            eventTracker.track(
                "creator-verification-failed",
                Map.of(
                    "groupId", groupId,
                    "creatorId", creatorId,
                    "creatorName", creatorName,
                    "verificationMessage", result.getMessage(),
                    "action", "logged_only"
                ),
                EventDirection.INTERNAL,
                "system",
                "MemberVerify"
            );

            clearCache(groupId, creatorName);
            result = verifyMember(groupId, creatorId, creatorName);
        }
        return result;
    }

    /**
     * Member Ids
     */
    public List<String> getGroupMemberIds(String groupId) throws SQLException {
        String query = CommandQueryManager.GET_MEMBER_ID.get();
        List<String> memberIds = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, groupId);
            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    memberIds.add(rs.getString("user_id"));
                }
            }
        }

        return memberIds;
    }

    /**
     * Clear Cache 
     */
    public void clearCache(String groupId, String userId) {
        if(groupId != null && userId != null) {
            verificationCache.remove(groupId + ":" + userId);
        } else if(groupId != null) {
            verificationCache.keySet().removeIf(key -> key.startsWith(groupId + ":"));
        } else {
            verificationCache.clear();
        }
    }
}
