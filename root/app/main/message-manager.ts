import { React, ReactDOMServer } from "next/dist/server/route-modules/app-page/vendored/ssr/entrypoints";
import { SocketClient } from "../.server/socket-client";
import { SocketEmitter } from "../.server/socket-emitter";
import { ContentGetter } from "../content-getter";
import { MessageTypes } from "./message-types";
import { configSocketClientEvents } from '../.data/socket-client-events';

export class MessageManager {
    private contentGetter: ContentGetter;
    private socketClient: SocketClient;
    private messageTypes: MessageTypes;

    private uname: any;
    private appEl: HTMLDivElement | null = null;
    private socketId: string | null = null;
    private currentUserId: string | null = null;

    private joinHandled: boolean = false;
    private chatHandled: boolean = false;

    constructor(socketClient: SocketClient) {
        this.contentGetter = new ContentGetter();
        this.socketClient = socketClient;
        this.messageTypes = new MessageTypes(this.contentGetter);
    }

    public async init(): Promise<void> {
        if(typeof document === 'undefined') return;
        this.appEl = document.querySelector<HTMLDivElement>('.app');
        
        this.socketClient.on('connect', (id: string) => {
            this.socketId = id;
            this.currentUserId = id;
        });
        await this.socketClient.connect();
        this.updateSocket();
    }

    public handleJoin(): void {
        if(!this.appEl || this.joinHandled) return;
        this.joinHandled = true;

        const joinBtn = this.appEl.querySelector<HTMLButtonElement>('.join-screen #join-user');
        if(!joinBtn) throw new Error('join button err');

        joinBtn.addEventListener('click', () => {
            const usernameInput = this.appEl!.querySelector<HTMLInputElement>('.join-screen #username')!.value;
            if(!usernameInput.length) return;

            this.socketClient.socketEmitter.emit('new-user', usernameInput);
            this.uname = usernameInput;

            //Join Screen
            const joinScreen = this.appEl!.querySelector('.join-screen');
            if(!joinScreen) throw new Error('join screen err');
            joinScreen.classList.remove('active');

            //Chat Screen
            const chatScreen = this.appEl!.querySelector('.chat-screen');
            if(!chatScreen) throw new Error('chat screen err');
            chatScreen.classList.add('active');
        });
    }

    public handleChatMessage(): void {
        if(!this.appEl || this.chatHandled) return;
        this.chatHandled = true;

        const sendBtn = this.appEl.querySelector<HTMLButtonElement>('.chat-screen #send-message');
        if(!sendBtn) throw new Error('send button err');

        sendBtn.addEventListener('click', () => {
            let messageInputEl = this.appEl!.querySelector<HTMLInputElement>('.chat-screen #message-input');
            let messageInput = messageInputEl!.value;
            if(!messageInputEl || !messageInput.length) return;
 
            this.socketClient.socketEmitter.emit('chat', {
                senderId: this.socketClient.getSocketId(),
                username: this.uname,
                content: messageInput,
            });
            messageInputEl.value = '';
        });
    }

    public exitChat(): void {
        this.socketClient.socketEmitter.emit('exit-chat', this.uname);
        window.location.href = window.location.href;
    }

    private renderMessage(type: any, data: any) {
        if(!this.appEl) return;

        let messageContainer = this.appEl.querySelector<HTMLDivElement>('.chat-screen .messages');
        if(!messageContainer) throw new Error('message container err');

        const content = this.contentGetter.__messageContent(
            this.messageTypes.content, 
            type, 
            data
        );

        if(React.isValidElement(content)) {
            const render = ReactDOMServer.renderToStaticMarkup(content);
            messageContainer.insertAdjacentHTML('beforeend', render);
        }
    }

    private updateSocket(): void {
        if(this.socketClient && this.socketClient.socket) {
            console.log('tst')
            configSocketClientEvents(this.socketClient, this.socketClient.socket);
        }
        
        //Update
        this.socketClient.socketEmitter.registerEventHandler({
            eventName: 'update',
            handler: (update: any) => {
                this.renderMessage('update', update);
            },
            autoRegister: true
        });

        //Chat
        this.socketClient.socketEmitter.registerEventHandler({
            eventName: 'chat',
            handler: (message: any) => {
                const type = message.content.senderId === this.socketId;
                this.renderMessage(type ? 'self' : 'other', {
                    username: message.content.username,
                    content: message.content.content
                });
            },
            autoRegister: true
        });
    }
}