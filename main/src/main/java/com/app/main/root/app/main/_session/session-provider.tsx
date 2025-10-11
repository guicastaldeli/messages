import React, { createContext, useContext, Component } from 'react';
import { ApiClient } from '../_api-client/api-client';

export type SessionType = 
'main' |
'dashboard';

export interface ContextType {
    currentSession: SessionType;
    setSession: (session: SessionType) => void;
    userId: string | null;
    setUserId: (userId: string | null) => void;
    username: string | null;
    setUsername: (username: string | null) => void;
}

interface Props {
    children: React.ReactNode;
    initialSession?: SessionType;
}

interface State {
    currentSession: SessionType;
    userId: string | null;
    username: string | null;
}

export const SessionContext = createContext<ContextType | undefined>(undefined);

export class SessionProvider extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            currentSession: props.initialSession || 'main',
            userId: null,
            username: null
        }
    }

    setSession = (session: SessionType): void => {
        this.setState({ currentSession: session });
    }

    setUserId = (userId: string | null): void => {
        this.setState({ userId });
    }

    setUsername = (username: string | null): void => {
        this.setState({ username });
    }

    getContextValue(): ContextType {
        return {
            currentSession: this.state.currentSession,
            setSession: this.setSession,
            userId: this.state.userId,
            setUserId: this.setUserId,
            username: this.state.username,
            setUsername: this.setUsername
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