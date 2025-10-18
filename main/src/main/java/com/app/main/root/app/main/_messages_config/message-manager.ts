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
        await this.update();
    }

    public handleJoin(): Promise<'dashboard'> {
        return new Promise(async (res, rej) => {
            if(!this.appEl || this.joinHandled) return rej('err');
            
            const usernameInput = this.appEl.querySelector<HTMLInputElement>('.join-screen #username');
            if(!usernameInput || !usernameInput.value.trim()) return rej(new Error('Username is required'));
            this.joinHandled = true;

            const data = {
                userId: await this.socketClient.getSocketId(),
                username: usernameInput.value.trim(),
                sessionId: await this.socketClient.getSocketId()
            }

            try {
                const sucss = await this.socketClient.sendToDestination(
                    '/app/new-user',
                    data,
                    '/topic/user'
                );
                if(!sucss) {
                    this.joinHandled = false;
                    return rej(new Error('Failed to send join request!'));
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

        const senderId = await this.socketClient.getSocketId();
        const sendBtn = this.appEl.querySelector<HTMLButtonElement>('.chat-screen #send-message');
        let msgInputEl = this.appEl!.querySelector<HTMLInputElement>('.chat-screen #message-input');
        if(!sendBtn || !msgInputEl) return;
        
        sendBtn.addEventListener('click', async () => {
            const msgInput = msgInputEl.value.trim();
            if(!msgInput.length) return; 
 
            try {
                await this.sendMessage({
                    senderId: senderId,
                    username: this.uname,
                    content: msgInput,
                    chatId: chatId || senderId
                });
                msgInputEl.value = '';
                msgInputEl.focus();
            } catch(err) {
                console.error(err);
            }
        });
    }

    /*
    ** Send Message Method
    */
    private async sendMessage(data: any): Promise<void> {
        return new Promise(async (res, rej) => {
            const sucssDestination = '/queue/message-sent';
            const errDestination = '/queue/message-err';

            /* Success */
            const handleSucss = (response: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);

                this.renderMessage('self', {
                    username: data.username,
                    content: data.content,
                    messageId: response.messageId,
                    timestamp: response.timestamp
                });

                res();
            }

            /* Error */
            const handleErr = (err: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(new Error(err.error || err.mesage || 'Failed to send message'));
            }

            try {
                await this.socketClient.onDestination(sucssDestination, handleSucss);
                await this.socketClient.onDestination(errDestination, handleErr);

                const sucss = await this.socketClient.sendToDestination(
                    '/app/chat',
                    data
                );

                if(!sucss) {
                    this.socketClient.offDestination(sucssDestination, handleSucss);
                    this.socketClient.offDestination(errDestination, handleErr);
                    rej(new Error('Failed to send message request!'));
                }
            } catch(err) {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(err);
            }
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
        const destination = '/queue/new-messages';

        const handleIncomingMessage = async (msg: any) => {
            if(!this.currentUserId) this.currentUserId = await this.socketClient.getSocketId();

            const type = msg.senderId === this.currentUserId ? 'self' : 'other';
            this.renderMessage(type, {
                username: msg.username,
                content: msg.content,
                messageId: msg.messageId,
                timestamp: msg.timestamp
            });
        }

        await this.socketClient.onDestination(destination, handleIncomingMessage, {
            autoSubscribe: true,
            eventName: 'new-message'
        });
    }

    public async messageEventHandler(): Promise<void> {
        if(this.msgHandlerCallback) {
            this.socketClient.off('new-message', this.msgHandlerCallback);
            this.msgHandlerCallback = null;
        }
        await this.update();
    }
}