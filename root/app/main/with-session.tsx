import React from "react";
import { SessionContext, ContextType } from "../.api/session-context";

export function withSession<P extends object>(
    WrappedComponent: React.ComponentType<P & ContextType>
): React.ComponentType<P> {
    return class WithSession extends React.Component<P> {
        render() {
            return (
                <SessionContext.Consumer>
                    {(sessionContext: ContextType) => (
                        <WrappedComponent {...this.props} {...sessionContext} />
                    )}
                </SessionContext.Consumer>
            )
        }
    }
}