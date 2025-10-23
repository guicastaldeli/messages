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

interface LastMessageUpdatedEvent extends CustomEvent {
    detail: {
        id: string;
        lastMessage: string;
        sender: string;
        timestamp: string;
    }
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
        window.addEventListener('message-tracked', this.handleMessageTracked as EventListener);
        window.addEventListener('last-message-updated', this.handleLastMessageUpdated as EventListener);
    }

    public unmount(): void {
        window.removeEventListener('chat-item-added', this.handleChatItemAdded as EventListener);
        window.removeEventListener('chat-activated', this.handleChatActivated as EventListener);
        window.removeEventListener('message-tracked', this.handleMessageTracked as EventListener);
        window.removeEventListener('last-message-updated', this.handleLastMessageUpdated as EventListener);
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

    private handleLastMessageUpdated = (event: Event): void => {
        const customEvent = event as LastMessageUpdatedEvent;
        this.updateLastMessage(customEvent.detail);
    }

    public updateLastMessage(detail: {
        id: string;
        lastMessage: string;
        sender: string;
        timestamp: string;
    }): void {
        const { lastMessage, sender, timestamp } = detail;
        
        this.setState((prevState: State) => {
            const chatIndex = prevState.chatList.findIndex(chat => chat.lastMessage);
            if(chatIndex === -1) return prevState;

            const updatedChatList = [...prevState.chatList];
            const originalChat = updatedChatList[chatIndex];

            const updatedChat = {
                ...originalChat,
                lastMessage: `${sender}: ${lastMessage}`,
                lastMessageSender: sender,
                lastMessageTime: timestamp,
            }

            updatedChatList[chatIndex] = updatedChat;
            return { chatList: updatedChatList }
        });
    }

    public setUpdateCallback(callback: (list: any[]) => void): void {
        this.updateCallback = callback;
    }

    private handleMessageTracked = (event: CustomEvent): void => {
        const {
            type,
            data,
            username,
            timestamp
        } = event.detail;
        
        if(type === 'chat' || type === 'new-message') {
            this.updateMessageTracked(data, username, timestamp);
        }
    }

    private updateMessageTracked(
        data: any,
        sender: string,
        timestamp: Date
    ): void {
        const id = sender;
        const lastMessage = data?.content ?? data;

        this.updateLastMessage({
            id,
            lastMessage,
            sender: sender || data.username,
            timestamp: timestamp.toISOString()
        });
    }

    public setContainer(container: HTMLElement): void {
        this.container = container;
        const groupManager = this.getGroupManager();
        if(groupManager) groupManager.container = container;
    }

    public setDashboard(instance: Dashboard): void {
        const groupManager = this.getGroupManager();
        if(groupManager) groupManager.dashboard = instance;
    }

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
}