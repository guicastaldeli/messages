import React from "react";

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

export class ChatManager {
    private setState: React.Component<any, State>['setState']; 

    constructor(setState: React.Component<any, State>['setState']) {
        this.setState = setState;
    }

    public mount(): void {
        window.addEventListener('chat-item-added', this.handleChatItemAdded as EventListener);
        window.addEventListener('chat-activated', this.handleChatActivated as EventListener);
    }

    public unmount(): void {
        window.removeEventListener('chat-item-added', this.handleChatItemAdded as EventListener);
        window.removeEventListener('chat-activated', this.handleChatActivated as EventListener);
    }

    private handleChatItemAdded = (event: CustomEvent): void => {
        const newChat: Item = event.detail;
        this.setState(prevState => ({
            chatList: [...prevState.chatList, newChat]
        }));
    }

    private handleChatActivated = (event: CustomEvent): void => {
        const activeChat: ActiveChat = event.detail;
        this.setState({ activeChat });
    }
}