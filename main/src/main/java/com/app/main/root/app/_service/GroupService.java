package com.app.main.root.app._service;
import com.app.main.root.app._types._User;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._types._Group;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.sql.*;

@Component
public class GroupService {
    private final DataSource dataSource;

    public GroupService(DataSource dataSource) {
        this.dataSource = dataSource;
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

    public void addUserToGroup(String groupId, String userId) throws SQLException {
        String query = CommandQueryManager.ADD_USER_TO_GROUP.get();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, groupId);
            stmt.setString(2, userId);
            stmt.executeUpdate();
        }
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
    public Map<String, Object> getGroupInfo(String id) {
        
    }

    /*
    * Store Invite Code 
    */
    public void storeInviteCode(
        String groupId,
        String inviteCode,
        String createdBy
    ) {

    }

    public boolean isUserGroupMember(String id, String username) {
        
    }
}