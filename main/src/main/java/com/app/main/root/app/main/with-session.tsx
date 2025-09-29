import React from "react";
import { SessionContext, ContextType } from "./session-provider";

export function withSession<P extends object>(
    WrappedComponent: React.ComponentType<P & ContextType>
): React.ComponentType<P> {
    return class WithSession extends React.Component<P> {
        render() {
            return (
                <SessionContext.Consumer>
                    {(sessionContext: ContextType | undefined) => (
                        sessionContext ? (
                            <WrappedComponent {...this.props} {...sessionContext} />
                        ) : (
                            <div>Loading session...</div>
                        )
                    )}
                </SessionContext.Consumer>
            )
        }
    }
}