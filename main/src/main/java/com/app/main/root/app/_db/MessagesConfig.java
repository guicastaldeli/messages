package com.app.main.root.app._db;
import com.app.main.root.app._types._Message;
import com.app.main.root.app._types._RecentChat;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.List;
import java.sql.*;

@Component
public class MessagesConfig {
    private final DataSource dataSource;

    public MessagesConfig(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public int saveMessage(
        String chatId,
        String senderId,
        String content,
        String type
    ) throws SQLException {
        String sql =
        """
            INSERT INTO message(
                chat_id,
                sender_id,
                content,
                message_type
            )        
            VALUES (?, ?, ?, ?)
        """;

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)
        ) {
            String fType = type != null ? type : "text";

            stmt.setString(1, chatId);
            stmt.setString(2, senderId);
            stmt.setString(3, content);
            stmt.setString(4, fType);

            int affectedRows = stmt.executeUpdate();
            if(affectedRows > 0) {
                try(ResultSet generatedKeys = stmt.getGeneratedKeys()) {
                    if(generatedKeys.next()) {
                        return generatedKeys.getInt(1);
                    }
                }
            }

            return -1;
        }
    }

    public List<_Message> getMessages(String chatId) throws SQLException {
        String sql =
        """
            SELECT m.*, u.username
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ?
            ORDER BY m.created_at DESC        
        """;

        List<_Message> messages = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql)
        ) {
            stmt.setString(1, chatId);

            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    messages.add(mapMessageFromResultSet(rs));
                }
            }
        }

        return messages;
    }

    public List<_Message> getMessagesByChatId(String chatId, int limit) throws SQLException {
        String sql =
        """
            SELECT m.*, u.username
            FROM messages m
            LEFT JOIN users u ON m.serder_id = u.id
            WHERE m.chat_id = ?
            ORDER BY m.created_at ASC
            LIMIT ?        
        """;

        List<_Message> messages = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql)
        ) {
            stmt.setString(1, chatId);
            stmt.setInt(2, limit);

            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    messages.add(mapMessageFromResultSet(rs));
                }
            }
        }

        return messages;
    }

    public List<_RecentChat> getRecentChats(String userId, int limit) throws SQLException {
        String sql =
        """
            SELECT
                chat_id,
                MAX(created_at) as last_message_time,
                (
                    SELECT content FROM messages m2
                    WHERE m2.chat_id = m.chat_id
                    ORDER BY created_at DESC LIMIT 1
                ) as last_message,
                (
                    SELECT username FROM users u
                    JOIN messages m3 ON m3.sender_id = u.id
                    WHERE m3.chat_id = m.chat_id
                    ORDER BY m3.created_at DESC LIMIT 1
                ) as last_sender,
                CASE
                    WHEN chat_id LIKE 'group_%' THEN 'group'
                    ELSE 'direct'
                END as chat_type,
                CASE
                    WHEN chat_id LIKE 'group_%' THEN
                        (SELECT name FROM groups WHERE id = chat_id)
                    ELSE
                        (
                            SELECT username FROM users WHERE id =
                            CASE
                                WHEN chat_id = ? THEN sender_id
                                ELSE chat_id
                            END
                        ) 
                END as chat_name
            FROM messages m
            WHERE chat_id IN 
            (
                SELECT DISTINCT chat_id
                FROM messages
                WHERE sender_id = ? OR chat_id = ?
            )
            GROUP BY chat_id
            ORDER BY last_message_time DESC
            LIMIT ?
        """;

        List<_RecentChat> recentChats = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql)
        ) {
            stmt.setString(1, userId);
            stmt.setString(2, userId);
            stmt.setString(3, userId);
            stmt.setInt(4, limit);

            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    recentChats.add(mapRecentChatFromResultSet(rs));
                }
            }
        }

        return recentChats;
    }

    public List<_Message> getRecentMessages(String chatId, int limit) throws SQLException {
        String sql =
        """
            SELECT m.*, u.username
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ?
            ORDER BY m.created_at DESC
            LIMIT ?      
        """;

        List<_Message> messages = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(sql)
        ) {
            stmt.setString(1, chatId);
            stmt.setInt(2, limit);

            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    messages.add(mapMessageFromResultSet(rs));
                }
            }
        }

        List<_Message> reversed = new ArrayList<>();
        for(int i = messages.size() - 1; i >= 0; i--) reversed.add(messages.get(i));
        return reversed;
    }

    /*
    **
    ***
    *** Maps
    ***
    **
    */
    private _Message mapMessageFromResultSet(ResultSet rs) throws SQLException {
        _Message message = new _Message();
        message.setId(rs.getInt("id"));
        message.setChatId(rs.getString("chat_id"));
        message.setSenderId(rs.getString("sender_id"));
        message.setContent(rs.getString("content"));
        message.setMessageType(rs.getString("message_type"));
        message.setCreatedAt(rs.getTimestamp("created_at"));
        message.setUsername(rs.getString("username"));
        return message;
    }

    private _RecentChat mapRecentChatFromResultSet(ResultSet rs) throws SQLException {
        _RecentChat chat = new _RecentChat();
        chat.setChatId(rs.getString("chat_id"));
        chat.setLastMessageTime(rs.getTimestamp("last_message_time"));
        chat.setLastMessage(rs.getString("last_message"));
        chat.setLastSender(rs.getString("last_sender"));
        chat.setChatType(rs.getString("chat_type"));
        chat.setChatName(rs.getString("chat_name"));
        return chat;
    }
}