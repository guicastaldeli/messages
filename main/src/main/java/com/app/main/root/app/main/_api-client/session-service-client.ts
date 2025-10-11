import { SessionType } from "../_session/session-provider";

export class SessionServiceClient {
    private baseUrl: string | undefined;

    constructor(url: string | undefined) {
        this.baseUrl = url;
    }

    /*
    ** Get Session
    */
    public async getSession(userId: string): Promise<void> {
        const res = await fetch(`${this.baseUrl}/api/session/${userId}`);
        if(!res.ok) throw new Error('Failed to get session');
        return res.json();
    }

    /*
    ** Stats
    */
    public async getSessionStats(): Promise<void> {
        const res = await fetch(`${this.baseUrl}/api/session/stats`);
        if(!res.ok) throw new Error('Failed to get session stats');
        return res.json();
    }

    /*
    ** Stats
    */
    public async getActive(): Promise<void> {
        const res = await fetch(`${this.baseUrl}/api/session/active`);
        if(!res.ok) throw new Error('Failed to get active sessions');
        return res.json();
    }

    /*
    ** Update Session Type
    */
    public async updateSessionType(userId: string, type: SessionType): Promise<void> {
        const params = new URLSearchParams({ type });
        const res = await fetch(`${this.baseUrl}/api/session/${userId}/type?${params}`, {
            method: 'PUT'
        });
        if(!res.ok) throw new Error('Failed to update session type');
        return res.json();
    }

    /*
    ** Update Session
    */
    public async updateSession(
        userId: string,
        username: string, 
        type: SessionType
    ): Promise<void> {
        const params = new URLSearchParams({ 
            userId,
            username,
            type
        });
        const res = await fetch(`${this.baseUrl}/api/session/${userId}/type?${params}`, {
            method: 'POST'
        });
        if(!res.ok) throw new Error('Failed to update session');
        return res.json();
    }
}