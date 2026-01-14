import React, { useState, useEffect } from "react";
import { GroupManager } from "../group-manager";

interface GroupMember {
    id: string;
    username: string;
}

interface GroupMembersInterfaceProps {
    groupId: string;
    groupName: string;
    groupManager: GroupManager;
    chatController: any;
    onClose: () => void;
}

export const GroupMembersInterface: React.FC<GroupMembersInterfaceProps> = ({
    groupId,
    groupName,
    groupManager,
    chatController,
    onClose
}) => {
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [showAddUser, setShowAddUser] = useState(false);
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [pollingLoading, setPollingLoading] = useState(false);
    const [selectedContact, setSelectedContact] = useState<string>('');
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

    const isLoading = loading || pollingLoading;

    useEffect(() => {
        console.log('GroupMembersInterface mounted for group:', groupId);
        loadGroupMembers();
        loadContacts();
        getCurrentUserId();
        startPolling();
        
        return () => {
            console.log('stopping polling');
            stopPolling();
        };
    }, [groupId]);

    /**
     * Start Polling
     */
    const startPolling = () => {
        console.log('Starting polling for group members');

        stopPolling();
        
        const interval = setInterval(async () => {
            try {
                await pollForGroupMembers();
            } catch(err) {
                console.error('Error polling for group members:', err);
            }
        }, 3000);
        
        setPollingInterval(interval);
    };

    /**
     * Stop Polling
     */
    const stopPolling = () => {
        if(pollingInterval) {
            console.log('Stopping polling interval');
            clearInterval(pollingInterval);
            setPollingInterval(null);
        }
    };

    /**
     * Poll for Group Members
     */
    const pollForGroupMembers = async () => {
        try {
            setPollingLoading(true);
            const currentMembers = await groupManager.getGroupMembers(groupId);
            
            if(hasMembersChanged(members, currentMembers)) {
                console.log('Group members updated, refreshing list');
                setMembers(currentMembers);
                
                const event = new CustomEvent('group-members-updated', {
                    detail: { 
                        groupId, 
                        members: currentMembers,
                        timestamp: new Date().toISOString()
                    }
                });
                window.dispatchEvent(event);
            }
        } catch(err) {
            console.error('Failed to poll group members:', err);
        } finally {
            setPollingLoading(false);
        }
    };

    const hasMembersChanged = (oldMembers: GroupMember[], newMembers: GroupMember[]): boolean => {
        if(oldMembers.length !== newMembers.length) return true;
        
        const oldIds = oldMembers.map(m => m.id).sort();
        const newIds = newMembers.map(m => m.id).sort();
        
        return !oldIds.every((id, index) => id === newIds[index]);
    };

    const getCurrentUserId = async () => {
        try {
            const userId = groupManager.userId || chatController.userId;
            setCurrentUserId(userId || '');
        } catch(err) {
            console.error('Failed to get current user ID', err);
        }
    }

    const loadGroupMembers = async () => {
        console.log('loadGroupMembers called');
        try {
            setLoading(true);
            console.log('Loading group members for group:', groupId);
            const groupMembers = await groupManager.getGroupMembers(groupId);
            console.log('Group members loaded:', groupMembers);
            setMembers(groupMembers);
        } catch(err) {
            console.error('Failed to load group members', err);
            setMembers([]);
        } finally {
            setLoading(false);
            console.log('Loading state set to false');
        }
    }

    const loadContacts = async () => {
        try {
            const contactList = await groupManager.dashboard?.contactService?.getContacts();
            setContacts(contactList || []);
        } catch(err) {
            console.error('Failed to load contacts: ', err);
        }
    }

    /**
     * Handle Add User
     */
    const handleAddUser = async () => {
        if(!selectedContact) return;
        setLoading(true);

        try {
            await groupManager.addUserToGroup(groupId, selectedContact);
            await loadGroupMembers();
            setShowAddUser(false);
            setSelectedContact('');
        } catch(err: any) {
            console.error('Failed to add user: ', err.message);
        } finally {
            setLoading(false);
        }
    }

    const handleRemoveUser = async (id: string, username: string) => {
        setLoading(true);
        try {
            await groupManager.removeUserFromGroup(groupId, id, username);
            await loadGroupMembers();
        } catch(err: any) {
            console.error('Failed to remove member:', err.message);
        } finally {
            setLoading(false);
        }
    }

    const availableContacts = contacts.filter(c =>
        !members.some(m => m.id === c.id)
    );

    return (
        <div className="group-members-interface overlay">
            <div className="group-members-modal">
                {/* Header */}
                <div className="modal-header">
                    <h2>{groupName} - Members</h2>
                    <div className="header-actions">
                        <button className="close-button" onClick={onClose}>X</button>
                    </div>
                </div>

                {/* Members List */}
                <div className="members-section">
                    <div className="section-header">
                        <h3>Group Members ({members.length})</h3>
                        <button 
                            className="btn-add-member"
                            onClick={() => setShowAddUser(true)}
                            disabled={isLoading}
                        >
                            Add Members
                        </button>
                    </div>
                    
                    <div className="members-list">
                        {members.map(member => (
                            <div key={member.id} className="member-item">
                                <div className="member-info">
                                    <span className="username">
                                        {member.username || member.id}
                                    </span>
                                    {member.id === currentUserId && (
                                        <span className="you-badge">(You)</span>
                                    )}
                                </div>
                                <div className="member-actions">
                                    {member.id !== currentUserId && (
                                        <button 
                                            className="btn-remove-member"
                                            onClick={() => handleRemoveUser(member.id, member.username || member.id)}
                                            disabled={isLoading}
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Add User Section */}
                {showAddUser && (
                    <div className="add-user-section">
                        <h3>Add User to Group</h3>
                        
                        {availableContacts.length === 0 ? (
                            <p className="no-contacts">No available contacts to add</p>
                        ) : (
                            <>
                                <select 
                                    value={selectedContact}
                                    onChange={(e) => setSelectedContact(e.target.value)}
                                    className="contact-select"
                                    disabled={isLoading}
                                >
                                    <option value="">Select a contact...</option>
                                    {availableContacts.map(contact => (
                                        <option key={contact.id} value={contact.id}>
                                            {contact.username || contact.id}
                                        </option>
                                    ))}
                                </select>
                                
                                <div className="add-user-actions">
                                    <button 
                                        onClick={handleAddUser}
                                        disabled={!selectedContact || isLoading}
                                        className="btn-confirm-add"
                                    >
                                        {isLoading ? 'Adding...' : 'Add to Group'}
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setShowAddUser(false);
                                            setSelectedContact('');
                                        }}
                                        className="btn-cancel-add"
                                        disabled={isLoading}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}