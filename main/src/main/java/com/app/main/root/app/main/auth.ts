import React, { Component } from "react";
import { SessionManager } from "./_session/session-manager";
import { ApiClientController } from "./_api-client/api-client-controller";
import { ChatManager } from "./chat/chat-manager";
import { Dashboard } from "./_dashboard";
import { SocketClientConnect } from "./socket-client-connect";
import { ChatService } from "./chat/chat-service";
import { ChatController } from "./chat/chat-controller";
import { Main } from "./_main";
import InputSanitizer, { TypeMap } from "../utils/input-sanitizer";

export interface State {
    userId: string | null;
    sessionId: string | null;
    username: string | null;
    message: string;
    error: string;
    isAuthenticating: boolean;
}

export class Auth {
    private main: Main;
    public apiClientController: ApiClientController;
    public socketClientConnect: SocketClientConnect;
    public chatService: ChatService;
    public chatManager: ChatManager;
    public chatController: ChatController;
    
    public appContainerRef: any;
    public loginEmailRef = React.createRef<HTMLInputElement>();
    public loginPasswordRef = React.createRef<HTMLInputElement>();
    public createEmailRef = React.createRef<HTMLInputElement>();
    public createUsernameRef = React.createRef<HTMLInputElement>();
    public createPasswordRef = React.createRef<HTMLInputElement>();
    public dashboardInstance: Dashboard;

    public state: State;

    constructor(
        main: Main,
        apiClientController: ApiClientController,
        socketClientConnect: SocketClientConnect,
        chatService: ChatService,
        chatManager: ChatManager,
        chatController: ChatController,
        appContainerRef: any,
        dashboardInstance: Dashboard
    ) {
        this.main = main;
        this.apiClientController = apiClientController;
        this.socketClientConnect = socketClientConnect;
        this.chatService = chatService;
        this.chatManager = chatManager;
        this.chatController = chatController;
        this.appContainerRef = appContainerRef;
        this.dashboardInstance = dashboardInstance;
        this.state = {
            userId: null,
            sessionId: null,
            username: null,
            message: '',
            error: '',
            isAuthenticating: false
        }
    }

    public setState(newState: Partial<State>, cb?: () => void): void {
        this.state = { ...this.state, ...newState }
        if(cb) cb();
    }

    public clearMessages(): void {
        this.setState({
            message: '',
            error: ''
        });
    }

    public join = async (sessionContext: any, isCreateAccount: boolean = false): Promise<void> => {
        this.setState({
            isAuthenticating: true,
            error: '',
            message: ''
        });

        try {
            let email: any;
            let username: any;
            let password: any;
    
            if(isCreateAccount) {
                if(!this.createEmailRef.current || !this.createUsernameRef.current || !this.createPasswordRef.current) {
                    console.error('No container found register');
                    return;
                }
                        
                email = InputSanitizer.sanitizeRefValue(this.createEmailRef, TypeMap.EMAIL);
                username = InputSanitizer.sanitizeRefValue(this.createUsernameRef, TypeMap.USERNAME);
                password = InputSanitizer.sanitizeRefValue(this.createPasswordRef, TypeMap.PASSWORD);

                const missingFields = [];
                if(!email) missingFields.push('Email');
                if(!username) missingFields.push('Username');
                if(!password) missingFields.push('Password');
                if(missingFields.length > 0) {
                    const fieldNames = missingFields.join(', ');
                    const text = missingFields.length === 1 ? 'is' : 'are'
                    this.setState({ 
                        error: `${fieldNames} ${text} required`,
                        isAuthenticating: false 
                    });
                }

                try {
                    const userService = await this.apiClientController.getUserService();

                    const usernameExists = await userService.checkUsernameExists(username);
                    if(usernameExists) {
                        this.setState({ isAuthenticating: false });
                        return;
                    }
                    const emailExists = await userService.checkUserExists(email);
                    if(emailExists) {
                        this.setState({ isAuthenticating: false });
                        return;
                    }
                } catch(err) {
                    console.error('Error checking', err);
                }
            } else if(!isCreateAccount) {
                if(!this.loginEmailRef.current || !this.loginPasswordRef.current) {
                    console.error('No container found login');
                    return;
                }

                email = this.loginEmailRef.current.value.trim();
                password = this.loginPasswordRef.current.value.trim();
                
                const missingFields = [];
                if(!email) missingFields.push('Email');
                if(!password) missingFields.push('Password');
                if(missingFields.length > 0) {
                    const fieldNames = missingFields.join(' and ');
                    const text = missingFields.length === 1 ? 'is' : 'are';
                    this.setState({ 
                        error: `${fieldNames} ${text} required`,
                        isAuthenticating: false 
                    });
                    return;
                }
            }

            try {
                const isSessionValid = SessionManager.isSessionValid();
                const userInfo = SessionManager.getUserInfo();
                        
                if(isSessionValid && userInfo && userInfo.email === email) {
                    this.setState({ 
                        username: userInfo.username,
                        userId: userInfo.userId,
                        sessionId: userInfo.sessionId
                    }, async () => {
                        try {
                            const data = {
                                sessionId: userInfo.sessionId,
                                userId: userInfo.userId,
                                username: userInfo.username
                            };
                            await this.socketClientConnect.sendToDestination(
                                '/app/new-user',
                                data,
                                '/topic/user'
                            );
                                
                            const cacheService = await this.chatService.getCacheServiceClient();
                            await cacheService.initCache(userInfo.userId);
        
                            if(this.dashboardInstance) {
                                await this.dashboardInstance.getUserData(
                                    userInfo.sessionId,
                                    userInfo.userId,
                                    userInfo.username
                                );
                            }
        
                            const authService = await this.apiClientController.getAuthService();
                            const validation = await authService.validateSession();
                                
                            if(validation && validation.valid) {
                                console.log('Session validated with server');
                                sessionContext.setSession('MAIN_DASHBOARD');
                            } else {
                                console.log('Session invalid on server, forcing new login');
                                SessionManager.clearSession();
                                this.doLogin(sessionContext, email, password, isCreateAccount, username);
                            }
                        } catch(err: any) {
                            console.error('Error in existing session flow:', err);
                            this.setState({ 
                                error: 'Session error: ' + err.message,
                                isAuthenticating: false 
                            });
                        }
                    });

                    console.log('ChatManager created:', !!this.chatManager);
                    console.log('State chatManager:', this.main.state.chatManager);
                    console.log('Dashboard loading state:', this.main.state.isLoading);
                    return;
                }
        
                await this.doLogin(sessionContext, email, password, isCreateAccount, username);
            } catch(err: any) {
                this.setState({ 
                    error: err.message || 'Login failed!', 
                    isAuthenticating: false 
                });
            }
        } catch(err) {
            console.error('Join error');
            this.setState({ isAuthenticating: false });
            return;
        }
    }
        
    /**
     * Do Login
     */
    public doLogin = async (
        sessionContext: any, 
        email: string, 
        password: string, 
        isCreateAccount: boolean, 
        username?: string
    ): Promise<void> => {
        try {
            SessionManager.clearSession();
                    
            const socketId = await this.socketClientConnect.getSocketId();
            console.log('Creating new session with socket ID:', socketId);
    
            let result;
            const authService = await this.apiClientController.getAuthService();
                    
            if(isCreateAccount) {
                result = await authService.registerUser({
                    email: email,
                    username: username!,
                    password: password,
                    sessionId: socketId,
                    rememberUser: true
                });
            } else {
                result = await authService.loginUser({
                    email: email,
                    password: password,
                    sessionId: socketId,
                    rememberUser: true
                });
            }
    
            console.log('Auth result:', result);
            const authData = result;
    
            if(authData && authData.userId) {
                SessionManager.saveSession(
                    {
                        userId: authData.userId,
                        username: authData.username,
                        email: authData.email
                    },
                    authData.sessionId,
                    true
                );
                        
                console.log('New session saved with ID:', authData.sessionId);
                        
                if(typeof localStorage !== 'undefined') {
                    localStorage.setItem('LAST_SOCKET_ID', socketId);
                }

                await new Promise<void>((res) => {
                    this.setState({
                        username: authData.username,
                        userId: authData.userId,
                        sessionId: authData.sessionId
                    }, res);
                });
    
                this.chatManager = new ChatManager(
                    this.chatService,
                    this.socketClientConnect,
                    this.chatController,
                    this.apiClientController,
                    null as any,
                    this.appContainerRef.current,
                    authData.username,
                    (newState: any, cb?: () => void) => {
                        this.setState(newState);
                        if(cb) cb();
                    }
                );
    
                this.chatController.setChatManager(this.chatManager);
                await new Promise<void>((resolve) => {
                    this.main.setState({ 
                        chatManager: this.chatManager,
                        isLoading: false 
                    }, resolve);
                });
                this.chatManager.loadChats(authData.userId);
                        
                this.setState({ 
                    username: authData.username,
                    userId: authData.userId,
                    sessionId: authData.sessionId
                }, async () => {
                    this.main.setState({
                        chatManager: this.chatManager,
                        isLoading: false
                    });
                    try {
                        const data = {
                            sessionId: authData.sessionId,
                            userId: authData.userId,
                            username: authData.username
                        };
                                
                        await this.socketClientConnect.sendToDestination(
                            '/app/new-user',
                            data,
                            '/topic/user'
                        );
                                
                        const cacheService = await this.chatService.getCacheServiceClient();
                        await cacheService.initCache(authData.userId);
                                
                        if(this.dashboardInstance) {
                            const dashboardProps = {
                                ...this.dashboardInstance.props,
                                chatManager: this.chatManager
                            };
                            Object.assign(this.dashboardInstance.props, dashboardProps);
                            
                            await this.dashboardInstance.getUserData(
                                authData.sessionId,
                                authData.userId,
                                authData.username
                            );
                        }
                                
                        sessionContext.setSession('MAIN_DASHBOARD');
                        console.log('Successfully logged in and switched to dashboard');
                    } catch(err: any) {
                        console.error('Error in post-login setup:', err);
                        this.setState({ 
                            error: err.message,
                            isAuthenticating: false 
                        });
                        sessionContext.setSession('MAIN_DASHBOARD');
                    }
                });
            } else {
                console.error('Invalid auth data:', authData);
                throw new Error('Invalid response from server - missing user data');
            }
        } catch(err: any) {
            console.error(err);
            this.setState({ 
                error: err.message,
                isAuthenticating: false 
            });
            return;
        }
    }
    
    public logout = async (sessionContext: any): Promise<void> => {
        try {
            console.log('Logging out...');
            const authService = await this.apiClientController.getAuthService();
            await authService.logoutUser();
                    
            SessionManager.clearSession();
            sessionContext.setSession('LOGIN');
                    
            if(sessionContext && sessionContext.clearSession) {
                await sessionContext.clearSession();
            }
            if(this.main.props.onLogout) {
                this.main.props.onLogout();
            }
                    
            console.log('Logged out successfully');
            
            setTimeout(() => {
                this.main.initRenderer();
                this.main.hello.init();
            }, 100);
        } catch(err) {
            console.error('Logout failed:', err);
            SessionManager.clearSession();
                    
            if(sessionContext && sessionContext.setSession) {
                sessionContext.setSession('LOGIN');
            }
        }
    }

    /**
     * Handle Password Reset
     */
    public handlePasswordReset = (sessionContext: any): void => {
        if(sessionContext && sessionContext.setSession) {
            sessionContext.setSession('PASSWORD_RESET');
        }
    }

    /**
     * Handle Back to Login
     */
    public handleBackToLogin = (sessionContext: any): void => {
        if(sessionContext && sessionContext.setSession) {
            sessionContext.setSession('LOGIN');
        }
        this.setState({ isAuthenticating: false });
        setTimeout(() => {
            this.main.initRenderer();
            this.main.hello.init();
        }, 100);
    }
}