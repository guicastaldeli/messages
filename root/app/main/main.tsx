import { Component } from 'react';
import { MessageManager } from './message-manager';
import { SocketClient } from '../.server/socket-client';
import './_styles/styles.scss';

export class Main extends Component {
    private messageManager: MessageManager;
    private socketClient: SocketClient;

    constructor(props: any) {
        super(props);
        this.socketClient = SocketClient.getInstance();
        this.messageManager = new MessageManager(this.socketClient);
        this.connect();
    }

    private connect(): void {
        if(!this.socketClient || this.socketClient['isConnected']) return;
        this.socketClient.connect();
        this.messageManager.init();
    }

    render() {
        return (
            <div className='app'>
                <div className='screen join-screen active'>
                    <div className='form'>
                        <h2>Join chatroom</h2>
                        <div className="form-input">
                            <label>Username</label>
                            <input type="text" id='username' />
                        </div>
                        <div className='form-input'>
                            <button 
                                id='join-user' 
                                onClick={() => this.messageManager.handleJoin()}
                            >
                                Join
                            </button>
                        </div>
                    </div>
                </div>
                <div className='screen chat-screen'>
                    <div className="header">
                        <div className="logo">chatroom</div>
                        <button id="exit-chat">Exit</button>
                    </div>
                    <div className="messages"></div>
                    <div className="typebox">
                        <input type="text" id="message-input" />
                        <button 
                            id="send-message" 
                            onClick={() => this.messageManager.handleChatMessage()}
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>
        )
    }
}