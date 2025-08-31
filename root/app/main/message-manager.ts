import { SocketClient } from "../.server/socket-client";
import { ContentGetter } from "../content-getter";

export class MessageManager {
    private contentGetter: ContentGetter;
    private socket: SocketClient;
    private uname: any;
    private appEl: HTMLDivElement | null = null;

    constructor(socket: SocketClient) {
        this.contentGetter = new ContentGetter();
        this.socket = socket;
    }

    public init(): void {
        if(typeof document === 'undefined') return;
        this.appEl = document.querySelector<HTMLDivElement>('.app');
        this.updateSocket();
    }

    public handleJoin(): void {
        if(!this.appEl) return;
        console.log('handleuser')

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
        if(!this.appEl) return;

        const sendBtn = this.appEl.querySelector<HTMLButtonElement>('.chat-screen #send-message');
        if(!sendBtn) throw new Error('send button err');

        sendBtn.addEventListener('click', () => {
            let messageInputEl = this.appEl!.querySelector<HTMLInputElement>('.chat-screen #message-input');
            let messageInput = messageInputEl!.value;
            if(!messageInputEl || !messageInput.length) return;

            this.socket.emitNewMessage(messageInput);
            messageInputEl.value = '';
        });
    }

    public exitChat(): void {
        this.socket.emitExitUser(this.uname);
        window.location.href = window.location.href;
    }

    private renderMessage(type: any, message: any) {
        if(!this.appEl) return;

        let messageContainer = this.appEl.querySelector<HTMLDivElement>('.chat-screen .messages');
        if(!messageContainer) throw new Error('messgae container err');

        switch(type) {
            case 'my':
                const mEl: HTMLDivElement = document.createElement('div');
                mEl.setAttribute('class', 'message my-message');
                mEl.innerHTML = this.contentGetter.__my({
                    username: this.uname,
                    text: message
                });
                messageContainer.appendChild(mEl);
                break;
            case 'other':
                const oEl: HTMLDivElement = document.createElement('div');
                oEl.setAttribute('class', 'message other-message');
                oEl.innerHTML = this.contentGetter.__other({
                    username: message.username,
                    text: message.text
                });
                messageContainer.appendChild(oEl);
                break;
            case 'update':
                let uEl: HTMLDivElement = document.createElement('div');
                uEl.setAttribute('class', 'update');
                uEl.innerText = message;
                messageContainer.appendChild(uEl);
                break;
        }
    }

    private updateSocket(): void {
        this.socket.on('update', (update: any) => {
            this.renderMessage('update', update);
        });
        this.socket.on('chat', (message: any) => {
            this.renderMessage('my', message);   
            this.renderMessage('other', message);
        });
    }
}