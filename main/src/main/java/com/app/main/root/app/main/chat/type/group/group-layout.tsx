import "@/app/main/__styles/styles.css"
import React from 'react';
import { Component, createRef } from 'react';
import { ChatController } from '../../chat-controller';
import { GroupManager } from './group-manager';
import { GroupMembersInterface } from "./group-members-interface";
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
    dataGroupLayout?: string;
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
    activatedGroups: Set<string>;
    showInviteDialog: boolean;
    inviteCode: string; 
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
            showMembersInterface: false,
            activatedGroups: new Set(),
            showInviteDialog: false,
            inviteCode: ''
        }
    }

    componentDidMount(): void {
        this.groupManager.dashboard?.setStateChange((state: any) => {
            this.setState({ managerState: state });
        });
        
        if(this.props.mode === 'chat' && this.props.groupId) {
            this.loadMessages(this.props.groupId);
        }
    }

    componentDidUpdate(prevProps: Props): void {
        if(this.props.mode === 'chat' &&
            this.props.groupId !== prevProps.groupId &&
            this.props.groupId
        ) {
            this.loadMessages(this.props.groupId);
        }
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

    /**
     * Handle Create
     */
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

    /**
     * Handle Join Success
     */
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

    /**
     * Handle Group Exit
     */
    handleGroupExit = (e: CustomEvent) => {
        const data = e.detail;
        const groupId = data.id || data.groupId;

        this.setState(prevState => {
            const newActivatedGroups = new Set(prevState.activatedGroups);
            newActivatedGroups.delete(groupId);
            return { activatedGroups: newActivatedGroups };
        });

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

    /**
     * Handle Back
     */
    handleBack = () => {
        if(this.groupManager.dashboard) {
            this.groupManager.dashboard?.updateState({
                showCreationForm: false,
                showJoinForm: false,
                showGroup: false,
                hideGroup: true,
                groupName: ''
            });
            this.groupManager.dashboard?.setState({ activeChat: null });
        }
        if(this.groupManager.root) {
            this.groupManager.root.unmount();
            this.groupManager.root = null;
        }
        
        this.chatController.setCurrentChat(null, null, []);
    }

    /**
     * Handle Generate Invite Link
     */
    handleGenerateInviteLink = async () => {
        console.log('handleGenerateInviteLink called');
        
        if(!this.groupManager.currentGroupId) {
            console.error('No active group selected!')
            return;
        }

        try {
            console.log('Generating invite link for group:', this.groupManager.currentGroupId);
            await new Promise(res => setTimeout(res, 500));
            const groupId = this.groupManager.currentGroupId;
            const link = await this.groupManager.getInviteCodeManager().generate(groupId);
            const inviteCode = link.includes('=') ? link.split('=')[1] : link;
            console.log("LINK", link)
            this.setState({ 
                generatedLink: link,
                inviteCode: inviteCode,
                showInviteDialog: true,
                isLoading: false
            });
        } catch(err: any) {
            console.error('Failed to generate invite link:', err);
        }
    }

    /**
     * Members Interface
     */
    handleShowMembersInterface = async () => {
        this.setState({ showMembersInterface: true });
    }

    handleCloseMembersInterface = async () => {
        this.setState({ showMembersInterface: false });
    }

    /**
     * Handle File Upload
     */
    handleFileUpload = async (): Promise<void> => {
        this.fileUploaderRef.current?.triggerFileInput();
    }

    handleFileUploadSuccess = (res: any): void => {
        console.log('File uploaded successfully:', res);
        if(this.props.onSuccess) {
            this.props.onSuccess(res);
        }
    }

    handleFileUploadError = (err: Error): void => {
        console.error('File upload error:', err);
        if(this.props.onError) {
            this.props.onError(err);
        }
    }

    handleFileSharedInChat = (fileData: any): void => {
        console.log('File shared in chat:', fileData);
    }

    handleCopyInviteCode = async () => {
        try {
            await navigator.clipboard.writeText(this.state.inviteCode);
            console.log('Invite code copied to clipboard');
        } catch(err) {
            console.error('Failed to copy invite code:', err);
            this.setState({ error: 'Failed to copy invite code to clipboard' });
        }
    }

    /**
     * Handle Close Invite Dialog
     */
    handleCloseInviteDialog = () => {
        this.setState({ 
            showInviteDialog: false,
            inviteCode: '',
            generatedLink: ''
        });
    }

    render() {
        const { 
            isLoading, 
            error, 
            showMembersInterface, 
            showInviteDialog, 
            inviteCode 
        } = this.state;
        const { 
            showCreationForm,
            showJoinForm, 
            showGroup,
            groupName 
        } = this.state.managerState;

        const SEND_MSG_ICON_PATH = './data/resource/img/send.png';
        const SEND_FILE_ICON_PATH = './data/resource/img/file.png';
        
        return (
            <>
                {/* Info */}
                {this.props.mode === 'create' && 
                    showCreationForm && 
                    !showJoinForm && 
                (
                    <div className="group-info form">
                        <div className="group-info-form-content">
                            <input 
                                type="text" 
                                id="group-info-name"
                                ref={this.nameInputRef}
                                placeholder="Enter group name"
                                disabled={isLoading}
                                defaultValue={groupName}
                            />
                            <div className="group-info-actn">
                                <button 
                                    id="create-group button"
                                    disabled={isLoading}
                                    onClick={this.handleCreate}
                                >
                                    {isLoading ? 'Creating...' : 'Create Group'}
                                </button>
                                <button 
                                    id="close-menu button"
                                    onClick={this.handleBack}
                                >
                                    Back
                                </button>
                            </div>
                        </div>

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
                            <button 
                                id="exit-chat"
                                onClick={this.handleBack}
                            >
                                Back
                            </button>
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
                                onClick={this.handleGroupExitAction}
                            >
                                Exit Group
                            </button>
                        </div>
                        <div className="messages"></div>
                        <div className="typebox">
                            <input type="text" id="message-input" />
                            <button id="send-message">
                                <img src={SEND_MSG_ICON_PATH} alt="Send" />
                            </button>
                            <button id="send-file" onClick={this.handleFileUpload}>
                                <img src={SEND_FILE_ICON_PATH} alt="File" />
                            </button>
                        </div>
                    </div>
                )}

                {showInviteDialog && (
                    <div className="invite-dialog-overlay">
                        <div className="invite-dialog">
                            <div className="invite-dialog-header">
                                <h3>Group Invite Code</h3>
                                <button 
                                    className="close-button"
                                    onClick={this.handleCloseInviteDialog}
                                >
                                    ×
                                </button>
                            </div>
                            <div className="invite-dialog-content">
                                <p>Share this code to invite others to the group:</p>
                                <div className="invite-code-container">
                                    <input 
                                        type="text" 
                                        value={inviteCode}
                                        readOnly
                                        className="invite-code-input"
                                    />
                                </div>
                                <div className="invite-dialog-actions">
                                    <button 
                                        onClick={this.handleCopyInviteCode}
                                        className="copy-button"
                                    >
                                        Copy
                                    </button>
                                    <button 
                                        onClick={this.handleCloseInviteDialog}
                                        className="close-dialog-button"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
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