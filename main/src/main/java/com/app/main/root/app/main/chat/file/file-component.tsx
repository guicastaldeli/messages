import React from 'react';
import { MessageProps } from '../messages/message-item';
import { Item } from './file-item';

export interface FileMessageProps extends MessageProps {
    fileData: Item;
    onDownload?: (file: Item) => Promise<void>;
    onPreview?: (file: Item) => Promise<void>;
}

export const FileMessageWrapper: React.FC<FileMessageProps> = React.memo(({
    username,
    content,
    timestamp,
    messageId,
    type,
    priority,
    isDirect,
    isGroup,
    isSystem,
    perspective,
    direction,
    userColor,
    chatType,
    currentUserId,
    fileData,
    onDownload,
    onPreview
}) => {
    const isSelf = direction === 'self';
    const selfColor = '#4a90e2';

    const getMessageColor = () => {
        if(isSelf) return { backgroundColor: selfColor };
        if(userColor) return { backgroundColor: userColor };
        return { backgroundColor: '#f0f0f0' };
    };

    const messageColor = getMessageColor();

    const getFileIcon = (fileType: string, mimeType: string): string => {
        switch(fileType) {
            case 'image': return 'IMG';
            case 'video': return 'VID';
            case 'document': 
                if(mimeType.includes('pdf')) return 'DOC';
                if(mimeType.includes('word') || mimeType.includes('document')) return 'DOC';
                return 'OTH';
            default: return 'OTH';
        }
    };

    const formatFileSize = (bytes: number): string => {
        if(bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if(onDownload) {
            await onDownload(fileData);
        }
    };

    const handlePreview = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if(onPreview) {
            await onPreview(fileData);
        }
    };

    return (
        <div 
            className={`message file-message ${isSelf ? 'self-message' : 'other-message'}`}
            style={messageColor}
            data-message-id={messageId}
            data-direction={direction}
            data-type="file"
        >
            <div className="message-header">
                {perspective.showUsername && (
                    <div className="username">{username}</div>
                )}
                <div className="timestamp">
                    {new Date(timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </div>
            </div>
            
            <div className="file-message-content">
                <div className="file-icon">
                    {getFileIcon(fileData.fileType, fileData.mimeType)}
                </div>
                
                <div className="file-info">
                    <div className="file-name">{fileData.originalFileName}</div>
                    <div className="file-details">
                        <span className="file-size">{formatFileSize(fileData.fileSize)}</span>
                        <span className="file-type">{fileData.fileType}</span>
                    </div>
                </div>
                
                <div className="file-actions">
                    <button 
                        className="file-action-btn preview-btn"
                        onClick={handlePreview}
                        title="Preview"
                    >
                        P
                    </button>
                    <button 
                        className="file-action-btn download-btn"
                        onClick={handleDownload}
                        title="Download"
                    >
                        ⬇
                    </button>
                </div>
            </div>
        </div>
    );
});

FileMessageWrapper.displayName = 'FileMessageWrapper';

export class FileMessageComponentGetter {
    private currentUserId: string | undefined;

    public setCurrentUserId(userId: string) {
        this.currentUserId = userId;
    }

    public getFileMessage(data: any): React.ReactElement {
        const {
            username,
            content,
            timestamp,
            messageId,
            type,
            priority,
            isDirect,
            isGroup,
            isSystem,
            perspective,
            direction,
            userColor,
            chatType,
            fileData,
            onDownload,
            onPreview
        } = data;

        return (
            <FileMessageWrapper
                username={username}
                content={content}
                timestamp={timestamp}
                messageId={messageId}
                type={type}
                priority={priority}
                isDirect={isDirect}
                isGroup={isGroup}
                isSystem={isSystem}
                perspective={perspective}
                direction={direction}
                userColor={userColor}
                chatType={chatType}
                currentUserId={this.currentUserId}
                fileData={fileData}
                onDownload={onDownload}
                onPreview={onPreview}
            />
        );
    }
}