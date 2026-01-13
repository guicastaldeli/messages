import React, { useState, useEffect, useRef } from 'react';
import { ContactLayoutProps } from './contact-interface';

export const ContactLayout: React.FC<ContactLayoutProps> = ({ contactService }) => {
    const [contacts, setContacts] = useState<any[]>([]);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [showAddContact, setShowAddContact] = useState(false);
    const [usernameToAdd, setUsernameToAdd] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'contacts' | 'pending'>('contacts');
    const hasSubscribedRef = useRef(false);

    useEffect(() => {
        if(contactService && !hasSubscribedRef.current) {
            hasSubscribedRef.current = true;
            loadContacts();
            loadPendingRequests();
            setupEventListeners();
        }
    }, [contactService]);

    const setupEventListeners = () => {
        if(!contactService) return;

        /**
         * Contact Added
         */
        const handleContactAdded = (e: CustomEvent) => {
            const { contact } = e.detail;
            setContacts(prevContacts => {
                const contactExists = prevContacts.some(c => c.id === contact.id);
                if(!contactExists) {
                    return [...prevContacts, contact];
                }
                return prevContacts;
            });
        }

        /**
         * Contact Removed
         */
        const handleContactRemoved = (e: CustomEvent) => {
            const { contactId } = e.detail;
            setContacts(prevContacts =>
                prevContacts.filter(c => c.id !== contactId)
            );
        } 

        /**
         * Request Updated
         */
        const handleRequestUpdated = (e: CustomEvent) => {
            const { requestId, status } = e.detail;
            if(status === 'accepted') {
                setPendingRequests(prevRequests =>
                    prevRequests.filter(req => req.requestId !== requestId)
                );
                setTimeout(() => loadContacts(), 300);
            } else if(status === 'rejected') {
                setPendingRequests(prevRequests =>
                    prevRequests.filter(req => req.requestId !== requestId)
                );
            }
        }

        /**
         * Handle New Request
         */
        const handleNewRequest = (e: CustomEvent) => {
            const { request } = e.detail;
            setPendingRequests(prevRequests => {
                const requestExists = prevRequests.some(req => req.requestId === request.requestId);
                if(!requestExists) {
                    return [...prevRequests, request];
                }
                return prevRequests;
            });
        }

        /**
         * Handle Status Changes
         */
        const handleStatusChanged = (e: CustomEvent) => {
            const { contactId, isOnline } = e.detail;
            setContacts(prevContacts =>
                prevContacts.map(contact =>
                    contact.id === contactId 
                        ? { ...contact, isOnline }
                        : contact
                )
            );
        }

        /**
         * Handle Poll Update
         */
        const handlePollUpdate = (e: CustomEvent) => {
            const { contacts, pendingRequests } = e.detail;

            setContacts(prevContacts => {
                if(prevContacts.length !== contacts.length) {
                    console.log('ContactLayout: Updating contacts from poll');
                    return contacts;
                }
                return prevContacts;
            });
            setPendingRequests(prevRequests => {
                if(prevRequests.length !== pendingRequests.length) {
                    console.log('ContactLayout: Updating pending requests from poll');
                    return pendingRequests;
                }
                return prevRequests;
            });
        }

        window.addEventListener('contact-added', handleContactAdded as EventListener);
        window.addEventListener('contact-removed', handleContactRemoved as EventListener);
        window.addEventListener('contact-request-updated', handleRequestUpdated as EventListener);
        window.addEventListener('contact-request-received', handleNewRequest as EventListener);
        window.addEventListener('contact-poll-update', handlePollUpdate as EventListener);
        window.addEventListener('contact-status-changed', handleStatusChanged as EventListener);

        return () => {
            window.removeEventListener('contact-added', handleContactAdded as EventListener);
            window.removeEventListener('contact-removed', handleContactRemoved as EventListener);
            window.removeEventListener('contact-request-updated', handleRequestUpdated as EventListener);
            window.removeEventListener('contact-request-received', handleNewRequest as EventListener);
            window.removeEventListener('contact-poll-update', handlePollUpdate as EventListener);
            window.removeEventListener('contact-status-changed', handleStatusChanged as EventListener);
        }
    }

    /**
     * 
     * Load Contacts
     * 
     */
    const loadContacts = async () => {
        try {
            const contactList = await contactService.getContacts();
            setContacts(contactList);
        } catch(err) {
            console.error('Get contacts err', err);
        }
    }

    /**
     * 
     * Load Pending Requests
     * 
     */
    const loadPendingRequests = async () => {
        try {
            const requests = await contactService.getPendingRequests();
            setPendingRequests(requests);
        } catch(err) {
            console.error('Pending requests err', err);
        }
    }

    /**
     * Add Contact
     */
    const handleAddContact = async () => {
        if(!usernameToAdd.trim()) return;
        setLoading(true);

        try {
            await contactService.sendContactRequest(usernameToAdd.trim());
            setUsernameToAdd('');
            setShowAddContact(false);
            console.log('Contact request sent!');
            await loadPendingRequests();
        } catch(err: any) {
            console.log(`Failed to send request: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }

    /**
     * Response Request
     */
    const handleResponseRequest = async (requestId: string, accept: boolean) => {
        console.log('ContactLayout: handleResponseRequest called', { requestId, accept });
        try {
            await contactService.responseContactRequest(requestId, accept);
            console.log('ContactLayout: Response sent successfully');
            await loadPendingRequests();
            if(accept) {
                console.log('ContactLayout: Request accepted, reloading contacts');
                setTimeout(() => loadContacts(), 100);
            }
        } catch(err: any) {
            console.log(`ContactLayout: Failed to respond: ${err.message}`);
        }
    }

    /**
     * Remove Contact
     */
    const handleRemoveContact = async (contactId: string) => {
        if(confirm('Remove contact?')) {
            try {
                await contactService.removeContact(contactId);
                await loadContacts();
            } catch(err: any) {
                console.log(`Failed to remove contact: ${err.message}`);
            }
        }
    }

    const handleContactClick = (contact: any) => {
        console.log('ContactLayout: Contact clicked', contact);
        const event = new CustomEvent('contact-clicked', {
            detail: {
                contactId: contact.id,
                username: contact.username
            }
        });
        window.dispatchEvent(event);
    }

    return (
        <div className="contacts-panel">
            <div className="contacts-header">
                <h3>Contacts</h3>
                <button
                    onClick={() => setShowAddContact(!showAddContact)}
                    className="btn-primary-add"
                >
                    + Add
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="contacts-tabs">
                <button
                    className={`tab-button ${activeTab === 'contacts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('contacts')}
                >
                    Contacts ({contacts.length})
                </button>
                <button
                    className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pending')}
                >
                    Pending ({pendingRequests.length})
                </button>
            </div>

            {/* Add Contact */}
            {showAddContact && (
                <div className="add-contact-form">
                    <input 
                        type="text"
                        placeholder="Enter username"
                        value={usernameToAdd}
                        onChange={(e) => setUsernameToAdd(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddContact()}
                    />
                    <button
                        onClick={handleAddContact}
                        disabled={loading || !usernameToAdd.trim()}
                    >
                        {loading ? 'Sending...' : 'Send Request'}
                    </button>
                    <button onClick={() => setShowAddContact(false)}>Cancel</button>
                </div>
            )}

            {/* Contacts Tab */}
            {activeTab === 'contacts' && (
                <div className="contacts-list">
                    {contacts.length === 0 ? (
                        <p className="empty-state">No contacts yet. Add some friends!</p>
                    ) : (
                        contacts.map(contact => (
                            <div 
                                key={contact.id} 
                                className="contact-item"
                            >
                                <div className="contact-info" onClick={() => handleContactClick(contact)}>
                                    <span className={`username ${contact.isOnline ? 'online' : 'offline'}`}>
                                        {contact.username}
                                        <span className="status"></span>
                                    </span>
                                </div>
                                <div className="contact-actions">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveContact(contact.id);
                                        }}
                                        className="btn-remove"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Pending Requests Tab */}
            {activeTab === 'pending' && (
                <div className="pending-requests-list">
                    {pendingRequests.length === 0 ? (
                        <p className="empty-state">No pending requests</p>
                    ) : (
                        pendingRequests.map(request => (
                            <div 
                                key={request.requestId}
                                className="contact-request"
                            >
                                <span className="request-username">{request.fromUsername}</span>
                                <div className="request-actions">
                                    <button
                                        onClick={() => handleResponseRequest(request.requestId, true)}
                                        className="btn-accept-req"
                                    >
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => handleResponseRequest(request.requestId, false)}
                                        className="btn-reject-req"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}