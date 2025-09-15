import sqlite3 from 'sqlite3';

export class MessagesConfig {
    private db: sqlite3.Database;
        
    constructor(db: sqlite3.Database) {
        this.db = db;
    }

    public async saveMessage(data: {
        chatId: string;
        senderId: string;
        content: string;
        type?: string;
    }): Promise<number> {
        return new Promise((res, rej) => {
            this.db.run(
                `
                    INSERT INTO 
                    messages(
                        chat_id,
                        sender_id,
                        content,
                        message_type
                    )
                    VALUES (?, ?, ?, ?)
                `,
                [
                    data.chatId,
                    data.senderId,
                    data.content,
                    data.type || 'text'
                ],
                ((err) => {
                    if(err) rej(err);
                    else res(this.lastId);
                })
            );
        });
    }

    public async getMessages(chatId: string): Promise<any[]> {
        return new Promise((res, rej) => {
            this.db.all(
                `
                    SELECT m.*, u.username,
                    FROM messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE m.chat_id = ?
                    ORDER BY m.created_at DESC
                    LIMIT ?
                `,
                [chatId],
                (err, rows) => {
                    if(err) rej(err);
                    else res(rows);
                }
            );
        });
    }

    public async getRecentChats(userId: string, limit: number = 5): Promise<any[]> {
        return new Promise((res, rej) => {
            this.db.all(
                `
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
                                    SELECT username FROM WHERE id =
                                    CASE
                                        WHEN chat_id = ? THEN sender_id
                                        ELSE chat_id
                                    END
                                ) END as chat_name
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
                `,
                [userId, userId, userId, limit],
                (err, rows) => {
                    if(err) rej(err);
                    else res(rows);
                }
            );
        });
    }
}