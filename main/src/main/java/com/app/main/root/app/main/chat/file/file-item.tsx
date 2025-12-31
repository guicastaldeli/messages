import React, { Component } from "react";
import { ApiClientController } from "../_api-client/api-client-controller";
import { Preview } from "./preview";

type FileType =
    'image' |
    'video' |
    'document' |
    'other';

type SortType =
    'name' | 
    'date' | 
    'size' | 
    'type';

export interface Item {
    fileId: string;
    originalFileName: string;
    fileSize: number;
    mimeType: string;
    fileType: FileType;
    parentFolderId: string;
    uploadedAt: string;
    lastModified: string;
    isDeleted?: boolean; 
}

export interface Response {
    success: boolean;
    data: any[];
    total?: number;
    page?: number;
    pageSize?: number;
}

interface Props {
    apiClientController: ApiClientController;
    userId: string;
    parentFolderId?: string;
    onFileSelect?: (file: Item) => void;
    onFileDelete?: (fileId: string) => void;
    onRefresh?: () => void;
}

interface State {
    files: Item[];
    isLoading: boolean;
    error: string | null;
    currentPage: number;
    totalFiles: number;
    pageSize: number;
    selectedFiles: Set<string>
    viewMode: 'grid' | 'list';
    sortBy: SortType;
    sortOrder: 'asc' | 'desc';
    previewFile: Item | null;
    previewContent: string | null;
    previewLoading: boolean;
    previewError: string | null;  
}

export function mapToItem(file: any): Item {
    return {
        fileId: file.file_id,
        originalFileName: file.original_filename,
        fileSize: file.file_size,
        mimeType: file.mime_type,
        fileType: file.file_type,
        parentFolderId: file.parent_folder_id,
        uploadedAt: file.uploaded_at,
        lastModified: file.last_modified,
        isDeleted: file.is_deleted
    };
}

export class FileItem extends Component<Props, State> {
    private apiClientController: ApiClientController;
    private observer: IntersectionObserver | null = null;
    private sentinelRef = React.createRef<HTMLDivElement>();
    private containerRef = React.createRef<HTMLDivElement>();
    private hasMore = true;
    private isLoadingMore = false;
    
    constructor(props: Props) {
        super(props);
        this.state = {
            files: [],
            isLoading: false,
            error: null,
            currentPage: 0,
            totalFiles: 0,
            pageSize: 5,
            selectedFiles: new Set(),
            viewMode: 'grid',
            sortBy: 'date',
            sortOrder: 'desc',
            previewFile: null,
            previewContent: null,
            previewLoading: false,
            previewError: null
        }
        this.apiClientController = this.props.apiClientController;
        
        this.handleFileSelect = this.handleFileSelect.bind(this);
        this.handleFileDelete = this.handleFileDelete.bind(this);
        this.handleFileCheckbox = this.handleFileCheckbox.bind(this);
        this.handleSelectAll = this.handleSelectAll.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        this.changeSort = this.changeSort.bind(this);
        this.handlePreviewFile = this.handlePreviewFile.bind(this);
        this.closePreview = this.closePreview.bind(this);
    }

    async componentDidMount() {
        await this.loadFiles();
        this.setupIntersectionObserver();
    }

    async componentDidUpdate(prevProps: Props): Promise<void> {
        if(prevProps.parentFolderId !== this.props.parentFolderId ||
            prevProps.userId !== this.props.userId
        ) {
            await this.resetAndLoad();
        }
    }

    componentWillUnmount() {
        if(this.observer) {
            this.observer.disconnect();
        }
    }

    private setupIntersectionObserver() {
        if(typeof IntersectionObserver === 'undefined') return;

        this.observer = new IntersectionObserver(
            (entries) => {
                const sentinel = entries[0];
                if(
                    sentinel.isIntersecting && 
                    !this.isLoadingMore && 
                    this.hasMore &&
                    this.state.files.length > 0
                ) {
                    this.loadMoreFiles();
                }
            },
            {
                root: this.containerRef.current,
                rootMargin: '100px',
                threshold: 1.0
            }
        );

        if(this.sentinelRef.current) {
            this.observer.observe(this.sentinelRef.current);
        }
    }

    /**
     * Handle Download
     */
    private async handleDownloadFile(file: Item): Promise<void> {
        try {
            const fileService = await this.apiClientController.getFileService();
            const res = await fileService.downloadFile(this.props.userId, file.fileId);
            
            if(res.success && res.data) {
                if(res.data.content && res.data.filename) {
                    const blob = new Blob([res.data.content], {
                        type: res.data.mimeType || 'application/octet-stream'
                    });
                    this.createDownloadEl(blob, res.data.filename);
                } else if(res.data instanceof Blob) {
                    this.createDownloadEl(res.data, file.originalFileName);
                } else if(
                    res.data instanceof ArrayBuffer || 
                    res.data instanceof Uint8Array
                ) {
                    const blob = new Blob([new Uint8Array(res.data)], {
                        type: file.mimeType || 'application/octet-stream'
                    });
                    this.createDownloadEl(blob, file.originalFileName);
                } else if(typeof res.data === 'string') {
                    const blob = new Blob([res.data], {
                        type: file.mimeType || 'text/plain'
                    });
                    this.createDownloadEl(blob, file.originalFileName);
                } else {
                    console.error('Unsupported download response format:', res.data);
                }
            } else {
                throw new Error(res.error || 'Download failed');
            }
        } catch (err: any) {
            console.error('Error downloading file:', err);
        }
    }

    private createDownloadEl(blob: Blob, filename: string): void {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * Reset and Load
     */
    private async resetAndLoad() {
        this.hasMore = true;
        this.isLoadingMore = false;
        this.setState({
            files: [],
            currentPage: 0,
            totalFiles: 0
        }, () => {
            this.loadFiles();
        });
    }

    /**
     * Load Files
     */
    private async loadFiles() {
        this.setState({ isLoading: true, error: null });

        try {
            const fileService = await this.apiClientController.getFileService();
            const res = await fileService.listFiles(
                this.props.userId,
                this.props.parentFolderId || 'root'
            );
            
            const page = 0;
            await this.handleFileResponse(res, page);
        } catch(err: any) {
            this.setState({
                error: err.message,
                isLoading: false
            });
            console.error('Error loading files', err);
        }
    }

    /**
     * Load More Files
     */
    private async loadMoreFiles() {
        if(this.isLoadingMore || !this.hasMore) return;
        this.isLoadingMore = true;
        
        const nextPage = this.state.currentPage + 1;
        console.log('Loading more files, nextPage:', nextPage);

        try {
            const fileService = await this.apiClientController.getFileService();
            const res = await fileService.listFiles(
                this.props.userId,
                this.props.parentFolderId || 'root',
                nextPage
            );
            
            await this.handleFileResponse(res, nextPage);
        } catch(err: any) {
            console.error('Error loading more files', err);
        } finally {
            this.isLoadingMore = false;
        }
    }

    /**
     * Handle File Response
     */
    private async handleFileResponse(res: any, requestedPage: number) {
        if(res.success) {
            const filesData = 
                Array.isArray(res.data) ?
                res.data :
                (res.data && res.data.files ? res.data.files : []);

            const newFiles = filesData.map(mapToItem);
                
            const existingIds = new Set(this.state.files.map(f => f.fileId));
            const uniqueNewFiles = newFiles.filter((file: any) => !existingIds.has(file.fileId));
            if(uniqueNewFiles.length === 0) {
                this.hasMore = false;
                this.isLoadingMore = false;
                return;
            }
                
            const allFiles = [...this.state.files, ...uniqueNewFiles];
            const sortedFiles = this.sortFiles(allFiles);
            const pagination = res.data?.pagination || res.pagination;
                
            const totalFiles = pagination?.total || 0;
            const loadedFilesCount = sortedFiles.length;
            this.hasMore = pagination?.hasMore !== false && loadedFilesCount < totalFiles;

            this.setState({
                files: sortedFiles,
                isLoading: false,
                currentPage: requestedPage,
                totalFiles: totalFiles,
                error: null
            }, () => {
                setTimeout(() => {
                    if(this.sentinelRef.current && this.observer) {
                        this.observer.disconnect();
                        this.observer.observe(this.sentinelRef.current);
                    }
                }, 100);
            });
        } else {
            throw new Error(res.error || 'Failed to load files!');
        }
    }

    /**
     * Sort Files
     */
    private sortFiles(files: Item[]): Item[] {
        return [...files].sort((a, b) => {
            let comparison = 0;
            switch(this.state.sortBy) {
                case 'name':
                    comparison = a.originalFileName.localeCompare(b.originalFileName);
                    break;
                case 'date':
                    comparison = 
                        new Date(a.uploadedAt).getTime() - 
                        new Date(b.uploadedAt).getTime();
                    break;
                case 'size':
                    comparison = a.fileSize - b.fileSize;
                    break;
                case 'type':
                    comparison = a.fileType.localeCompare(b.fileType);
                    break;
            }

            return this.state.sortOrder === 'asc' ? comparison : -comparison;
        });
    }

    private formatFileSize(bytes: number): string {
        if(bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    private formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    private getFileIcon(fileType: string, mimeType: string): string {
        switch(fileType) {
            case 'image':
                return 'IMG';
            case 'video':
                return 'VID';
            case 'audio':
                return 'AUD';
            case 'document':
                if(mimeType.includes('pdf')) return 'PDF';
                if(mimeType.includes('word') || mimeType.includes('document')) return 'DOC';
                return 'DOC';
            default:
                return 'DOC';
        }
    }

    /**
     * Handle File Select
     */
    private handleFileSelect(file: Item): void {
        if(this.props.onFileSelect) {
            this.props.onFileSelect(file);
        }
    }

    /**
     * Handle File Delete
     */
    private async handleFileDelete(fileId: string, e: React.MouseEvent): Promise<void> {
        e.stopPropagation();
        if(!confirm('Delete??')) return;

        try {
            const fileService = await this.apiClientController.getFileService();
            const res = await fileService.deleteFile(fileId, this.props.userId);
            if(res.success) {
                const updatedFiles = this.state.files.filter(f => f.fileId !== fileId);
                this.setState({ files: updatedFiles });

                if(this.props.onFileDelete) this.props.onFileDelete(fileId);
                if(this.props.onRefresh) this.props.onRefresh();
            }
        } catch(err) {
            console.error('Error deleting file', err);
            throw err;
        }
    }

    /**
     * Handle Checkbox
     */
    private handleFileCheckbox(fileId: string, checked: boolean) {
        const newSelected = new Set(this.state.selectedFiles);
        if(checked) {
            newSelected.add(fileId);
        } else {
            newSelected.delete(fileId);
        }
        this.setState({ selectedFiles: newSelected });
    }

    /**
     * Handle Select All
     */
    private handleSelectAll() {
        const allFilesIds = this.state.files.map(f => f.fileId);
        const newSelected = new Set<string>();
        
        if(this.state.selectedFiles.size !== allFilesIds.length) {
            allFilesIds.forEach(id => newSelected.add(id));
        }
        this.setState({ selectedFiles: newSelected });
    }

    /**
     * Handle Scroll
     */
    private handleScroll(e: React.UIEvent<HTMLDivElement>) {
        if(typeof IntersectionObserver !== 'undefined') return;
        
        const container = e.currentTarget;
        const { scrollTop, scrollHeight, clientHeight } = container;
        const scrollBottom = scrollHeight - scrollTop - clientHeight;
        
        if(scrollBottom < 100 && !this.isLoadingMore && this.hasMore) {
            this.loadMoreFiles();
        }
    }

    /**
     * Change Sort
     */
    private changeSort(sortBy: SortType) {
        const newSortOrder = 
            this.state.sortBy === sortBy && 
            this.state.sortOrder === 'desc' ? 'asc' : 'desc';
        
        this.setState({
            sortBy,
            sortOrder: newSortOrder
        }, () => {
            const sortedFiles = this.sortFiles(this.state.files);
            this.setState({ files: sortedFiles });
        });
    }

    /**
     * Refresh Files
     */
    public async refreshFiles(): Promise<void> {
        await this.resetAndLoad();
    }

    /**
     * Handle File Preview
     */
    private async handlePreviewFile(file: Item): Promise<void> {
        this.setState({
            previewFile: file,
            previewLoading: true,
            previewError: null,
            previewContent: null
        });

        try {
            const fileService = await this.apiClientController.getFileService();
            const res = await fileService.downloadFile(this.props.userId, file.fileId);
            
            if(res.success && res.data) {
                if(res.data.content) {
                    if(typeof res.data.content === 'string') {
                        this.setState({
                            previewContent: res.data.content,
                            previewLoading: false
                        });
                    } else if(
                        res.data.content instanceof ArrayBuffer || 
                        res.data.content instanceof Uint8Array
                    ) {
                        let uint8Array: Uint8Array;
                        if(res.data.content instanceof ArrayBuffer) {
                            uint8Array = new Uint8Array(res.data.content);
                        } else {
                            uint8Array = res.data.content;
                        }
                        
                        const binaryString = uint8Array.reduce(
                            (data, byte) => data + 
                            String.fromCharCode(byte),
                            ''
                        );
                        const base64Content = btoa(binaryString);
                        
                        this.setState({
                            previewContent: base64Content,
                            previewLoading: false
                        });
                    } else if(res.data.content instanceof Blob) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const base64data = reader.result as string;
                            const base64Content = base64data.split(',')[1] || base64data;
                            this.setState({
                                previewContent: base64Content,
                                previewLoading: false
                            });
                        };
                        reader.readAsDataURL(res.data.content);
                    } else {
                        this.setState({
                            previewContent: String(res.data.content),
                            previewLoading: false
                        });
                    }
                } else {
                    if(res.data instanceof ArrayBuffer || 
                        res.data instanceof Uint8Array) {
                        
                        let uint8Array: Uint8Array;
                        if(res.data instanceof ArrayBuffer) {
                            uint8Array = new Uint8Array(res.data);
                        } else {
                            uint8Array = res.data;
                        }
                        
                        const binaryString = uint8Array.reduce(
                            (data, byte) => data + String.fromCharCode(byte),
                            ''
                        );
                        const base64Content = btoa(binaryString);
                        
                        this.setState({
                            previewContent: base64Content,
                            previewLoading: false
                        });
                    } else {
                        this.setState({
                            previewContent: String(res.data),
                            previewLoading: false
                        });
                    }
                }
            } else {
                throw new Error(res.error || 'Failed to download file');
            }
        } catch (err: any) {
            console.error('Error previewing file:', err);
            this.setState({
                previewError: err.message || 'Failed to load file for preview',
                previewLoading: false
            });
        }
    }

    /**
     * Close Preview
     */
    private closePreview(): void {
        this.setState({
            previewFile: null,
            previewContent: null,
            previewError: null
        });
    }

    render() {
        const { 
            isLoading,
            error,
            files,
            viewMode,
            selectedFiles,
            previewFile,
            previewContent,
            previewLoading,
            previewError
        } = this.state;

        if(isLoading && files.length === 0) {
        return (
                <div className="file-list-loading">
                    <div className="spinner"></div>
                    <p>Loading files...</p>
                </div>
            );
        }
        
        if(error && files.length === 0) {
            return (
                <div className="file-list-error">
                    <p>Error: {error}</p>
                    <button onClick={() => this.loadFiles()}>Retry</button>
                </div>
            );
        }

        if(files.length === 0 && !isLoading) {
            return (
                <div className="file-list-empty">
                    <div className="empty-icon">EMPTY</div>
                    <h3>No files yet</h3>
                    <p>Upload your first file to get started!</p>
                </div>
            );
        }

        return (
            <div 
                className="file-list-container"
                ref={this.containerRef}
                onScroll={this.handleScroll}
                style={{ height: '100%', overflow: 'auto' }}
            >
                {/* Toolbar */}
                <div className="file-list-toolbar">
                    <div className="toolbar-left">
                        <input 
                            type="checkbox"
                            checked={selectedFiles.size === files.length && files.length > 0}
                            onChange={this.handleSelectAll}
                            className="select-all-checkbox"
                        />
                        <span>{selectedFiles.size} selected</span>
                    </div>
                    
                    <div className="toolbar-right">
                        <div className="view-toggle">
                            <button 
                                className={viewMode === 'grid' ? 'active' : ''}
                                onClick={() => this.setState({ viewMode: 'grid' })}
                            >
                                Grid
                            </button>
                            <button 
                                className={viewMode === 'list' ? 'active' : ''}
                                onClick={() => this.setState({ viewMode: 'list' })}
                            >
                                List
                            </button>
                        </div>
                        
                        <div className="sort-options">
                            <span>Sort by:</span>
                            <select 
                                value={this.state.sortBy}
                                onChange={(e) => this.changeSort(e.target.value as SortType)}
                            >
                                <option value="name">Name</option>
                                <option value="date">Date</option>
                                <option value="size">Size</option>
                                <option value="type">Type</option>
                            </select>
                            <button 
                                onClick={() => this.setState({ 
                                    sortOrder: this.state.sortOrder === 'asc' ? 'desc' : 'asc' 
                                }, () => {
                                    const sortedFiles = this.sortFiles(this.state.files);
                                    this.setState({ files: sortedFiles });
                                })}
                            >
                                {this.state.sortOrder === 'asc' ? '↑' : '↓'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* File List */}
                <div className={`file-list ${viewMode}`}>
                    {files.map(file => (
                        <div 
                            key={file.fileId}
                            className={`file-item ${selectedFiles.has(file.fileId) ? 'selected' : ''}`}
                        >
                            <div className="file-item-checkbox">
                                <input 
                                    type="checkbox"
                                    checked={selectedFiles.has(file.fileId)}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        this.handleFileCheckbox(file.fileId, e.target.checked);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                            
                            <div className="file-item-icon">
                                {this.getFileIcon(file.fileType, file.mimeType)}
                            </div>
                            
                            <div className="file-item-info">
                                <div 
                                    className="file-name clickable"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        this.handlePreviewFile(file);
                                    }}
                                    title="Click to preview"
                                >
                                    {file.originalFileName}
                                </div>
                                <div className="file-details">
                                    <span className="file-size">{this.formatFileSize(file.fileSize)}</span>
                                    <span className="file-date">{this.formatDate(file.uploadedAt)}</span>
                                    <span className="file-type">{file.fileType}</span>
                                </div>
                            </div>
                            
                            <div className="file-item-actions">
                                <button 
                                    className="action-btn download-btn"
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        console.log('Downloading...', file.fileId);
                                        await this.handleDownloadFile(file);
                                    }}
                                    title="Download"
                                >
                                    Download
                                </button>
                                <button 
                                    className="action-btn delete-btn"
                                    onClick={(e) => this.handleFileDelete(file.fileId, e)}
                                    title="Delete"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                    
                    {/* Loading Sentinel */}
                    <div 
                        ref={this.sentinelRef}
                        style={{ 
                            height: '1px',
                            visibility: 'hidden',
                            marginTop: '10px'
                        }}
                    />
                    
                    {/* Loading More Indicator */}
                    {this.isLoadingMore && (
                        <div className="loading-more">
                            <div className="spinner small"></div>
                            <p>Loading more files...</p>
                        </div>
                    )}
                    
                    {/* End of List */}
                    {!this.hasMore && files.length > 0 && (
                        <div className="end-of-list">
                            <p>No more files to load</p>
                        </div>
                    )}
                </div>

                {/* Preview */}
                {previewFile && (
                    <Preview
                        file={previewFile}
                        content={previewContent}
                        isLoading={previewLoading}
                        error={previewError}
                        onClose={this.closePreview}
                        onDownload={async (file) => {
                            try {
                                const fileService = await this.apiClientController.getFileService();
                                await fileService.downloadFile(this.props.userId, file.fileId);
                            } catch (err) {
                                console.error('Error downloading file:', err);
                            }
                        }}
                    />
                )}
            </div>
        );
    }
}