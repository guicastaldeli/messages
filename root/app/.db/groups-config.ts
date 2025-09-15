import sqlite3 from 'sqlite3';

export class GroupsConfig {
    private db: sqlite3.Database;
    
    constructor(db: sqlite3.Database) {
        this.db = db;
    }

    public async createGroup(data: {
        id: string;
        name: string;
        creatorId: string;
    }): Promise<void> {
        return new Promise((res, rej) => {
            this.db.run(
                'INSERT INTO groups (id, name, creator_id) VALUES (?, ?, ?)',
                [data.id, data.name, data.creatorId],
                ((err) => {
                    if(err) rej(err);
                    else res();
                })
            );
        });
    }

    public async addUserToGroup(groupId: string, userId: string): Promise<void> {
        return new Promise((res, rej) => {
            this.db.run(
                'INSERT INTO group_members(group_id, user_id) VALUES (?, ?)',
                [groupId, userId],
                ((err) => {
                    if(err) rej(err);
                    else res();
                })
            );
        });
    }

    public async getGroupById(id: string): Promise<any> {
        return new Promise((res, rej) => {
            this.db.get(
                'SELECT * FROM groups WHERE id = ?',
                [id],
                (err, row) => {
                    if(err) rej(err);
                    else res(row);
                }
            );
        });
    }

    public async getGroupMembers(id: string): Promise<any[]> {
        return new Promise((res, rej) => {
            this.db.all(
                `
                    SELECT u.*
                    FROM group_members gm
                    JOIN users u ON gm.user_id = u.id,
                    WHERE gm.group_id = ?
                `,
                [id],
                (err, rows) => {
                    if(err) rej(err);
                    else res(rows);
                } 
            );
        });
    }

    public async getUserGroups(id: string): Promise<any[]> {
        return new Promise((res, rej) => {
            this.db.all(
                `
                    SELECT u.*
                    FROM groups_members gm
                    JOIN users u ON gm.user_id = u.id
                    WHERE gm.group_id = ?
                `,
                [id],
                (err, rows) => {
                    if(err) rej(err);
                    else res(rows);
                }
            );
        });
    }
} 