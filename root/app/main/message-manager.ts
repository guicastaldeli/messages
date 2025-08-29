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

    public handleUser(): void {
        if(!this.appEl) return;
        console.log('handleuser')

        const joinBtn = this.appEl.querySelector<HTMLButtonElement>('.join-screen #join-user');
        if(!joinBtn) throw new Error('join button err');

        joinBtn.addEventListener('click', () => {
            const usernameInput = this.appEl!.querySelector<HTMLInputElement>('.join-screen #username')!.value;
            if(!usernameInput.length) return;

            this.socket.emitNewUser(usernameInput);
            this.uname = usernameInput;

            const active = this.appEl!.querySelector('.join-screen')!.classList;
            active.remove('active');
            active.add('active');
        });
    }

    public handleChatMessage(): void {
        if(!this.appEl) return;

        const sendBtn = this.appEl.querySelector<HTMLButtonElement>('.chat-screen #send-message');
        if(!sendBtn) throw new Error('send button err');

        sendBtn.addEventListener('click', () => {
            let messageInput = this.appEl!.querySelector<HTMLInputElement>('.chat-screen #message-input')!.value;
            if(!messageInput.length) return;

            this.renderMessage('my', {
                username: this.uname,
                text: messageInput
            });
            this.socket.emitNewMessage(messageInput);
            messageInput = '';
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
                mEl.innerHTML = this.contentGetter.__my(message);
                messageContainer.appendChild(mEl);
                break;
            case 'other':
                const oEl: HTMLDivElement = document.createElement('div');
                oEl.setAttribute('class', 'message my-message');
                oEl.innerHTML = this.contentGetter.__other(message);
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
            this.renderMessage('other', message);
        });
    }
}