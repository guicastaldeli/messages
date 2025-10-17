import React, { useState, useRef } from "react";
import { GroupManager } from "./group-manager";

interface Props {
    groupManager: GroupManager;
    onJoinSucss: (data: any) => void;
    onCancel: () => void;
}

export const JoinGroupLayout: React.FC<Props> = ({
    groupManager,
    onJoinSucss,
    onCancel
}) => {
    const [groupId, setGroupId] = useState('');
    const [groupInfo, setGroupInfo] = useState<any>(null);
    const [showGroupPreview, setShowGroupPreview] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /*
    ** Group Preview
    */
    const handleGroupPreview = async () => {
        if(!groupId.trim()) {
            setError('Please enter a Group Id');
            return;
        }

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
        if(!groupId.trim()) {
            setError('Group ID is required');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await groupManager.join(groupId, inviteCode);
            const lmTime = new Date().toISOString();
            const chatItem = {
                id: result.groupId,
                name: result.groupName,
                type: 'group',
                unreadCount: 0,
                lastMessage: 'You joined',
                lastMessageTime: lmTime,
                members: result.members
            }
            const chatEvent = new CustomEvent('chat-item-added', { detail: chatItem });
            window.dispatchEvent(chatEvent);

            const activeChatEvent = new CustomEvent('chat-activated', {
                detail: {
                    id: result.groupId,
                    name: result.groupName,
                    type: 'group'
                }
            });
            window.dispatchEvent(activeChatEvent);

            onJoinSucss(result);
        } catch(err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }

    /* Back to Form */
    const handleBackToForm = () => {
        setShowGroupPreview(false);
        setGroupInfo(null);
    }

    /* Clear Form */
    const clearForm = () => {
        setGroupId('');
        setInviteCode('');
        setError(null);
        setGroupInfo(null);
        setShowGroupPreview(false);
    }

    /* Render */
    return (
        <div className="join-group-form">
            <div id="form-header">
                <h3>Join Group</h3>
                <button className="close-button" onClick={onCancel}>Close</button>
            </div>

            {!showGroupPreview ? (
                <div className="form-content">
                    <div id="form-input">
                        <label htmlFor="groupId">Invite Link</label>
                        <div id="form-input">
                            <label htmlFor="inviteCode">Invite Code</label>
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
                            <span id="error-icon">Escalada</span>
                            {error}
                        </div>
                    )}

                    <div className="form-actions">
                        <button
                            onClick={handleGroupPreview}
                            disabled={isLoading || !groupId.trim()}
                            id="preview-button"
                        >
                            {isLoading ? 'Checking...' : 'Preview Group'}
                        </button>
                        <button
                            onClick={onCancel}
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
    )
}