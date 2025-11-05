import React, { useState, useEffect, Component } from 'react';
import { DirectManager } from './direct-manager';
import { MessageManager } from '../../_messages_config/message-manager';

interface Props {
    messageManager: MessageManager;
    directManager: DirectManager;
    onBack?: () => void;
}

interface State {
    isActive: boolean;
    currentChat: any;
}

export class DirectLayout extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            isActive: false,
            currentChat: null
        }
    }

    componentDidMount(): void {
        window.addEventListener('direct-activated', this.handleChatActivated as EventListener);
    }

    componentWillUnmount(): void {
        window.removeEventListener('direct-activated', this.handleChatActivated as EventListener);
    }

    /*
    ** Chat Activated
    */
    private handleChatActivated = (e: CustomEvent): void => {
        this.setState({
            currentChat: e.detail,
            isActive: true
        });
    }

    /*
    ** Back
    */
    private handleBack = (): void => {
        if(this.props.onBack) this.props.onBack();
    }

    private handleSendMessage = async (): Promise<void> => {
        const { messageManager, directManager } = this.props;
        const { currentChat } = this.state;

        if (!currentChat) {
            console.error('No active chat to send message to');
            return;
        }

        try {
            // Ensure the message manager knows about the current direct chat
            await messageManager.setCurrentChat(
                currentChat.chatId,
                'DIRECT',
                [directManager.userId, currentChat.participant.id]
            );
            
            // Now call the send message handler
            await messageManager.handleSendMessage();
        } catch (err) {
            console.error('Failed to send message:', err);
        }
    }

    render() {
        const { isActive, currentChat } = this.state;
        if(!isActive || !currentChat) return null;

        return (
            <div className="screen chat-screen">
                <div className="header">
                    <div id="participant-name">
                        {currentChat.participant?.username || 'Unknown User'}
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