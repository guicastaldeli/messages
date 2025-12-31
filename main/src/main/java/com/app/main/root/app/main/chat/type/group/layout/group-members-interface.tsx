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
    const [selectedContact, setSelectedContact] = useState<string>('');

    useEffect(() => {
        loadGroupMembers();
        loadContacts();
    }, [groupId]);

    const loadGroupMembers = async () => {
        try {
            const groupMembers = await groupManager.getGroupMembers(groupId);
            setMembers(groupMembers);
        } catch(err) {
            console.error('Failed to load contacts', err);
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

    /*
    ** Handle Add User
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

    /*
    ** Handle Remove User
    */
    const handleRemoveUser = async (id: string, username: string) => {
        try {
            await groupManager.removeUserFromGroup(groupId, id, username);
            await loadGroupMembers();
        } catch(err: any) {
            console.error('Failed to remove member:', err.message);
        }
    }

    /*
    ** Available Contacts
    */
    const availableContacts = contacts.filter(c =>
        !members.some(m => m.id === c.id)
    );

    return (
        <div className="group-members-interface overlay">
            <div className="group-members-modal">
                {/* Header */}
                <div className="modal-header">
                    <h2>{groupName} - Members</h2>
                    <button className="close-button" onClick={onClose}>X</button>
                </div>

                {/* Members List */}
                <div className="members-section">
                    <div className="section-header">
                        <h3>Group Members ({members.length})</h3>
                        <button 
                            className="btn-add-member"
                            onClick={() => setShowAddUser(true)}
                        >
                            Add Members
                        </button>
                    </div>
                    
                    <div className="members-list">
                        {members.length === 0 ? (
                            <p className="no-members">No members in this group</p>
                        ) : (
                            members.map(member => (
                                <div key={member.id} className="member-item">
                                    <div className="member-info">
                                        <span className="username">
                                            {member.username || member.id}
                                        </span>
                                    </div>
                                    <div className="member-actions">
                                        <button 
                                            className="btn-remove-member"
                                            onClick={() => handleRemoveUser(member.id, member.username || member.id)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
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
                                        disabled={!selectedContact || loading}
                                        className="btn-confirm-add"
                                    >
                                        {loading ? 'Adding...' : 'Add to Group'}
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setShowAddUser(false);
                                            setSelectedContact('');
                                        }}
                                        className="btn-cancel-add"
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