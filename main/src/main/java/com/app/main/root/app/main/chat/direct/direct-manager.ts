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
    private username!: string;

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
    public async getUserData(sessionId: string, userId: string, username: string): Promise<void> {
        this.socketId = sessionId;
        this.userId = userId;
        this.username = username;
    }

    /*
    ** Open Chat
    */
    public async openChat(contactId: string, contactUsername: string): Promise<void> {
        const chatId = this.chatRegistry.generateChatId('DIRECT', [this.userId, contactId]);
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
                type: 'DIRECT'
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
}