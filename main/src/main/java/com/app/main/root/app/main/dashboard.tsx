import './__styles/styles.scss';
import React, { Component } from 'react';
import { MessageManager } from './_messages_config/message-manager';
import { SessionContext, SessionType } from './_session/session-provider';
import { ChatManager } from './chat/chat-manager';
import { chatState } from './chat-state-service';
import { ApiClient } from './_api-client/api-client';
import { GroupLayout } from './chat/group/group-layout';

interface Props {
    messageManager: MessageManager;
    chatManager: ChatManager;
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
        if(!this.groupContainerRef.current || !this.props.chatManager) return;
        this.props.chatManager.setContainer(this.groupContainerRef.current);
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
            this.props.chatList && 
            this.props.chatManager !== prevProps.chatManager &&
            this.groupContainerRef.current 
        ) {
            this.props.chatManager.setContainer(this.groupContainerRef.current);
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
        const chatType = chat.type === 'DIRECT' ? 'DIRECT' : 'GROUP'
        chatState.setType(chatType);
        
        try {
            const messageService = await this.apiClient.getMessageService()
            const messages = await messageService.getMessagesByChatId(chat.id);
            
            await this.props.messageManager.setCurrentChat(
                chat.id,
                chatType,
                chat.members || []
            );
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

            this.forceUpdate();
            await this.props.messageManager.renderHistory(messages);
            
            const event = new CustomEvent('chat-activated', {
                detail: {
                    chat: {
                        ...chat,
                        type: chatType
                    },
                    messages,
                    shouldRender: true
                }
            });
            window.dispatchEvent(event);
        } catch(err) {
            console.error('Error loading chat history:', err);
        }
    }

    private handleCloseGroupLayout = (): void => {
        this.setState({
            activeChat: null
        });
        this.updateState({
            showGroup: false,
            groupName: ''
        });
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
        const { messageManager, chatManager } = this.props

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
                                                onClick={() => this.props.chatManager.getGroupManager().onCreateGroup()}
                                            >
                                                Group++++
                                            </button>
                                            <button 
                                                id="action-join-group"
                                                onClick={() => this.props.chatManager.getGroupManager().onJoinGroup()}
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
                                                    className={`chat-item${
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

                            {activeChat && (
                                <GroupLayout
                                    messageManager={messageManager}
                                    groupManager={chatManager.getGroupManager()}
                                    groupId={activeChat.id}
                                    groupName={activeChat.name}
                                    onClose={this.handleCloseGroupLayout}
                                    mode="chat"
                                />
                            )}
                        </>
                    )
                }}
            </SessionContext.Consumer>
        );
    }
}