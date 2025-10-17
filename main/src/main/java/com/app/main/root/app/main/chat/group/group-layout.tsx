import '../../__styles/styles.scss';
import React, { useState } from 'react';
import { Component, createRef } from 'react';
import { MessageManager } from '../../_messages_config/message-manager';
import { GroupManager } from './group-manager';
import { JoinGroupLayout } from './join-group-layout';

interface Props {
    messageManager: MessageManager;
    groupManager: GroupManager;
    onSuccess?: (data: any) => void;
    onError?: (error: any) => void;
}

interface State {
    creationComplete: boolean;
    groupName: string;
    isLoading: boolean;
    error: string | null;
    generatedLink: string;
    managerState: {
        showForm: boolean;
        showJoinForm: boolean;
        showInviteLink: boolean;
        showChat: boolean;
        hideChat: boolean;
        groupName: string;
    }
}

export class GroupLayout extends Component<Props, State> {
    private messageManager: MessageManager;
    private groupManager: GroupManager;

    private timeout: number = 15000;
    private nameInputRef = createRef<HTMLInputElement>();

    constructor(props: Props) {
        super(props);
        this.messageManager = this.props.messageManager;
        this.groupManager = this.props.groupManager;

        this.state = {
            creationComplete: false,
            groupName: '',
            isLoading: false,
            error: null,
            generatedLink: '',
            managerState: {
                showForm: true,
                showJoinForm: false,
                showInviteLink: false,
                showChat: false,
                hideChat: false,
                groupName: ''
            }
        }
    }

    componentDidMount(): void {
        this.groupManager.dashboard.setStateChange((state: any) => {
            this.setState({ managerState: state });
        });
        window.addEventListener(
            'group-creation-complete',
            this.handleCreationComplete as EventListener
        );
    }
    componentWillUnmount(): void {
        window.removeEventListener(
            'group-creation-complete',
            this.handleCreationComplete as EventListener
        );
    }

    handleCreationComplete = () => {
        this.setState({
            isLoading: false,
            creationComplete: true,
            error: null
        });
    }

    /* Create */
    handleCreate = async () => {
        const groupName = this.nameInputRef.current?.value || '';
        if(!groupName.trim()) {
            alert('Enter a group name');
            return;
        }

        this.setState({
            isLoading: true,
            groupName,
            error: null
        });

        try {
            this.groupManager.manageCreate(groupName);

            setTimeout(() => {
                if(this.state.isLoading && !this.state.creationComplete) {
                    this.setState({
                        isLoading: false,
                        error: 'Timeout. try again ;-;'
                    });
                }
            }, this.timeout);
        } catch(err) {
            console.log(err);
            throw new Error('Failed to create');
        }
    }

    handleRetry = () => {
        this.setState({ error: null });
    }

    resetForm = () => {
        if(this.nameInputRef.current) this.nameInputRef.current.value = '';
        this.setState({
            creationComplete: false,
            groupName: '',
            isLoading: false,
            error: null
        });
    }

    /* Exit */
    handleExitGroup = () => {
       // this.groupManager.exitGroup();
        this.resetForm();
        this.groupManager.dashboard.updateState({
            showForm: false,
            showChat: false,
            hideChat: false,
            groupName: ''
        });
    }

    /* Back */
    handleBack = () => {
        this.groupManager.dashboard.updateState({
            showForm: false,
            showChat: false,
            hideChat: true,
            groupName: ''
        });
    }

    /* Generated Link Handler */
    handleGenerateInviteLink = async () => {
        if(!this.groupManager.currentGroupId) {
            console.error('No active group selected!')
            return;
        }

        try {
            const groupId = this.groupManager.currentGroupId;
            const link = await this.groupManager.getInviteCodeManager().generate(groupId);
            this.setState({
                generatedLink: link
            })
            this.state.managerState.showInviteLink = true;
        } catch(err: any) {
            console.error('Failed to generate invite link:', err);
        }
    }

    /* Join Group Success */
    handleJoinSuccess = (data: any) => {
        this.state.managerState.showJoinForm = false;
        this.groupManager.dashboard.updateState({
            showForm: false,
            showChat: true,
            hideChat: false,
            groupName: data.groupName
        });
        this.groupManager.currentGroupId = data.groupId;
    }

    /* Show Join Form */
    handleShowJoinForm = () => {
        this.state.managerState.showJoinForm = true;
    }

    /* Render */
    render() {
        const { isLoading, error } = this.state;
        const { 
            showForm, 
            showChat,
            hideChat, 
            groupName 
        } = this.state.managerState;
        
        return (
            <>
                {/* Info */}
                {showForm && (
                    <div className="group-info form">
                        <input 
                            type="text" 
                            id="group-info-name"
                            ref={this.nameInputRef}
                            placeholder="Enter group name"
                            disabled={isLoading}
                            defaultValue={groupName}
                        />
                        <button 
                            id="create-group button"
                            disabled={isLoading}
                            onClick={this.handleCreate}
                        >
                            {isLoading ? 'Creating...' : 'Create Group'}
                        </button>

                        {/* Loading */}
                        {isLoading && (
                            <div className="loading">Creating group, please wait...</div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="error">
                                <p>{error}</p>
                                <button onClick={this.handleRetry}>Try Again</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Layout */}
                {showChat && (
                    <div className="screen chat-screen">
                        <div className="header">
                            <div id="group-name">{groupName}</div>
                            <button
                                onClick={this.handleGenerateInviteLink}
                                id='invite-button'
                            >
                                Invite
                            </button>
                            <button 
                                id="exit-chat"
                                onClick={this.handleBack}
                            >
                                Back
                            </button>
                            <button 
                                id="exit-chat"
                                onClick={this.handleExitGroup}
                            >
                                Exit Group
                            </button>
                        </div>
                        <div className="messages"></div>
                        <div className="typebox">
                            <input type="text" id="message-input" />
                            <button 
                                id="send-message" 
                                onClick={async () => {
                                    await this.messageManager.handleSendMessage();
                                }}
                            >
                                Send
                            </button>
                        </div>
                    </div>
                )}

                {/* Invite Link Container */}
                {this.state.managerState.showInviteLink && (
                    <div className="invite-link-container">
                        <div id="header">
                            <h3>Invite Link Generated</h3>
                            <button
                                onClick={() => this.state.managerState.showInviteLink = false}
                                id='close-button'
                            >

                            </button>
                        </div>
                    </div>
                )}
            </>
        );
    }
}