import React, { Component } from "react";
import { SessionManager } from "../../_session/session-manager";
import { ChatService } from "../chat-service";
import { CacheServiceClient } from "@/app/_cache/cache-service-client";
import { ChatController } from "../chat-controller";
import { Item } from "./file-item";

interface Props {
    chatService: ChatService;
    chatController: ChatController;
    onUploadSuccess?: (res: any) => void;
    onUploadError?: (err: Error) => void;
    onFileSharedInChat?: (data: any) => void;
}

interface State {
    isUploading: boolean;
    uploadProgress: number;
}

export class FileUploader extends Component<Props, State> {
    private fileInputRef = React.createRef<HTMLInputElement>();

    constructor(props: Props) {
        super(props);
        this.state = {
            isUploading: false,
            uploadProgress: 0
        }
    }

    public handleUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
        try {
            const files = e.target.files;
            if(!files || files.length === 0) {
                console.log('No files!');
                return;
            }
            
            const file = files[0];
            console.log('Selected file:', file.name, file.size, file.type);
            if(!file || file.size === 0) {
                console.error('Invalid file selected');
                return;
            }
            
            const sessionData = SessionManager.getCurrentSession();
            if(!sessionData || !sessionData.userId) {
                console.error('Login first!');
                return;
            }

            const currentChatId = this.props.chatController.currentChatId;
            if(!currentChatId) {
                console.error('No active chat selected!');
                return;
            }
            const fileItem: Item = {
                fileId: '',
                originalFileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                chatId: currentChatId,
                fileType: this.getFileType(file.type),
                uploadedAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                userId: sessionData.userId,
                file: file
            }
            
            console.log('Sending file message with file:', fileItem.originalFileName);
            
            if(this.props.chatController && this.props.chatController.sendFileMessage) {
                await this.props.chatController.sendFileMessage(fileItem, sessionData.userId);
            }
            if(this.props.onFileSharedInChat) {
                this.props.onFileSharedInChat(fileItem);
            }
            
            e.target.value = '';
        } catch(err) {
            console.error('Upload error', err);
            if(this.props.onUploadError) {
                this.props.onUploadError(err as Error);
            }
        }
    }

    private getFileType(mimeType: string): 'image' | 'video' | 'document' | 'other' {
        if(mimeType.startsWith('image/')) return 'image';
        if(mimeType.startsWith('video/')) return 'video';
        if(mimeType.startsWith('application/') || mimeType.startsWith('text/')) return 'document';
        return 'other';
    }

    public triggerFileInput = (): void => {
        this.fileInputRef.current?.click();
    }

    render() {
        const { isUploading, uploadProgress } = this.state;

        return (
            <div className={`file-uploader ${isUploading}`}>
                <input
                    type="file"
                    ref={this.fileInputRef}
                    onChange={this.handleUpload}
                    style={{ display: 'none' }}
                    disabled={isUploading}
                />
            </div>
        )
    }
}