import React, { Component } from "react";
import { SessionContext, SessionType, ContextType } from '../.api/session-context';

interface Props {
    internal: React.ReactNode;
    initialSession?: SessionType;
}

interface State {
    currentSession: SessionType;
}

export class SessionProvider extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            currentSession: props.initialSession || 'join'
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
                {this.props.internal}
            </SessionContext.Provider>
        )
    }
}