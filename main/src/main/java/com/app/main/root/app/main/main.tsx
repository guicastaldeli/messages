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
    groupManager: MessageManager['controller']['groupManager'] | null;
    chatList: Item[];
    activeChat: ActiveChat | null;
    currentSession: SessionType;
    userId: string | null;
    username: string | null;
}

export class Main extends Component<any, State> {
    private messageManager!: MessageManager;
    private socketClientConnect: SocketClientConnect;
    private chatManager: ChatManager;
    private dashboardInstance: Dashboard | null = null;
    private apiClient: ApiClient;

    constructor(props: any) {
        super(props);
        this.socketClientConnect = SocketClientConnect.getInstance();
        this.apiClient = new ApiClient();
        this.messageManager = new MessageManager(this.socketClientConnect);
        this.state = { 
            groupManager: null,
            chatList: [],
            activeChat: null,
            currentSession: 'LOGIN',
            userId: null,
            username: null
        }
        this.chatManager = new ChatManager(this.setState.bind(this));
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

    componentDidMount(): void {
        this.connect();
        this.chatManager.mount();
        this.loadData();
    }

    componentWillUnmount(): void {
        this.chatManager.unmount();
    }

    private connect(): void {
        if(!this.socketClientConnect) return;
        this.socketClientConnect.connect();
        this.messageManager.init();
    }

    private setDashboardRef = (instance: Dashboard | null): void => {
        this.dashboardInstance = instance;
        if(instance && this.messageManager) {
            this.messageManager.dashboard = instance;
            this.messageManager.controller.setDashboard(instance);
        }
    }

    //Join
    private handleJoin = async (sessionContext: any): Promise<void> => {
        try {
            const usernameInput = document.getElementById('username') as HTMLInputElement;
            const username = usernameInput.value.trim();

            if(sessionContext) {
                sessionContext.setUsername(username);
                sessionContext.setUserId(`user_${Date.now()}`);
            }

            await this.messageManager.handleJoin();
            if(sessionContext) sessionContext.setSession('MAIN_DASHBOARD');
            this.setState({ groupManager: this.messageManager.controller.groupManager });
        } catch(err) {
            console.error(err);
        }
    }

    //Create Group
    private handleCreateGroup = (): void => {
        this.messageManager.controller.groupManager.showMenu();
    }

    render() {
        const { chatList, activeChat } = this.state;
        console.log(this.socketClientConnect.isConnected)

        return (
            <div className='app'>
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
                                                <h2>Join chatroom</h2>
                                                <div className="form-input">
                                                    <label>Username</label>
                                                    <input type="text" id="username" />
                                                </div>
                                                <div className='form-input'>
                                                    <button 
                                                        id='join-user' 
                                                        onClick={() => this.handleJoin(sessionContext)}
                                                    >
                                                        Join
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {sessionContext && sessionContext.currentSession === 'MAIN_DASHBOARD' && (
                                        <Dashboard 
                                            ref={this.setDashboardRef}
                                            onCreateGroup={this.handleCreateGroup}
                                            messageManager={this.messageManager}
                                            chatManager={this.chatManager}
                                            groupManager={this.state.groupManager!}
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