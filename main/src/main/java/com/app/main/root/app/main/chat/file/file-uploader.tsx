import React, { Component } from "react";
import { SessionManager } from "../_session/session-manager";
import { ApiClientController } from "../_api-client/api-client-controller";
import { CacheServiceClient } from "@/app/_cache/cache-service-client";

interface Props {
    apiClientController: ApiClientController;
    onUploadSuccess?: (res: any) => void;
    onUploadError?: (err: Error) => void;
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

            const fileService = await this.props.apiClientController.getFileService();
            const res = await fileService.uploadFile(
                file,
                sessionData.userId,
                "root"
            );
            if(res.success) {
                console.log('FILE UPLOADED!');
                const cacheService = CacheServiceClient.getInstance();
                await cacheService.invalidateFolderCache(sessionData.userId, "root");
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

    private triggerFileInput = (): void => {
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

                <button
                    onClick={this.triggerFileInput}
                    disabled={isUploading}
                    style={{
                        cursor: isUploading ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isUploading ? `Uploading... ${uploadProgress}` : 'Upload'}
                </button>

                {isUploading && (
                    <div>
                        <progress value={uploadProgress} max="100" style={{ width: '100%' }}></progress>
                    </div>
                )}
            </div>
        )
    }
}