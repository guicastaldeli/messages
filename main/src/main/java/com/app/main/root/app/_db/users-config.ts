import sqlite3 from 'sqlite3';

export class UsersConfig {
    private db: sqlite3.Database;

    constructor(db: sqlite3.Database) {
        this.db = db;
    }

    public async addUser(id: string, username: string): Promise<void> {
        return new Promise((res, rej) => {
            this.db.run(
                'INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)',
                [id, username],
                ((err) => {
                    if(err) rej(err);
                    else res();
                })
            );
        });
    }

    public async getUserById(id: string): Promise<any> {
        return new Promise((res, rej) => {
            this.db.get(
                'SELECT * FROM users WHERE id = ?',
                [id],
                (err, row) => {
                    if(err) rej(err);
                    else res(row);
                } 
            );
        });
    }

    public async getUserByUsername(username: string): Promise<any> {
        return new Promise((res, rej) => {
            this.db.get(
                'SELECT * FROM users WHERE username = ?',
                [username],
                (err, row) => {
                    if(err) rej(err);
                    else res(row);
                }
            );
        });
    }
}