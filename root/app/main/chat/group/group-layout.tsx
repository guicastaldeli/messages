import '../../_styles/styles.scss';
import { Component } from 'react';
import { MessageManager } from '../../message-manager';
import { GroupManager } from './group-manager';

interface Props {
    messageManager: MessageManager;
    groupManager: GroupManager;
}

export class GroupLayout extends Component<Props> {
    private messageManager: MessageManager;
    private groupManager: GroupManager;

    constructor(props: Props) {
        super(props);
        this.messageManager = this.props.messageManager;
        this.groupManager = this.props.groupManager;
    }

    render() {
        return (
            <>
                {/* Info */}
                <div className="group-info form">
                    <input type="text" id="group-info-name" />
                    <button 
                        id="create-group button"
                        onClick={() => this.groupManager.handleCreate()}
                    >
                        Create
                    </button>
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