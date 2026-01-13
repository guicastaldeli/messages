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
import { Main } from "./_main";
import { DirectLayout } from "./chat/type/direct/direct-layout";

interface Props {
    chatController: ChatController;
    chatManager: ChatManager;
    chatService: ChatService;
    chatList: any[];
    activeChat: any;
    main: Main;
    onChatListUpdate?: (chatList: any[]) => void;
    onLogout?: () => Promise<void>;
}

interface State {
    userId: string | null;
    currentSession: SessionType;
    groups: any[];
    chatList: any[] | any;
    activeChat: any;
    contactService: ContactServiceClient | null;
    isLoading: boolean;
    contactsLoaded: boolean;
    chatsLoaded: boolean;
    chatStreamComplete: boolean;
    chatItemsAdded: boolean;
    expectedChatCount: number;
    unreadCounts: Map<string, number>;
    activeSidebarTab: 'chats' | 'contacts';
}

export class Dashboard extends Component<Props, State> {
    public contactService: ContactServiceClient | null = null;
    private chatContainerRef: React.RefObject<HTMLDivElement | null>;

    private removedChatIds = new Set<string>();

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
            contactsLoaded: false,
            chatsLoaded: false,
            chatStreamComplete: false,
            chatItemsAdded: false,
            expectedChatCount: 0,
            unreadCounts: new Map(),
            activeSidebarTab: 'chats'
        }
        this.chatContainerRef = React.createRef();
    }

    public async getUserData(sessionId: string, userId: string, username: string): Promise<void> {
        this.setState({ userId });
        this.props.chatManager.getUserData(sessionId, userId, username);
    }

    /**
     * Handle Stream Complete
     */
    private async handleChatStreamComplete() {
        await new Promise<void>((resolve) => {
            const complete = (event: any) => {
                const { total } = event.detail;
                console.log('Stream complete event received. Expected total chats:', total);
                
                this.setState({ 
                    chatStreamComplete: true,
                    expectedChatCount: total || 0
                }, () => {
                    this.checkChatItemsAdded();
                    resolve();
                });
                
                window.removeEventListener('chat-stream-complete', complete);
            };
                
            const err = () => {
                this.setState({ 
                    chatStreamComplete: true,
                    chatItemsAdded: true
                });
                resolve();
                window.removeEventListener('chats-stream-error', err);
            };
                
            window.addEventListener('chat-stream-complete', complete);
            window.addEventListener('chats-stream-error', err);
        });
    }

    private checkChatItemsAdded() {
        const currentCount = this.state.chatList.length;
        const expectedCount = this.state.expectedChatCount;
        const allChatsLoaded = expectedCount === 0 || currentCount >= expectedCount;
        if(allChatsLoaded) this.setState({ chatItemsAdded: true });
    }

    private async checkChatsCompleted() {
        await new Promise<void>((res) => {
            const completed = () => {
                if(this.state.chatStreamComplete) {
                    console.log('Chat stream complete, total chats:', this.state.chatList.length);
                    res();
                } else {
                    setTimeout(completed, 100);
                }
            };
            completed();
        });
    }

    /**
     *  Chat List Update
     */
    public updateChatList(chatList: any[]): void {
        this.setState({ chatList });
        if(this.props.onChatListUpdate) {
            this.props.onChatListUpdate(chatList);
        }
        
        const event = new CustomEvent('chat-list-updated', {
            detail: { chatList }
        });
        window.dispatchEvent(event);
    }

    private handleChatListUpdated = (event: CustomEvent): void => {
        const { chatList } = event.detail;

        const filteredChatList = chatList.filter((chat: any) =>
            !this.removedChatIds.has(chat.id) && !this.removedChatIds.has(chat.groupId)
        );
        this.setState({ chatList: filteredChatList });
        
        if(this.state.chatStreamComplete && 
           this.state.expectedChatCount > 0 && 
           chatList.length >= this.state.expectedChatCount
        ) {
            this.setState({ chatItemsAdded: true });
        }
        
        if(this.props.onChatListUpdate) {
            this.props.onChatListUpdate(filteredChatList);
        }
    }

    async componentDidMount(): Promise<void> {
        this.setSession('MAIN_DASHBOARD');

        const sessionData = SessionManager.getUserInfo();
        const userId = sessionData?.userId;

        const savedActiveChat = localStorage.getItem('active-chat');
        if(savedActiveChat) {
            try {
                const activeChat = JSON.parse(savedActiveChat);
                console.log('Restored active chat from storage:', activeChat);
                this.setState({ 
                    activeChat,
                    isLoading: false
                });
            } catch(err) {
                console.error('Failed to parse saved active chat:', err);
            }
        }

        if(this.props.chatManager) {
            this.props.chatManager.setDashboard(this);
            this.props.chatManager.setUpdateCallback((updatedList) => { 
                const filteredList = updatedList.filter((chat: any) => 
                    !this.removedChatIds.has(chat.id) &&
                    !this.removedChatIds.has(chat.groupId)
                );
                this.setState({ chatList: filteredList }); 
            });
            if(this.chatContainerRef.current) {
                const container = this.chatContainerRef.current;
                this.props.chatManager.setContainer(container);
                this.props.chatManager.getDirectManager()?.setContainer(container);
                this.props.chatManager.getGroupManager()?.setContainer(container);
            }
        }

        if(userId) {
            this.setState({ userId });
            await this.loadData();
        } else {
            this.setState({
                contactsLoaded: false,
                chatsLoaded: false, 
                chatStreamComplete: false,
                isLoading: false 
            });
        }

        window.removeEventListener('chat-item-removed', this.handleChatItemRemoved as EventListener);
        window.removeEventListener('chat-list-updated', this.handleChatListUpdated as EventListener);

        window.addEventListener('chat-unread-updated', this.handleChatUnreadUpdated as EventListener);
        window.addEventListener('chat-read', this.handleChatRead as EventListener);
        window.addEventListener('chat-item-removed', this.handleChatItemRemoved as EventListener);
        window.addEventListener('chat-list-updated', this.handleChatListUpdated as EventListener);
    }

    componentWillUnmount(): void {
        window.removeEventListener('chat-item-removed', this.handleChatItemRemoved as EventListener);
        window.removeEventListener('chat-list-updated', this.handleChatListUpdated as EventListener);
        window.removeEventListener('chat-stream-complete', () => {});
        window.removeEventListener('chats-stream-error', () => {});
        window.removeEventListener('chat-unread-updated', this.handleChatUnreadUpdated as EventListener);
        window.removeEventListener('chat-read', this.handleChatRead as EventListener);
    }

    componentDidUpdate(prevProps: Props): void {
        if(this.props.chatList && 
            this.props.chatManager !== prevProps.chatManager
        ) {
            this.props.chatManager.setContainer(this.chatContainerRef.current!);
        }

        let stateUpdates: Partial<State> = {};
        if(prevProps.activeChat !== this.props.activeChat) {
            stateUpdates.activeChat = this.props.activeChat || null;
        }
        
        if(Object.keys(stateUpdates).length > 0) {
            this.setState(stateUpdates as Pick<State, keyof State>);
        }
    }

    private async loadData(): Promise<void> {
        try {
            this.setState({ isLoading: true }); 
            await this.props.main.loadData(this.state.userId!);

            this.contactService = new ContactServiceClient({
                socketClient: this.props.chatController.socketClient,
                chatController: this.props.chatController,
                userId: this.props.chatController.userId,
                username: this.props.chatController.username
            });
            this.contactService.setupEventListeners();

            await this.handleChatStreamComplete();
            await this.checkChatsCompleted();
            
            this.setState({
                contactService: this.contactService,
                contactsLoaded: true,
                chatsLoaded: true,
                isLoading: false
            }, () => {
                const event = new CustomEvent('dashboard-loaded');
                window.dispatchEvent(event);
            });
        } catch(err) {
            console.error('Error loading chat list', err);
            this.setState({
                contactsLoaded: false,
                chatsLoaded: false,
                chatStreamComplete: false,
                isLoading: false 
            });
        }
    }

    private setSession = (session: SessionType): void => {
        this.setState({ currentSession: session });
    }

    /**
     * Unread Message
     */
    private getChatUnreadCount(chatId: string): number {
        if(!this.props.chatController.getNotificationController()) return 0;
        return this.props.chatController.getNotificationController().getChatUnreadCount(chatId);
    }

    private handleChatUnreadUpdated = (e: CustomEvent): void => {
        const { chatId, unreadCount } = e.detail;
        this.setState(prevState => {
            const newUnreadCounts = new Map(prevState.unreadCounts);
            newUnreadCounts.set(chatId, unreadCount);
            return { unreadCounts: newUnreadCounts }
        });
    }

    /**
     * Handle Chat Read
     */
    private handleChatRead = (e: CustomEvent): void => {
        const { chatId } = e.detail;
        this.setState(prevState => {
            const newUnreadCounts = new Map(prevState.unreadCounts);
            return { unreadCounts: newUnreadCounts }
        });
    }

    /**
     * Handle Chat Select
     */
    private handleChatSelect = async (chat: any): Promise<void> => {
        const chatType = chat.type === 'DIRECT' ? 'DIRECT' : 'GROUP';
        const chatId = chat.id || chat.chatId;

        if(this.props.chatController.getNotificationController()) {
            await this.props.chatController
                .getNotificationController()
                .markAsRead(chatId);
        }

        const readEvent = new CustomEvent('chat-read', {
            detail: { chatId: chatId }
        });
        window.dispatchEvent(readEvent);
        
        chatState.setType(chatType);
        
        try {
            const activeChatData = {
                ...chat,
                id: chatId,
                name: chat.name || chat.contactUsername || 'Chat',
                type: chatType
            };
            
            this.setState({ activeChat: activeChatData }, () => {
                localStorage.setItem('active-chat', JSON.stringify(activeChatData));
                
                this.updateState({
                    showCreationForm: false,
                    showJoinForm: false,
                    showGroup: chatType === 'GROUP',
                    hideGroup: false,
                    groupName: chat.name || chat.contactUsername || 'Chat'
                });

                if(this.chatContainerRef.current && this.props.chatManager) {
                    const container = this.chatContainerRef.current;
                    this.props.chatManager.setContainer(container);
                    this.props.chatManager.getDirectManager()?.setContainer(container);
                    this.props.chatManager.getGroupManager()?.setContainer(container);
                }

                this.props.chatController.setCurrentChat(
                    chatId,
                    chatType,
                    chat.members || []
                );

                const event = new CustomEvent('chat-activated', {
                    detail: {
                        chat: activeChatData,
                        shouldRender: true
                    }
                });
                window.dispatchEvent(event);
            });
        } catch(err) {
            console.error('Error loading chat history:', err);
        }
    }

    private handleCloseGroupLayout = (): void => {
        if(this.chatContainerRef.current) {
            this.chatContainerRef.current.innerHTML = '';
        }
        localStorage.removeItem('active-chat');
        this.setState({
            activeChat: null
        });
        this.updateState({
            showGroup: false,
            groupName: ''
        });
        this.props.chatController.setCurrentChat(null, null, []);
    }

    /**
     * Remove Chat Item
     */
    private handleChatItemRemoved = (event: CustomEvent): void => {
        const { id, groupId, reason } = event.detail;
        if(reason !== 'group-exit') return;

        const removedId = id || groupId;
        if(!removedId) return;

        this.removedChatIds.add(removedId);
        const updatedChatList = this.state.chatList.filter((chat: any) => 
            chat.id !== removedId && chat.groupId !== removedId
        );
        
        this.setState({ 
            chatList: updatedChatList 
        });
        if(this.props.onChatListUpdate) {
            this.props.onChatListUpdate(updatedChatList);
        }

        if(this.state.activeChat && 
            (this.state.activeChat.id === removedId ||
            this.state.activeChat.groupId === removedId)
        ) {
            console.log('Clearing active chat');
            this.setState({ activeChat: null });
            localStorage.removeItem('active-chat');
        }

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

    /**
     * Is Loaded
     */
    private isLoaded(): boolean {
        return this.state.chatsLoaded && 
            this.state.contactsLoaded &&
            this.state.chatStreamComplete &&
            this.state.chatItemsAdded;
    }

    private renderChatLayout() {
        const { activeChat, chatList } = this.state;
        const { chatController, chatManager } = this.props;

        if (!activeChat || !chatManager) {
            return (
                <div className="chat-content-empty">
                    <div className="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="currentColor"/>
                        </svg>
                        <h3>Select a chat</h3>
                        <p>Choose a conversation from the sidebar to start messaging</p>
                    </div>
                </div>
            );
        }

        if (activeChat.type === 'DIRECT' && chatManager.getDirectManager()) {
            return (
                <DirectLayout
                    chatController={chatController}
                    directManager={chatManager.getDirectManager()}
                    onClose={this.handleCloseGroupLayout}
                    chatId={activeChat.id}
                    participantName={activeChat.name}
                    key={`direct-${activeChat.id}`}
                />
            );
        } else if (activeChat.type === 'GROUP' && chatManager.getGroupManager()) {
            return (
                <GroupLayout
                    chatController={chatController}
                    groupManager={chatManager.getGroupManager()}
                    groupId={activeChat.id}
                    groupName={activeChat.name}
                    onClose={this.handleCloseGroupLayout}
                    mode="chat"
                    key={`group-${activeChat.id}`}
                />
            );
        }

        return null;
    }

    render() {
        const sessionData = SessionManager.getUserInfo();
        const userId = sessionData?.userId;
        const { chatList, activeSidebarTab } = this.state;
        const { activeChat } = this.state;
        const { chatController, chatManager } = this.props

        if(!userId) {
            return <div>Loading user data...</div>;
        }
        
        const loadingOverlay = (this.state.isLoading || !this.isLoaded()) ? (
            <div className="dashboard-loading-overlay">
                <div className="loading-content">
                    <div>Loading dashboard...</div>
                    <div className="loading-status">
                        {!this.state.chatsLoaded && <span>Loading chats...</span>}
                        {!this.state.contactsLoaded && <span>Loading contacts...</span>}
                        {this.state.chatsLoaded && this.state.contactsLoaded && 
                        !this.state.chatStreamComplete && (
                            <span>Streaming chat data...</span>
                        )}
                        {this.state.chatStreamComplete && !this.state.chatItemsAdded && (
                            <span>Processing chats ({this.state.chatList.length}/{this.state.expectedChatCount})...</span>
                        )}
                    </div>
                </div>
            </div>
        ) : null;

        return (
            <SessionContext.Consumer>
                {(sessionContext) => {
                    if(!sessionContext || sessionContext.currentSession !== 'MAIN_DASHBOARD') {
                        return null;
                    }

                    return (
                        <>
                            {loadingOverlay}
                            {sessionContext && sessionContext.currentSession === 'MAIN_DASHBOARD' && (
                                <div className="screen main-dashboard">
                                    <div className="sidebar">
                                        {/* User Info Section */}
                                        <div className="user-info-section">
                                            <div className="user-profile">
                                                <div className="user-avatar">
                                                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="currentColor"/>
                                                        <path d="M12 14C6.477 14 2 18.477 2 24H22C22 18.477 17.523 14 12 14Z" fill="currentColor"/>
                                                    </svg>
                                                </div>
                                                <div className="user-details">
                                                    <div className="username-display">
                                                        {sessionData?.username || 'User'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="user-options">
                                                
                                                <button 
                                                    id="logout-actn" 
                                                    onClick={() => this.props.main.handleLogout(sessionContext)}
                                                    title="Logout"
                                                >
                                                    Logout
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {/* Sidebar Tabs */}
                                        <div className="sidebar-tabs">
                                            <button
                                                className={activeSidebarTab === 'chats' ? 'active' : ''}
                                                onClick={() => this.setState({ activeSidebarTab: 'chats' })}
                                            >
                                                Chats
                                            </button>
                                            <button
                                                className={activeSidebarTab === 'contacts' ? 'active' : ''}
                                                onClick={() => this.setState({ activeSidebarTab: 'contacts' })}
                                            >
                                                Contacts
                                            </button>
                                        </div>
                                        
                                        {/* Conditional Rendering Based on Tab */}
                                        {activeSidebarTab === 'contacts' && this.contactService && (
                                            <ContactLayout contactService={this.contactService} />
                                        )}
                                        
                                        {activeSidebarTab === 'chats' && (
                                            <div id="chat-container">
                                                <header>
                                                    <div id="actions-bar">
                                                        <button 
                                                            id="action-create-group"
                                                            onClick={() => chatManager?.getGroupManager()?.onCreateGroup()}
                                                            disabled={!chatManager}
                                                        >
                                                            Create Group
                                                        </button>
                                                        <button 
                                                            id="action-join-group"
                                                            onClick={() => chatManager?.getGroupManager()?.onJoinGroup()}
                                                            disabled={!chatManager}
                                                        >
                                                            Join Group
                                                        </button>
                                                    </div>
                                                </header>
                                                
                                                <div className="chat-list">
                                                    {chatList.length === 0 ? (
                                                        <p>No chats yet.</p>
                                                    ) : (
                                                        <ul>
                                                            {chatList.map((chat: any, i: any) => {
                                                                const unreadCount = this.getChatUnreadCount(chat.id || chat.chatId || chat.groupId);
                                                                const isUnread = unreadCount > 0;
                                                                return (
                                                                    <li
                                                                        key={chat.id || `${chat.type}_${i}`}
                                                                        className={`chat-item${
                                                                            activeChat && 
                                                                            activeChat.id === chat.id ? ' active' : ''
                                                                        }${isUnread ? ' unread' : ''}`} 
                                                                        onClick={() => this.handleChatSelect(chat)}
                                                                    >
                                                                        <div 
                                                                            className={`chat-icon ${chat.type === 'DIRECT' ? 'direct-icon' : 'group-icon'}`}
                                                                            data-chat-index={i}
                                                                        >
                                                                            {chat.type === 'DIRECT' ? (
                                                                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                                    <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="currentColor"/>
                                                                                    <path d="M12 14C6.477 14 2 18.477 2 24H22C22 18.477 17.523 14 12 14Z" fill="currentColor"/>
                                                                                </svg>
                                                                            ) : (
                                                                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                                    <path d="M16 11C17.66 11 18.99 9.66 18.99 8C18.99 6.34 17.66 5 16 5C14.34 5 13 6.34 13 8C13 9.66 14.34 11 16 11ZM8 11C9.66 11 10.99 9.66 10.99 8C10.99 6.34 9.66 5 8 5C6.34 5 5 6.34 5 8C5 9.66 6.34 11 8 11ZM8 13C5.67 13 1 14.17 1 16.5V19H15V16.5C15 14.17 10.33 13 8 13ZM16 13C15.71 13 15.38 13.02 15.03 13.05C16.19 13.89 17 15.02 17 16.5V19H23V16.5C23 14.17 18.33 13 16 13Z" fill="currentColor"/>
                                                                                </svg>
                                                                            )}
                                                                        </div>
                                                                        <div className="chat-info">
                                                                            <div id="chat-name">{chat.name}</div>
                                                                            <div id="chat-preview">
                                                                                {typeof chat.lastMessage === 'object' 
                                                                                    ? chat.lastMessage.content 
                                                                                    : chat.lastMessage}
                                                                            </div>
                                                                        </div>
                                                                        {isUnread && (
                                                                            <div className="unread-badge">
                                                                                {unreadCount}
                                                                            </div>
                                                                        )}
                                                                    </li>
                                                                )
                                                            })}
                                                        </ul>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div 
                                        className="chat-content-container"
                                        ref={this.chatContainerRef}
                                        key={`chat-content-${activeChat?.id || 'empty'}-${activeChat?.type || 'none'}`}
                                    >
                                        {this.renderChatLayout()}
                                    </div>
                                </div>
                            )}
                        </>
                    )
                }}
            </SessionContext.Consumer>
        );
    }
}