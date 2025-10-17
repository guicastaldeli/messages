package com.app.main.root.app._service;
import com.app.main.root.app._types._User;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._types._Group;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.sql.*;

@Component
public class GroupService {
    private final DataSource dataSource;
    private InviteCodeManager inviteCodeManager;

    public GroupService(DataSource dataSource) {
        this.dataSource = dataSource;
        this.inviteCodeManager = new InviteCodeManager(dataSource);
    }

    public void createGroup(
        String id,
        String name,
        String creatorId
    ) throws SQLException {
        String query = CommandQueryManager.CREATE_GROUP.get();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, id);
            stmt.setString(2, name);
            stmt.setString(3, creatorId);
            stmt.executeUpdate();
        }
    }

    public boolean addUserToGroup(String groupId, String userId, String sessionId) throws SQLException {
        String query = CommandQueryManager.ADD_USER_TO_GROUP.get();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, groupId);
            stmt.setString(2, userId);
            stmt.setString(3, sessionId);
            stmt.executeUpdate();
        }

        return true;
    }

    public _Group getGroupId(String id) throws SQLException {
        String query = CommandQueryManager.GET_GROUP_BY_ID.get();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, id);
            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    return mapGroupFromResultSet(rs);
                }
            }
        }

        return null;
    }

    public List<_User> getGroupMembers(String groupId) throws SQLException {
        String query = CommandQueryManager.GET_GROUP_MEMBERS.get();

        List<_User> members = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, groupId);
            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    members.add(mapUserFromResultSet(rs));
                }
            }
        }

        return members;
    }

    public List<_Group> getUserGroups(String userId) throws SQLException {
        String query = CommandQueryManager.GET_USER_GROUPS.get();

        List<_Group> groups = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, userId);
            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    groups.add(mapGroupFromResultSet(rs));
                }
            }
        }

        return groups;
    }

    /*
    * Parser 
    */
    public Map<String, Object> parseData(Object data) throws Exception {
        if(data instanceof Map) {
            return (Map<String, Object>) data;
        } else if(data instanceof String) {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue((String) data, Map.class);
        } else {
            throw new IllegalArgumentException("Group data must be Map or JSON String!");
        }
    }

    /*
    * Get Group Info 
    */
    public Map<String, Object> getGroupInfo(String id) throws SQLException {
        String groupQuery = CommandQueryManager.GET_GROUP_INFO.get();
        String membersQuery = CommandQueryManager.GET_GROUP_INFO_MEMBERS.get();
        Map<String, Object> info = new HashMap<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement groupStmt = conn.prepareStatement(groupQuery);
            PreparedStatement membersStmt = conn.prepareStatement(membersQuery);
        ) {
            /* Group Info */
            groupStmt.setString(1, id);
            try(ResultSet groupRs = groupStmt.executeQuery()) {
                if(groupRs.next()) {
                    info.put("id", groupRs.getString("id"));
                    info.put("name", groupRs.getString("name"));
                    info.put("creatorId", groupRs.getString("creator_id"));
                    info.put("createdAt", groupRs.getString("createdAt"));
                } else {
                    throw new SQLException("Group not found: " + id);
                }
            }

            /* Members Info */
            membersStmt.setString(1, id);
            List<Map<String, String>> members = new ArrayList<>();
            try(ResultSet membersRs = membersStmt.executeQuery()) {
                while(membersRs.next()) {
                    Map<String, String> member = new HashMap<>();
                    member.put("id", membersRs.getString("id"));
                    member.put("username", membersRs.getString("username"));
                    members.add(member);
                }
            }
            info.put("members", members);
            info.put("memberCount", members.size());
        }

        return info;
    }

    public boolean isUserGroupMember(String id, String username) throws SQLException {
        String query = CommandQueryManager.IS_GROUP_MEMBER.get();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, id);
            stmt.setString(2, username);
            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    return rs.getInt(1) > 0;
                }
            }
        }

        return false;
    }

    /*
    **
    ***
    *** Maps
    ***
    **
    */
    private _Group mapGroupFromResultSet(ResultSet rs) throws SQLException {
        _Group group = new _Group();
        group.setId(rs.getString("id"));
        group.setName(rs.getString("name"));
        group.setCreatorId(rs.getString("creator_id"));
        group.setCreatedAt(rs.getTimestamp("created_at"));
        return group;
    }

    private _User mapUserFromResultSet(ResultSet rs) throws SQLException {
        _User user = new _User();
        user.setId(rs.getString("id"));
        user.setUsername(rs.getString("username"));
        user.setCreatedAt(rs.getTimestamp("created_at"));
        return user;
    }

    /*
    * Invite Codes 
    */
    public InviteCodeManager getInviteCodes() {
        return inviteCodeManager;
    }
}