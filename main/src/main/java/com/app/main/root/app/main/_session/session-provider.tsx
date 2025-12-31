import React, { createContext, useContext, Component } from 'react';
import { ApiClientController } from '../_api-client/api-client-controller';
import { useSessionTypes } from './useSessionTypes';
import { SessionManager, UserData, UserSessionData } from './session-manager';

export type SessionType = string;

export interface ContextType {
    currentSession: SessionType;
    setSession: (session: SessionType) => void;
    userId: string | null;
    setUserId: (userId: string | null) => void;
    username: string | null;
    setUsername: (username: string | null) => void;
    sessionData: any | null;
    setSessionData: (data: any) => void;
    isLoading: boolean;
    sessionTypes: { [key: string]: string };
    sessionTypesLoading: boolean;
    syncSessionServer: () => Promise<void>;
    validadeSessionType: (type: string) => boolean;
}

interface Props {
    children: React.ReactNode;
    initialSession?: SessionType;
    apiClientController: ApiClientController;
}

interface State {
    currentSession: SessionType;
    userId: string | null;
    username: string | null;
    email: string | null;
    sessionData: UserSessionData | null;
    isLoading: boolean;
    isAuth: boolean;
}

export const SessionContext = createContext<ContextType | undefined>(undefined);

export class SessionProvider extends Component<Props, State> {
    private apiClientController: ApiClientController;
    private sessionTypes: ReturnType<typeof useSessionTypes>;
    private sessionCheckInterval: NodeJS.Timeout | null = null;

    constructor(props: Props) {
        super(props);
        this.apiClientController = props.apiClientController;
        this.sessionTypes = {} as any;
        
        this.state = {
            currentSession: props.initialSession || 'LOGIN',
            userId: null,
            username: null,
            email: null,
            sessionData: null,
            isLoading: true,
            isAuth: false
        }
    }

    async componentDidMount(): Promise<void> {
        await this.initSession();
        this.startSessionWatcher();    
    }

    componentWillUnmount(): void {
        this.stopSessionWatcher();
    }

    /**
     * Init Session
     */
    private async initSession(): Promise<void> {
        this.setState({ isLoading: true });
        try {
            const sessionData = await SessionManager.initSession();
            if(sessionData && SessionManager.isSessionValid()) {
                this.setState({
                    currentSession: sessionData.currentSession as SessionType || 'MAIN_DASHBOARD',
                    userId: sessionData.userId,
                    username: sessionData.username,
                    email: sessionData.email,
                    sessionData: sessionData,
                    isLoading: false,
                    isAuth: true
                });

                setTimeout(async () => {
                    await this.checkAuth();
                }, 1000);
            } else {
                this.setState({
                    currentSession: 'LOGIN',
                    isLoading: false,
                    isAuth: false
                });
            }
        } catch(err) {
            console.error('Failed to init session!', err);
            this.setState({
                currentSession: 'LOGIN',
                isLoading: false,
                isAuth: false
            });
        }
    }

    /**
     * Session Watcher
     */
    private startSessionWatcher() {
        this.sessionCheckInterval = setInterval(async () => {
            if(this.state.isAuth) {
                const { needsRefresh } = SessionManager.checkSessionStatus();
                if(needsRefresh) await this.refreshSessionToken();
            }
        }, 30 * 1000);
    }

    private stopSessionWatcher() {
        if(this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
            this.sessionCheckInterval = null;
        }
    }

    setSession = async (session: SessionType): Promise<void> => {
        if(!this.validadeSessionType(session)) {
            console.warn(`Invalid session type: ${session}`);
            return;
        }

        this.setState({ currentSession: session });
        if(this.state.sessionData) {
            const updatedSession = {
                ...this.state.sessionData,
                currentSession: session
            }
            SessionManager.updateSession(updatedSession);
            this.setState({ sessionData: updatedSession });
        }
        if(this.state.userId) {
            try {
                const service = await this.apiClientController.getSessionService();
                await service.updateSessionType(this.state.userId, session);
            } catch(err) {
                console.error(err);
            }
        }
    }

    /**
     * User Info
     */
    setUserId = (userId: string | null): void => {
        this.setState({ userId });
        if(this.state.sessionData) {
            SessionManager.updateSession({ userId });
        }
    }

    setUsername = (username: string | null): void => {
        this.setState({ username });
        if(this.state.sessionData) {
            SessionManager.updateSession({ username });
        }
    }

    setEmail = (email: string | null): void => {
        this.setState({ email });
        if(this.state.sessionData) {
            SessionManager.updateSession({ email });
        }
    }

    validadeSessionType = (t: string): boolean => {
        return ['LOGIN', 'MAIN_DASHBOARD'].includes(t)
    }

    setSessionData = (sessionData: any): void => {
        this.setState({ 
            sessionData,
            userId: sessionData.userId,
            username: sessionData.username,
            email: sessionData.email,
            currentSession: sessionData.currentSession as SessionType || 'MAIN_DASHBOARD' 
        });
        SessionManager.saveSession(
            sessionData,
            sessionData.sessionId,
            sessionData.rememberUser
        );
    }

    syncSessionServer = async (): Promise<void> => {
        if(!this.state.userId) return;
        this.setState({ isLoading: true });

        try {
            const service = await this.apiClientController.getSessionService();
            const sessionData = await service.getSession(this.state.userId);
            if(sessionData) {
                const mergedData = {
                    ...this.state.sessionData,
                    ...sessionData
                }
                this.setSessionData(mergedData);
            }
        } catch (err) {
            console.error('Failed to sync session with server:', err);
        } finally {
            this.setState({ isLoading: false });
        }
    }

    /**
     * Get Context Value
     */
    getContextValue(): ContextType {
        return {
            currentSession: this.state.currentSession,
            setSession: this.setSession,
            userId: this.state.userId,
            setUserId: this.setUserId,
            username: this.state.username,
            setUsername: this.setUsername,
            sessionData: this.state.sessionData,
            setSessionData: this.setSessionData,
            isLoading: this.state.isLoading,
            syncSessionServer: this.syncSessionServer,
            sessionTypes: this.sessionTypes.types || {},
            sessionTypesLoading: this.sessionTypes.loading || false,
            validadeSessionType: this.validadeSessionType
        }
    }

    /**
     * Check Auth
     */
    checkAuth = async (): Promise<boolean> => {
        try {
            const authService = await this.apiClientController.getAuthService(); 
            const isValid = await authService.isAuth();
            this.setState({ isAuth: isValid });
            return isValid;
        } catch(err) {
            console.error('Auth check failed', err);
            this.setState({ isAuth: false });
            return false;
        }
    }
    
    /**
     * Refresh Token
     */
    refreshSessionToken = async (): Promise<boolean> => {
        try {
            const authService = await this.apiClientController.getAuthService();
            const res = await authService.refreshToken();
            if(res.success) {
                const sessionData = SessionManager.getCurrentSession();
                if(sessionData) {
                    this.setState({
                        sessionData,
                        userId: sessionData.userId,
                        username: sessionData.username,
                        email: sessionData.email
                    });
                }
                return true;
            }
            return false;
        } catch(err) {
            console.error('Session refresh failed', err);
            return false;
        }
    }

    /**
     * Create Session
     */
    createSession = async (
        userData: UserData, 
        sessionId: string, 
        rememberUser: boolean = false
    ): Promise<void> => {
        const dates = SessionManager.setDate(rememberUser);
        const sessionData: UserSessionData = {
            ...userData,
            sessionId,
            currentSession: 'MAIN_DASHBOARD',
            rememberUser,
            ...dates
        }
        SessionManager.saveSession(userData, sessionId, rememberUser, sessionData);
        this.setState({
            currentSession: 'MAIN_DASHBOARD',
            userId: userData.userId,
            username: userData.username,
            email: userData.email,
            sessionData,
            isAuth: true
        });
    }

    /**
     * Clear Session
     */
    clearSession = async (): Promise<void> => {
        try {
            const sessionConfig = await this.apiClientController.getSessionConfig();
            await sessionConfig.logout();
        } catch(err) {
            console.error('Error logout', err);
        } finally {
            SessionManager.clearSession();
            this.setState({
                currentSession: 'LOGIN',
                userId: null,
                username: null,
                email: null,
                sessionData: null,
                isAuth: false
            });
        }
    }

    render() {
        if(this.state.isLoading) {
            return (
                <div className="session-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading session...</p>
                </div>
            );
        }
        return (
            <SessionContext.Provider value={this.getContextValue()}>
                {this.props.children}
            </SessionContext.Provider>
        )
    }
}

export const useSession = (): ContextType => {
    const context = useContext(SessionContext);
    if(!context) throw new Error('useSession err');
    return context;
}