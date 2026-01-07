import { Root } from "react-dom/client";
import { SocketClientConnect } from "../../../socket-client-connect";
import { ChatController } from "../../chat-controller";
import { chatState } from "../../chat-state-service";
import { ChatStateManager } from "../../chat-state-manager";
import { ChatService } from "../../chat-service";
import { ChatManager } from "../../chat-manager";

export class DirectManager {
    private socketClient: SocketClientConnect;
    public chatController: ChatController;
    private chatService: ChatService;
    private chatManager: ChatManager;
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
        chatManager: ChatManager,
        chatService: ChatService,
        container?: HTMLElement
    ) {
        this.socketClient = socketClient;
        this.chatController = chatController;
        this.chatService = chatService;
        this.chatManager = chatManager;
        this.container = container!;
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

    public setContainer(container: HTMLElement): void {
        this.container = container;
        console.log('DirectManager: Container set', container);
    }

    /**
     * User Data
     */
    public async getUserData(sessionId: string, userId: string): Promise<void> {
        this.socketId = sessionId;
        this.userId = userId;
    }

    /**
     * Open Chat
     */
    public async openChat(contactId: string, contactUsername: string): Promise<void> {
        console.log('openChat called', { contactId, contactUsername });
        
        try {
            const chatId = await this.getChatId(contactId);
            console.log('Got chat ID:', chatId);
            
            this.currentParticipant = { id: contactId, username: contactUsername };
            this.currentChatId = chatId;

            const activeChatData = {
                id: chatId,
                name: contactUsername,
                type: 'DIRECT' as const,
                contactId: contactId,
                contactUsername: contactUsername
            };

            localStorage.setItem('active-chat', JSON.stringify(activeChatData));
            chatState.setType('DIRECT');
            const chatEvent = new CustomEvent('chat-activated', {
                detail: {
                    chat: activeChatData,
                    shouldRender: true
                }
            });
            window.dispatchEvent(chatEvent);
            await new Promise(resolve => setTimeout(resolve, 100));

            await this.chatController.setCurrentChat(
                chatId,
                'DIRECT',
                [this.userId, contactId]
            );

            const directEvent = new CustomEvent('direct-activated', {
                detail: {
                    chatId: chatId,
                    participant: this.currentParticipant,
                    userInitiated: true
                }
            });
            window.dispatchEvent(directEvent);
            
            console.log('Chat opened successfully');
        } catch(error) {
            console.error('Failed to open chat:', error);
        }
    }

    /**
     * Last Message
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

    /**
     * Chat Id
     */
    private async getChatId(contactId: string): Promise<string> {        
        return new Promise(async (res, rej) => {
            const resDestination = '/queue/direct-chat-id-scss';

            let hasResolved = false;

            const handle = (data: any) => {
                console.log('Received chatId response', data);
                if(hasResolved) return;
                hasResolved = true;
                this.socketClient.offDestination(resDestination, handle);
                
                if(data && data.chatId) {
                    console.log('Got chatId:', data.chatId);
                    res(data.chatId);
                } else {
                    rej(new Error('Invalid chat id response'));
                }
            };
            try {
                await this.socketClient.onDestination(resDestination, handle);
                const success = await this.socketClient.sendToDestination('/app/get-direct-chat-id', {
                    contactId: contactId
                });
                
                if(!success) {
                    if(hasResolved) return;
                    hasResolved = true;
                    this.socketClient.offDestination(resDestination, handle);
                    rej(new Error('Failed to send chat id request'));
                }
            } catch(err) {
                if(hasResolved) return;
                hasResolved = true;
                this.socketClient.offDestination(resDestination, handle);
                rej(err);
            }
        });
    }

    /**
     * Create Item
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