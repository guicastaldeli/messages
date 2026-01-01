import "@/app/main/__styles/styles.css"
import React, { useState } from 'react';
import { Component, createRef } from 'react';
import { ChatController } from '../../chat-controller';
import { GroupManager } from './group-manager';
import { GroupMembersInterface } from './layout/group-members-interface';
import { FileUploader } from "../../file/file-uploader";

export interface Props {
    chatController: ChatController;
    groupManager: GroupManager;
    onSuccess?: (data: any) => void;
    onError?: (error: any) => void;
    onClose?: () => void;
    groupId?: any;
    groupName?: string;
    mode: 'create' | 'join' | 'chat';
}

interface State {
    creationComplete: boolean;
    groupName: string;
    isLoading: boolean;
    error: string | null;
    generatedLink: string;
    managerState: {
        showCreationForm: boolean;
        showJoinForm: boolean;
        showGroup: boolean;
        hideGroup: boolean;
        groupName: string;
    }
    messagesLoaded: boolean;
    showMembersInterface: boolean;
}

export class GroupLayout extends Component<Props, State> {
    private chatController: ChatController;
    private groupManager: GroupManager;

    private timeout: number = 15000;
    private nameInputRef = createRef<HTMLInputElement>();
    private fileUploaderRef = createRef<FileUploader>();

    constructor(props: Props) {
        super(props);
        this.chatController = this.props.chatController;
        this.groupManager = this.props.groupManager;

        this.state = {
            creationComplete: false,
            groupName: '',
            isLoading: false,
            error: null,
            generatedLink: '',
            managerState: {
                showCreationForm: true,
                showJoinForm: false,
                showGroup: false,
                hideGroup: false,
                groupName: ''
            },
            messagesLoaded: false,
            showMembersInterface: false
        }
    }

    componentDidMount(): void {
        this.groupManager.dashboard?.setStateChange((state: any) => {
            this.setState({ managerState: state });
        });
        window.addEventListener('group-creation-complete', this.handleGroupActivation as EventListener);
        window.addEventListener('group-activated', this.handleGroupActivation as EventListener);
        window.addEventListener('group-join-complete', this.handleGroupActivation as EventListener);
        window.addEventListener('group-exit-complete', this.handleGroupExit as EventListener);
        if(this.props.mode === 'chat' && this.props.groupId) {
            this.loadMessages(this.props.groupId);
        }
    }
    componentDidUpdate(prevProps: Props): void {
        if(
            this.props.mode === 'chat' &&
            this.props.groupId !== prevProps.groupId &&
            this.props.groupId
        ) {
            this.loadMessages(this.props.groupId);
        }
    }
    componentWillUnmount(): void {
        window.removeEventListener('group-creation-complete', this.handleGroupActivation as EventListener);
        window.removeEventListener('group-activated', this.handleGroupActivation as EventListener);
        window.removeEventListener('group-join-complete', this.handleGroupActivation as EventListener);
        window.removeEventListener('group-exit-complete', this.handleGroupExit as EventListener);
    }

    private loadMessages = async (groupId: string): Promise<void> => {
        try {
            this.setState({ isLoading: true });
            this.setState({
                messagesLoaded: true,
                isLoading: false
            });
        } catch(err) {
            this.setState({
                error: 'Failed to load messages',
                isLoading: false
            });
        }
    }

    handleGroupActivation = (event: CustomEvent) => {
        const data = event.detail;
        this.groupManager.currentGroupId = data.id || data.groupId;
        this.groupManager.dashboard?.updateState({
            showCreationForm: false,
            showJoinForm: false,
            showGroup: true,
            hideGroup: false,
            groupName: data.name
        });
        this.setState({
            managerState: {
                showCreationForm: false,
                showJoinForm: false,
                showGroup: true,
                hideGroup: false,
                groupName: data.name
            }
        });
        if(data.id || data.groupId) {
            this.loadMessages(data.id || data.groupid);
        }
        console.log('Group activated:', data.name, 'ID:', this.groupManager.currentGroupId);
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
            await this.groupManager.create(groupName);

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

    /* Join Group Success */
    handleJoinSuccess = (data: any) => {
        this.groupManager.currentGroupId = data.groupId;
        this.groupManager.currentGroupName = data.name;

        this.groupManager.dashboard?.updateState({
            showCreationForm: false,
            showJoinForm: false,
            showGroup: true,
            hideGroup: false,
            groupName: data.groupName
        });
        this.setState({
            managerState: {
                ...this.state.managerState,
                showCreationForm: false,
                showJoinForm: false,
                showGroup: true,
                hideGroup: false,
                groupName: data.name
            }
        });
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
    handleGroupExit = () => {
        this.groupManager.dashboard?.updateState({
            showCreationForm: false,
            showJoinForm: false,
            showGroup: false,
            hideGroup: false,
            groupName: ''
        });
        this.setState({
            managerState: {
                showCreationForm: false,
                showJoinForm: false,
                showGroup: false,
                hideGroup: false,
                groupName: ''
            }
        });
    }

    handleGroupExitAction = async () => {
        try {
            await this.groupManager.exitGroup(this.groupManager.currentGroupId);
        } catch(err: any) {
            console.error(err);
            this.setState({
                isLoading: false,
                error: `Failed to exit group: ${err.message}`
            });
        }
    }

    /* Back */
    handleBack = () => {
        this.groupManager.dashboard?.updateState({
            showCreationForm: false,
            showJoinForm: false,
            showGroup: false,
            hideGroup: true,
            groupName: ''
        });
        if(this.groupManager.root) {
            this.groupManager.root.unmount();
            this.groupManager.root = null;
        }
    }

    /* Generated Link Handler */
    handleGenerateInviteLink = async () => {
        if(!this.groupManager.currentGroupId) {
            console.error('No active group selected!')
            return;
        }

        try {
            await new Promise(res => setTimeout(res, 500));
            const groupId = this.groupManager.currentGroupId;
            const link = await this.groupManager.getInviteCodeManager().generate(groupId);
            this.setState({ generatedLink: link });
        } catch(err: any) {
            console.error('Failed to generate invite link:', err);
        }
    }

    /* Members Interface */
    handleShowMembersInterface = async () => {
        this.setState({ showMembersInterface: true });
    }

    handleCloseMembersInterface = async () => {
        this.setState({ showMembersInterface: false });
    }

    handleFileUpload = async (): Promise<void> => {
        this.fileUploaderRef.current?.triggerFileInput();
    }

    handleFileUploadSuccess = (res: any): void => {
        console.log('File uploaded successfully:', res);
        if (this.props.onSuccess) {
            this.props.onSuccess(res);
        }
    }

    handleFileUploadError = (err: Error): void => {
        console.error('File upload error:', err);
        if (this.props.onError) {
            this.props.onError(err);
        }
    }

    handleFileSharedInChat = (fileData: any): void => {
        console.log('File shared in chat:', fileData);
    }

    /* Render */
    render() {
        const { isLoading, error, showMembersInterface } = this.state;
        const { 
            showCreationForm,
            showJoinForm, 
            showGroup,
            groupName 
        } = this.state.managerState;
        
        return (
            <>
                {/* Info */}
                {this.props.mode === 'create' && 
                    showCreationForm && 
                    !showJoinForm && 
                (
                    <div className="group-info form">
                        <button 
                            id="close-menu button"
                            onClick={this.handleBack}
                        >
                            Back
                        </button>
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
                {showGroup && (
                    <div className="screen chat-screen">
                        <div className="header">
                            <div id="group-name">{groupName}</div>
                            <button
                                onClick={this.handleShowMembersInterface}
                                id='members-button'
                            >
                                Members
                            </button>
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
                                onClick={this.handleGroupExitAction}
                            >
                                Exit Group
                            </button>
                        </div>
                        <div className="messages"></div>
                        <div className="typebox">
                            <input type="text" id="message-input" />
                            <button id="send-message">
                                Send
                            </button>
                            <button id="send-file" onClick={this.handleFileUpload}>
                                Send
                            </button>
                        </div>
                    </div>
                )}

                <FileUploader
                    ref={this.fileUploaderRef}
                    chatService={this.chatController.chatService}
                    chatController={this.chatController}
                    onUploadSuccess={this.handleFileUploadSuccess}
                    onUploadError={this.handleFileUploadError}
                    onFileSharedInChat={this.handleFileSharedInChat}
                />
                {showMembersInterface && (
                    <GroupMembersInterface
                        groupId={this.groupManager.currentGroupId}
                        groupName={groupName}
                        groupManager={this.groupManager}
                        chatController={this.chatController}
                        onClose={this.handleCloseMembersInterface}
                    />
                )}
            </>
        );
    }
}