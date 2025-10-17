package com.app.main.root.app._service;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._types._User;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.List;
import java.sql.*;

@Component
public class UserService {
    private final DataSource dataSource;

    public UserService(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public void addUser(String id, String username) throws SQLException {
        String query = CommandQueryManager.ADD_USER.get();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, id);
            stmt.setString(2, username);
            stmt.executeUpdate();
        }
    }

    public _User getUserById(String id) throws SQLException {
        String query = CommandQueryManager.GET_USER_BY_ID.get();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, id);

            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    return mapUserFromResultSet(rs);
                }
            }
        }

        return null;
    }

    public _User getUserByUsername(String username) throws SQLException {
        String query = CommandQueryManager.GET_USER_BY_USERNAME.get();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, username);

            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    return mapUserFromResultSet(rs);
                }
            }
        }

        return null;
    }

    public List<_User> getAllUsers() throws SQLException {
        String query = CommandQueryManager.GET_ALL_USERS.get();
        List<_User> users = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
            ResultSet rs = stmt.executeQuery()
        ) {
            while(rs.next()) {
                users.add(mapUserFromResultSet(rs));
            }
        }

        return users;
    }

    /*
    **
    ***
    *** Maps
    ***
    **
    */
    private _User mapUserFromResultSet(ResultSet rs) throws SQLException {
        _User user = new _User();
        user.setId(rs.getString("id"));
        user.setUsername(rs.getString("username"));
        user.setCreatedAt(rs.getTimestamp("created_at"));
        return user;
    }
}