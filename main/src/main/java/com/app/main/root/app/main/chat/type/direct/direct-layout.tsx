import React, { useState, useEffect, Component } from 'react';
import { DirectManager } from './direct-manager';
import { ChatController } from '../../chat-controller';

interface Props {
    chatController: ChatController;
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