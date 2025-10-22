import './__styles/styles.scss';
import React, { Component } from 'react';
import { MessageManager } from './_messages_config/message-manager';
import { GroupManager } from './chat/group/group-manager';
import { SessionContext, SessionType } from './_session/session-provider';
import { ChatManager } from './chat/chat-manager';
import { chatState } from './chat-state-service';
import { ApiClient } from './_api-client/api-client';

interface Props {
    messageManager: MessageManager;
    chatManager: ChatManager;
    groupManager: GroupManager;
    chatList: any[];
    activeChat: any;
    apiClient: ApiClient;
}

interface State {
    currentSession: SessionType;
    groups: any[];
    chatList: any[];
    activeChat: any;
}

export class Dashboard extends Component<Props, State> {
    private groupContainerRef: React.RefObject<HTMLDivElement | null>;
    private apiClient: ApiClient;

    constructor(props: Props) {
        super(props);
        this.state = {
            currentSession: 'MAIN_DASHBOARD',
            groups: [],
            chatList: props.chatList || [],
            activeChat: props.activeChat || null
        }
        this.groupContainerRef = React.createRef();
        this.apiClient = props.apiClient;
    }

    async componentDidMount(): Promise<void> {
        this.setSession('MAIN_DASHBOARD');
        if(!this.groupContainerRef.current || !this.props.groupManager) return;
        this.props.groupManager.setContainer(this.groupContainerRef.current);
        this.props.chatManager.setUpdateCallback((updatedList) => { this.setState({ chatList: updatedList }) });

        try {
            const socketId = await this.props.messageManager.socketClient.getSocketId();
            const messageService = await this.apiClient.getMessageService()
            const chatList = await messageService.getMessagesByUser(socketId);
            this.setState({ chatList });
        } catch(err) {
            console.error('Error loading chat list', err);
        }
    }

    componentDidUpdate(prevProps: Props): void {
        if(
            this.props.groupManager && 
            this.props.groupManager !== prevProps.groupManager &&
            this.groupContainerRef.current 
        ) {
            this.props.groupManager.setContainer(this.groupContainerRef.current);
        }

        if (prevProps.chatList !== this.props.chatList) {
            this.setState({ chatList: this.props.chatList || [] });
        }
        if (prevProps.activeChat !== this.props.activeChat) {
            this.setState({ activeChat: this.props.activeChat || null });
        }
    }

    private setSession = (session: SessionType): void => {
        this.setState({ currentSession: session });
    }

    handleChatSelect = async (chat: any): Promise<void> => {
        chatState.setType(chat.type === 'direct' ? 'direct' : 'group');
        
        try {
            const socketId = await this.props.messageManager.socketClient.getSocketId();
            const messageService = await this.apiClient.getMessageService()
            const messages = await messageService.getMessagesByUser(socketId);
            const event = new CustomEvent('chat-activated', { detail: { chat, messages } });
            window.dispatchEvent(event);

            this.updateState({
                showCreationForm: false,
                showJoinForm: false,
                showGroup: true,
                hideGroup: false,
                groupName: chat.name
            });
            this.setState({
                activeChat: {
                    ...chat,
                    messages
                }
            });
        } catch(err) {
            console.error('Error loading chat history:', err);
        }
    }

    /*
    ** Group Actions
    */
    onCreateGroup = () => {
        this.props.groupManager.showCreationMenu();
    }

    onJoinGroup = () => {
        this.props.groupManager.showJoinMenu();
    }

    /*
    ** State Related
    */
    public onStateChange?: (
        state: {
            showCreationForm: boolean;
            showJoinForm: boolean;
            showGroup: boolean;
            hideGroup: boolean;
            groupName: string;
        }
    ) => void;

    private currentState = {
        showCreationForm: false,
        showJoinForm: false,
        showGroup: false,
        hideGroup: false,
        groupName: ''
    }

    public setStateChange(callback: (state: any) => void): void {
        this.onStateChange = callback;
    }

    public updateState(newState: Partial<typeof this.currentState>): void {
        this.currentState = { ...this.currentState, ...newState }
        if(this.onStateChange) this.onStateChange(this.currentState);
    }

    render() {
        const { chatList, activeChat } = this.props;

        return (
            <SessionContext.Consumer>
                {(sessionContext) => {
                    if(!sessionContext || sessionContext.currentSession !== 'MAIN_DASHBOARD') {
                        return null;
                    }

                    return (
                        <>
                            {sessionContext && sessionContext.currentSession === 'MAIN_DASHBOARD' && (
                                <div className="screen main-dashboard">
                                    <header>
                                        <div id="actions-bar">
                                            <button 
                                                id="action-create-group"
                                                onClick={() => this.onCreateGroup()}
                                            >
                                                Group++++
                                            </button>
                                            <button 
                                                id="action-join-group"
                                                onClick={() => this.onJoinGroup()}
                                            >
                                                Join :))
                                            </button>
                                        </div>
                                    </header>
                                </div>
                            )}

                            <div className="group-container" ref={this.groupContainerRef}></div>

                            <div id="chat-container">
                                <div className="chat-list">
                                    {chatList.length === 0 ? (
                                        <p>No chats.</p>
                                    ) : (
                                        <ul>
                                            {chatList.map((chat, i) => (
                                                <li
                                                    key={chat.id || i}
                                                    className={`chat-item ${
                                                        activeChat && 
                                                        activeChat.id === chat.id ? 'active' : ''
                                                    }`}
                                                    onClick={() => this.handleChatSelect(chat)}
                                                >
                                                    <div className="chat-icon">
                                                        {chat.type === 'direct' ? 'd' : 'g'}
                                                    </div>
                                                    <div className="chat-info">
                                                        <div id="chat-name">{chat.name}</div>
                                                        <div id="chat-preview">
                                                            {chat.lastMessage}
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </>
                    )
                }}
            </SessionContext.Consumer>
        );
    }
}