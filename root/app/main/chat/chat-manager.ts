import React from "react";
import { chatState } from "../chat-state-service";

export interface Item {
    id: string;
    name: string;
    type: 'direct' | 'group';
    lastMessage?: string;
    timestamp?: Date;
    unreadCount: number;
}

export interface ActiveChat {
    id: string;
    name: string;
    type: 'direct' | 'group';
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
    private chatList: any[] = [];
    private activeChat: any = null;
    private updateCallback: ((chatList: any[]) => void) | null = null;
    private setState: React.Component<any, State>['setState']; 

    constructor(setState: React.Component<any, State>['setState']) {
        this.setState = setState;
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
        chatState.setType(activeChat.type === 'direct' ? 'direct' : 'group');
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

    public async loadChatHistory(chatId: string): Promise<any[]> {
        try {
            const res = await fetch(`../../.api//messages-routes?chatId=${chatId}`);
            return res.ok ? await res.json() : [];
        } catch(err) {
            console.error(err);
            return [];
        }
    }

    public async loadRecentMessages(chatId: string): Promise<any[]> {
        try {
            const res = await fetch(`../../.api//messages-routes?chatId=${chatId}`);
            return res.ok ? await res.json() : [];
        } catch(err) {
            console.error('Error loading recent messages:', err);
            return [];
        }
    }

    public async getChatList(userId: string): Promise<any[]> {
        try {
            const res = await fetch(`../../.api//recent-chats?userId=${userId}`);
            return res.ok ? await res.json() : [];
        } catch(err) {
            console.error('Error loading chat list', err);
            return [];
        }
    }
}