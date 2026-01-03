import React from "react";
import { chatState } from "../chat/chat-state-service";
import { SocketClientConnect } from "../socket-client-connect";
import { ChatController } from "../chat/chat-controller";
import { ChatService } from "./chat-service";
import { ApiClientController } from "../_api-client/api-client-controller";
import { Dashboard } from "../_dashboard";
import { Loader } from "./loader";
import { DirectManager } from "./type/direct/direct-manager";
import { GroupManager } from "./type/group/group-manager";

export interface Item {
    id: string;
    chatId?: string;
    groupId?: string;
    name: string;
    type: 'DIRECT' | 'GROUP';
    lastMessage?: string;
    timestamp?: Date;
}

export interface ActiveChat {
    id: string;
    name: string;
    type: 'DIRECT' | 'GROUP';
}

interface State {
    chatList: Item[];
    activeChat: ActiveChat | null;
}

export class ChatManager {
    private apiClientController: ApiClientController;
    private socketClient: SocketClientConnect;
    private dashboard: Dashboard;

    private chatList: any[] = [];
    private activeChat: any = null;
    private container!: HTMLElement;
    public userId!: string;

    private updateCallback: ((chatList: any[]) => void) | null = null;
    private setState: React.Component<any, State>['setState'];
    private updateQueue: Array<() => void> = [];
    private isUpdating = false;

    private loader!: Loader;
    private chatService: ChatService;
    private directManager: DirectManager;
    private groupManager: GroupManager;

    constructor(
        chatService: ChatService,
        socketClient: SocketClientConnect,
        chatController: ChatController,
        apiClientController: ApiClientController,
        dashboard: Dashboard,
        appEl: HTMLDivElement | null = null,
        username: string | undefined,
        setState: React.Component<any, State>['setState']
    ) {
        this.chatService = chatService;
        this.socketClient = socketClient;
        this.dashboard = dashboard;
        this.apiClientController = apiClientController;
        this.directManager = new DirectManager(
            socketClient,
            chatController,
            chatService
        );
        this.groupManager = new GroupManager(
            this,
            socketClient, 
            chatController, 
            apiClientController,
            dashboard, 
            appEl, 
            username!
        );
        this.setState = setState;
    }

    public setUpdateCallback(callback: (list: any[]) => void): void {
        this.updateCallback = callback;
    }

    public async getUserData(sessionId: string, userId: string, username: string): Promise<void> {
        this.userId = userId;
        await this.directManager.getUserData(sessionId, userId);
        await this.groupManager.getUserData(sessionId, userId, username);
    }

    /**
     * Chat Item Added
     */
    private handleChatItemAdded = (event: CustomEvent): void => {
        const chatItem = event.detail;
        
        const existingChatIndex = this.chatList.findIndex(chat => chat.id === chatItem.id);
        
        if (existingChatIndex === -1) {
            this.chatList.push(chatItem);
        } else {
            this.chatList[existingChatIndex] = {
                ...this.chatList[existingChatIndex],
                ...chatItem,
                lastUpdated: new Date()
            };
        }

        this.sortChats(this.chatList);

        if(this.setState) this.setState({ chatList: [...this.chatList] });
        if(this.updateCallback) this.updateCallback([...this.chatList]);

        this.updateChatList();
    }

    /**
     * Load Chats
     */
    public async loadChats(userId: string): Promise<void> {
        try {
            const handleChatItemAdded = (event: CustomEvent) => {
                this.handleChatItemAdded(event);
            };

            const handleStreamComplete = (event: CustomEvent) => {
                console.log('Chats streaming completed:', event.detail);
                window.removeEventListener('chat-item-added', handleChatItemAdded as EventListener);
                window.removeEventListener('chat-item-streamed', handleChatItemAdded as EventListener);
                window.removeEventListener('chat-activated', this.handleChatActivated as EventListener);
                window.removeEventListener('last-message-updated', this.handleLastMessage as EventListener);
                window.removeEventListener('chats-stream-complete', handleStreamComplete as EventListener);
                window.removeEventListener('chats-stream-error', handleStreamError as EventListener);
            };

            const handleStreamError = (event: CustomEvent) => {
                console.error('Chats streaming error:', event.detail.error);
                window.removeEventListener('chat-item-added', handleChatItemAdded as EventListener);
                window.removeEventListener('chat-item-streamed', handleChatItemAdded as EventListener);
                window.removeEventListener('chat-activated', this.handleChatActivated as EventListener);
                window.removeEventListener('last-message-updated', this.handleLastMessage as EventListener);
                window.removeEventListener('chats-stream-complete', handleStreamComplete as EventListener);
                window.removeEventListener('chats-stream-error', handleStreamError as EventListener);
            };

            window.addEventListener('chat-item-added', handleChatItemAdded as EventListener);
            window.addEventListener('chat-item-streamed', handleChatItemAdded as EventListener);
            window.addEventListener('chat-activated', this.handleChatActivated as EventListener);
            window.addEventListener('last-message-updated', this.handleLastMessage as EventListener);
            window.addEventListener('chats-stream-complete', handleStreamComplete as EventListener);
            window.addEventListener('chats-stream-error', handleStreamError as EventListener);

            const chatService = new ChatService(this.socketClient, this.apiClientController);
            const loader = new Loader(this.socketClient, chatService, this);
            await loader.loadChatItems(userId);
        } catch (err) {
            console.error('Failed to load chats via events:', err);
        }
    }

    /**
     * Update Chat List
     */
    private updateChatList(): void {
        if(this.dashboard) this.dashboard.updateChatList(this.chatList);
        const event = new CustomEvent('chat-list-updated', {
            detail: { chatList: this.chatList }
        });
        window.dispatchEvent(event);
    }

    private processQueue(): void {
        if(this.isUpdating || this.updateQueue.length === 0) return;
        this.isUpdating = true;

        const updateFn = this.updateQueue.shift();
        if(updateFn) updateFn();

        setTimeout(() => {
            this.isUpdating = false;
            this.processQueue();
        }, 0);
    }

    /**
     * Update Last Message
     */
    private handleLastMessage = (event: CustomEvent): void => {
        const { 
            messageId, 
            chatId, 
            userId, 
            lastMessage, 
            sender, 
            timestamp, 
            isCurrentUser 
        } = event.detail;

        const systemMessage = this.isSystemMessage(event.detail);
        const formattedMessage = this.formattedMessage(
            chatId, 
            lastMessage, 
            isCurrentUser, 
            sender, 
            systemMessage
        
        );
        this.updateChatMessage({
            id: chatId,
            userId: userId,
            messageId: messageId,
            lastMessage: formattedMessage,
            sender: sender,
            timestamp: timestamp
        });
        this.ensureChatExists(
            chatId,
            sender,
            timestamp,
            formattedMessage
        );
    }

    public updateChatMessage(detail: {
        id: string;
        userId: string;
        messageId: string;
        lastMessage: string;
        sender: string;
        timestamp: string;
    }): void {
        const { id, lastMessage, sender, timestamp, messageId, userId } = detail;
        const now = new Date(timestamp);
        
        this.setState((prevState: State) => {
            const chatIndex = prevState.chatList.findIndex(chat => chat.id === id);
            if(chatIndex === -1) {
                return prevState;
            }

            const updatedChatList = [...prevState.chatList];
            const originalChat = updatedChatList[chatIndex];

            const updatedChat = {
                ...originalChat,
                userId: userId,
                messageId: messageId,
                lastMessage: this.formattedLastMessage(lastMessage),
                lastMessageSender: sender,
                lastMessageTime: timestamp,
                timestamp: now
            }

            updatedChatList.splice(chatIndex, 1);
            updatedChatList.unshift(updatedChat);
            return { chatList: updatedChatList }
        });
    }

    private ensureChatExists(
        chatId: string, 
        sender: string, 
        timestamp: string,
        lastMessage: string
    ): void {
        this.setState((prevState: State) => {
            const chatExists = prevState.chatList.some(chat =>
                chat.id === chatId ||
                chat.chatId === chatId ||
                chat.groupId === chatId
            );
            if(chatExists) {
                const updatedChatList = prevState.chatList.map(chat => {
                    if(
                        chat.id === chatId ||
                        chat.chatId === chatId ||
                        chat.groupId === chatId
                    ) {
                        return {
                            ...chat,
                            lastMessage: lastMessage,
                            timestamp: new Date(timestamp)
                        }
                    }
                    return chat;
                });
                return { chatList: updatedChatList }
            }
            const chatType = chatId.startsWith('direct_') ? 'DIRECT' : 'GROUP';
            const chatName = sender;
            
            const item: Item = {
                id: chatId,
                name: chatName,
                type: chatType,
                timestamp: new Date(timestamp)
            }
            
            return { chatList: [item, ...prevState.chatList] }
        });
    }

    public setLastMessage(
        id: string,
        userId: string,
        messageId: string,
        content: string,
        sender: string,
        isSystem: boolean
    ): void {
        this.updateLastMessage(
            id,
            userId,
            messageId, 
            content, 
            sender,
            isSystem
        );
    }

    public async lastMessage(id: string): Promise<{
        content: string,
        currentUserId: string, 
        sender: string, 
        isSystem: boolean
    } | null> {
        try {
            const service = await this.chatService.getMessageController().getMessageService();
            const res = await service.getMessagesByChatId(id, 0);
            const messages = res.messages || [];
            if(messages && messages.length > 0) {
                const sortedMessages = messages.sort((a, b) => {
                    return parseInt(b.id) - parseInt(a.id);
                });

                const lastMsg = sortedMessages[0];
                return {
                    content: lastMsg.content,
                    currentUserId: lastMsg.sender || lastMsg.senderId,
                    sender: lastMsg.sender || lastMsg.senderId,
                    isSystem: lastMsg.isSystem || false
                }
            }
        } catch(err) {
            console.error('Failed to get recent messages', err);
        }

        return null;
    }

    public updateLastMessage(
        id: string,
        userId: string,
        messageId: string,
        content: string,
        sender: string,
        isSystem: boolean
    ): void {
        const time = new Date().toISOString();
        const updateEvent = new CustomEvent('last-message-updated', {
            detail: {
                chatId: id,
                userId: userId,
                messageId: messageId,
                lastMessage: content,
                sender: sender,
                timestamp: time,
                isCurrentUser: sender,
                isSystem: isSystem
            }
        });
        window.dispatchEvent(updateEvent);
    }

    /**
     * Activate Chat
     */
    private handleChatActivated = (event: CustomEvent): void => {
        const activeChat: ActiveChat = event.detail.chat;
        const shouldRender = event.detail.shouldRender;
        chatState.setType(activeChat.type === 'DIRECT' ? 'DIRECT' : 'GROUP');
        this.setState({ activeChat });

        if(activeChat.type === 'GROUP') {
            this.groupManager.currentGroupId = activeChat.id;
            this.groupManager.currentGroupName = activeChat.name;
        }
        if(shouldRender && this.updateCallback) this.updateCallback([...this.chatList])
    }

    /* Set Container */
    public setContainer(container: HTMLElement): void {
        this.container = container;
        const directManager = this.getDirectManager();
        if(directManager) directManager.container = container;
        const groupManager = this.getGroupManager();
        if(groupManager) groupManager.container = container;
    }

    /* Set Dashboard */
    public setDashboard(instance: Dashboard): void {
        const groupManager = this.getGroupManager();
        if(groupManager) groupManager.dashboard = instance;
    }

    /* Set Username */
    public setUsername(username: string): void {
        const groupManager = this.getGroupManager();
        if(groupManager) groupManager.username = username;
    }

    /**
     * Formatted Message
     */
    public formattedMessage(
        chatId: string, 
        lastMessage: string, 
        isCurrentUser: string, 
        sender: string,
        systemMessage: boolean
    ): string {
        const isDirect = chatId.startsWith('direct_');
        let formattedMessage;

        if(isDirect) {
            if(systemMessage) {
                formattedMessage = lastMessage;
            } else {
                formattedMessage = lastMessage;
            }
        } else {
            if(systemMessage) {
                formattedMessage = lastMessage;
            } else {
                formattedMessage = isCurrentUser 
                    ? `You: ${lastMessage}`
                    : `${sender}: ${lastMessage}`;
            }
        }

        return formattedMessage;
    }

    public formattedLastMessage(message: string): string {
        if(message.length > 10) return message.substring(0, 15) + '...';
        return message;
    }

    /**
     * System Message
     */
    private isSystemMessage(message: any): boolean {
        if(message.isSystem === true) return true;
        if(message.messageId.includes('sys_')) return true;
        if(message.type === 'SYSTEM') return true;
        return false;
    }

    private sortChats(chats: any[]): any[] {
        return chats.sort((a, b) => {
            const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : new Date(a.createdAt).getTime();
            const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : new Date(b.createdAt).getTime();
            return timeB - timeA;
        });
    }

    /**
     * Get Loader
     */
    public getLoader(): Loader {
        return this.loader;
    }

    /**
     * Get Direct Manager
     */
    public getDirectManager(): DirectManager {
        return this.directManager;
    }

    /**
     * Get Group Manager
     */
    public getGroupManager(): GroupManager {
        return this.groupManager;
    }
}