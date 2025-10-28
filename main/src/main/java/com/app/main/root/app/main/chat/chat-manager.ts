import React from "react";
import { chatState } from "../chat-state-service";
import { SocketClientConnect } from "../socket-client-connect";
import { MessageManager } from "../_messages_config/message-manager";
import { ApiClient } from "../_api-client/api-client";
import { Dashboard } from "../dashboard";
import { DirectManager } from "./direct/direct-manager";
import { GroupManager } from "./group/group-manager";

export interface Item {
    id: string;
    name: string;
    type: 'DIRECT' | 'GROUP';
    lastMessage?: string;
    timestamp?: Date;
    unreadCount: number;
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

    private directManager: DirectManager;
    private groupManager: GroupManager;

    constructor(
        socketClient: SocketClientConnect,
        messageManager: MessageManager,
        apiClient: ApiClient,
        dashboard: Dashboard | null,
        appEl: HTMLDivElement | null = null, 
        uname: any,
        setState: React.Component<any, State>['setState']
    ) {
        this.directManager = new DirectManager();
        this.groupManager = new GroupManager(
            socketClient, 
            messageManager, 
            apiClient,
            dashboard, 
            appEl, 
            uname
        );
        this.setState = setState;
    }

    public async init(): Promise<void> {
        //await this.directManager.init();
        await this.groupManager.init();
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

    private handleChatItemAdded = (event: CustomEvent): void => {
        const newChat: Item = event.detail;
        this.setState(prevState => ({
            chatList: [...prevState.chatList, newChat]
        }));
    }

    private handleChatActivated = (event: CustomEvent): void => {
        const activeChat: ActiveChat = event.detail;
        chatState.setType(activeChat.type === 'DIRECT' ? 'DIRECT' : 'GROUP');
        this.setState({ activeChat });
    }

    public setUpdateCallback(callback: (list: any[]) => void): void {
        this.updateCallback = callback;
    }

    /*
    ** Update Last Message
    */
    private handleLastMessage = (event: CustomEvent): void => {
        const { messageId, chatId, lastMessage, sender, timestamp, isCurrentUser, isSystem } = event.detail;
        console.log(event.detail)
        const systemMessage = this.isSystemMessage(event.detail);

        let formattedMessage;
        if(systemMessage) {
            formattedMessage = lastMessage;
        } else {
            formattedMessage = isCurrentUser 
                ? `You: ${lastMessage}`
                : `${sender}: ${lastMessage}`;
        }

        this.updateLastMessage({
            id: chatId,
            messageId: messageId,
            lastMessage: formattedMessage,
            sender: sender,
            timestamp: timestamp
        });
    }

    public updateLastMessage(detail: {
        id: string;
        messageId: string;
        lastMessage: string;
        sender: string;
        timestamp: string;
    }): void {
        const { id, lastMessage, sender, timestamp, messageId } = detail;
        const now = new Date(timestamp);
        
        this.setState((prevState: State) => {
            const chatIndex = prevState.chatList.findIndex(chat => chat.id === id);
            if(chatIndex === -1) {
                console.warn(`Chat with id ${id} not found!`);
                return prevState;
            }

            const updatedChatList = [...prevState.chatList];
            const originalChat = updatedChatList[chatIndex];

            const updatedChat = {
                ...originalChat,
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

    public setLastMessage(
        id: string,
        messageId: string,
        content: string,
        sender: string,
        isSystem: boolean
    ): void {
        this.getGroupManager().updateLastMessage(
            id,
            messageId, 
            content, 
            sender,
            isSystem
        );
    }

    /* Set Container */
    public setContainer(container: HTMLElement): void {
        this.container = container;
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
        if(groupManager) groupManager.uname = username;
    }

    /*
    ** Direct Manager
    */
    public getDirectManager(): DirectManager {
        return this.directManager;
    }

    /*
    ** Group Manager
    */
    public getGroupManager(): GroupManager {
        return this.groupManager;
    }

    /*
    ** Formatted Last Message
    */
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
}