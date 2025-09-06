import { React, ReactDOMServer } from "next/dist/server/route-modules/app-page/vendored/ssr/entrypoints";
import { SocketClient } from "../.server/socket-client";
import { ContentGetter } from "../content-getter";
import { MessageTypes } from "./message-types";
import { configSocketClientEvents } from '../.data/socket-client-events';
import { GroupManager } from "./chat/group/group-manager";

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

    public groupManager!: GroupManager;

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

    public handleJoin(): Promise<void> {
        return new Promise((res, rej) => {
            if(!this.appEl || this.joinHandled) return rej('err');
    
            const usernameInput = this.appEl.querySelector<HTMLInputElement>('.join-screen #username');
            if(!usernameInput || !usernameInput.value.trim()) return rej(new Error('Username is required'));
            this.joinHandled = true;

            try {
                this.socketClient.socketEmitter.emit('new-user', usernameInput.value);
                this.uname = usernameInput.value;
                this.groupManager = new GroupManager(
                    this.socketClient,
                    this,
                    this.appEl,
                    this.uname
                );

                //Join Screen
                const joinScreen = this.appEl!.querySelector('.join-screen');
                if(!joinScreen) throw new Error('join screen err');
                joinScreen.classList.remove('active');
    
                //Dashboard
                const dashboard = this.appEl!.querySelector('.main-dashboard');
                if(!dashboard) throw new Error('dashboard');
                dashboard.classList.add('active');

                res();
            } catch(err) {
                this.joinHandled = false;
                rej(err);
            }
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

        //Group
            this.socketClient.socketEmitter.registerEventHandler({
                eventName: 'group-creation-scss',
                handler: (data: any) => {
                    console.log('Group created', data);
                    alert(`Group '${data.name}' created! :)`);
                },
                autoRegister: true
            });

            this.socketClient.socketEmitter.registerEventHandler({
                eventName: 'group-creation-err',
                handler: (err: any) => {
                    console.error('Group creation failed', err);
                    alert(`Failed to create group: ${err.message}`);
                },
                autoRegister: true
            });

            this.socketClient.socketEmitter.registerEventHandler({
                eventName: 'group-update',
                handler: (update: any) => {
                    this.renderMessage('update', update);
                },
                autoRegister: true
            });
        //
    }
}