import './__styles/styles.scss';
import React, { useRef } from 'react';
import { Component } from 'react';
import { ApiClient } from './_api-client/api-client';
import { MessageManager } from './_messages_config/message-manager';
import { SocketClientConnect } from './socket-client-connect';
import { Dashboard } from './dashboard';
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
    private messageManager!: MessageManager;
    private socketClientConnect: SocketClientConnect;
    private apiClient: ApiClient;
    private chatManager?: ChatManager;

    private appContainerRef = React.createRef<HTMLDivElement>();
    private dashboardInstance: Dashboard | null = null;

    constructor(props: any) {
        super(props);
        this.socketClientConnect = SocketClientConnect.getInstance();
        this.apiClient = new ApiClient();
        this.messageManager = new MessageManager(this.socketClientConnect, this.apiClient);
        this.state = { 
            chatManager: null,
            chatList: [],
            activeChat: null,
            currentSession: 'LOGIN',
            userId: null,
            username: null
        }
    }

    private loadData = async(): Promise<void> => {
        try {
            const messageService = await this.apiClient.getMessageService();
            const trackedMessages = await messageService.getMessagesByUser(this.state.userId);
            this.setState({ chatList: trackedMessages });
        } catch(err) {
            console.error('Failed to load chat data:', err);
        }
    }

    async componentDidMount(): Promise<void> {
        await this.connect();
        this.chatManager = new ChatManager(
            this.socketClientConnect,
            this.messageManager,
            this.apiClient,
            this.dashboardInstance,
            this.appContainerRef.current,
            this.state.username,
            this.setState.bind(this)
        );
        this.chatManager.mount();
        await this.chatManager.init();
        this.messageManager.setChatManager(this.chatManager);
        this.loadData();
    }

    componentWillUnmount(): void {
        if(this.chatManager) this.chatManager.unmount();
    }

    private async connect(): Promise<void> {
        if(!this.socketClientConnect) return;
        await this.socketClientConnect.connect();
        await this.messageManager.init();
    }

    private setDashboardRef = (instance: Dashboard | null): void => {
        this.dashboardInstance = instance;
        if(instance && this.messageManager) this.messageManager.dashboard = instance;
        if(this.chatManager && instance) this.chatManager.setDashboard(instance);
    }

    //Join
    private handleJoin = async (sessionContext: any): Promise<void> => {
        if(!this.chatManager) throw new Error('Chat manager error');

        try {
            const usernameInput = document.getElementById('username') as HTMLInputElement;
            const username = usernameInput.value.trim();

            if(sessionContext) {
                sessionContext.setUsername(username);
                sessionContext.setUserId(`user_${Date.now()}`);
            }

            await this.messageManager.handleJoin();
            if(sessionContext) sessionContext.setSession('MAIN_DASHBOARD');
            this.chatManager.setUsername(username);
            this.setState({ chatManager: this.chatManager });
        } catch(err) {
            console.error(err);
        }
    }

    render() {
        const { chatList, activeChat } = this.state;

        return (
            <div className='app' ref={this.appContainerRef}>
                <SessionProvider 
                    apiClient={this.apiClient} 
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
                                                <div className="form-input">
                                                    <h2>Join</h2>
                                                    <label>Email</label>
                                                    <input type="text" id="email" />
                                                    <label>Password</label>
                                                    <input type="text" id="email" />
                                                    <div className='form-input'>
                                                    <button 
                                                        id='join-user' 
                                                        onClick={() => this.handleJoin(sessionContext)}
                                                    >
                                                        Join
                                                    </button>
                                                </div>
                                                </div>
                                                <div className="form-input">
                                                    <h2>Create Account</h2>
                                                    <label>Email</label>
                                                    <input type="text" id="email" />
                                                    <label>Username</label>
                                                    <input type="text" id="username" />
                                                    <label>Password</label>
                                                    <input type="text" id="email" />
                                                    <div className='form-input'>
                                                    <button 
                                                        id='create-user' 
                                                        onClick={() => this.handleCreate(sessionContext)}
                                                    >
                                                        Create
                                                    </button>
                                                </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {sessionContext && sessionContext.currentSession === 'MAIN_DASHBOARD' && (
                                        <Dashboard 
                                            ref={this.setDashboardRef}
                                            messageManager={this.messageManager}
                                            chatManager={this.state.chatManager!}
                                            chatList={chatList}
                                            activeChat={activeChat}
                                            apiClient={this.apiClient}
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