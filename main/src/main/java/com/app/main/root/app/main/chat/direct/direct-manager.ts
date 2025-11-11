import React from "react";
import { SocketClientConnect } from "../../socket-client-connect";
import { MessageManager } from "../../_messages_config/message-manager";
import { ApiClient } from "../../_api-client/api-client";
import { chatState } from "../../chat/chat-state-service";
import { DirectLayout } from "./direct-layout";
import { createRoot, Root } from "react-dom/client";
import { ChatStateManager } from "../chat-state-manager";

export class DirectManager {
    private socketClient: SocketClientConnect;
    private messageManager: MessageManager;
    private apiClient: ApiClient;
    private chatStateManager = ChatStateManager.getIntance();

    public currentChatId: string = '';
    public currentParticipant: { id: string; username: string } | null = null;

    private socketId: string | null = null;
    public userId!: string;

    public root: Root | null = null;
    public container!: HTMLElement;

    constructor(
        socketClient: SocketClientConnect,
        messageManager: MessageManager,
        apiClient: ApiClient
    ) {
        this.socketClient = socketClient;
        this.messageManager = messageManager;
        this.apiClient = apiClient;
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

        const openEvent = new CustomEvent('direct-chat-opened', {
            detail: { chatId, contactId, contactUsername }
        });
        window.dispatchEvent(openEvent);

        chatState.setType('DIRECT');
        await this.messageManager.setCurrentChat(
            chatId,
            'DIRECT',
            [this.userId, contactId]
        );

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
            const res = await service.getMessagesByChatId(id);
            const messages = res.messages || [];
            if(messages && messages.length > 0) {
                const lastMessage = messages[messages.length - 1]
                return lastMessage.content;
            }
        } catch(err) {
            console.error('Failed to get recent messages', err);
        }

        return '';
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

    /*
    ** Create Item
    */
    public createItem(chatId: string): void {
        const currentCount = this.chatStateManager.getMessageCount(chatId);
        if(currentCount === 0) {
            this.chatStateManager.incrementMessageCount(chatId);
        } else {
            this.chatStateManager.updateMessageCount(chatId, currentCount + 1);
        }
    }
}