import { React, ReactDOMServer } from "next/dist/server/route-modules/app-page/vendored/ssr/entrypoints";
import { SocketClientConnect } from "../socket-client-connect";
import { ContentGetter } from "../../content-getter";
import { MessageTypes } from "./message-types";
import { Controller } from "../controller";

export class MessageManager {
    private contentGetter: ContentGetter;
    public socketClient: SocketClientConnect;
    private messageTypes: MessageTypes;
    public controller!: Controller;
    public dashboard: any;

    private uname: any;
    private appEl: HTMLDivElement | null = null;
    private socketId: string | null = null;
    private currentUserId: string | null = null;

    private joinHandled: boolean = false;
    private chatHandled: boolean = false;

    constructor(socketClient: SocketClientConnect) {
        this.contentGetter = new ContentGetter();
        this.socketClient = socketClient;
        this.messageTypes = new MessageTypes(this.contentGetter);
    }

    private initController(): void {
        this.controller = new Controller(
            this.socketClient,
            this,
            this.dashboard,
            this.appEl,
            this.uname
        );
    }

    public async init(): Promise<void> {
        if(typeof document === 'undefined') return;
        this.appEl = document.querySelector<HTMLDivElement>('.app');

        this.socketClient.on('connect', (id: string) => {
            this.socketId = id;
            this.currentUserId = id;
        });

        await this.socketClient.connect();
        await this.updateSocket();
    }

    public handleJoin(): Promise<'dashboard'> {
        return new Promise(async (res, rej) => {
            if(!this.appEl || this.joinHandled) return rej('err');
            
            const usernameInput = this.appEl.querySelector<HTMLInputElement>('.join-screen #username');
            if(!usernameInput || !usernameInput.value.trim()) return rej(new Error('Username is required'));
            this.joinHandled = true;

            try {
                const ok = await this.socketClient.emit('new-user', usernameInput.value);
                if(!ok) {
                    this.joinHandled = false;
                    return rej(new Error('Event err'));
                }
                this.socketClient.on('new-user', () => {
                    console.log('%cNew User::::!!', "font-weight: bold; color: blue;")
                })
                this.uname = usernameInput.value;
                this.initController();
                this.controller.init();
                res('dashboard');
            } catch(err) {
                this.joinHandled = false;
                rej(err);
            }
        });
    }

    public handleSendMessage(chatId?: string): void {
        if(!this.appEl || this.chatHandled) return;
        this.chatHandled = true;

        const sendBtn = this.appEl.querySelector<HTMLButtonElement>('.chat-screen #send-message');
        if(!sendBtn) throw new Error('send button err');

        sendBtn.addEventListener('click', () => {
            let messageInputEl = this.appEl!.querySelector<HTMLInputElement>('.chat-screen #message-input');
            let messageInput = messageInputEl!.value;
            if(!messageInputEl || !messageInput.length) return;
 
            this.socketClient.send('chat', {
                senderId: this.socketClient.getSocketId(),
                username: this.uname,
                content: messageInput,
                chatId: chatId || this.socketId
            });
            messageInputEl.value = '';
        });
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

    private async updateSocket(): Promise<void> {        
        //Update
        this.socketClient.on('update', (update: any) => {
            this.renderMessage('update', update);
        })

        //Chat
        this.socketClient.on('chat', (message: any) => {
            const type = message.senderId === this.currentUserId ? 'self' : 'other';
            this.renderMessage(type, {
                username: message.username,
                content: message.content
            });
        })

        //Group
            this.socketClient.on('group-creation-scss', (data: any) => {
                console.log('Group created', data);
            })

            this.socketClient.on('group-creation-err', (data: any) => {
                console.log('Group created', data);
            })

            this.socketClient.on('group-update', (update: any) => {
                this.renderMessage('update', update);
            });

            this.socketClient.on('user-joined', (data: any) => {
                this.renderMessage('update', `${data.username} joined`);
            });

            this.socketClient.on('user-left', (data: any) => {
                this.renderMessage('update', `${data.username} left`);
            });
        //
    }
}