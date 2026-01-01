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
            if (!currentChatId) {
                console.error('No active chat selected!');
                return;
            }

            const fileService = await this.props.chatService.getFileController().getFileService();
            const res = await fileService.uploadFile(
                file,
                sessionData.userId,
                currentChatId
            );
            
            if(res.success) {
                console.log('FILE UPLOADED!', res);
                
                const fileItem: Item = {
                    fileId: res.data.fileId,
                    originalFileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    chatId: currentChatId,
                    fileType: this.getFileType(file.type),
                    uploadedAt: new Date().toISOString(),
                    lastModified: new Date().toISOString()
                };
                
                console.log('Sending file message with fileId:', fileItem.fileId);
                
                if(this.props.chatController) {
                    await this.props.chatController.sendFileMessage(fileItem);
                }
                
                if(this.props.onFileSharedInChat) {
                    this.props.onFileSharedInChat(fileItem);
                }
                
                if(this.props.onUploadSuccess) {
                    this.props.onUploadSuccess(res);
                }
            } else {
                const error = new Error(`Upload failed: ${res.error}`);
                if(this.props.onUploadError) {
                    this.props.onUploadError(error);
                }
                throw error;
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