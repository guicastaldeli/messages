import React, { useState, useEffect, useRef } from 'react';
import { ContactServiceClient } from './contact-service-client';
import { ContactLayoutProps } from './contact-interface';

export const ContactLayout: React.FC<ContactLayoutProps> = ({ contactService }) => {
    const [contacts, setContacts] = useState<any[]>([]);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [showAddContact, setShowAddContact] = useState(false);
    const [usernameToAdd, setUsernameToAdd] = useState('');
    const [loading, setLoading] = useState(false);
    const hasSubscribedRef = useRef(false);

    useEffect(() => {
        if(contactService && !hasSubscribedRef.current) {
            hasSubscribedRef.current = true;
            loadContacts();
            loadPendingRequests();
        }
    }, [contactService]);

    /*
    **
    *** Load Contacts
    ** 
    */
    const loadContacts = async () => {
        try {
            const contactList = await contactService.getContacts();
            setContacts(contactList);
        } catch(err) {
            console.error('Get contacts err', err);
        }
    }

    /*
    **
    *** Load Pending Requests
    ** 
    */
    const loadPendingRequests = async () => {
        try {
            const requests = await contactService.getPendingRequests();
            setPendingRequests(requests);
        } catch(err) {
            console.error('Pending requests err', err);
        }
    }

    /*
    ** Add Contact
    */
    const handleAddContact = async () => {
        if(!usernameToAdd.trim()) return;
        setLoading(true);

        try {
            await contactService.sendContactRequest(usernameToAdd.trim());
            setUsernameToAdd('');
            setShowAddContact(false);
            console.log('Contact request sent!'); //Switch later...
            await loadPendingRequests();
        } catch(err: any) {
            console.log(`Failed to send request: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }

    /*
    ** Response Request
    */
    const handleResponseRequest = async (requestId: string, accept: boolean) => {
        try {
            await contactService.responseContactRequest(requestId, accept);
            await loadPendingRequests();
            if(accept) {
                setTimeout(() => loadContacts(), 500);
            }
        } catch(err: any) {
            console.log(`Failed to respond: ${err.message}`);
        }
    }

    /*
    ** Remove Contact
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
                    Add Contact
                </button>
            </div>

            {/* Add Contact */}
            {showAddContact && (
                <div className="add-contact-form">
                    <input 
                        type="text"
                        placeholder="Enter username!"
                        value={usernameToAdd}
                        onChange={(e) => setUsernameToAdd(e.target.value)} 
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

            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
                <div className="pending-requests">
                    <h3>Pending Requests ({pendingRequests.length})</h3>
                    {pendingRequests.map(request => (
                        <div 
                            key={request.requestId}
                            className="contact-request"
                        >
                            <span>{request.fromUsername}</span>
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
                    ))}
                </div>
            )}

            {/* Contact List*/}
            <div className="contacts-list">
                {contacts.length === 0 ? (
                    <p>No contacts yet. Add some friends... :')</p>
                ) : (
                    contacts.map(contact => (
                        <div 
                            key={contact.id} 
                            className="contact-item"
                            onClick={() => handleContactClick(contact)}
                        >
                            <div className="contact-info">
                                <span className={`username ${contact.isOnline ? 'online' : 'offline'}`}>
                                    {contact.username}
                                    {contact.isOnline && <span className="status"></span>}
                                </span>
                            </div>
                            <div className="contact-actions">
                                <button
                                    onClick={() => handleRemoveContact(contact.id)}
                                    className="btn-remove"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}