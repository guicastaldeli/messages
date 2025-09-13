import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

export class DbService {
    private usersDb!: sqlite3.Database;
    private messagesDb!: sqlite3.Database;
    private groupsDb!: sqlite3.Database; 

    constructor() {
        this.load();
        this.init();
    }

    private load(): void {
        this.usersDb = new sqlite3.Database(path.join(__dirname, './data/users.db'));
        this.messagesDb = new sqlite3.Database(path.join(__dirname, './data/messages.db'));
        this.groupsDb = new sqlite3.Database(path.join(__dirname, './data/groups.db'));
    }

    private init(): void {
        /* Users Table */
        this.usersDb.serialize(() => {
            this.usersDb.run(`
                CREATE TABLE users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `, (err) => {
                if(err) console.error('Error users table', err);
            });
        });

        /* Groups Table */
        this.groupsDb.serialize(() => {
            this.groupsDb.run(`
                CREATE TABLE groups (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    creator_id TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (creator_id) REFERENCES users(id)
                );
            `, (err) => {
                if(err) console.error('Error groups table', err);
            });

            this.groupsDb.run(`
                CREATE TABLE group_members (
                    group_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (group_id, user_id),
                    FOREIGN KEY (group_id) REFERENCES groups(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );
            `, (err) => {
                if(err) console.error('Error group_members table', err);
            });
        });

        /* Messages Table */
        this.messagesDb.serialize(() => {
            this.messagesDb.run(`
                CREATE TABLE messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chat_id TEXT NOT NULL,
                    sender_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    message_type TEXT DEFAULT 'text',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (sender_id) REFERENCES users(id)
                );
            `, (err) => {
                if(err) console.error('Error messages table', err);
            });
        });
    }
}