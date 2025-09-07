import { createContext, useContext } from "react";

export type SessionType = 
'login' |
'dashboard'

export interface ContextType {
    currentSession: SessionType;
    setSession: (session: SessionType) => void;
}

export const SessionContext = createContext<ContextType>({
    currentSession: 'login',
    setSession: () => {}
});

export const useSession = (): ContextType => {
    const context = useContext(SessionContext);
    if(!context) throw new Error('useScreen err');
    return context;
}