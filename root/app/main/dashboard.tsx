import './_styles/styles.scss';
import React, { Component } from 'react';
import { MessageManager } from './message-manager';
import { GroupManager } from './chat/group/group-manager';
import { SessionContext } from '../.api/session-context';
import { ChatManager } from './chat/chat-manager';
import { chatState } from './chat-state-service';

interface Props {
    onCreateGroup: () => void;
    messageManager: MessageManager;
    chatManager: ChatManager;
    groupManager: GroupManager;
    chatList: any[];
    activeChat: any;
}

interface State {
    groups: any[];
    chatList: any[];
    activeChat: any;
}

export class Dashboard extends Component<Props, State> {
    private groupContainerRef: React.RefObject<HTMLDivElement | null>;

    constructor(props: Props) {
        super(props);
        this.state = {
            groups: [],
            chatList: props.chatList || [],
            activeChat: props.activeChat || null
        }
        this.groupContainerRef = React.createRef();
    }

    componentDidMount(): void {
        if(!this.groupContainerRef.current || !this.props.groupManager) return;
        this.props.groupManager.setContainer(this.groupContainerRef.current);
        this.props.chatManager.setUpdateCallback((updatedList) => { this.setState({ chatList: updatedList }) });
    }

    componentDidUpdate(prevProps: Props): void {
        if(
            this.props.groupManager && 
            this.props.groupManager !== prevProps.groupManager &&
            this.groupContainerRef.current 
        ) {
            this.props.groupManager.setContainer(this.groupContainerRef.current);
        }

        if (prevProps.chatList !== this.props.chatList) {
            this.setState({ chatList: this.props.chatList || [] });
        }
        if (prevProps.activeChat !== this.props.activeChat) {
            this.setState({ activeChat: this.props.activeChat || null });
        }
    }

    handleChatSelect = (chat: any): void => {
        chatState.setType(chat.type === 'direct' ? 'direct' : 'group');
        const event = new CustomEvent('chat-activated', { detail: chat });
        window.dispatchEvent(event);
    }

    handleSendMessage = (chatId: string): void => {
        this.props.messageManager.handleSendMessage(chatId);
    }

    render() {
        const { chatList, activeChat } = this.props;

        return (
            <SessionContext.Consumer>
                {({ currentSession }) => (
                    <>
                        {currentSession === 'dashboard' && (
                            <div className="screen main-dashboard">
                                <header>
                                    <div id="actions-bar">
                                        <button 
                                            id="action-chat"
                                            onClick={() => this.props.onCreateGroup()}
                                        >
                                            Group++++
                                        </button>
                                    </div>
                                </header>
                            </div>
                        )}

                        <div className="group-container" ref={this.groupContainerRef}></div>

                        <div id="chat-container">
                            <div className="chat-list">
                                {chatList.length === 0 ? (
                                    <p>No chats.</p>
                                ) : (
                                    <ul>
                                        {chatList.map((chat, i) => (
                                            <li
                                                key={chat.id || i}
                                                className={`chat-item ${
                                                    activeChat && 
                                                    activeChat.id === chat.id ? 'active' : ''
                                                }`}
                                                onClick={() => this.handleChatSelect(chat)}
                                            >
                                                <div className="chat-icon">
                                                    {chat.type === 'group' ? 'g' : 'd'}
                                                </div>
                                                <div className="chat-info">
                                                    <div id="chat-name">{chat.name}</div>
                                                    <div id="chat-preview">
                                                        {chat.lastMessage}
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </SessionContext.Consumer>
        );
    }
}