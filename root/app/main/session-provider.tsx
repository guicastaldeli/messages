import React, { Component } from "react";
import { SessionContext, SessionType, ContextType } from '../.api/session-context';

interface Props {
    children: React.ReactNode;
    initialSession?: SessionType;
}

interface State {
    currentSession: SessionType;
}

export class SessionProvider extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            currentSession: props.initialSession || 'login'
        }
    }

    setSession = (session: SessionType): void => {
        this.setState({ currentSession: session });
    }

    getContextValue(): ContextType {
        return {
            currentSession: this.state.currentSession,
            setSession: this.setSession
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