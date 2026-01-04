import React from "react";
import { SocketClientConnect } from "../../../socket-client-connect";
import { ChatController } from "../../chat-controller";
import { chatState } from "../../chat-state-service";
import { DirectLayout } from "./direct-layout";
import { createRoot, Root } from "react-dom/client";
import { ChatStateManager } from "../../chat-state-manager";
import { ChatService } from "../../chat-service";

export class DirectManager {
    private socketClient: SocketClientConnect;
    private chatController: ChatController;
    private chatService: ChatService;
    private chatStateManager = ChatStateManager.getIntance();

    public currentChatId: string = '';
    public currentParticipant: { id: string; username: string } | null = null;

    private socketId: string | null = null;
    public userId!: string;

    public root: Root | null = null;
    public container!: HTMLElement;

    constructor(
        socketClient: SocketClientConnect,
        chatController: ChatController,
        chatService: ChatService
    ) {
        this.socketClient = socketClient;
        this.chatController = chatController;
        this.chatService = chatService;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        window.addEventListener('contact-clicked', ((e: CustomEvent) => {
            this.openChat(e.detail.contactId, e.detail.username);
        }) as EventListener);
    }

    public setCurrentChat(chatId: string): void {
        if(!this.container || !(this.container instanceof HTMLElement)) return;
        this.currentChatId = chatId;
        console.log('Direct chat activated:', chatId);
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
        await this.chatController.setCurrentChat(
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
            chatController: this.chatController,
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
            const res = await this.chatService.getChatData(this.userId, id);
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