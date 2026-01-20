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
import { Auth } from './auth';
import { Hello } from './hello';

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
    activeTab: 'login' | 'register';
    authState: AuthState;
}

interface AuthState {
    userId: string | null;
    sessionId: string | null;
    username: string | null;
    message: string;
    error: string;
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
            activeTab: 'login',
            authState: { ...this.auth.state }
        }

        this.hello = new Hello();
    }

    async componentDidMount(): Promise<void> {
        try {
            const originalSetState = this.auth.setState.bind(this.auth);
            this.auth.setState = (newState: any, cb?: () => void) => {
                originalSetState(newState, cb);
                this.setState({
                    authState: { ...this.auth.state }
                });
            }

            await new Promise(resolve => setTimeout(resolve, 0));
            setTimeout(() => {
                if(this.canvasRef.current) {
                    this.initRenderer();
                    this.hello.init();
                }
            }, 100);

            await this.connect();

            const userInfo = SessionManager.getUserInfo();
            console.log('Loaded user info from cookies:', userInfo);
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
                    console.log('Initializing cache for user:', userInfo.userId);
                    
                    await cacheService.initCache(userInfo.userId);
                    if(activeChatId) {
                        console.log('Loading active chat:', activeChatId);
                        try {
                            await this.chatService.getData(userInfo.userId, activeChatId, 0);
                        } catch(err) {
                            console.error('Failed to load active chat:', err);
                        }
                    }
                }
                this.loadData(userInfo.userId);
                this.setState({ 
                    chatManager: this.chatManager,
                    isLoading: false,
                    rememberUser: rememberUser
                });
            }
        } catch(err) {
            console.error('Error in componentDidMount:', err);
            this.setState({ isLoading: false });
        }
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
        const loader = this.chatManager.getLoader();
        if(loader) await loader.loadChatItems(userId);
    }

    private setDashboardRef = (instance: Dashboard | null): void => {
        this.dashboardInstance = instance;
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
        try {
            if(!this.canvasRef.current) {
                console.warn('Canvas ref not available');
                return;
            }

            this.renderer = new Renderer();
            await this.renderer.setup(this.canvasRef.current.id);
            await this.renderer.run();
            await this.renderer.update();

            this.setState({ renderer: this.renderer });
        } catch(err) {
            console.error('Renderer err', err);
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

        const clearMessages = () => this.auth.clearMessages();

        return (
            <div className='app' ref={this.appContainerRef}>
                <SessionProvider 
                    apiClientController={this.apiClientController} 
                    initialSession='LOGIN'
                >
                    <SessionContext.Consumer>
                        {(sessionContext) => {
                            if(!sessionContext) {
                                return (
                                    <div className="session-loading-overlay">
                                        <div className="session-loading-content">
                                            <div>Loading session...</div>
                                            <div className="session-loading-status">
                                                <span>Initializing application</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <>
                                    <div className="app-main">
                                        {sessionContext.currentSession === 'LOGIN' && (
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
                                                    <canvas 
                                                        id='ctx'
                                                        ref={this.canvasRef}
                                                    >
                                                    </canvas>
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
                                                                    <div className="form-input">
                                                                        <h2>Login</h2>
                                                                        <label>Email</label>
                                                                        <input 
                                                                            type="email" 
                                                                            ref={this.auth.loginEmailRef}
                                                                            placeholder="Enter your email"
                                                                            onChange={clearMessages}
                                                                        />
                                                                        <label>Password</label>
                                                                        <input 
                                                                            type="password"
                                                                            ref={this.auth.loginPasswordRef}
                                                                            placeholder="Enter your password"
                                                                            onChange={clearMessages}
                                                                        />
                                                                        <div className="login-input">
                                                                            <button 
                                                                                onClick={() => this.auth.join(sessionContext, false)}
                                                                            >
                                                                                Login
                                                                            </button>
                                                                            <button 
                                                                                type="button"
                                                                                className="forgot-password-btn"
                                                                                onClick={() => this.auth.handlePasswordReset(sessionContext)}
                                                                            >
                                                                                Forgot Password?
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                        
                                                                {/* Register Tab */}
                                                                <div className={`tab-panel ${activeTab === 'register' ? 'active' : ''}`}>
                                                                    <div className="form-input">
                                                                        <h2>Create Account</h2>
                                                                        <label>Email</label>
                                                                        <input 
                                                                            type="email" 
                                                                            ref={this.auth.createEmailRef}
                                                                            placeholder="Enter your email"
                                                                            onChange={clearMessages}
                                                                        />
                                                                        <label>Username</label>
                                                                        <input 
                                                                            type="text" 
                                                                            ref={this.auth.createUsernameRef}
                                                                            placeholder="Choose a username"
                                                                            onChange={clearMessages}
                                                                        />
                                                                        <label>Password</label>
                                                                        <input 
                                                                            type="password"
                                                                            ref={this.auth.createPasswordRef}
                                                                            placeholder="Create a password"
                                                                            onChange={clearMessages}
                                                                        />
                                                                        <div className='register-input'>
                                                                            <button 
                                                                                onClick={() => this.auth.join(sessionContext, true)}
                                                                            >
                                                                                Create Account
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="letter-container"></div>
                                                <div className='info'>
                                                    <div className="border-info"></div>
                                                    <div className="text-info">
                                                        <p>
                                                            Messages 2026. Fork on
                                                            <a href={REPO_LINK} target='_blank'> GitHub</a>
                                                        </p>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        {sessionContext.currentSession === 'PASSWORD_RESET' && (
                                            <div className="app-password-reset">
                                                <PasswordResetController
                                                    apiClientController={this.apiClientController}
                                                    socketClientConnect={this.socketClientConnect}
                                                    onBackToLogin={() => this.auth.handleBackToLogin(sessionContext)}
                                                    token={this.state.passwordResetToken}
                                                />
                                            </div>
                                        )}
                                        {sessionContext.currentSession === 'MAIN_DASHBOARD' && (
                                            <>
                                                {!this.chatManager ? (
                                                    <div className="chat-manager-loading-overlay">
                                                        <div className="chat-manager-loading-content">
                                                            <div>Initializing chat manager...</div>
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
                                </>
                            );
                        }}
                    </SessionContext.Consumer>
                </SessionProvider>
            </div>
        );
    }
}