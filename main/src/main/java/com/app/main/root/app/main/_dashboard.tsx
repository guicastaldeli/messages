import "./__styles/styles.scss";
import React, { Component } from "react";
import { ChatController } from "./chat/chat-controller";
import { SessionContext, SessionType } from "./_session/session-provider";
import { ChatManager } from "./chat/chat-manager";
import { ChatService } from "./chat/chat-service";
import { chatState } from "./chat/chat-state-service";
import { GroupLayout } from "./chat/type/group/group-layout";
import { ContactServiceClient } from "./contact/contact-service-client";
import { ContactLayout } from "./contact/contact-layout";
import { SessionManager } from "./_session/session-manager";

interface Props {
    chatController: ChatController;
    chatManager: ChatManager;
    chatService: ChatService;
    chatList: any[];
    activeChat: any;
    onChatListUpdate?: (chatList: any[]) => void;
    onLogout?: () => Promise<void>;
}

interface State {
    userId: string | null;
    currentSession: SessionType;
    groups: any[];
    chatList: any[];
    activeChat: any;
    contactService: ContactServiceClient | null;
    isLoading: boolean;
}

export class Dashboard extends Component<Props, State> {
    private groupContainerRef: React.RefObject<HTMLDivElement | null>;
    public contactService: ContactServiceClient | null = null;

    constructor(props: Props) {
        super(props);
        this.state = {
            userId: null,
            currentSession: 'MAIN_DASHBOARD',
            groups: [],
            chatList: props.chatList || [],
            activeChat: props.activeChat || null,
            contactService: null,
            isLoading: true,
        }
        this.groupContainerRef = React.createRef();
    }

    public async getUserData(sessionId: string, userId: string, username: string): Promise<void> {
        this.setState({ userId });
        this.props.chatManager.getUserData(sessionId, userId, username);
        console.log(sessionId, userId,'username:', username)
    }

    async componentDidMount(): Promise<void> {
        this.setSession('MAIN_DASHBOARD');

        const sessionData = SessionManager.getUserInfo();
        const userId = sessionData?.userId;
        if(userId) {
            this.setState({ userId });
            try {
                const messageService = 
                    await this.props.chatService
                        .getMessageController()
                        .getMessageService();
                const chatList = await messageService.getMessagesByUserId(this.state.userId!);
                this.setState({ chatList, isLoading: false });
            } catch(err) {
                console.error('Error loading chat list', err);
                this.setState({ isLoading: false });
            }
        } else {
            this.setState({ isLoading: false });
        }

        if(!this.groupContainerRef.current || !this.props.chatManager) return;
        this.props.chatManager.setDashboard(this);
        this.props.chatManager.setContainer(this.groupContainerRef.current);
        this.props.chatManager.setUpdateCallback((updatedList) => { this.setState({ chatList: updatedList }) });
        window.addEventListener('chat-item-removed', this.handleChatItemRemoved as EventListener);

        this.contactService = new ContactServiceClient({
            socketClient: this.props.chatController.socketClient,
            chatController: this.props.chatController,
            userId: this.props.chatController.userId,
            username: this.props.chatController.username
        });
        this.contactService.setupEventListeners();
    }

    componentWillUnmount(): void {
        window.removeEventListener('chat-item-removed', this.handleChatItemRemoved as EventListener);
    }

    componentDidUpdate(prevProps: Props): void {
        if(this.props.chatList && 
            this.props.chatManager !== prevProps.chatManager &&
            this.groupContainerRef.current 
        ) {
            this.props.chatManager.setContainer(this.groupContainerRef.current);
        }

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
            await this.props.chatController.setCurrentChat(
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

    /**
     * State Related
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
        if(this.state.isLoading) {
            return <div>Loading dashboard...</div>;
        }

        const sessionData = SessionManager.getUserInfo();
        const userId = sessionData?.userId;
        if(!userId) {
            return <div>Loading user data...</div>;
        }

        const { chatList, activeChat } = this.props;
        const { chatController, chatManager } = this.props

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
                                                onClick={() => chatManager?.getGroupManager()?.onCreateGroup()}
                                                disabled={!chatManager}
                                            >
                                                Group++++
                                            </button>
                                            <button 
                                                id="action-join-group"
                                                onClick={() => chatManager?.getGroupManager()?.onJoinGroup()}
                                                disabled={!chatManager}
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
                                    chatController={chatController}
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