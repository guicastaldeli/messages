import React, { Component, createRef } from 'react';
import { DirectManager } from './direct-manager';
import { ChatController } from '../../chat-controller';
import { FileUploader } from '../../file/file-uploader';

interface Props {
    chatController: ChatController;
    directManager: DirectManager;
    onClose?: () => void;
    chatId?: string;
    participantName?: string;
    onSuccess?: (data: any) => void;
    onError?: (error: any) => void;
}

interface State {
    isActive: boolean;
}

export class DirectLayout extends Component<Props, State> {
    private fileUploaderRef = createRef<FileUploader>();

    constructor(props: Props) {
        super(props);
        this.state = {
            isActive: false
        }
    }

    componentDidMount(): void {
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

    /**
     * Back
     */
    private handleBack = (): void => {
        if(this.props.onClose) this.props.onClose();
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

    render() {
        const { isActive } = this.state;
        const { participantName } = this.props;
        
        if(!isActive) return null;

        return (
            <>
                <div className="screen chat-screen">
                    <div className="header">
                        <button onClick={this.handleBack} id="exit-chat">
                            Back
                        </button>
                        <div id="participant-name">
                            {participantName || 'Unknown User'}
                        </div>
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

                <FileUploader
                    ref={this.fileUploaderRef}
                    chatService={this.props.directManager.chatController.chatService}
                    chatController={this.props.directManager.chatController}
                    onUploadSuccess={this.handleFileUploadSuccess}
                    onUploadError={this.handleFileUploadError}
                    onFileSharedInChat={this.handleFileSharedInChat}
                />
            </>
        );
    }
}