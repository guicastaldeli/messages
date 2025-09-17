import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { UsersConfig } from './users-config';
import { MessagesConfig } from './messages-config';
import { GroupsConfig } from './groups-config';
import { colorConverter } from '../.utils/color-converter';

class DbService {
    private usersDb!: sqlite3.Database;
    private messagesDb!: sqlite3.Database;
    private groupsDb!: sqlite3.Database; 

    public usersConfig!: UsersConfig;
    public messagesConfig!: MessagesConfig;
    public groupsConfig!: GroupsConfig;

    constructor() {
        this.cleanupCorruptedFiles();
        this.ensureDataDir();
        this.load();
        this.init();
        this.set();
    }

    private cleanupCorruptedFiles(): void {
        const dataDir = path.join(__dirname, './src');
        if(!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            return;
        }

        const filesToClean = [
            path.join(dataDir, 'users.db'),
            path.join(dataDir, 'messages.db'),
            path.join(dataDir, 'groups.db')
        ];
        filesToClean.forEach(path => {
            if(fs.existsSync(path)) {
                const content = fs.readFileSync(path, 'utf8');
                if(!content.includes('CREATE TABLE')) {
                    console.log(`${colorConverter.style(`REMOVING CORRUPTED FILE: ${path}...`, ['red', 'bold'])}`);
                    fs.unlinkSync(path);
                }
            }
        });
    }

    private ensureDataDir(): void {
        const dataDir = path.join(__dirname, './src');
        if(!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    }

    private load(): void {
        try {
            const usersDbPath = path.join(__dirname, './src/users.db');
            const messagesDbPath = path.join(__dirname, './src/messages.db');
            const groupsDbPath = path.join(__dirname, './src/groups.db');

            if(!fs.existsSync(usersDbPath)) fs.writeFileSync(usersDbPath, '');
            if(!fs.existsSync(messagesDbPath)) fs.writeFileSync(messagesDbPath, '');
            if(!fs.existsSync(groupsDbPath)) fs.writeFileSync(groupsDbPath, '');

            this.usersDb = new sqlite3.Database(usersDbPath);
            this.messagesDb = new sqlite3.Database(messagesDbPath);
            this.groupsDb = new sqlite3.Database(groupsDbPath);
        } catch(err) {
            console.error('Failed to load databases', err);
            throw err;
        }
    }

    private init(): void {
        /* Users Table */
        this.usersDb.serialize(() => {
            this.usersDb.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `, (err) => {
                if(err) console.error('Error users table', err);
            });
        });

        /* Groups Table */
        this.groupsDb.serialize(() => {
            this.groupsDb.run(`
                CREATE TABLE IF NOT EXISTS groups (
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
                CREATE TABLE IF NOT EXISTS group_members (
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
                CREATE TABLE IF NOT EXISTS messages (
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

    private set(): void {
        this.usersConfig = new UsersConfig(this.usersDb);
        this.messagesConfig = new MessagesConfig(this.messagesDb);
        this.groupsConfig = new GroupsConfig(this.groupsDb);
    }

    public close(): void {
        this.usersDb.close();
        this.messagesDb.close();
        this.groupsDb.close();
    }

    public alert(): void {
        console.log(
            `${colorConverter.style('ALERT', ['red', 'italic'])}, ${colorConverter.style('Database initialized :)', ['green', 'bold'])}`
        );
    }
}

export const dbService = new DbService();