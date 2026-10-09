import './__styles/styles.scss';
import React from 'react';
import InputSanitizer from '../utils/input-sanitizer';
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
import { Auth } from './auth';
import { Hello } from './hello';
import { disableConsole } from 'console-off';

disableConsole({ exclude: ['error', 'warn'] });

interface State {
    chatManager: ChatManager | null;
    chatList: Item[];
    activeChat: ActiveChat | null;
    currentSession: SessionType;
    isLoading: boolean;
    rememberUser: boolean;
    showPasswordReset: boolean;
    passwordResetToken?: string;
    renderer: Renderer | null;
    rendererReady: boolean;
    rendererError: string | null;
    activeTab: 'login' | 'register';
    authState: AuthState;
}

interface AuthState {
    userId: string | null;
    sessionId: string | null;
    username: string | null;
    message: string;
    error: string;
    isAuthenticating: boolean;
}

export class Main extends Component<any, State> {
    private socketClientConnect: SocketClientConnect;
    private apiClientController: ApiClientController;
    private chatService: ChatService;
    private chatManager!: ChatManager;
    private chatController!: ChatController;
    private renderer: Renderer | null = null;

    public auth: Auth;
    public appContainerRef = React.createRef<HTMLDivElement>();
    private canvasRef = React.createRef<HTMLCanvasElement>();
    private dashboardInstance: Dashboard | null = null;
    
    public hello: Hello;
    
    private rendererInitialized = false;

    private RENDER_TIMEOUT: number = 1500;

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
        this.auth = new Auth(
            this,
            this.apiClientController,
            this.socketClientConnect,
            this.chatService,
            this.chatManager,
            this.chatController,
            this.appContainerRef,
            this.dashboardInstance!
        )

        const rememberUserCookie = 
            typeof window !== 'undefined' ?
            CookieService.getValue(SessionManager.REMEMBER_USER) === 'true' :
            false;
            
        this.state = { 
            chatManager: null,
            chatList: [],
            activeChat: null,
            currentSession: 'LOGIN',
            isLoading: true,
            rememberUser: rememberUserCookie,
            showPasswordReset: false,
            passwordResetToken: undefined,
            renderer: null,
            rendererReady: false,
            rendererError: null,
            activeTab: 'login',
            authState: { ...this.auth.state }
        }

        this.hello = new Hello();
    }

    async componentDidMount(): Promise<void> {
        try {
            InputSanitizer.sanitizeAllInputs();
            InputSanitizer.addLiveSanitizationToAll();

            setTimeout(() => {
                if(!this.state.rendererReady && !this.state.rendererError) {
                    //console.warn('Renderer init timed out, continuing anyway');
                    this.setState({ rendererError: 'Renderer timed out' });
                }
            }, this.RENDER_TIMEOUT);
            
            const originalSetState = this.auth.setState.bind(this.auth);
            this.auth.setState = (newState: any, cb?: () => void) => {
                originalSetState(newState, cb);
                this.setState({
                    authState: { ...this.auth.state }
                });
            }

            await this.connect();

            const userInfo = SessionManager.getUserInfo();
            //console.log('Loaded user info from cookies:', userInfo);
            if(userInfo) {
                try {
                    const authService = await this.apiClientController.getAuthService();
                    const validation = await authService.validateSession();
                    
                    if(validation.user && validation.user.userId !== userInfo.userId) {
                        console.error('Session user mismatch!');
                        console.error('Cookie userId:', userInfo.userId);
                        console.error('Server userId:', validation.user.userId);
                        SessionManager.clearSession();
                        this.setState({ isLoading: false });
                        return;
                    }
                } catch(err) {
                    console.error('Session validation failed:', err);
                    SessionManager.clearSession();
                    this.setState({ isLoading: false });
                    return;
                }
                this.auth.setState({
                    userId: userInfo.userId,
                    sessionId: userInfo.sessionId,
                    username: userInfo.username
                });
            
                const rememberUser = CookieService.getValue(SessionManager.REMEMBER_USER) === 'true';
    
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
                //console.log('Found active chat from storage:', activeChat);
                let activeChatId = null;
                if(activeChat) {
                    try {
                        const chatObj = JSON.parse(activeChat);
                        activeChatId = chatObj.id || chatObj.chatId;
                        //console.log(`Extracted active chat ID: ${activeChatId}`);
                    } catch(err) {
                        console.warn('Failed to parse active chat, using as-is:', activeChat);
                        activeChatId = activeChat;
                    }
                }

                const cacheService = await this.chatService.getCacheServiceClient();
                if(userInfo.userId) {
                    //console.log('Initializing cache for user:', userInfo.userId);
                    
                    await cacheService.initCache(userInfo.userId);
                    if(activeChatId) {
                        //console.log('Loading active chat:', activeChatId);
                        try {
                            await this.chatService.getData(userInfo.userId, activeChatId, 0);
                        } catch(err) {
                            console.error('Failed to load active chat:', err);
                        }
                    }
                }
                this.setState({ 
                    chatManager: this.chatManager,
                    isLoading: false,
                    rememberUser: rememberUser
                });

                await this.loadData(userInfo.userId);
            } else {
                this.setState({ isLoading: false });
            }
        } catch(err) {
            console.error('Error in componentDidMount:', err);
            this.setState({ isLoading: false });
        }
    }

    componentDidUpdate(): void {
        if(this.rendererInitialized ||
            !this.canvasRef.current ||
            document.querySelector('#ctx') !== this.canvasRef.current
        ) {
            return;
        }

        this.rendererInitialized = true;
        this.initRenderer();
        this.hello.init();
    }

    componentWillUnmount(): void {
        /*
        this.hello.fontChangeIntervals.forEach(interval => clearInterval(interval));
        this.hello.fontChangeIntervals = [];
        this.hello.el = [];
        */
    }

    private async connect(): Promise<void> {
        if(!this.socketClientConnect) return;
        await this.socketClientConnect.connect();
        await this.chatController.init();
    }

    public async loadData(userId: string): Promise<any> {
        if(!this.state.chatManager) {
            //console.warn('ChatManager not initialized yet, skipping loadData');
            return;
        }
        
        try {
            const sessionId = await this.socketClientConnect.getSocketId();
            if(!sessionId) {
                console.error('No sessionId available, waiting for connection...');
                await new Promise(resolve => setTimeout(resolve, 500));
                const retrySessionId = await this.socketClientConnect.getSocketId();
                if(!retrySessionId) {
                    //console.error('Still no sessionId after retry, skipping loadData');
                    return;
                }
            }
            //console.log('SessionId available, loading chat items for userId:', userId);
        } catch(err) {
            console.error('Error getting sessionId:', err);
            return;
        }
        
        const loader = this.state.chatManager.getLoader();
        if(loader) await loader.loadChatItems(userId);
    }

    private setDashboardRef = (instance: Dashboard | null): void => {
        this.dashboardInstance = instance;
        this.auth.dashboardInstance = instance!;
        if(instance && this.auth.state.userId && this.auth.state.username) {
            this.socketClientConnect.getSocketId().then((sessionId) => {
                if(sessionId) {
                    instance.getUserData(
                        sessionId,
                        this.auth.state.userId!,
                        this.auth.state.username!
                    );
                }
            });
        }
    }

    /**
     * 
     * Renderer
     * 
     */
    public async initRenderer(): Promise<void> {
        if (!this.canvasRef.current) {
            console.warn('Canvas ref not available');
            this.setState({
                rendererReady: false,
                rendererError: 'Canvas not available',
            });
            return;
        }

        try {
            this.renderer = new Renderer();
            await this.renderer.setup(this.canvasRef.current.id);
            await this.renderer.run();
            await this.renderer.update();

            this.setState(
                {
                    renderer: this.renderer,
                    rendererReady: true,
                    rendererError: null,
                },
                () => {
                    requestAnimationFrame(() => {
                        window.dispatchEvent(new Event('resize'));
                    });
                }
            );
        } catch (err) {
            console.error('Renderer err', err);
            this.setState({
                rendererReady: false,
                rendererError: (err as Error)?.message ?? 'Failed to initialize renderer',
            });
        }
    }

    private switchTab = (tab: 'login' | 'register'): void => {
        this.auth.clearMessages();
        this.setState({ activeTab: tab });
    }

    render() {
        const { chatList, activeChat, chatManager, activeTab, isLoading, authState } = this.state;
        const LOGO_PATH = './data/resource/img/logo.png';
        const REPO_LINK = 'https://github.com/guicastaldeli/messages';

        const hasMessages = authState.message || authState.error;
        const joinScreenClass = hasMessages ? 'screen join-screen expanded' : 'screen join-screen';
        const isAuthenticating = authState.isAuthenticating;

        const clearMessages = () => this.auth.clearMessages();

        return (
            <div className='app' ref={this.appContainerRef}>
                <SessionProvider
                    apiClientController={this.apiClientController}
                    initialSession='LOGIN'
                >
                    <SessionContext.Consumer>
                        {(sessionContext) => {
                            const showOverlay = !sessionContext || (!this.state.rendererReady && !this.state.rendererError);
                            const showLoginScreen = !sessionContext || sessionContext.currentSession === 'LOGIN';

                            return (
                                <>
                                    <div className="app-main">
                                        {/* Login Screen */}
                                        {showLoginScreen && (
                                            <>
                                                <header id='main-header'>
                                                    <div id="header-content">
                                                        <img
                                                            src={LOGO_PATH}
                                                            alt="messages"
                                                            onClick={() => window.location.href = ''}
                                                            title='Home'
                                                        />
                                                        <a href={REPO_LINK} target='_blank'>Repository</a>
                                                    </div>
                                                </header>

                                                <div className='renderer'>
                                                    <canvas id='ctx' ref={this.canvasRef}></canvas>
                                                </div>

                                                <div className={joinScreenClass}>
                                                    <div className='form'>
                                                        <div className="tab-container">
                                                            {/* Tab Headers */}
                                                            <div className="tab-headers">
                                                                <div
                                                                    className={`tab-header ${activeTab === 'login' ? 'active' : ''}`}
                                                                    onClick={() => this.switchTab('login')}
                                                                >
                                                                    Login
                                                                </div>
                                                                <div
                                                                    className={`tab-header ${activeTab === 'register' ? 'active' : ''}`}
                                                                    onClick={() => this.switchTab('register')}
                                                                >
                                                                    Register
                                                                </div>
                                                            </div>

                                                            <div className="auth-content" style={{ display: hasMessages ? 'flex' : 'none' }}>
                                                                {authState.message && (
                                                                    <div className="auth-message">
                                                                        {authState.message.split('\n').map((line, i) => (
                                                                            <div key={i}>{line}</div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {authState.error && (
                                                                    <div className="auth-error">
                                                                        {authState.error.split('\n').map((line, i) => (
                                                                            <div key={i}>{line}</div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Tab Content */}
                                                            <div className="tab-content">
                                                                {/* Login Tab */}
                                                                <div className={`tab-panel ${activeTab === 'login' ? 'active' : ''}`}>
                                                                    <form
                                                                        className="form-input"
                                                                        noValidate
                                                                        onSubmit={(e) => {
                                                                            e.preventDefault();
                                                                            this.auth.join(sessionContext, false);
                                                                        }}
                                                                    >
                                                                        <h2>Login</h2>
                                                                        <label htmlFor="login-email">Email</label>
                                                                        <input
                                                                            id="login-email"
                                                                            name="email"
                                                                            type="email"
                                                                            autoComplete="email"
                                                                            ref={this.auth.loginEmailRef}
                                                                            placeholder="Enter your email"
                                                                            onChange={clearMessages}
                                                                        />

                                                                        <label htmlFor="login-password">Password</label>
                                                                        <input
                                                                            id="login-password"
                                                                            name="password"
                                                                            type="password"
                                                                            autoComplete="current-password"
                                                                            ref={this.auth.loginPasswordRef}
                                                                            placeholder="Enter your password"
                                                                            onChange={clearMessages}
                                                                        />

                                                                        <div className="login-input">
                                                                            <button
                                                                                type="submit"
                                                                                className={`login-input-btn ${isAuthenticating ? 'auth' : 'default'}`}
                                                                            >
                                                                                {isAuthenticating ? 'Logging in...' : 'Login'}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className="forgot-password-btn"
                                                                                onClick={() => this.auth.handlePasswordReset(sessionContext)}
                                                                            >
                                                                                Forgot Password?
                                                                            </button>
                                                                        </div>
                                                                    </form>
                                                                </div>

                                                                {/* Register Tab */}
                                                                <div className={`tab-panel ${activeTab === 'register' ? 'active' : ''}`}>
                                                                    <form
                                                                        className="form-input"
                                                                        noValidate
                                                                        onSubmit={(e) => {
                                                                            e.preventDefault();
                                                                            this.auth.join(sessionContext, true);
                                                                        }}
                                                                    >
                                                                        <h2>Create Account</h2>
                                                                        <label htmlFor="register-email">Email</label>
                                                                        <input
                                                                            id="register-email"
                                                                            name="email"
                                                                            type="email"
                                                                            autoComplete="email"
                                                                            ref={this.auth.createEmailRef}
                                                                            placeholder="Enter your email"
                                                                            onChange={clearMessages}
                                                                        />

                                                                        <label htmlFor="register-username">Username</label>
                                                                        <input
                                                                            id="register-username"
                                                                            name="username"
                                                                            type="text"
                                                                            autoComplete="username"
                                                                            ref={this.auth.createUsernameRef}
                                                                            placeholder="Choose a username"
                                                                            onChange={clearMessages}
                                                                        />

                                                                        <label htmlFor="register-password">Password</label>
                                                                        <input
                                                                            id="register-password"
                                                                            name="password"
                                                                            type="password"
                                                                            autoComplete="new-password"
                                                                            ref={this.auth.createPasswordRef}
                                                                            placeholder="Create a password"
                                                                            onChange={clearMessages}
                                                                        />

                                                                        <div className='register-input'>
                                                                            <button
                                                                                type="submit"
                                                                                className={`register-input-btn ${isAuthenticating ? 'auth' : 'default'}`}
                                                                            >
                                                                                {isAuthenticating ? 'Creating Account...' : 'Create Account'}
                                                                            </button>
                                                                        </div>
                                                                    </form>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="letter-container"></div>

                                                <div className="info">
                                                    <div className="text-info">
                                                        <p>
                                                            Messages 2026. Fork on
                                                            <a href={REPO_LINK} target='_blank'> GitHub</a>
                                                        </p>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* Password Reset Screen */}
                                        {sessionContext?.currentSession === 'PASSWORD_RESET' && (
                                            <div className="app-password-reset">
                                                <PasswordResetController
                                                    apiClientController={this.apiClientController}
                                                    socketClientConnect={this.socketClientConnect}
                                                    onBackToLogin={() => this.auth.handleBackToLogin(sessionContext)}
                                                    token={this.state.passwordResetToken}
                                                />
                                            </div>
                                        )}

                                        {/* Main Dashboard */}
                                        {sessionContext?.currentSession === 'MAIN_DASHBOARD' && (
                                            <>
                                                {!this.state.chatManager ? (
                                                    <div className="chat-manager-loading-overlay">
                                                        <div className="chat-manager-loading-content">
                                                            <div className="chat-manager-loading-status">
                                                                <span>Loading your conversations</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="app-dashboard">
                                                        <div className="dashboard-content">
                                                            <Dashboard
                                                                ref={this.setDashboardRef}
                                                                chatController={this.chatController}
                                                                chatManager={chatManager!}
                                                                chatService={this.chatService}
                                                                chatList={chatList}
                                                                activeChat={activeChat}
                                                                main={this}
                                                                onLogout={() => this.auth.logout(sessionContext)}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Loading overlay */}
                                    {showOverlay && (
                                        <div className="session-loading-overlay">
                                            <div className="session-loading-content">
                                                <div>Loading session...</div>
                                                <div className="session-loading-status">
                                                    <span>Initializing application</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        }}
                    </SessionContext.Consumer>
                </SessionProvider>
            </div>
        );
    }
}