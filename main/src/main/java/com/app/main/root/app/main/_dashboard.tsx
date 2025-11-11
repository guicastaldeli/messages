import "./__styles/styles.scss";
import React, { Component } from "react";
import { MessageManager } from "./_messages_config/message-manager";
import { SessionContext, SessionType } from "./_session/session-provider";
import { ChatManager } from "./chat/chat-manager";
import { chatState } from "./chat/chat-state-service";
import { ApiClient } from "./_api-client/api-client";
import { GroupLayout } from "./chat/group/group-layout";
import { ContactServiceClient } from "./_contact_config/contact-service-client";
import { ContactLayout } from "./_contact_config/contact-layout";

interface Props {
    messageManager: MessageManager;
    chatManager: ChatManager;
    chatList: any[];
    activeChat: any;
    apiClient: ApiClient;
    onChatListUpdate?: (chatList: any[]) => void;
}

interface State {
    currentSession: SessionType;
    groups: any[];
    chatList: any[];
    activeChat: any;
    contactService: ContactServiceClient | null;
}

export class Dashboard extends Component<Props, State> {
    private groupContainerRef: React.RefObject<HTMLDivElement | null>;
    private apiClient: ApiClient;
    private contactService: ContactServiceClient | null = null;

    private socketId!: string;
    private userId!: string;

    constructor(props: Props) {
        super(props);
        this.state = {
            currentSession: 'MAIN_DASHBOARD',
            groups: [],
            chatList: props.chatList || [],
            activeChat: props.activeChat || null,
            contactService: null
        }
        this.groupContainerRef = React.createRef();
        this.apiClient = props.apiClient;
    }

    public async getUserData(sessionId: string, userId: string): Promise<void> {
        this.socketId = sessionId;
        this.userId = userId;
    }

    async componentDidMount(): Promise<void> {
        this.setSession('MAIN_DASHBOARD');
        if(!this.groupContainerRef.current || !this.props.chatManager) return;
        this.props.chatManager.setContainer(this.groupContainerRef.current);
        this.props.chatManager.setUpdateCallback((updatedList) => { this.setState({ chatList: updatedList }) });
        window.addEventListener('chat-item-removed', this.handleChatItemRemoved as EventListener);

        this.contactService = new ContactServiceClient({
            socketClient: this.props.messageManager.socketClient,
            messageManager: this.props.messageManager,
            userId: this.props.messageManager.userId,
            username: this.props.messageManager.username
        });
        this.contactService.setupEventListeners();

        try {
            const messageService = await this.apiClient.getMessageService()
            const chatList = await messageService.getMessagesByUserId(this.userId);
            this.setState({ chatList });
        } catch(err) {
            console.error('Error loading chat list', err);
        }
    }

    componentWillUnmount(): void {
        window.removeEventListener('chat-item-removed', this.handleChatItemRemoved as EventListener);
    }

    componentDidUpdate(prevProps: Props): void {
    if(
        this.props.chatList && 
        this.props.chatManager !== prevProps.chatManager &&
        this.groupContainerRef.current 
    ) {
        this.props.chatManager.setContainer(this.groupContainerRef.current);
    }

    // Combine state updates
    let stateUpdates: Partial<State> = {};
    if(prevProps.chatList !== this.props.chatList) {
        stateUpdates.chatList = this.props.chatList || [];
    }
    if(prevProps.activeChat !== this.props.activeChat) {
        stateUpdates.activeChat = this.props.activeChat || null;
    }
    
    if(Object.keys(stateUpdates).length > 0) {
        this.setState(stateUpdates as Pick<State, keyof State>);
    }
}

    private setSession = (session: SessionType): void => {
        this.setState({ currentSession: session });
    }

    handleChatSelect = async (chat: any): Promise<void> => {
        const chatType = chat.type === 'DIRECT' ? 'DIRECT' : 'GROUP'
        const chatId = chat.id || chat.chatId;
        chatState.setType(chatType);
        
        try {
            this.updateState({
                showCreationForm: false,
                showJoinForm: false,
                showGroup: true,
                hideGroup: false,
                groupName: chat.name
            });
            await this.props.messageManager.setCurrentChat(
                chatId,
                chatType,
                chat.members || []
            );
            this.setState({
                activeChat: { ...chat }
            });
            
            const event = new CustomEvent('chat-activated', {
                detail: {
                    chat: {
                        ...chat,
                        type: chatType
                    },
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

    private handleChatItemRemoved = (event: CustomEvent): void => {
        const { id, groupId, reason } = event.detail;
        if(reason !== 'group-exit') return;

        const removedId = id || groupId;
        if(!removedId) return;

        const itemExists = this.state.chatList.some(chat =>
            chat.id === removedId || chat.groupId === removedId
        );
        if(!itemExists) return;

        if(this.props.onChatListUpdate) {
            const updatedList = this.props.chatList.filter(chat =>
                chat.id !== removedId && chat.groupId !== removedId
            );
            this.props.onChatListUpdate(updatedList);
        }

        this.setState(prevState => ({
            chatList: prevState.chatList.filter(chat => {
                const shouldKeep = chat.id !== removedId && chat.groupId != removedId;
                return shouldKeep;
            })
        }));
        this.setState(prevState => {
            if (
                prevState.activeChat && 
                (prevState.activeChat.id === removedId ||
                prevState.activeChat.groupId === removedId)
            ) {
                return { activeChat: null };
            }
            return null;
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
                                    <div className="sidebar">
                                        {this.contactService && (
                                            <ContactLayout contactService={this.contactService!}></ContactLayout>
                                        )}
                                    </div>
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
                                                    key={chat.id || `${chat.type}_${i}`}
                                                    className={`chat-item${
                                                        activeChat && 
                                                        activeChat.id === chat.id ? 'active' : ''
                                                    }`}
                                                    onClick={() => this.handleChatSelect(chat)}
                                                >
                                                    <div className="chat-icon">
                                                        {chat.type === 'DIRECT' ? 'd' : 'g'}
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