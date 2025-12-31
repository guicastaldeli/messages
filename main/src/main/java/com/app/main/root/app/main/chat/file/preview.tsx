import { useState } from "react";
import { Item } from "./file-item";

interface Props {
    file: Item;
    content: string | null;
    isLoading: boolean;
    error: string | null;
    onClose: () => void;
    onDownload: (file: Item) => Promise<void>;
}

export const Preview: React.FC<Props> = ({
    file,
    content,
    isLoading,
    error,
    onClose,
    onDownload
}) => {
    const [isFullscreen, setIsFullscreen] = useState(false);

    const renderContent = () => {
        if(isLoading) {
            return (
                <div className="preview-loading">
                    <div className="spinner"></div>
                    <p>Loading file...</p>
                </div>
            );
        }

        if(error) {
            return (
                <div className="preview-error">
                    <p>Error: {error}</p>
                    <button onClick={() => onDownload(file)}>Try Download</button>
                </div>
            );
        }

        if(!content) {
            return (
                <div className="preview-empty">
                    <p>No content to display</p>
                </div>
            );
        }

        switch (file.fileType) {
            case 'image':
                return (
                    <div className="image-preview">
                        <img 
                            src={`data:${file.mimeType};base64,${content}`}
                            alt={file.originalFileName}
                            style={{ 
                                maxWidth: '100%', 
                                maxHeight: '100%',
                                objectFit: 'contain' 
                            }}
                        />
                    </div>
                );
            case 'document':
                if(file.mimeType.includes('pdf')) {
                    return (
                        <div className="pdf-preview">
                            <iframe
                                src={`data:application/pdf;base64,${content}`}
                                title={file.originalFileName}
                                width="100%"
                                height="100%"
                            />
                        </div>
                    );
                } else if(
                    file.mimeType.includes('text') || 
                    file.mimeType.includes('json') ||
                    file.mimeType.includes('xml') ||
                    file.originalFileName.match(/\.(txt|json|xml|html|css|js)$/i)
                ) {
                    return (
                        <div className="text-preview">
                            <pre>{atob(content)}</pre>
                        </div>
                    );
                } else {
                    return (
                        <div className="unsupported-preview">
                            <p>Preview not available for this document type.</p>
                            <button onClick={() => onDownload(file)}>Download to view</button>
                        </div>
                    );
                }
            case 'video':
                return (
                    <div className="video-preview">
                        <video controls style={{ maxWidth: '100%', maxHeight: '100%' }}>
                            <source 
                                src={`data:${file.mimeType};base64,${content}`} 
                                type={file.mimeType}
                            />
                            Your browser does not support the video tag.
                        </video>
                    </div>
                );
            default:
                return (
                    <div className="generic-preview">
                        <p>Preview not available for this file type.</p>
                        <button onClick={() => onDownload(file)}>Download to view</button>
                    </div>
                );
        }
    };

    return (
        <div className={`preview-modal ${isFullscreen ? 'fullscreen' : ''}`}>
            <div className="preview-modal-overlay" onClick={onClose}></div>
            <div className="preview-modal-content">
                <div className="preview-modal-header">
                    <div className="preview-modal-title">
                        <span className="file-icon">
                            {getFileIcon(file.fileType, file.mimeType)}
                        </span>
                        <span className="file-name">{file.originalFileName}</span>
                        <span className="file-size">({formatFileSize(file.fileSize)})</span>
                    </div>
                    <div className="preview-modal-actions">
                        <button 
                            className="action-btn"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                        >
                            {isFullscreen ? "⤓" : "⤢"}
                        </button>
                        <button 
                            className="action-btn"
                            onClick={() => onDownload(file)}
                            title="Download"
                        >
                            ⬇
                        </button>
                        <button 
                            className="action-btn close-btn"
                            onClick={onClose}
                            title="Close"
                        >
                            ✕
                        </button>
                    </div>
                </div>
                
                <div className="preview-modal-body">
                    {renderContent()}
                </div>
                
                <div className="preview-modal-footer">
                    <div className="file-info">
                        <span>Type: {file.fileType}</span>
                        <span>MIME: {file.mimeType}</span>
                        <span>Uploaded: {formatDate(file.uploadedAt)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const formatFileSize = (bytes: number): string => {
    if(bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getFileIcon = (fileType: string, mimeType: string): string => {
    switch(fileType) {
        case 'image': return 'IMG';
        case 'video': return 'VID';
        case 'audio': return 'AUD';
        case 'document':
            if(mimeType.includes('pdf')) return 'PDF';
            if(mimeType.includes('word') || mimeType.includes('document')) return 'DOC';
            return 'DOC';
        default: return 'DOC';
    }
};