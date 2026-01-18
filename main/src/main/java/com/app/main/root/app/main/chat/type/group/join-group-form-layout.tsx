import React, { useState, useRef, useEffect } from "react";
import { GroupManager } from "./group-manager";
import { Props } from "./group-layout";

export const JoinGroupLayout: React.FC<Props> = ({
    groupManager,
    onSuccess,
    onError,
    mode
}) => {
    const [groupId, setGroupId] = useState('');
    const [groupInfo, setGroupInfo] = useState<any>(null);
    const [showGroupPreview, setShowGroupPreview] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Group Preview
     */
    const handleGroupPreview = async () => {
        if(!inviteCode.trim()) {
            setError('Please enter an invite code');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const info = await groupManager.info(inviteCode);
            setGroupInfo(info);
            setShowGroupPreview(true);
        } catch(err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Handle Join
     */
    const handleJoin = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await groupManager.join(inviteCode);
            setIsLoading(false);
            groupManager.currentGroupId = result.id;
            groupManager.currentGroupName = result.name;

            groupManager.dashboard?.updateState({
                showCreationForm: false,
                showJoinForm: false,
                showGroup: true,
                hideGroup: false,
                groupName: result.name
            });

            if(onSuccess) {
                const event = new CustomEvent('group-join-complete', { detail: result });
                onSuccess(event);
            }
        } catch(err) {
            console.log(err);
            setIsLoading(false);
            throw new Error('Failed to join');
        }
    }

    /* Close */
    const handleClose = () => {
        setShowGroupPreview(false);
        setGroupInfo(null);
        setError(null);
        setInviteCode('');
        setIsLoading(false);

        groupManager.dashboard?.updateState({
            showCreationForm: false,
            showJoinForm: false,
            showGroup: false,
            hideGroup: false,
            groupName: ''
        });
        if(groupManager.dashboard) {
            groupManager.dashboard.setState({ activeChat: null });
        }
        if(groupManager.root) {
            groupManager.root.unmount();
            groupManager.root = null;
        }
    }
    
    /* Render */
    return (
        <>
            {mode === 'join' && (
                <div className="join-group-form">
                    {!showGroupPreview ? (
                        <div className="form-content">
                            <div id="header">
                                <h3>Join Group</h3>
                            </div>
                            <div id="form-input">
                                <div id="form-input">
                                    <label htmlFor="inviteCode">Invite Code: </label>
                                    <input 
                                        type="text"
                                        id="inviteCodeInput"
                                        value={inviteCode}
                                        onChange={(e) => {
                                            setInviteCode(e.target.value);
                                            setError(null);
                                        }}
                                        placeholder="Enter Invite Code!"
                                        disabled={isLoading}
                                        style={{ borderColor: error ? 'rgb(209, 30, 30)' : '' }}
                                        className={error ? 'input-error' : ''}
                                    />
                                </div>
                                {error && (
                                    <div className="error-message">
                                        {error}
                                    </div>
                                )}
                            </div>

                            <div className="btn-actions">
                                <div className="form-actions">
                                    <button
                                        onClick={handleGroupPreview}
                                        disabled={isLoading}
                                        id="preview-button"
                                    >
                                        {isLoading ? 'Checking...' : 'Preview Group'}
                                    </button>
                                </div>

                                <button onClick={handleClose} id="back-button">Back</button>
                            </div>
                        </div>
                    ) : (
                        <div className="group-preview" style={{ backgroundColor: '#3f712bff' }}>
                            {groupInfo && (
                                <div className="group-info">
                                    <div id="group-details">
                                        <div id="detail-item">
                                            <h4>Group Name:</h4>
                                            <span>{groupInfo.name}</span>
                                        </div>
                                        <div id="detail-item">
                                            <h5>Members:</h5>
                                            <span>{groupInfo.memberCount || groupInfo.members?.length}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="actions">
                                <button
                                    onClick={handleJoin}
                                    disabled={isLoading}
                                    id="join-button"
                                >
                                    {isLoading ? 'Joining...' : 'Join Group'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    )
}