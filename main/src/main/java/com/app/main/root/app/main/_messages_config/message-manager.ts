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

    private msgHandlerCallback: ((msg: any) => void) | null = null;

    constructor(socketClient: SocketClientConnect) {
        this.contentGetter = new ContentGetter();
        this.socketClient = socketClient;
        this.messageTypes = new MessageTypes(this.contentGetter);
        this.update();
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

    public async handleSendMessage(chatId?: string): Promise<void> {
        if(!this.appEl || this.chatHandled) return;
        this.chatHandled = true;

        const sendBtn = this.appEl.querySelector<HTMLButtonElement>('.chat-screen #send-message');
        let msgInputEl = this.appEl!.querySelector<HTMLInputElement>('.chat-screen #message-input');
        if(!sendBtn || !msgInputEl) return;
        
        sendBtn.addEventListener('click', async () => {
            const msgInput = msgInputEl.value.trim();
            if(!msgInput.length) return; 
 
            this.socketClient.send('chat', {
                senderId: this.socketClient.getSocketId(),
                username: this.uname,
                content: msgInput,
                chatId: chatId || this.socketId
            });
            await this.messageEventHandler();
            msgInputEl.value = '';
            msgInputEl.focus();
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

    /*
    ** Update
    */
    public async update(): Promise<void> {
        this.socketClient.on('update', (update: any) => {
            this.renderMessage('update', update);
        });
    }

    public async messageEventHandler(): Promise<void> {
        if(this.msgHandlerCallback) {
            this.socketClient.off('new-message', this.msgHandlerCallback);
        }

        /* Change Id Later....!!! */
        this.msgHandlerCallback = async (message: any) => {
            if(!this.currentUserId || message.senderId) {
                this.currentUserId = await this.socketClient.getSocketId();
                message.senderId = this.currentUserId;
            }
            
            const type = message.senderId === this.currentUserId ? 'self' : 'other';
            this.renderMessage(type, {
                username: message.username,
                content: message.content
            });
        }

        this.socketClient.on('new-message', this.msgHandlerCallback);
    }
}