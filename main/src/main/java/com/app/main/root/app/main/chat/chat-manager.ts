import React from "react";
import { chatState } from "../chat/chat-state-service";
import { SocketClientConnect } from "../socket-client-connect";
import { MessageManager } from "../_messages_config/message-manager";
import { ApiClient } from "../_api-client/api-client";
import { Dashboard } from "../_dashboard";
import { Loader } from "./loader";
import { DirectManager } from "./direct/direct-manager";
import { GroupManager } from "./group/group-manager";
import { CacheServiceClient } from "@/app/_cache/cache-service-client";

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
    private apiClient: ApiClient;
    private chatList: any[] = [];
    private activeChat: any = null;
    private container!: HTMLElement;
    private userId!: string;

    private updateCallback: ((chatList: any[]) => void) | null = null;
    private setState: React.Component<any, State>['setState'];
    private updateQueue: Array<() => void> = [];
    private isUpdating = false;

    private loader: Loader;
    private cacheService: CacheServiceClient
    private directManager: DirectManager;
    private groupManager: GroupManager;

    constructor(
        cacheService: CacheServiceClient,
        socketClient: SocketClientConnect,
        messageManager: MessageManager,
        apiClient: ApiClient,
        dashboard: Dashboard | null,
        appEl: HTMLDivElement | null = null,
        username: string,
        setState: React.Component<any, State>['setState']
    ) {
        this.cacheService = cacheService;
        this.apiClient = apiClient;
        this.loader = new Loader(
            socketClient, 
            apiClient, 
            this
        );
        this.directManager = new DirectManager(
            socketClient,
            messageManager,
            apiClient
        );
        this.groupManager = new GroupManager(
            this,
            socketClient, 
            messageManager, 
            apiClient,
            dashboard, 
            appEl, 
            username
        );
        this.setState = setState;
    }

    public async getUserData(sessionId: string, userId: string, username: string): Promise<void> {
        this.userId = userId;
        await this.directManager.getUserData(sessionId, userId);
        await this.groupManager.getUserData(sessionId, userId, username);
    }

    public mount(): void {
       // window.addEventListener('chat-should-be-created', this.handleChatItemAdded as EventListener);
        window.addEventListener('chat-item-added', this.handleChatItemAdded as EventListener);
        window.addEventListener('chat-activated', this.handleChatActivated as EventListener);
        window.addEventListener('last-message-updated', this.handleLastMessage as EventListener);
    }

    public unmount(): void {
        //window.removeEventListener('chat-should-be-created', this.handleChatItemAdded as EventListener);
        window.removeEventListener('chat-item-added', this.handleChatItemAdded as EventListener);
        window.removeEventListener('chat-activated', this.handleChatActivated as EventListener);
        window.removeEventListener('last-message-updated', this.handleLastMessage as EventListener);
    }

    private queueUpdate(updateFn: () => void): void {
        this.updateQueue.push(updateFn);
        this.processQueue();
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

    private handleChatItemAdded = (event: CustomEvent): void => {
        const newChat: Item = event.detail;
        this.queueUpdate(() => {
            this.setState(prevState => {
                const chatExists = prevState.chatList.some(chat =>
                    chat.id === newChat.id ||
                    chat.chatId === newChat.id ||
                    chat.groupId === newChat.id ||
                    (chat.chatId && chat.chatId === newChat.id) ||
                    (chat.groupId && chat.groupId === newChat.groupId)
                );
                if(chatExists) {
                    console.log('Chat already exists!', newChat.id);
                    return prevState;
                }
                console.log('Adding new chat:', newChat.id, newChat.name);
                return {
                    ...prevState,
                    chatList: [...prevState.chatList, newChat]
                }
            });
        });
    }

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

    public setUpdateCallback(callback: (list: any[]) => void): void {
        this.updateCallback = callback;
    }

    /*
    ** Update Last Message
    */
    private handleLastMessage = (event: CustomEvent): void => {
        const { messageId, chatId, userId, lastMessage, sender, timestamp, isCurrentUser } = event.detail;
        const systemMessage = this.isSystemMessage(event.detail);
        const formattedMessage = this.formattedMessage(chatId, lastMessage, isCurrentUser, sender, systemMessage);

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

    /*
    ** Formatted Message
    */
    private formattedMessage(
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

    private formattedLastMessage(message: string): string {
        if(message.length > 15) return message.substring(0, 15) + '...';
        return message;
    }

    /*
    ** Last Message
    */
    public async lastMessage(id: string): Promise<string> {
        try {
            const service = await this.apiClient.getMessageService();
            const res = await service.getMessagesByChatId(id, 0);
            const messages = res.messages || [];
            if(messages && messages.length > 0) {
                const sortedMessages = messages.sort((a, b) => {
                    return parseInt(b.id) - parseInt(a.id);
                });
                return sortedMessages[0].content;
            }
        } catch(err) {
            console.error('Failed to get recent messages', err);
        }

        return '';
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

    /*
    ** System Message
    */
    private isSystemMessage(message: any): boolean {
        if(message.isSystem === true) return true;
        if(message.messageId.includes('sys_')) return true;
        if(message.type === 'SYSTEM') return true;
        return false;
    }

    /*
    ** Get Loader
    */
    public getLoader(): Loader {
        return this.loader;
    }

    /*
    ** Get Direct Manager
    */
    public getDirectManager(): DirectManager {
        return this.directManager;
    }

    /*
    ** Get Group Manager
    */
    public getGroupManager(): GroupManager {
        return this.groupManager;
    }
}