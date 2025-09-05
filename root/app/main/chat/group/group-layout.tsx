import '../../_styles/styles.scss';
import { Component } from 'react';
import { MessageManager } from '../../message-manager';

interface Props {
    messageManager: MessageManager;
}

export class GroupLayout extends Component<Props> {
    private messageManager: MessageManager;

    constructor(props: Props) {
        super(props);
        this.messageManager = this.props.messageManager
    }

    render() {
        return (
            <>
                {/* Info */}
                <div className="group-info form">
                    <input type="text" id="group-info name" />
                    <button id="create-group button">Create</button>
                </div>

                {/* Layout */}
                <div className="screen chat-screen">
                    <div className="header">
                        <div id="group-name"></div>
                        <button 
                            id="exit-chat"
                            onClick={() => this.messageManager.exitChat()}
                        >
                            Exit
                        </button>
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
            </>
        );
    }
}