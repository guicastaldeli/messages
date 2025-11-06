import { SocketClientConnect } from "../../socket-client-connect";
import { MessageManager } from "../../_messages_config/message-manager";
import { ApiClient } from "../../_api-client/api-client";
import { ChatManager } from "../chat-manager";
import { ChatRegistry } from "../chat-registry";
import { chatState } from "../../chat-state-service";
import { DirectLayout } from "./direct-layout";
import React from "react";
import { createRoot, Root } from "react-dom/client";

interface ChatData {
    id: string;
    chatId: string;
    participantId: string;
    participantUsername: string;
    currentUserId: string;
    lastMessage?: string;
    lastMessageTime?: string;
}

export class DirectManager {
    private socketClient: SocketClientConnect;
    private messageManager: MessageManager;
    private apiClient: ApiClient;
    private chatManager: ChatManager;
    private chatRegistry: ChatRegistry;

    public currentChatId: string = '';
    public currentParticipant: { id: string; username: string } | null = null;

    private socketId: string | null = null;
    public userId!: string;

    public root: Root | null = null;
    public container!: HTMLElement;

    constructor(
        chatManager: ChatManager,
        socketClient: SocketClientConnect,
        messageManager: MessageManager,
        apiClient: ApiClient,
        chatRegistry: ChatRegistry
    ) {
        this.chatManager = chatManager;
        this.socketClient = socketClient;
        this.messageManager = messageManager;
        this.apiClient = apiClient;
        this.chatRegistry = chatRegistry;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        window.addEventListener('contact-clicked', ((e: CustomEvent) => {
            this.openChat(e.detail.contactId, e.detail.username);
        }) as EventListener);
    }

    /*
    ** User Data
    */
    public async getUserData(sessionId: string, userId: string): Promise<void> {
        this.socketId = sessionId;
        this.userId = userId;
    }

    /*
    ** Open Chat
    */
    public async openChat(contactId: string, contactUsername: string): Promise<void> {
        if(!this.container || !(this.container instanceof HTMLElement)) return;

        const chatId = await this.getChatId(contactId);
        this.currentParticipant = { id: contactId, username: contactUsername }
        this.currentChatId = chatId;

        chatState.setType('DIRECT');
        await this.messageManager.setCurrentChat(
            chatId,
            'DIRECT',
            [this.userId, contactId]
        );
        await this.loadMessagesHistory(chatId);

        const chatEvent = new CustomEvent('direct-activated', {
            detail: {
                chatId: chatId,
                participant: this.currentParticipant,
                userInitiated: true
            }
        });
        window.dispatchEvent(chatEvent);

        const content = React.createElement(DirectLayout, {
            messageManager: this.messageManager,
            directManager: this
        });
        
        if(!this.root) this.root = createRoot(this.container);
        this.root.render(content);
    }

    /*
    ** Last Message
    */
    public async lastMessage(id: string): Promise<string> {
        try {
            const service = await this.apiClient.getMessageService();
            const messages = await service.getMessagesByChatId(id);
            if(messages && messages.length > 0) {
                const lastMessage = messages[messages.length - 1];
                return lastMessage.content;
            }
        } catch(err) {
            console.error('Failed to get recent messages', err);
        }

        return '';
    }

    /*
    ** Load History
    */
    public async loadMessagesHistory(chatId: string): Promise<void> {
        try {
            const service = await this.apiClient.getMessageService();
            const messages = await service.getMessagesByChatId(chatId);

            if(messages && Array.isArray(messages)) {
                for(const message of messages) {
                    await this.messageManager.renderHistory(message);
                }
            }
        } catch(err) {
            console.error(err);
        }
    }

    /*
    ** Chat Id
    */
    private async getChatId(contactId: string): Promise<string> {        
        return new Promise(async (res, rej) => {
            const resDestination = '/queue/direct-chat-id-scss';

            const handle = (data: any) => {
                if(data && data.chatId) {
                    this.socketClient.offDestination(resDestination, handle);
                    res(data.chatId);
                } else {
                    this.socketClient.offDestination(resDestination, handle);
                    rej(new Error('Invalid chat id response'));
                }
            }

            await this.socketClient.onDestination(resDestination, handle);
            this.socketClient.sendToDestination('/app/get-direct-chat-id', {
                contactId: contactId
            }).then(sucss => {
                if(!sucss) {
                    this.socketClient.offDestination(resDestination, handle);
                    rej(new Error('Failed to send chat id request'));
                }
            }).catch(err => {
                this.socketClient.offDestination(resDestination, handle);
                rej(err);
            });
        });
    }
}