package com.app.main.root.app._db;

public enum CommandQueryManager {
    /*
    * ~~~ CONFIG ~~~ 
    */
    VALIDATE_DATABASE(
        "SELECT name FROM sqlite_master WHERE type='table' LIMIT 1"
    ),

    /*
    * ~~~ DIRECT SERVICE ~~~ 
    */
    GET_USER_DIRECT(
        """
            SELECT 
                uc.id,
                uc.contact_id,
                u.username,
                uc.created_at
            FROM user_contacts uc
            JOIN users u ON uc.contact_id = u.id
            WHERE uc.user_id = ?
            ORDER BY uc.created_at DESC
        """
    ),
    
    /*
    * ~~~ GROUP SERVICE ~~~ 
    */
    CREATE_GROUP(
        "INSERT INTO groups (id, name, creator_id) VALUES (?, ?, ?)"
    ),
    ADD_USER_TO_GROUP(
        "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)"
    ),
    GET_GROUP_BY_ID(
        "SELECT * FROM groups WHERE id = ?"
    ),
    GET_GROUP_MEMBERS(
        """
            SELECT
                gm.user_id as id,
                gm.user_id as username,
                CURRENT_TIMESTAMP as created_at
            FROM group_members gm
            WHERE gm.group_id = ?      
        """
    ),
    GET_USER_GROUPS(
        """
            SELECT g.id, g.name, g.creator_id, g.created_at,
                (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count
            FROM groups g
            INNER join group_members gm ON g.id = gm.group_id
            WHERE gm.user_id = ?
            ORDER BY g.created_at DESC     
        """
    ),
    GET_GROUP_INFO(
        "SELECT * FROM groups WHERE id = ?"
    ),
    GET_GROUP_INFO_MEMBERS(
        """
            SELECT gm.user_id as id, gm.user_id as username
            FROM group_members gm
            WHERE gm.group_id = ?        
        """
    ),
    STORE_INVITE_CODE(
        """
            INSERT INTO group_invite_codes (group_id, invite_code, created_by, user_id, expires_at)
            VALUES (?, ?, ?, ?, ?)            
        """
    ),
    VALIDATE_INVITE_CODE(
        """
            SELECT COUNT(*) FROM group_invite_codes
            WHERE group_id = ? AND invite_code = ? AND is_used = 0 AND expires_at > ?
        """
    ),
    INVITE_CODE_IS_USED(
        """
            UPDATE group_invite_codes SET is_used = 1, used_at = ?
            WHERE group_id = ? AND invite_code = ?
        """
    ),
    GET_ACTIVE_INVITE_CODES(
        """
            SELECT invite_code, created_by, created_at, expires_at
            FROM group_invite_codes
            WHERE group_id = ? AND is_used = 0 AND expires_at > ?
        """
    ),
    IS_GROUP_MEMBER(
        """
            SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?
        """
    ),
    UPDATE_GROUP_LAST_MESSAGE(
        "UPDATE groups SET last_message = ?, last_sender = ?, last_message_time = ? WHERE id = ?"
    ),
    EXEC_INDEX_GROUP_INVITE_CODE(
        "CREATE INDEX IF NOT EXISTS idx_group_invite_code ON group_invite_codes(group_id, invite_code)"
    ),
    EXEC_INDEX_INVITE_EXPIRES(
        "CREATE INDEX IF NOT EXISTS idx_invite_expires ON group_invite_codes(expires_at)"
    ),
    EXEC_INDEX_INVITE_USED(
        "CREATE INDEX IF NOT EXISTS idx_invite_used ON group_invite_codes(is_used)"
    ),
    FIND_GROUP_ID_BY_INVITE_CODE(
        """
            SELECT group_id FROM group_invite_codes
            WHERE invite_code = ? AND is_used = 0 AND expires_at > ?        
        """
    ),
    REMOVE_USER_FROM_GROUP(
        "DELETE FROM group_members WHERE group_id = ? AND user_id = ?"
    ),
    GET_MEMBER_ID(
        "SELECT user_id FROM group_members WHERE group_id = ?"
    ),

    /*
    * ~~~ USER SERVICE ~~~ 
    */
    ADD_USER(
        "INSERT OR IGNORE INTO users (id, username, session_id) VALUES (?, ?, ?)"
    ),
    GET_USER_BY_ID(
        "SELECT * FROM users WHERE id = ?"
    ),
    GET_USER_BY_USERNAME(
        "SELECT * FROM users WHERE username = ?"
    ),
    GET_USER_BY_EMAIL(
        "SELECT * FROM users WHERE email = ?"
    ),
    GET_ALL_USERS(
        "SELECT * FROM users ORDER BY created_at DESC"
    ),
    REGISTER_USER(
        """
            INSERT INTO users (id, username, email, password_hash, session_id)
            VALUES (?, ?, ?, ?, ?)        
        """
    ),
    CREATE_USER_PROFILE(
        "INSERT INTO user_profiles (user_id, display_name) VALUES (?, ?)"
    ),
    LOGIN_USER(
        """
            SELECT id, username, email, password_hash, is_active FROM users
            WHERE (email = ?) AND is_active = TRUE
        """
    ),
    UPDATE_USER_SESSION(
        "UPDATE users SET session_id = ?, last_login = ? WHERE id = ?"
    ),
    UPDATE_LAST_LOGIN(
        "UPDATE users SET last_login = ? WHERE id = ?"
    ),
    GET_USER_PROFILE(
        "SELECT * FROM user_profiles where user_id = ?"
    ),

    /*
    * ~~~ CONTACT SERVICE ~~~ 
    */
    CHECK_CONTACT_PENDING_REQUEST(
    "SELECT id FROM contact_requests WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'"
    ),
    ADD_CONTACT_REQUEST(
        "INSERT INTO contact_requests (id, from_user_id, to_user_id, status) VALUES (?, ?, ?, 'pending')"
    ),
    VERIFY_REQUEST(
        "SELECT from_user_id, to_user_id FROM contact_requests WHERE id = ? AND to_user_id = ? AND status = 'pending'"
    ),
    UPDATE_CONTACT_STATUS(
        "UPDATE contact_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ),
    ADD_CONTACT(
        "INSERT INTO user_contacts (id, user_id, contact_id) VALUES (?, ?, ?)"
    ),
    IS_CONTACT(
        "SELECT id FROM user_contacts WHERE user_id = ? AND contact_id = ?"
    ),
    GET_CONTACTS(
        """
            SELECT
                u.id,
                u.username,
                u.email,
                uc.created_at,
                CASE
                    WHEN us.session_id IS NOT NULL THEN 1
                    ELSE 0
                END as is_online
            FROM user_contacts uc
            JOIN users u ON uc.contact_id = u.id
            LEFT JOIN users us ON uc.contact_id = us.id AND us.session_id IS NOT NULL
            WHERE uc.user_id = ?
            ORDER BY u.username
        """
    ),
    GET_PENDING_CONTACTS(
        """
            SELECT cr.id, cr.from_user_id, u.username, cr.created_at
            FROM contact_requests cr
            JOIN users u ON cr.from_user_id = u.id
            WHERE cr.to_user_id = ? AND cr.status = 'pending'
            ORDER BY cr.created_at DESC        
        """
    ),
    REMOVE_CONTACT(
        "DELETE FROM user_contacts WHERE user_id = ? AND contact_id = ?"
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
                message_type,
                username
            )        
            VALUES (?, ?, ?, ?, ?)
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
                    SELECT username FROM messages u
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
                            SELECT username FROM messages WHERE id =
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
        "SELECT * FROM messages ORDER BY created_at DESC LIMIT ?"
    ),
    GET_ALL_MESSAGES(
        "SELECT m.* FROM messages m ORDER BY m.created_at DESC"
    ),
    GET_ALL_MESSAGES_BY_CHAT_ID(
        "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at DESC"
    ),
    GET_MESSAGES_BY_TYPE(
        "SELECT * FROM messages WHERE message_type = ? ORDER BY created_at DESC"    
    ),
    GET_MESSAGES_BY_USERNAME(
        "SELECT * FROM messages WHERE username = ? ORDER BY created_at DESC"
    ),
    CLEAR_MESSAGES(
        "DELETE from MESSAGES"
    ),
    TOTAL_MESSAGES(
        "SELECT COUNT(*) as count FROM messages"
    ),
    TOTAL_MESSAGES_DIRECT(
        "SELECT COUNT(*) as count FROM messages WHERE message_type = 'DIRECT'"
    ),
    TOTAL_MESSAGES_GROUP(
        "SELECT COUNT(*) as count FROM messages WHERE message_type = 'GROUP'"
    ),

    /*
    * ~~~ SYSTEM MESSAGE SERVICE ~~~ 
    */
    SAVE_SYSTEM_MESSAGE(
        "INSERT INTO system_messages (group_id, content, message_type) VALUES (?, ?, ?)"
    ),
    GET_SYSTEM_MESSAGES_BY_GROUP(
        "SELECT * FROM system_messages WHERE group_id = ? ORDER BY created_at ASC"
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