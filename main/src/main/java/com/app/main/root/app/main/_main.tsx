import './__styles/styles.scss';
import React from 'react';
import { Component } from 'react';
import { ApiClientController } from './_api-client/api-client-controller';
import { SocketClientConnect } from './socket-client-connect';
import { ChatController } from './chat/chat-controller';
import { ChatService } from './chat/chat-service';
import { CachePreloaderService } from '../_cache/cache-preloader-service';
import { Dashboard } from './_dashboard';
import { SessionProvider, SessionType, SessionContext } from './_session/session-provider';
import { ChatManager } from './chat/chat-manager';
import { Item } from './chat/chat-manager';
import { ActiveChat } from './chat/chat-manager';

interface State {
    chatManager: ChatManager | null;
    chatList: Item[];
    activeChat: ActiveChat | null;
    currentSession: SessionType;
    userId: string | null;
    username: string | null;
}

export class Main extends Component<any, State> {
    private socketClientConnect: SocketClientConnect;
    private apiClientController: ApiClientController;
    private chatService: ChatService;
    private cachePreloader: CachePreloaderService;
    private chatManager!: ChatManager;
    private chatController!: ChatController;

    private appContainerRef = React.createRef<HTMLDivElement>();
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
        this.cachePreloader = new CachePreloaderService(this.apiClientController, this.chatService);
        this.state = { 
            chatManager: null,
            chatList: [],
            activeChat: null,
            currentSession: 'LOGIN',
            userId: null,
            username: null
        }
    }

    async componentDidMount(): Promise<void> {
        await this.connect();
        this.chatManager = new ChatManager(
            this.chatService,
            this.socketClientConnect,
            this.chatController,
            this.apiClientController,
            this.dashboardInstance,
            this.appContainerRef.current,
            this.state.username!,
            this.setState.bind(this)
        );
        this.chatManager.mount();
        this.chatController.setChatManager(this.chatManager);
        if(this.state.userId) await this.chatService.getCacheServiceClient().initCache(this.state.userId);
        this.loadData();
    }

    componentWillUnmount(): void {
        if(this.chatManager) this.chatManager.unmount();
    }
    

    private loadData = async(): Promise<void> => {
        try {
            const messageService = await this.chatService.getMessageController().getMessageService();
            const trackedMessages = await messageService.getMessagesByUserId(this.state.userId!);
            this.setState({ chatList: trackedMessages });
        } catch(err) {
            console.error('Failed to load chat data:', err);
        }
    }

    private async connect(): Promise<void> {
        if(!this.socketClientConnect) return;
        await this.socketClientConnect.connect();
        await this.chatController.init();
    }

    private setDashboardRef = (instance: Dashboard | null): void => {
        this.dashboardInstance = instance;
        if(instance && this.chatController) this.chatController.dashboard = instance;
        if(this.chatManager && instance) this.chatManager.setDashboard(instance);
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
        if (!this.chatManager) {
            console.error('Chat manager not initialized');
            return;
        }

        try {
            let email, username, password;

            if (isCreateAccount) {
                if (!this.createEmailRef.current || !this.createUsernameRef.current || !this.createPasswordRef.current) {
                    alert('Form elements not found');
                    return;
                }
                
                email = this.createEmailRef.current.value.trim();
                username = this.createUsernameRef.current.value.trim();
                password = this.createPasswordRef.current.value.trim();

                if (!email || !username || !password) {
                    alert('All fields are required for account creation');
                    return;
                }
                try {
                    const userService = await this.apiClientController.getUserService();
                    const usernameExists = await userService.checkUsernameExists(username);
                    if (usernameExists) {
                        alert('Username already taken');
                        return;
                    }
                } catch (err) {
                    console.error('Error checking username:', err);
                }
                try {
                    const userService = await this.apiClientController.getUserService();
                    const emailExists = await userService.checkUserExists(email);
                    if (emailExists) {
                        alert('Email already registered');
                        return;
                    }
                } catch (err) {
                    console.error('Error checking email:', err);
                }
            } else {
                if (!this.loginEmailRef.current || !this.loginPasswordRef.current) {
                    alert('Form elements not found');
                    return;
                }
                
                email = this.loginEmailRef.current.value.trim();
                password = this.loginPasswordRef.current.value.trim();

                if (!email || !password) {
                    alert('Email and password are required');
                    return;
                }
            }

            const sessionId = await this.socketClientConnect.getSocketId();
            let result;

            try {
                const authService = await this.apiClientController.getAuthService();
                if (isCreateAccount) {
                    result = await authService.registerUser({
                        email: email,
                        username: username!,
                        password: password,
                        sessionId: sessionId
                    });
                } else {
                    result = await authService.loginUser({
                        email: email,
                        password: password,
                        sessionId: sessionId
                    });
                }

                console.log('Auth result:', result);
                const authData = result;

                if (authData && authData.userId) {
                    this.chatManager.setUsername(authData.username);
                    
                    this.setState({ 
                        chatManager: this.chatManager,
                        username: authData.username,
                        userId: authData.userId
                    }, async () => {
                        try {
                            await this.chatController.getUserData(authData.sessionId, authData.userId, authData.username);
                            await this.chatController.handleJoin(authData.sessionId, authData.userId, authData.username);
                            await this.chatService.getMessageController().initCache(authData.userId);
                            await this.cachePreloader.startPreloading(authData.userId);
                            await this.dashboardInstance?.getUserData(authData.sessionId, authData.userId);
                            await this.chatManager.getUserData(authData.sessionId, authData.userId, authData.username);
                            this.chatManager.getLoader().loadChatItems(authData.userId);
                            sessionContext.setSession('MAIN_DASHBOARD');
                        } catch (err) {
                            console.error('Error in handleJoin:', err);
                            alert('Failed to join chat: ' + err);
                        }
                    });
                } else {
                    console.error('Invalid auth data:', authData);
                    throw new Error('Invalid response from server - missing user data');
                }

            } catch (err: any) {
                console.error('Authentication API error:', err);
                alert(`Authentication failed: ${err.message}`);
            }

        } catch (err: any) {
            console.error('Authentication error:', err);
            alert(`Authentication failed: ${err.message}`);
        }
    }

    render() {
        const { chatList, activeChat } = this.state;

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
                                    {sessionContext && sessionContext.currentSession === 'LOGIN' && (
                                        <div className='screen join-screen'>
                                            <div className='form'>
                                                {/* Login Form */}
                                                <div className="form-input">
                                                    <h2>Login</h2>
                                                    <label>Email</label>
                                                    <input 
                                                        type="email" 
                                                        ref={this.loginEmailRef}
                                                    />
                                                    <label>Password</label>
                                                    <input 
                                                        type="text" 
                                                        ref={this.loginPasswordRef}
                                                    />
                                                    <div className='form-input'>
                                                        <button 
                                                            onClick={() => this.handleJoin(sessionContext, false)}
                                                        >
                                                            Login
                                                        </button>
                                                    </div>
                                                </div>
                                                
                                                {/* Create Account Form */}
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
                                                        type="text" 
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
                                    {sessionContext && sessionContext.currentSession === 'MAIN_DASHBOARD' && (
                                        <Dashboard 
                                            ref={this.setDashboardRef}
                                            chatController={this.chatController}
                                            chatManager={this.state.chatManager!}
                                            chatService={this.chatService}
                                            chatList={chatList}
                                            activeChat={activeChat}
                                            apiClientController={this.apiClientController}
                                        />
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