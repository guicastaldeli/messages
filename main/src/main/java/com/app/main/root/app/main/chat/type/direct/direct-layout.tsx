import React, { Component } from 'react';
import { DirectManager } from './direct-manager';
import { ChatController } from '../../chat-controller';

interface Props {
    chatController: ChatController;
    directManager: DirectManager;
    onClose?: () => void;
    chatId?: string;
    participantName?: string;
}

interface State {
    isActive: boolean;
}

export class DirectLayout extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            isActive: false
        }
    }

    componentDidMount(): void {
        console.log("DIRECT LAYOUT------ chatId:", this.props.chatId);
        
        if(this.props.chatId && this.props.directManager) {
            this.setState({ isActive: true });
            this.props.directManager.setCurrentChat(this.props.chatId);
        }
    }

    componentDidUpdate(prevProps: Props): void {
        if(prevProps.chatId !== this.props.chatId || 
            prevProps.directManager !== this.props.directManager) {
            if(this.props.chatId && this.props.directManager) {
                this.setState({ isActive: true });
                this.props.directManager.setCurrentChat(this.props.chatId);
            } else {
                this.setState({ isActive: false });
            }
        }
    }

    /*
    ** Back
    */
    private handleBack = (): void => {
        if(this.props.onClose) this.props.onClose();
    }

    render() {
        const { isActive } = this.state;
        const { participantName } = this.props;
        
        if(!isActive) return null;

        return (
            <div className="screen chat-screen">
                <div className="header">
                    <div id="participant-name">
                        {participantName || 'Unknown User'}
                    </div>
                    <button onClick={this.handleBack} id="exit-chat">
                        Back
                    </button>
                </div>
                <div className="messages"></div>
                <div className="typebox">
                    <input type="text" id="message-input" />
                    <button id="send-message">
                        Send
                    </button>
                </div>
            </div>
        );
    }
}