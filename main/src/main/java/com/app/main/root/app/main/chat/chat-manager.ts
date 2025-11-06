import React from "react";
import { chatState } from "../chat-state-service";
import { SocketClientConnect } from "../socket-client-connect";
import { MessageManager } from "../_messages_config/message-manager";
import { ApiClient } from "../_api-client/api-client";
import { Dashboard } from "../dashboard";
import { Loader } from "./loader";
import { DirectManager } from "./direct/direct-manager";
import { GroupManager } from "./group/group-manager";

export interface Item {
    id: string;
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
    private apiClient!: ApiClient;
    private chatList: any[] = [];
    private activeChat: any = null;
    private container!: HTMLElement;

    private updateCallback: ((chatList: any[]) => void) | null = null;
    private setState: React.Component<any, State>['setState'];
    private updateQueue: Array<() => void> = [];
    private isUpdating = false;

    private loader: Loader;
    private directManager: DirectManager;
    private groupManager: GroupManager;

    constructor(
        socketClient: SocketClientConnect,
        messageManager: MessageManager,
        apiClient: ApiClient,
        dashboard: Dashboard | null,
        appEl: HTMLDivElement | null = null,
        username: string,
        setState: React.Component<any, State>['setState']
    ) {
        this.loader = new Loader(
            socketClient, 
            apiClient, 
            messageManager
        );
        this.directManager = new DirectManager(
            this,
            socketClient,
            messageManager,
            apiClient,
            messageManager.chatRegistry
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
        await this.loader.getUserData(sessionId, userId, username);
        await this.directManager.getUserData(sessionId, userId);

    }

    public mount(): void {
        window.addEventListener('chat-item-added', this.handleChatItemAdded as EventListener);
        window.addEventListener('chat-activated', this.handleChatActivated as EventListener);
        window.addEventListener('last-message-updated', this.handleLastMessage as EventListener);
    }

    public unmount(): void {
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
                const chatExists = prevState.chatList.some(chat => chat.id === newChat.id);
                if(chatExists) return prevState;
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

        if(lastMessage && lastMessage.trim() !== '') {
            this.ensureChatExists(
                chatId,
                sender,
                timestamp,
                userId
            );
        }
        this.updateLastMessage({
            id: chatId,
            userId: userId,
            messageId: messageId,
            lastMessage: formattedMessage,
            sender: sender,
            timestamp: timestamp
        });
    }

    public updateLastMessage(detail: {
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
                const chatType = id.startsWith('direct_') ? 'DIRECT' : 'GROUP';
                const chatName = chatType === 'DIRECT' ? sender : id;

                const item: Item = {
                    id: id,
                    name: chatName,
                    type: chatType,
                    lastMessage: this.formattedLastMessage(lastMessage),
                    timestamp: now
                }
                return {
                    ...prevState,
                    chatList: [item, ...prevState.chatList]
                }
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
        userId: string
    ): void {
        this.setState((prevState: State) => {
            const chatExists = prevState.chatList.some(chat => chat.id === chatId);
            if(chatExists) return prevState;

            const chatType = chatId.startsWith('direct') ? 'DIRECT' : 'GROUP';
            const chatName = chatType === 'DIRECT' ? sender : chatId;
            const item: Item = {
                id: chatId,
                name: chatName,
                type: chatType,
                timestamp: new Date(timestamp)
            }
            window.dispatchEvent(new CustomEvent('chat-item-added', {
                detail: item
            }));
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
        this.loader.updateLastMessage(
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