import React, { createContext, useContext, Component } from 'react';
import { ApiClient } from '../_api-client/api-client';
import { useSessionTypes } from './useSessionTypes';

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
    apiClient: ApiClient;
}

interface State {
    currentSession: SessionType;
    userId: string | null;
    username: string | null;
    sessionData: string | null;
    isLoading: boolean
}

export const SessionContext = createContext<ContextType | undefined>(undefined);

export class SessionProvider extends Component<Props, State> {
    private apiClient: ApiClient;
    private sessionTypes: ReturnType<typeof useSessionTypes>;

    constructor(props: Props) {
        super(props);
        this.apiClient = props.apiClient;
        this.sessionTypes = {} as any;
        
        this.state = {
            currentSession: props.initialSession || 'LOGIN',
            userId: null,
            username: null,
            sessionData: null,
            isLoading: false
        }
    }

    setSession = async (session: SessionType): Promise<void> => {
        if(!this.validadeSessionType(session)) {
            console.warn(`Invalid session type: ${session}`);
            return;
        }

        this.setState({ currentSession: session });

        if(this.state.userId) {
            try {
                const service = await this.apiClient.getSessionService();
                await service.updateSessionType(this.state.userId, session);
            } catch(err) {
                console.error(err);
            }
        }
    }

    setUserId = (userId: string | null): void => {
        this.setState({ userId });
    }

    setUsername = (username: string | null): void => {
        this.setState({ username });
    }

    validadeSessionType = (t: string): boolean => {
        return ['LOGIN', 'MAIN_DASHBOARD'].includes(t)
    }

    setSessionData = (sessionData: any): void => {
        this.setState({ sessionData });
    }

    syncSessionServer = async (): Promise<void> => {
        if(!this.state.userId) return;
        this.setState({ isLoading: true });

        try {
            const service = await this.apiClient.getSessionService();
            const sessionData = await service.getSession(this.state.userId);
            this.setSessionData(sessionData);
        } catch (err) {
            console.error('Failed to sync session with server:', err);
        } finally {
            this.setState({ isLoading: false });
        }
    }

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

    render() {
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