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
        window.addEventListener('chat-message-received', this.handleNewMessage as EventListener);
    }

    public unmount(): void {
        window.removeEventListener('chat-item-added', this.handleChatItemAdded as EventListener);
        window.removeEventListener('chat-activated', this.handleChatActivated as EventListener);
        window.removeEventListener('chat-message-received', this.handleNewMessage as EventListener);
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

    private handleNewMessage = (event: CustomEvent): void => {
        const { chatId, message } = event.detail;

        const messageText = 
        typeof message === 'object' ?
        message.context || JSON.stringify(message) :
        message;

        this.setState(prevState => ({
            chatList: prevState.chatList.map(chat =>
                chat.id === chatId ?
                { 
                    ...chat,
                    lastMessage: messageText,
                    timestamp: new Date()
                } :
                chat
            )
        }));
    }
}