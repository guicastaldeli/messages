import { ReactDOMServer } from "next/dist/server/route-modules/app-page/vendored/ssr/entrypoints";
import { SocketClient } from "../.server/socket-client";
import { ContentGetter } from "../content-getter";
import { MessageTypes } from "./message-types";

export class MessageManager {
    private contentGetter: ContentGetter;
    private socket: SocketClient;
    private messageTypes: MessageTypes;

    private uname: any;
    private appEl: HTMLDivElement | null = null;
    private socketId: string | null = null;

    private joinHandled: boolean = false;
    private chatHandled: boolean = false;

    constructor(socket: SocketClient) {
        this.contentGetter = new ContentGetter();
        this.socket = socket;
        this.messageTypes = new MessageTypes(this.contentGetter);
    }

    public init(): void {
        if(typeof document === 'undefined') return;
        this.appEl = document.querySelector<HTMLDivElement>('.app');
        this.updateSocket();

        this.socket.on('connect', (id: string) => {
            this.socketId = id;
        });
    }

    public handleJoin(): void {
        if(!this.appEl || this.joinHandled) return;
        this.joinHandled = true;

        const joinBtn = this.appEl.querySelector<HTMLButtonElement>('.join-screen #join-user');
        if(!joinBtn) throw new Error('join button err');

        joinBtn.addEventListener('click', () => {
            const usernameInput = this.appEl!.querySelector<HTMLInputElement>('.join-screen #username')!.value;
            if(!usernameInput.length) return;

            this.socket.emitNewUser(usernameInput);
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

            this.renderMessage('self', {
                username: this.uname,
                content: messageInput
            });   
            this.socket.emitNewMessage(messageInput);
            messageInputEl.value = '';
        });
    }

    public exitChat(): void {
        this.socket.emitExitUser(this.uname);
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

        const render = ReactDOMServer.renderToStaticMarkup(content);
        messageContainer.insertAdjacentHTML('beforeend', render);
    }

    private updateSocket(): void {
        this.socket.on('update', (update: any) => {
            this.renderMessage('update', update);
        });
        
        this.socket.on('chat', (message: any) => {
            if(message.senderId !== this.socketId) {
                this.renderMessage('other', {
                    username: message.username,
                    content: message.content
                });
            }
        });
    }
}