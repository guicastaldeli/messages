import { CookieService } from "./cookie-service";

export interface UserSessionData {
    userId: string | null;
    username: string | null;
    email: string | null;
    sessionId: string;
    currentSession: string;
    rememberUser: boolean;
    createdAt: number;
    expiresAt: number;
}

export interface UserData {
    userId: string | null;
    username: string | null;
    email: string | null; 
}

interface SessionDate {
    createdAt: number;
    expiresAt: number;
}

export class SessionManager {
    public static readonly SESSION_ID_KEY = "SESSION_ID";
    public static readonly USER_INFO_KEY = "USER_INFO";
    public static readonly REMEMBER_USER = "REMEMBER_USER";
    public static readonly SESSION_STATUS_KEY = "SESSION_STATUS";
    public static readonly LOCAL_STORAGE_KEY = 'DRIVE_SESSION_DATA';

    public static setDate(rememberUser: boolean): SessionDate {
        const now = Date.now();
        return {
            createdAt: now,
            expiresAt: now + (rememberUser ?
                7 * 24 * 60 * 60 * 1000 : 30 * 60 * 1000
            )
        }
    } 

    public static async initSession(): Promise<UserSessionData | null> {
        try {
            let sessionId = CookieService.getValue(this.SESSION_ID_KEY);
            if(!sessionId) {
                const userInfo = this.getUserInfo();
                if(userInfo && userInfo.sessionId) {
                    sessionId = userInfo.sessionId;
                    console.log('Got sessionId from USER_INFO:', sessionId);
                }
            }
            const userInfo = this.getUserInfo();
            const rememberUser = CookieService.getValue(this.REMEMBER_USER) === 'true';

            let data: UserSessionData | null = null;
            if(!sessionId) {
                this.clearSession();
                console.log('session cleared, no session!');
                return null;
            }
            if(userInfo) {
                try {
                    const dates = this.setDate(rememberUser);
                    data = {
                        userId: userInfo.userId,
                        username: userInfo.username,
                        email: userInfo.email || '',
                        sessionId: sessionId,
                        currentSession: 'MAIN_DASHBOARD',
                        rememberUser: rememberUser,
                        ...dates
                    }

                    if(typeof localStorage !== 'undefined') {
                        const storedData = localStorage.getItem(this.LOCAL_STORAGE_KEY);
                        if(storedData) {
                            const parsedData = JSON.parse(storedData);
                            data = { ...data, ...parsedData };
                        }
                    }
                } catch(err) {
                    console.error(err);
                    return null;
                }
            }

            return data;
        } catch(err) {
            console.error(err);
            return null;
        }
    }

    /**
     * Save Session
     */
    public static saveSession(
        userData: UserData,
        sessionId: string,
        rememberUser: boolean = false,
        addData?: Partial<UserSessionData>    
    ): void {
        const dates = this.setDate(rememberUser);
        const data: UserSessionData = {
            ...userData,
            sessionId: sessionId,
            currentSession: 'MAIN_DASHBOARD',
            rememberUser: rememberUser,
            ...dates,
            ...addData
        }

        CookieService.set(this.SESSION_ID_KEY, sessionId, {
            days: rememberUser ? 7 : undefined,
            secure: 
                process.env.NODE_ENV === 'production' ||
                process.env.NODE_ENV === 'development'
        });
        CookieService.set(this.USER_INFO_KEY, JSON.stringify({
            userId: userData.userId,
            username: userData.username,
            email: userData.email,
            sessioinId: sessionId
        }), {
            days: rememberUser ? 7 : undefined,
            secure: 
                process.env.NODE_ENV === 'production' ||
                process.env.NODE_ENV === 'development',
            sameSite: 'Lax'
        });
        CookieService.set(this.SESSION_STATUS_KEY, 'active', {
            days: rememberUser ? 7 : undefined,
            secure: 
                process.env.NODE_ENV === 'production' ||
                process.env.NODE_ENV === 'development',
            sameSite: 'Lax'
        });
        CookieService.set(this.REMEMBER_USER, rememberUser.toString(), {
            days: rememberUser ? 7 : undefined,
            secure: 
                process.env.NODE_ENV === 'production' ||
                process.env.NODE_ENV === 'development',
            sameSite: 'Lax'
        });

        if(typeof localStorage !== 'undefined') {
            localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(data));
        }
    }

    /**
     * Update Session
     */
    public static updateSession(data: Partial<UserSessionData>): void {
        const currentData = this.getCurrentSession();
        if(currentData) {
            const updatedData = {
                ...currentData,
                ...data
            }

            if(typeof localStorage !== 'undefined') {
                localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(updatedData));
            }

            if(data.userId || data.username || data.email) {
                CookieService.set(this.USER_INFO_KEY, JSON.stringify({
                    userId: updatedData.userId,
                    username: updatedData.username,
                    email: updatedData.email
                }), {
                    days: updatedData.rememberUser ? 7 : undefined,
                    secure: 
                        process.env.NODE_ENV === 'production' ||
                        process.env.NODE_ENV === 'development',
                    sameSite: 'Lax'
                });
            }
        }
    }

    /**
     * Get Current Session
     */
    public static getCurrentSession(): UserSessionData | null {
        if(typeof localStorage === 'undefined') return null;

        const storedData = localStorage.getItem(this.LOCAL_STORAGE_KEY);
        if(storedData) {
            try {
                return JSON.parse(storedData);
            } catch(err) {
                console.error(err);
            }
        }
        return null;
    }

    /**
     * Valid Session
     */
    public static isSessionValid(): boolean {
        const sessionData = this.getCurrentSession();
        if(!sessionData) return false;

        let sessionId = CookieService.getValue(this.SESSION_ID_KEY);
        if (!sessionId) {
            const userInfo = this.getUserInfo();
            if (userInfo && userInfo.sessionId) {
                sessionId = userInfo.sessionId;
            }
        }
        if(!sessionId || sessionId !== sessionData.sessionId) return false;

        if(Date.now() > sessionData.expiresAt) {
            this.clearSession();
            return false;
        } 

        return true;
    }

    /**
     * Clear Session
     */
    public static clearSession(): void {
        CookieService.deleteCookie(this.SESSION_ID_KEY);
        CookieService.deleteCookie(this.USER_INFO_KEY);
        CookieService.deleteCookie(this.SESSION_STATUS_KEY);
        CookieService.deleteCookie(this.REMEMBER_USER);
        
        if(typeof localStorage !== 'undefined') {
            localStorage.removeItem(this.LOCAL_STORAGE_KEY);
            sessionStorage.clear();
        }
    }

    public static getSessionId(): string | null {
        const sessionId = CookieService.getValue(this.SESSION_ID_KEY);
        if (sessionId) {
            return sessionId;
        }
        
        const userInfo = this.getUserInfo();
        if (userInfo && userInfo.sessionId) {
            return userInfo.sessionId;
        }
        
        return null;
    }

    public static getUserInfo(): {
        sessionId: string;
        userId: string;
        username: string;
        email: string;
    } | null {
        try {
            const userCookie = CookieService.getValue(this.USER_INFO_KEY);
            if(!userCookie) return null;
            
            console.log('USER_INFO cookie:', userCookie);
            
            try {
                const parsedData = JSON.parse(userCookie);
                return {
                    sessionId: parsedData.sessionId || '',
                    userId: parsedData.userId || '',
                    username: parsedData.username || '',
                    email: parsedData.email || ''
                };
            } catch (jsonError) {
                console.log('JSON parse failed, trying old format:', jsonError);
                
                let value = userCookie.trim();
                if(value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
            
                if(value.includes(':')) {
                    const parts = value.split(':');
                    if (parts.length >= 4) {
                        return {
                            sessionId: parts[0] || '', 
                            userId: parts[1] || '',
                            username: parts[2] || '',
                            email: parts[3] || ''
                        };
                    }
                }
            }
            
            return null;
        } catch(err) {
            console.error('Error in getUserInfo:', err);
            return null;
        }
    }

    public static checkSessionStatus(): {
        isValid: boolean;
        timeUntilExpiry: number;
        needsRefresh: boolean
    } {
        const sessionData = this.getCurrentSession();
        if(!sessionData) {
            return {
                isValid: false,
                timeUntilExpiry: 0,
                needsRefresh: false
            }
        }

        const timeUntilExpiry = sessionData.expiresAt - Date.now();
        const isValid = timeUntilExpiry > 0;
        const needsRefresh = timeUntilExpiry < 5 * 60 * 1000;

        return {
            isValid,
            timeUntilExpiry,
            needsRefresh
        }
    }
}

