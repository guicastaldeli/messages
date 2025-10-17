package com.app.main.root.app._db;

public enum CommandQueryManager {
    /*
    * ~~~ CONFIG ~~~ 
    */
    VALIDATE_DATABASE(
        "SELECT name FROM sqlite_master WHERE type='table' LIMIT 1"
    ),
    /*
    * ~~~ GROUP SERVICE ~~~ 
    */
    CREATE_GROUP(
        "INSERT INTO GROUPS (id, name, creator_id) VALUES (?, ?, ?)"
    ),
    ADD_USER_TO_GROUP(
        "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)"
    ),
    GET_GROUP_BY_ID(
        "SELECT * FROM groups WHERE id = ?"
    ),
    GET_GROUP_MEMBERS(
        """
            SELECT u.*
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ?        
        """
    ),
    GET_USER_GROUPS(
        """
            SELECT g.*
            FROM group_members gm
            JOIN groups g ON gm.group_id = g.id
            WHERE gm.user_id = ?        
        """
    ),

    /*
    * ~~~ USER SERVICE ~~~ 
    */
    ADD_USER(
        "INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)"
    ),
    GET_USER_BY_ID(
        "SELECT * FROM users WHERE id = ?"
    ),
    GET_USER_BY_USERNAME(
        "SELECT * FROM users WHERE username = ?"
    ),
    GET_ALL_USERS(
        "SELECT * FROM users ORDER BY created_at DESC"
    ),

    /*
    * ~~~ MESSAGE SERVICE ~~~ 
    */
    SAVE_MESSAGE(
        """
            INSERT INTO messages(
                chat_id,
                sender_id,
                content,
                message_type
            )        
            VALUES (?, ?, ?, ?)
        """
    ),
    GET_MESSAGES_BY_CHAT(
        """
            SELECT m.*, u.username
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ?
            ORDER BY m.created_at DESC        
        """
    ),
    GET_MESSAGES_BY_CHAT_WITH_LIMIT(
        """
            SELECT m.*, u.username
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ?
            ORDER BY m.created_at ASC
            LIMIT ?        
        """
    ),
    GET_RECENT_CHATS(
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
        """
    ),
    GET_RECENT_MESSAGES(
        """
            SELECT m.*, u.username
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ?
            ORDER BY m.created_at DESC
            LIMIT ?      
        """
    );

    /* Main */
    private String query;

    CommandQueryManager(String query) {
        this.query = query;
    }

    public String get() {
        return query;
    }
}
