import './__styles/styles.scss';
import React from 'react';
import { Component } from 'react';
import { ApiClientController } from './_api-client/api-client-controller';
import { SocketClientConnect } from './socket-client-connect';
import { ChatController } from './chat/chat-controller';
import { ChatService } from './chat/chat-service';
import { Dashboard } from './_dashboard';
import { SessionProvider, SessionType, SessionContext } from './_session/session-provider';
import { ChatManager } from './chat/chat-manager';
import { Item } from './chat/chat-manager';
import { ActiveChat } from './chat/chat-manager';
import { SessionManager } from './_session/session-manager';
import { CookieService } from './_session/cookie-service';
import { PasswordResetController } from './password-reset-controller';
import { Renderer } from './renderer/renderer';

interface State {
    chatManager: ChatManager | null;
    chatList: Item[];
    activeChat: ActiveChat | null;
    currentSession: SessionType;
    userId: string | null;
    sessionId: string | null;
    username: string | null;
    isLoading: boolean;
    rememberUser: boolean;
    showPasswordReset: boolean;
    passwordResetToken?: string;
    renderer: Renderer | null;
}

export class Main extends Component<any, State> {
    private socketClientConnect: SocketClientConnect;
    private apiClientController: ApiClientController;
    private chatService: ChatService;
    private chatManager!: ChatManager;
    private chatController!: ChatController;
    private renderer: Renderer | null = null;

    private appContainerRef = React.createRef<HTMLDivElement>();
    private canvasRef = React.createRef<HTMLCanvasElement>();
    private dashboardInstance: Dashboard | null = null;

    constructor(props: any) {
        super(props);
        this.socketClientConnect = SocketClientConnect.getInstance();
        this.apiClientController = new ApiClientController(this.socketClientConnect);
        this.chatService = new ChatService(this.socketClientConnect, this.apiClientController);
        this.chatController = new ChatController(
            this.socketClientConnect, 
            this.apiClientController, 
            this.chatService
        );

        const rememberUserCookie = 
            typeof window !== 'undefined' ?
            CookieService.getValue(SessionManager.REMEMBER_USER) === 'true' :
            false;
            
        this.state = { 
            chatManager: null,
            chatList: [],
            activeChat: null,
            currentSession: 'LOGIN',
            userId: null,
            sessionId: null,
            username: null,
            isLoading: true,
            rememberUser: rememberUserCookie,
            showPasswordReset: false,
            passwordResetToken: undefined,
            renderer: null
        }
    }

    async componentDidMount(): Promise<void> {
        try {
            await new Promise(resolve => setTimeout(resolve, 0));
            setTimeout(() => {
                if (this.canvasRef.current) {
                    this.initRenderer();
                }
            }, 100);
            /*
            await this.connect();

            const userInfo = SessionManager.getUserInfo();
            console.log('Loaded user info from cookies:', userInfo);
            if(userInfo) {
                this.setState({
                    userId: userInfo.userId,
                    sessionId: userInfo.sessionId,
                    username: userInfo.username
                });
            
                const rememberUser = CookieService.getValue(SessionManager.REMEMBER_USER) === 'true';
                console.log('Remember user from cookie:', rememberUser);
    
                this.chatManager = new ChatManager(
                    this.chatService,
                    this.socketClientConnect,
                    this.chatController,
                    this.apiClientController,
                    null as any,
                    this.appContainerRef.current,
                    userInfo?.username,
                    this.setState.bind(this)
                );
    
                this.chatController.setChatManager(this.chatManager);
                this.chatManager.loadChats(userInfo!.userId);
                if(userInfo?.userId) {
                    try {
                        this.chatController.getUserData(
                            userInfo.sessionId,
                            userInfo.userId,
                            userInfo.username
                        );
    
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
                        
                    } catch(err) {
                        console.error('Failed to load chat items:', err);
                    }
                }
                
                const activeChat = localStorage.getItem('active-chat');
                console.log('Found active chat from storage:', activeChat);
                let activeChatId = null;
                if(activeChat) {
                    try {
                        const chatObj = JSON.parse(activeChat);
                        activeChatId = chatObj.id || chatObj.chatId;
                        console.log(`Extracted active chat ID: ${activeChatId}`);
                    } catch(err) {
                        console.warn('Failed to parse active chat, using as-is:', activeChat);
                        activeChatId = activeChat;
                    }
                }

                const cacheService = await this.chatService.getCacheServiceClient();
                if(userInfo.userId) {
                    console.log('Initializing cache with active chat:', activeChatId);
                    await cacheService.initCache(userInfo.userId, activeChatId || undefined);
                }
                this.loadData(userInfo.userId);
                this.setState({ 
                    chatManager: this.chatManager,
                    isLoading: false,
                    rememberUser: rememberUser
                });
            }
                */
        } catch(err) {
            console.error('Error in componentDidMount:', err);
            this.setState({ isLoading: false });
        }
    }

    componentDidUpdate(prevProps: any, prevState: State): void {
        if(!prevState.renderer && this.canvasRef.current && !this.renderer) {
            this.initRenderer();
        }
    }

    private async connect(): Promise<void> {
        if(!this.socketClientConnect) return;
        await this.socketClientConnect.connect();
        await this.chatController.init();
    }

    public async loadData(userId: string): Promise<any> {
        const loader = this.chatManager.getLoader();
        if(loader) await loader.loadChatItems(userId);
    }

    private setDashboardRef = (instance: Dashboard | null): void => {
        this.dashboardInstance = instance;
        if(instance && this.state.userId && this.state.username) {
            this.socketClientConnect.getSocketId().then((sessionId) => {
                if(sessionId) {
                    instance.getUserData(
                        sessionId,
                        this.state.userId!,
                        this.state.username!
                    );
                }
            });
        }
    }

    //Join
    /*
    **
    ** THIS *PROBABLY BUGGIER CODE IS A AI CODE FOR-
    ** TEST PURPOSES ONLY!!!. I DID THIS VERY QUICK! (I MEAN THE AI!)
    ** SWITCH THIS THING LATER. THANK YOU!!
    **
    */
        private loginEmailRef = React.createRef<HTMLInputElement>();
        private loginPasswordRef = React.createRef<HTMLInputElement>();
        private createEmailRef = React.createRef<HTMLInputElement>();
        private createUsernameRef = React.createRef<HTMLInputElement>();
        private createPasswordRef = React.createRef<HTMLInputElement>();
        private handleJoin = async (sessionContext: any, isCreateAccount: boolean = false): Promise<void> => {
            try {
                let email: any, username: any, password: any;

                if(isCreateAccount) {
                    if(!this.createEmailRef.current || !this.createUsernameRef.current || !this.createPasswordRef.current) {
                        alert('Form elements not found');
                        return;
                    }
                    
                    email = this.createEmailRef.current.value.trim();
                    username = this.createUsernameRef.current.value.trim();
                    password = this.createPasswordRef.current.value.trim();

                    if(!email || !username || !password) {
                        alert('All fields are required for account creation');
                        return;
                    }
                    try {
                        const userService = await this.apiClientController.getUserService();
                        const usernameExists = await userService.checkUsernameExists(username);
                        if(usernameExists) {
                            alert('Username already taken');
                            return;
                        }
                    } catch(err) {
                        console.error('Error checking username:', err);
                    }
                    try {
                        const userService = await this.apiClientController.getUserService();
                        const emailExists = await userService.checkUserExists(email);
                        if(emailExists) {
                            alert('Email already registered');
                            return;
                        }
                    } catch(err) {
                        console.error('Error checking email:', err);
                    }
                } else {
                    if(!this.loginEmailRef.current || !this.loginPasswordRef.current) {
                        alert('Form elements not found');
                        return;
                    }
                    
                    email = this.loginEmailRef.current.value.trim();
                    password = this.loginPasswordRef.current.value.trim();

                    if(!email || !password) {
                        alert('Email and password are required');
                        return;
                    }
                }

                const existingSessionId = SessionManager.getSessionId();
                const isSessionValid = SessionManager.isSessionValid();
                const userInfo = SessionManager.getUserInfo();
                
                /*
                console.log('=== Session Check Before Login ===');
                console.log('Existing session ID:', existingSessionId);
                console.log('Is session valid?', isSessionValid);
                console.log('User info from cookies:', userInfo);
                console.log('Requested email:', email);
                */
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
                        //await this.cachePreloader.startPreloading(userInfo.userId);

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
                            this.forceNewLogin(sessionContext, email, password, isCreateAccount, username);
                        }
                    } catch(err: any) {
                        console.error('Error in existing session flow:', err);
                        alert('Session error: ' + err.message);
                    }
                });
                console.log('ChatManager created:', !!this.chatManager);
                console.log('State chatManager:', this.state.chatManager);
                console.log('Dashboard loading state:', this.state.isLoading);
                return;
            }

                await this.forceNewLogin(sessionContext, email, password, isCreateAccount, username);
            } catch(err: any) {
                console.error('Authentication error:', err);
                alert(`Authentication failed: ${err.message}`);
            }
        }

        private forceNewLogin = async (
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
                        this.setState.bind(this)
                    );

                    this.chatController.setChatManager(this.chatManager);
                    this.chatManager.loadChats(authData.userId);
                    
                    this.setState({ 
                        username: authData.username,
                        userId: authData.userId,
                        sessionId: authData.sessionId,
                        chatManager: this.chatManager,
                        isLoading: false
                    }, async () => {
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

        public handleLogout = async (sessionContext: any): Promise<void> => {
            try {
                console.log('Logging out...');
                const authService = await this.apiClientController.getAuthService();
                await authService.logoutUser();
                
                SessionManager.clearSession();
                sessionContext.setSession('LOGIN');
                
                if(sessionContext && sessionContext.clearSession) {
                    await sessionContext.clearSession();
                }
                if(this.props.onLogout) {
                    this.props.onLogout();
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
    /* */

    private handleForgotPassword = (sessionContext: any): void => {
        if(sessionContext && sessionContext.setSession) {
            sessionContext.setSession('PASSWORD_RESET');
        }
    }

    private handleBackToLogin = (sessionContext: any): void => {
        if(sessionContext && sessionContext.setSession) {
            sessionContext.setSession('LOGIN');
        }
    }

    /**
     * 
     * Renderer
     * 
     */
    private async initRenderer(): Promise<void> {
        try {
            if(!this.canvasRef.current) {
                console.warn('Canvas ref not available');
                return;
            }

            this.renderer = new Renderer();
            await this.renderer.setup(this.canvasRef.current.id);

            this.startRender();
            this.setState({ renderer: this.renderer });
        } catch(err) {
            console.error('Renderer err', err);
        }
    }

    private startRender(): void {
        const render = async () => {
            if(this.renderer) {
                await this.renderer.render();
            }
            requestAnimationFrame(render);
        }
        render();
    }

    render() {
        const { chatList, activeChat, chatManager } = this.state;

        return (
            <div className='app' ref={this.appContainerRef}>
                <SessionProvider 
                    apiClientController={this.apiClientController} 
                    initialSession='LOGIN'
                >
                    <SessionContext.Consumer>
                        {(sessionContext) => {
                            if(!sessionContext) {
                                return <div>Loading...</div>
                            }

                            return (
                                <>
                                    <div className='renderer'>
                                        <canvas 
                                            id='ctx'
                                            ref={this.canvasRef}
                                        >
                                        </canvas>
                                    </div>
                                    {/*
                                    {sessionContext.currentSession === 'LOGIN' && (
                                        <div className='screen join-screen'>
                                            <div className='form'>
                                                <div className="form-input">
                                                    <h2>Login</h2>
                                                    <label>Email</label>
                                                    <input 
                                                        type="email" 
                                                        ref={this.loginEmailRef}
                                                    />
                                                    <label>Password</label>
                                                    <input 
                                                        type="password"
                                                        ref={this.loginPasswordRef}
                                                    />
                                                    <div className='form-input'>
                                                        <button 
                                                            onClick={() => this.handleJoin(sessionContext, false)}
                                                        >
                                                            Login
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            className="forgot-password-btn"
                                                            onClick={() => this.handleForgotPassword(sessionContext)}
                                                        >
                                                            Forgot Password?
                                                        </button>
                                                    </div>
                                                </div>
                                                
                                                <div className="form-input">
                                                    <h2>Create Account</h2>
                                                    <label>Email</label>
                                                    <input 
                                                        type="email" 
                                                        ref={this.createEmailRef}
                                                    />
                                                    <label>Username</label>
                                                    <input 
                                                        type="text" 
                                                        ref={this.createUsernameRef}
                                                    />
                                                    <label>Password</label>
                                                    <input 
                                                        type="password"
                                                        ref={this.createPasswordRef}
                                                    />
                                                    <div className='form-input'>
                                                        <button 
                                                            onClick={() => this.handleJoin(sessionContext, true)}
                                                        >
                                                            Create Account
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {sessionContext.currentSession === 'PASSWORD_RESET' && (
                                        <PasswordResetController
                                            apiClientController={this.apiClientController}
                                            socketClientConnect={this.socketClientConnect}
                                            onBackToLogin={() => this.handleBackToLogin(sessionContext)}
                                            token={this.state.passwordResetToken}
                                        />
                                    )}
                                    {sessionContext.currentSession === 'MAIN_DASHBOARD' && (
                                        <>
                                            {!this.chatManager ? (
                                                <div>Initializing chat manager...</div>
                                            ) : (
                                                <Dashboard 
                                                    ref={this.setDashboardRef}
                                                    chatController={this.chatController}
                                                    chatManager={chatManager!}
                                                    chatService={this.chatService}
                                                    chatList={chatList}
                                                    activeChat={activeChat}
                                                    main={this}
                                                    onLogout={() => this.handleLogout(sessionContext)}
                                                />
                                            )}
                                        </>
                                    )}
                                        */}
                                </>
                            );
                        }}
                    </SessionContext.Consumer>
                </SessionProvider>
            </div>
        );
    }
}