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
    const [managerState, setManagerState] = useState({
        showCreationForm: false,
        showJoinForm: false,
        showGroup: false,
        hideGroup: false,
        groupName: ''
    });

    useEffect(() => {
        if(!groupManager || !groupManager.dashboard) throw new Error('err');

        groupManager.dashboard.setStateChange((state: any) => {
            setManagerState(state);
        });

        return () => {
            groupManager.dashboard.setStateChange(() => {});
        }
    }, [groupManager]);

    /*
    ** Group Preview
    */
    const handleGroupPreview = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const info = await groupManager.info(groupId);
            setGroupInfo(info);
            setShowGroupPreview(true);
        } catch(err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }

    /*
    ** Handle Join
    */
    const handleJoin = async () => {
        try {
            await groupManager.join(groupId, inviteCode);
        } catch(err) {
            console.log(err);
            throw new Error('Failed to create');
        }
    }

    /* Back to Form */
    const handleBackToForm = () => {
        setShowGroupPreview(false);
        setGroupInfo(null);
    }
    
    /* Render */
    return (
        <>
            {mode === 'join' && (
                <div className="join-group-form">
                    <div id="form-header">
                        <button className="close-button" onClick={onError}>Close</button>
                        <h3>Join Group</h3>
                    </div>

                    {!showGroupPreview ? (
                        <div className="form-content">
                            <div id="form-input">
                                <label htmlFor="groupId" style={{ fontWeight: "bolder" }}>Link:</label>
                                <div id="form-input">
                                    <label htmlFor="inviteCode">Invite Code: </label>
                                    <input 
                                        type="text"
                                        id="inviteCodeInput"
                                        value={inviteCode}
                                        onChange={(e) => setInviteCode(e.target.value)}
                                        placeholder="Enter Invite Code!"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="error-message">
                                    {error}
                                </div>
                            )}

                            <div className="form-actions">
                                <button
                                    onClick={handleGroupPreview}
                                    disabled={isLoading}
                                    id="preview-button"
                                >
                                    {isLoading ? 'Checking...' : 'Preview Group'}
                                </button>
                                <button
                                    onClick={onError}
                                    disabled={isLoading}
                                    id="cancel-button"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="group-preview">
                            <div id="preview-header">
                                <button onClick={handleBackToForm} id="back-button">Back</button>
                            </div>

                            {groupInfo && (
                                <div className="group-info">
                                    <div id="group-name">{groupInfo.name}</div>
                                    <div id="group-details">
                                        <div id="detail-item">
                                            <h2>Group ID:</h2>
                                            <span>{groupInfo.id}</span>
                                        </div>
                                        <div id="detail-item">
                                            <h2>Members:</h2>
                                            <span>{groupInfo.memberCount || groupInfo.members?.length}</span>
                                        </div>
                                        <div id="detail-item">
                                            <h2>Created:</h2>
                                            <span>
                                                {new Date(groupInfo.createdAt).toLocaleDateString()}
                                            </span>
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
                                <button
                                    onClick={handleBackToForm}
                                    disabled={isLoading}
                                    id="cancel-button"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    )
}