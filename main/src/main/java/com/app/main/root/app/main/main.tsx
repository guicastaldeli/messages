import './__styles/styles.scss';
import React from 'react';
import { Component } from 'react';
import { apiClient } from './api-client';
import { MessageManager } from './message-manager';
import { SocketClientConnect } from './socket-client-connect';
import { Dashboard } from './dashboard';
import { SessionProvider, SessionType, SessionContext } from './session-provider';
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

    constructor(props: any) {
        super(props);
        this.socketClientConnect = SocketClientConnect.getInstance();
        this.messageManager = new MessageManager(this.socketClientConnect);
        this.state = { 
            groupManager: null,
            chatList: [],
            activeChat: null,
            currentSession: 'main',
            userId: null,
            username: null
        }
        this.chatManager = new ChatManager(this.setState.bind(this));
    }

    private loadData = async(): Promise<void> => {
        try {
            const recentChats = await apiClient.getRecentChats(this.state.userId);
            this.setState({ chatList: recentChats });
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
            if(sessionContext) sessionContext.setSession('dashboard');
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

        return (
            <div className='app'>
                <SessionProvider initialSession='main'>
                    <SessionContext.Consumer>
                        {(sessionContext) => {
                            if(!sessionContext) {
                                return <div>Loading...</div>
                            }
                            
                            return (
                                <>
                                    {sessionContext && sessionContext.currentSession === 'main' && (
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
                                    {sessionContext && sessionContext.currentSession === 'dashboard' && (
                                        <Dashboard 
                                            ref={this.setDashboardRef}
                                            onCreateGroup={this.handleCreateGroup}
                                            messageManager={this.messageManager}
                                            chatManager={this.chatManager}
                                            groupManager={this.state.groupManager!}
                                            chatList={chatList}
                                            activeChat={activeChat}
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