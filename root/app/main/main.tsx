import { Component } from 'react';
import { MessageManager } from './message-manager';
import './_styles/styles.scss';

export class Main extends Component {
    private messageManager: MessageManager;

    constructor(props: any) {
        super(props);
        this.render();
        this.messageManager = new MessageManager();
    }

    public render() {
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
                            <button id='join-user' onClick={() => this.messageManager.handleUser()}>Join</button>
                        </div>
                    </div>
                </div>
                <div className='screen chat-screen'>
                    <div className="header">
                        <div className="logo">chatroom</div>
                        <button id="exit-chat">Exit</button>
                    </div>
                    <div className="messages">
                        {/* Dummy msg */}
                        <div className="message my-message">
                            <div>
                                <div className="name">You</div>
                                <div className="text">Hi!</div>
                            </div>
                        </div>
                        <div className="update">
                            Abs has joined the chat
                        </div>
                        <div className="message other-message">
                            <div>
                                <div className="name">Abc</div>
                                <div className="text">Hi!</div>
                            </div>
                        </div>
                    </div>
                    <div className="typebox">
                        <input type="text" id="message-input" />
                        <button id="send-message">Send</button>
                    </div>
                </div>
            </div>
        )
    }
}