import { ApiClientController } from "../_api-client/api-client-controller";
import { SessionManager } from "./session-manager";

export class SessionConfig {
    private apiClientController: ApiClientController;

    constructor(ApiClientController: ApiClientController) {
        this.apiClientController = ApiClientController;
    }

    public setupSessionRefresh(): void {
        if(typeof window === 'undefined') return;

        setInterval(async () => {
            const { isValid, needsRefresh } = SessionManager.checkSessionStatus();
            if(!isValid) {
                SessionManager.clearSession();
                return;
            }
            if(needsRefresh) {
                try {
                    const authService = await this.apiClientController.getAuthService(); 
                    await authService.refreshToken();
                    console.log('Session rrefreshed! :)');
                } catch(err) {
                    console.error('Failed to refresh :(', err);
                }
            }
        }, 60000);
    }

    public async initSession(): Promise<boolean> {
        try {
            const sessionData = await SessionManager.initSession();
            if(!sessionData) return false;

            const authService = await this.apiClientController.getAuthService(); 
            const validation = await authService.validateSession();
            if(!validation) {
                SessionManager.clearSession();
                return false;
            }
            if(validation.user) {
                SessionManager.updateSession({
                    userId: validation.user.userId,
                    username: validation.user.username,
                    email: validation.user.email
                });
            }

            return true;
        } catch(err) {
            console.error('Error init session!', err);
            return false;
        }
    }

    public getAuthHeaders(): HeadersInit {
        const sessionId = SessionManager.getSessionId();
        const headers: HeadersInit = {
            'Content-Type': 'application/json'
        }
        if(sessionId) {
            headers['Authorization'] = `Bearer ${sessionId}`;
        }
        return headers;
    }

    public async logout(): Promise<void> {
        try {
            const authService = await this.apiClientController.getAuthService(); 
            await authService.logoutUser();
        } catch(err) {
            console.error('Logout err', err);
            SessionManager.clearSession();
        }
    }
}