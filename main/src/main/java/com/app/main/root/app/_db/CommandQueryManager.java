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
    GROUP_CREATION_DATE(
        "SELECT created_at FROM groups WHERE id = ?"
    ),
    ADD_USER_TO_GROUP(
        "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)"
    ),
    GET_GROUP_BY_ID(
        "SELECT * FROM groups WHERE id = ?"
    ),
    GET_GROUP_NAME(
        "SELECT name FROM groups WHERE id = ?"
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
        "UPDATE groups SET last_message = ?, last_sender = ?, last_ctime = ? WHERE id = ?"
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
    GET_USERNAME(
        "SELECT username FROM users WHERE id = ?"
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
                username,
                created_at
            )        
            VALUES (?, ?, ?, ?, ?, ?)
        """
    ),
    GET_MESSAGES_BY_CHAT_ID(
        """
            SELECT m.*
            FROM messages m
            WHERE m.chat_id = ?
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT ? OFFSET ? 
        """
    ),
    GET_MESSAGE_COUNT_BY_CHAT_ID(
        "SELECT COUNT(*) as count FROM messages WHERE chat_id = ?"
    ),
    GET_RECENT_CHATS(
        """
        SELECT
            chat_id,
            MAX(created_at) as last_message_time,
            (
                SELECT content FROM messages m2
                WHERE m2.chat_id = m.chat_id
                ORDER BY m2.created_at DESC LIMIT 1
            ) as last_message,
            (
                SELECT m3.username FROM messages m3
                WHERE m3.chat_id = m.chat_id
                ORDER BY m3.created_at DESC LIMIT 1
            ) as last_sender,
            CASE
                WHEN chat_id LIKE 'group_%' THEN 'group'
                ELSE 'direct'
            END as chat_type
        FROM messages m
        WHERE chat_id IN 
        (
            SELECT DISTINCT chat_id
            FROM messages
            WHERE sender_id = ? 
                OR (chat_id LIKE 'direct_%' AND chat_id LIKE ?)
        )
        GROUP BY chat_id
        ORDER BY last_message_time DESC
        LIMIT ? OFFSET ?
        """
    ),
    GET_RECENT_CHATS_COUNT(
        """
            SELECT COUNT(DISTINCT chat_id) as total_chats
            FROM messages
            WHERE sender_id = ? OR (chat_id LIKE 'direct_%' AND chat_id LIKE ?)  
        """
    ),
    GET_ALL_MESSAGES(
        "SELECT m.* FROM messages m ORDER BY m.created_at DESC"
    ),
    GET_ALL_MESSAGES_BY_CHAT_ID(
        "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at DESC"
    ),
    GET_MESSAGES_BY_USER_ID(
        "SELECT * FROM messages WHERE sender_id = ? ORDER BY created_at DESC"
    ),
    CLEAR_MESSAGES(
        "DELETE from messages"
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
    GET_LAST_MESSAGE_BY_CHAT_ID(
        """
            SELECT content, sender_id, created_at as timestamp
            FROM messages
            WHERE chat_id = ?
            ORDER BY created_at DESC
            LIMIT 1        
        """
    ),

    /*
    * ~~~ SYSTEM MESSAGE SERVICE ~~~ 
    */
    SAVE_SYSTEM_MESSAGE(
        "INSERT INTO system_messages (chat_id, content, message_type, created_at) VALUES (?, ?, ?, ?)"
    ),
    GET_SYSTEM_MESSAGES_BY_GROUP(
        "SELECT * FROM system_messages WHERE chat_id = ? ORDER BY created_at DESC"
    ),

    /*
    * ~~~ FILES METADATA ~~~ 
    */
    UPLOAD_FILE(
        """
            INSERT INTO files_metadata(
                file_id,
                user_id,
                original_filename,
                file_size,
                mime_type,
                file_type,
                database_name,
                chat_id,
                uploaded_at,
                iv,
                tag
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
    ),
    DOWNLOAD_FILE(
        """
            SELECT 
                mime_type,
                file_type,
                database_name
            FROM
                files_metadata
            WHERE
                file_id = ? AND
                user_id = ? AND
                is_deleted = FALSE             
        """
    ),
    GET_ALL_FILES(
        """
            SELECT
                file_id, 
                user_id,
                original_filename, 
                file_size, 
                mime_type,
                file_type,
                chat_id,
                uploaded_at,
                last_modified
            FROM
                files_metadata
            WHERE
                user_id = ? AND
                chat_id = ? AND
                is_deleted = FALSE
            ORDER BY
                last_modified DESC
            LIMIT ? OFFSET ?     
        """
    ),
    GET_FILES(
        """
            SELECT * FROM files_metadata 
            WHERE chat_id = ? 
            ORDER BY uploaded_at DESC 
            LIMIT ? OFFSET ?
        """
    ),
    GET_FILE_SIZE(
        "SELECT SUM(file_size) as total FROM files_metadata WHERE user_id = ? AND is_deleted = FALSE"
    ),
    GET_TOTAL_FILES(
        "SELECT COUNT(*) FROM files_metadata WHERE user_id = ? AND is_deleted = FALSE"
    ),
    GET_TOTAL_FILES_FOLDER(
        "SELECT COUNT(*) from files_metadata WHERE user_id = ? AND chat_id = ? AND is_deleted = FALSE"
    ),
    DELETE_FILE(
        """
           UPDATE files_metadata
           SET is_deleted = TRUE
           WHERE file_id = ? AND user_id = ?
        """
    ),
    GET_FILE_DATABASE(
        "SELECT 1 FROM files_metadata WHERE file_id = ? AND user_id = ?"
    ),
    GET_TYPE_FILES(
        """
            SELECT file_type, SUM(file_size) as type_size, COUNT(*) as type_count
            FROM files_metadata WHERE user_id = ? AND is_deleted = FALSE
            GROUP BY file_type     
        """
    ),
    GET_DB_NAME_FILES(
        "SELECT database_name FROM files_metadata WHERE file_id = ? AND user_id = ?"
    ),
    GET_FILE_INFO(
        """
            SELECT
                file_id,
                original_filename,
                file_size,
                mime_type,
                file_type,
                chat_id,
                database_name,
                uploaded_at,
                last_modified,
                iv,
                tag
            FROM files_metadata
            WHERE file_id = ? AND user_id = ? AND is_deleted = FALSE     
        """
    ),
    GET_ENCRYPTED_FILE_CONTENT(
        """
            SELECT content FROM %s WHERE file_id = ?
        """
    ),

    /*
    * ~~~ IMAGE DATA ~~~ 
    */
    ADD_IMAGE(
        "INSERT INTO image_data(file_id, content) VALUES (?, ?)"
    ),
    GET_IMAGE(
        "SELECT content FROM image_data WHERE file_id = ?"
    ),

    /*
    * ~~~ VIDEO DATA ~~~ 
    */
    ADD_VIDEO(
        "INSERT INTO video_data(file_id, content) VALUES (?, ?)"
    ),
    GET_VIDEO(
        "SELECT content FROM video_data WHERE file_id = ?"
    ),

    /*
    * ~~~ AUDIO DATA ~~~ 
    */
    ADD_AUDIO(
        "INSERT INTO audio_data(file_id, content) VALUES (?, ?)"
    ),
    GET_AUDIO(
        "SELECT content FROM audio_data WHERE file_id = ?"
    ),

    /*
    * ~~~ DOCUMENT DATA ~~~ 
    */
    ADD_DOCUMENT(
        "INSERT INTO document_data(file_id, content) VALUES (?, ?)"
    ),
    GET_DOCUMENT(
        "SELECT content FROM document_data WHERE file_id = ?"
    ),

    /*
    * ~~~ KEY SERVICE ~~~ 
    */
    STORE_KEY(
        "INSERT INTO file_encryption_keys (file_id, file_id_hash, user_id, encrypted_key) VALUES (?, ?, ?, ?)"
    ),
    RETRIEVE_KEY(
        "SELECT encrypted_key FROM file_encryption_keys WHERE file_id = ? AND user_id = ?"
    ),
    DELETE_KEY(
        "DELETE FROM file_encryption_keys WHERE file_id = ? AND user_id = ?"
    ),
    KEY_EXISTS(
        "SELECT COUNT(*) as count FROM file_encryption_keys WHERE file_id = ? AND user_id = ?"
    ),

    /*
    * ~~~ NOTIFICATIONS SERVICE ~~~ 
    */
    SAVE_NOTIFICATION(
        """
            INSERT INTO notifications(
                id,
                user_id,
                type,
                title,
                message,
                chat_id,
                sender_id,
                sender_name,
                is_read,
                priority,
                metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
    ),
    GET_USER_NOTIFICATIONS(
        """
           SELECT * FROM notifications
           WHERE user_id = ?
           ORDER BY created_at DESC     
        """
    ),
    MARK_NOTIFICATION_AS_READ(
        "UPDATE notifications SET is_read = TRUE WHERE id = ?"
    ),
    DELETE_NOTIFICATION(
        "DELETE FROM notifications WHERE id = ?"
    ),
    GET_UNREAD_COUNT(
        "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = FALSE"
    ),
    MARK_ALL_AS_READ(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = ?"
    ),

    /*
    * ~~~ PASSWORD RESET SERVICE ~~~ 
    */
    CREATE_PASSWORD_RESET_TOKEN(
        "INSERT INTO password_reset (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)"
    ),
    GET_PASSWORD_RESET_TOKEN(
        "SELECT * FROM password_reset WHERE token = ? AND expires_at > ? AND used = FALSE"
    ),
    MARK_TOKEN_USED(
        "UPDATE password_reset SET used = TRUE WHERE token = ?"
    ),
    UPDATE_USER_PASSWORD(
        "UPDATE users SET password_hash = ? WHERE id = ?"
    ),
    INVALIDATE_USER_TOKENS(
        "UPDATE password_reset SET used = TRUE WHERE user_id = ?"
    ),
    GET_USER_BY_RESET_TOKEN(
        """
           SELECT u.* FROM users u
           JOIN password_reset prt ON u.id = prt.user_id
           WHERE prt.token = ? AND prt.expires_at > ? AND prt.used = FALSE     
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