import { SessionManager, UserData, UserSessionData } from "../_session/session-manager";

export class AuthServiceClient {
    private url: string | undefined;
    
    constructor(url: string | undefined) {
        this.url = url;
    }

    /**
     * Register
     */
    public async registerUser(userData: {
        email: string,
        username: string,
        password: string,
        sessionId: string,
        rememberUser?: boolean
    }) {
        const res = await fetch(`${this.url}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
            credentials: 'include'
        });

        const data = await res.json();
        if(!res.ok) throw new Error(data.detail || data.message || 'Registration failed!');
        console.log(data)
        if(data.userId && data.username) {
            SessionManager.saveSession(
                {
                    userId: data.userId,
                    username: data.username,
                    email: data.email
                },
                data.sessionId || userData.sessionId,
                userData.rememberUser || false
            );
        }
        return data;
    }

    /**
     * Login User
     */
    public async loginUser(userData: {
        email: string,
        password: string,
        sessionId: string,
        rememberUser?: boolean
    }) {
        const res = await fetch(`${this.url}/api/auth/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(userData),
            credentials: 'include'
        });

        console.log('=== Login Response Headers ===');
    console.log('Status:', res.status);
    console.log('Set-Cookie header:', res.headers.get('set-cookie'));
    console.log('All headers:', Array.from(res.headers.entries()));

        const data = await res.json();
        if(!res.ok) throw new Error(data.detail || data.message || 'Login failed!');
        if(data.userId && data.username) {
            SessionManager.saveSession(
                {
                    userId: data.userId,
                    username: data.username,
                    email: data.email
                },
                data.sessionId || userData.sessionId,
                userData.rememberUser || false
            );
        }
        return data;
    }

    /**
     * Logout User
     */
    public async logoutUser(): Promise<void> {
        try {
            await fetch(`${this.url}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } finally {
            SessionManager.clearSession();
        }
    }

    /**
     * Validate Session
     */
    public async validateSession(): Promise<{ valid: boolean; user?: UserData }> {
        try {
            console.log(`${this.url}/api/auth/validate`)
            const res = await fetch(`${this.url}/api/auth/validate`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            if(res.ok) {
                const data = await res.json();
                return {
                    valid: data.valid || data.authenticated || false,
                    user: data.user
                }
            } else {
                return { valid: false }
            }
        } catch(err) {
            console.error(err);
            return { valid: false }
        }
    }

    /**
     * Refresh Token
     */
    public async refreshToken(): Promise<{ success: boolean; token?: string; }> {
        try {
            const res = await fetch(`${this.url}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include'
            });
            if(res.ok) {
                const data = await res.json();
                const sessionId = SessionManager.getSessionId();
                if(sessionId && data.token) {
                    const sessionData = SessionManager.getCurrentSession();
                    if(sessionData) {
                        SessionManager.updateSession({
                            sessionId: data.token
                        });
                    }
                }

                return {
                    success: true,
                    token: data.token
                }
            } else {
                return { success: false }
            }
        } catch(err) {
            console.error(err);
            return { success: false }
        }
    }

    /**
     * Is Auth
     */
    public async isAuth(): Promise<boolean> {
        if(!SessionManager.isSessionValid) return false;

        try {
            const validation = await this.validateSession();
            return validation.valid;
        } catch(err) {
            console.error('Auth failed', err);
            return false;
        }
    }

    /**
     * Get Current User Info
     */
    public getCurrentUserInfo(): UserData {
        const userInfo = SessionManager.getUserInfo();
        if(userInfo) return userInfo;

        const sessionData = SessionManager.getCurrentSession();
        if(sessionData) {
            return {
                userId: sessionData.userId,
                username: sessionData.username,
                email: sessionData.email
            }
        }

        return {
            userId: "",
            username: "",
            email: ""
        }
    }
}