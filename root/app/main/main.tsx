import './_styles/styles.scss';
import React from 'react';
import { Component } from 'react';
import { MessageManager } from './message-manager';
import { SocketClient } from '../.server/socket-client';
import { Dashboard } from './dashboard';
import { SessionContext, SessionType } from '../.api/session-context';
import { ChatManager } from './chat/chat-manager';
import { Item } from './chat/chat-manager';
import { ActiveChat } from './chat/chat-manager';

interface State {
    groupManager: MessageManager['groupManager'] | null;
    currentSession: SessionType;
    chatList: Item[];
    activeChat: ActiveChat | null;
}

export class Main extends Component<any, State> {
    private messageManager: MessageManager;
    private socketClient: SocketClient;
    private chatItem: ChatManager;

    static contextType = SessionContext;
    declare context: React.ContextType<typeof SessionContext>;

    constructor(props: any) {
        super(props);
        this.socketClient = SocketClient.getInstance();
        this.messageManager = new MessageManager(this.socketClient);
        this.state = { 
            groupManager: null,
            currentSession: 'login',
            chatList: [],
            activeChat: null
        }
        this.chatItem = new ChatManager(this.setState.bind(this));
    }

    componentDidMount(): void {
        this.connect();
        this.chatItem.mount();
    }

    componentWillUnmount(): void {
        this.chatItem.unmount();
    }

    private connect(): void {
        if(!this.socketClient || this.socketClient['isConnected']) return;
        this.socketClient.connect();
        this.messageManager.init();
        this.setState({ groupManager: this.messageManager.groupManager });
    }

    //Session
    private setSession = (session: SessionType): void => {
        this.setState({ currentSession: session });
    }

    //Join
    private handleJoin = async (): Promise<void> => {
        try {
            await this.messageManager.handleJoin();
            this.setState({ 
                groupManager: this.messageManager.groupManager,
                currentSession: 'dashboard'
            });
        } catch(err) {
            console.error(err);
        }
    }

    //Create Group
    private handleCreateGroup = (): void => {
        this.messageManager.groupManager.showMenu();
    }

    render() {
        const { 
            currentSession, 
            chatList, 
            activeChat
        } = this.state;

        return (
            <div className='app'>
                <SessionContext.Provider value={{
                    currentSession,
                    setSession: this.setSession
                }}>
                    {currentSession === 'login' && (
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
                                        onClick={this.handleJoin}
                                    >
                                        Join
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentSession === 'dashboard' && (
                        <Dashboard 
                            onCreateGroup={this.handleCreateGroup}
                            messageManager={this.messageManager}
                            groupManager={this.state.groupManager!}
                            chatList={chatList}
                            activeChat={activeChat}
                        />
                    )}
                </SessionContext.Provider>
            </div>
        );
    }
}