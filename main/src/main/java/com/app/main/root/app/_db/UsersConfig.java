package com.app.main.root.app._db;
import com.app.main.root.app._db.types._User;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.List;
import java.sql.*;

@Component
public class UsersConfig {
    private final DataSource dataSource;

    public UsersConfig(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public void addUser(String id, String username) throws SQLException {
        String sql = "INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)";

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql)
        ) {
            stmt.setString(1, id);
            stmt.setString(2, username);
            stmt.executeUpdate();
        }
    }

    public _User getUserById(String id) throws SQLException {
        String sql = "SELECT * FROM users WHERE id = ?";

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql)
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
        String sql = "SELECT * FROM users WHERE username = ?";

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql)
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
        String sql = "SELECT * FROM users ORDER BY created_at DESC";
        List<_User> users = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql);
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