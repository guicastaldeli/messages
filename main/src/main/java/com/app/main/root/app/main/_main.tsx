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
            renderer: null
        }
    }

    async componentDidMount(): Promise<void> {
        try {
            await new Promise(resolve => setTimeout(resolve, 0));
            setTimeout(() => {
                if(this.canvasRef.current) {
                    this.initRenderer();
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
    private async initRenderer(): Promise<void> {
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
                                    <div className="app-main">
                                        <header id='main-header'>
                                        </header>
                                        <div className='renderer'>
                                            <canvas 
                                                id='ctx'
                                                ref={this.canvasRef}
                                            >
                                            </canvas>
                                        </div>
                                        {sessionContext.currentSession === 'LOGIN' && (
                                            <div className='screen join-screen'>
                                                <div className='form'>
                                                    <div className="form-input">
                                                        <h2>Login</h2>
                                                        <label>Email</label>
                                                        <input 
                                                            type="email" 
                                                            ref={this.auth.loginEmailRef}
                                                        />
                                                        <label>Password</label>
                                                        <input 
                                                            type="password"
                                                            ref={this.auth.loginPasswordRef}
                                                        />
                                                        <div className='form-input'>
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
                                                    
                                                    <div className="form-input">
                                                        <h2>Create Account</h2>
                                                        <label>Email</label>
                                                        <input 
                                                            type="email" 
                                                            ref={this.auth.createEmailRef}
                                                        />
                                                        <label>Username</label>
                                                        <input 
                                                            type="text" 
                                                            ref={this.auth.createUsernameRef}
                                                        />
                                                        <label>Password</label>
                                                        <input 
                                                            type="password"
                                                            ref={this.auth.createPasswordRef}
                                                        />
                                                        <div className='form-input'>
                                                            <button 
                                                                onClick={() => this.auth.join(sessionContext, true)}
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
                                                onBackToLogin={() => this.auth.handleBackToLogin(sessionContext)}
                                                token={this.state.passwordResetToken}
                                            />
                                        )}
                                    </div>
                                    {sessionContext.currentSession === 'MAIN_DASHBOARD' && (
                                        <>
                                            {!this.chatManager ? (
                                                <div>Initializing chat manager...</div>
                                            ) : (
                                                <div className="app-dashboard">
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
                                            )}
                                        </>
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