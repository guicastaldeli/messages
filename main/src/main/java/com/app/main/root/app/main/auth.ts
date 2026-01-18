import React, { Component } from "react";
import { SessionManager } from "./_session/session-manager";
import { ApiClientController } from "./_api-client/api-client-controller";
import { ChatManager } from "./chat/chat-manager";
import { Dashboard } from "./_dashboard";
import { SocketClientConnect } from "./socket-client-connect";
import { ChatService } from "./chat/chat-service";
import { ChatController } from "./chat/chat-controller";
import { Main } from "./_main";

export interface State {
    userId: string | null;
    sessionId: string | null;
    username: string | null;
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
            username: null
        }
    }

    public setState(newState: Partial<State>, cb?: () => void): void {
        this.state = { ...this.state, ...newState }
        if(cb) cb();
    }

    public join = async (sessionContext: any, isCreateAccount: boolean = false): Promise<void> => {
        try {
            let email: any;
            let username: any;
            let password: any;
    
            if(isCreateAccount) {
                if(!this.createEmailRef.current || !this.createUsernameRef.current || !this.createPasswordRef.current) {
                    console.error('No container found register');
                    return;
                }
                        
                email = this.createEmailRef.current.value.trim();
                username = this.createUsernameRef.current.value.trim();
                password = this.createPasswordRef.current.value.trim();
                if(!email || !username || !password) return;

                try {
                    const userService = await this.apiClientController.getUserService();

                    const usernameExists = await userService.checkUsernameExists(username);
                    if(usernameExists) return;
                    const emailExists = await userService.checkUserExists(email);
                    if(emailExists) return;

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
                if(!email || !password) return;
            }

            try {
                const isSessionValid = SessionManager.isSessionValid();
                const userInfo = SessionManager.getUserInfo();
                        
                if(isSessionValid && userInfo && userInfo.email === email) {
                    console.log('Valid session exists for this user, skipping login API');
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
                            alert('Session error: ' + err.message);
                        }
                    });

                    console.log('ChatManager created:', !!this.chatManager);
                    console.log('State chatManager:', this.main.state.chatManager);
                    console.log('Dashboard loading state:', this.main.state.isLoading);
                    return;
                }
        
                await this.doLogin(sessionContext, email, password, isCreateAccount, username);
            } catch(err: any) {
                console.error('Authentication error:', err);
                alert(`Authentication failed: ${err.message}`);
            }
        } catch(err) {
            console.error('Join error');
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
                        alert('Login successful but setup failed: ' + err.getMessage());
                    }
                });
            } else {
                console.error('Invalid auth data:', authData);
                throw new Error('Invalid response from server - missing user data');
            }
        } catch(err: any) {
            console.error('Authentication API error:', err);
            alert(`Authentication failed: ${err.message}`);
            throw err;
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
        setTimeout(() => {
            this.main.initRenderer();
            this.main.hello.init();
        }, 100);
    }
}