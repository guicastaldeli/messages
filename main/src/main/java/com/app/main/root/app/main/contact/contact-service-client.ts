import React from 'react';
import { SocketClientConnect } from '../socket-client-connect';
import { ChatController } from '../chat/chat-controller';
import { Contact, ContactLayoutProps, ContactRequest, ContactServiceClientProps } from './contact-interface';
import { ContactLayout } from './contact-layout';

export class ContactServiceClient {
    private socketClient: SocketClientConnect;
    private chatController: ChatController;

    private userId: string;
    private username: string;

    private contactLayout: React.FC<ContactLayoutProps> | null = null;
    private pollingInterval: NodeJS.Timeout | null = null;

    constructor(props: ContactServiceClientProps) {
        this.socketClient = props.socketClient;
        this.chatController = props.chatController;
        this.userId = props.userId;
        this.username = props.username;
        this.contactLayout = null;
        this.pollingInterval = null;
    }

    /**
     * Send Contact Request
     */
    public async sendContactRequest(username: string): Promise<void> {
        const responseDestination = '/queue/contact-request-scss';
        const requestDestination = '/app/send-contact-request';
        const errDestination = '/queue/contact-request-err';

        return new Promise((res, rej) => {
            this.socketClient.onDestination(responseDestination, (response: any) => {
                if(response.error) {
                    rej(new Error(response.message));
                } else {
                    res();
                }
                this.socketClient.offDestination(responseDestination);
                this.socketClient.offDestination(errDestination);
            });

            this.socketClient.sendToDestination(requestDestination, { username }, responseDestination)
                .then(succss => {
                    if(!succss) {
                        rej(new Error('Failed to send contact request'));
                        this.socketClient.offDestination(responseDestination);
                        this.socketClient.offDestination(errDestination);
                    }
                })
                .catch(err => {
                    this.socketClient.offDestination(responseDestination);
                    this.socketClient.offDestination(errDestination);
                    rej(err);
                });
            console.log(requestDestination, { username }, responseDestination)
        });
    }

    /*
    ** Response Contact Request
    */
    public async responseContactRequest(requestId: string, accept: boolean): Promise<void> {
        const responseDestination = '/queue/contact-response-scss';
        const requestDestination = '/app/response-contact-request';

        return new Promise((res, rej) => {
            this.socketClient.onDestination(responseDestination, (response: any) => {
                console.log('ContactServiceClient: responseContactRequest response:', response);
                if(response.error) {
                    rej(new Error(response.message));
                } else {
                    this.emitRequestUpdated(requestId, accept ? 'accepted' : 'rejected');
                    if(accept) {
                        console.log('ContactServiceClient: Request accepted, forcing contact reloads');
                        setTimeout(async () => {
                            try {
                                const contacts = await this.getContacts();
                                console.log('ContactServiceClient: First contact reload after acceptance');
                                
                                if(response.contact) {
                                    this.emitContactAdded(response.contact);
                                } else if (contacts.length > 0) {
                                    contacts.forEach(contact => {
                                        this.emitContactAdded(contact);
                                    });
                                }
                                
                                setTimeout(async () => {
                                    try {
                                        await this.getContacts();
                                        console.log('ContactServiceClient: Second contact reload after acceptance');
                                    } catch (error) {
                                        console.error('Error in second contact reload:', error);
                                    }
                                }, 1000);
                                
                            } catch (error) {
                                console.error('Error in first contact reload:', error);
                            }
                        }, 300);
                    }
                    res();
                }
                this.socketClient.offDestination(responseDestination);
            });

            this.socketClient.sendToDestination(requestDestination, { requestId, accept }, responseDestination)
                .then(succss => {
                    if(!succss) {
                        this.socketClient.offDestination(responseDestination);
                        rej(new Error('Failed to respond to contact request'));
                    }
                })
                .catch(err => {
                    this.socketClient.offDestination(responseDestination);
                    rej(err);
                });
        });
    }

    /*
    ** Get Contacts
    */
    public async getContacts(): Promise<Contact[]> {
        const responseDestination = '/queue/contacts-scss';
        const requestDestination = '/app/get-contacts';

        return new Promise((res, rej) => {
            this.socketClient.onDestination(responseDestination, (response: any) => {
                if(response.error) {
                    rej(new Error(response.message));
                } else {
                    res(response.contacts || []);
                }
                this.socketClient.offDestination(responseDestination);
            });

            this.socketClient.sendToDestination(requestDestination, {}, responseDestination)
                .then(sucss => {
                    if(!sucss) {
                        this.socketClient.offDestination(responseDestination);
                        rej(new Error('Failed to get contacts'));
                    }
                })
                .catch(err => {
                    this.socketClient.offDestination(responseDestination);
                    rej(err);
                });
        })
    }

    /*
    ** Get Pending Contacts
    */
    public async getPendingRequests(): Promise<ContactRequest[]> {
        const responseDestination = '/queue/pending-requests-scss';
        const requestDestination = '/app/get-pending-requests';

        return new Promise((res, rej) => {
            this.socketClient.onDestination(responseDestination, (response: any) => {
                if(response.error) {
                    rej(new Error(response.message));
                } else {
                    res(response.requests || []);
                }
                this.socketClient.offDestination(responseDestination);
            });

            this.socketClient.sendToDestination(requestDestination, {}, responseDestination)
                .then(sucss => {
                    if(!sucss) {
                        this.socketClient.offDestination(responseDestination);
                        rej(new Error('Failed to get pending conatcts'));
                    }
                })
                .catch(err => {
                    this.socketClient.offDestination(responseDestination);
                    rej(err);
                });
        });
    }

    /*
    ** Remove Contact
    */
    public async removeContact(contactId: string): Promise<void> {
        const responseDestination = '/queue/response-contact-scss';
        const requestDestination = '/app/remove-contact';

        return new Promise((res, rej) => {
            this.socketClient.onDestination(responseDestination, (response: any) => {
                if(response.error) {
                    rej(new Error(response.message));
                } else {
                    res();
                }
                this.socketClient.offDestination(responseDestination);
            });

            this.socketClient.sendToDestination(requestDestination, { contactId }, responseDestination)
                .then(succss => {
                    if(!succss) {
                        this.socketClient.offDestination(responseDestination);
                        rej(new Error('Failed to remove contact'));
                    }
                })
                .catch(err => {
                    this.socketClient.offDestination(responseDestination);
                    rej(err);
                });
        });
    }

    public setupEventListeners(): void {
        this.startPolling();

        this.socketClient.on('contact-added', (data: any) => {
            this.emitContactAdded(data.contact);
        });

        this.socketClient.on('contact-removed', (data: any) => {
            this.emitContactRemoved(data.contactId);
        });

        this.socketClient.on('contact-request-accepted', (data: any) => {
            this.emitRequestUpdated(data.requestId, 'accepted');
            if (data.contact) {
                this.emitContactAdded(data.contact);
            }
        });

        this.socketClient.on('contact-request-accepted-by-recipient', (data: any) => {
            if(data.requestId) {
                this.emitRequestUpdated(data.requestId, 'accepted');
                setTimeout(async () => {
                    try {
                        const contacts = await this.getContacts();
                        const newContact = contacts.find(c =>
                            c.id === data.contactId || c.username === data.contactUsername
                        );
                        if(newContact) {
                            this.emitContactAdded(newContact);
                        }
                    } catch(err) {
                        console.error('Error loading contacts!:', err);
                    }
                }, 500);
            }
        });

        this.socketClient.on('contact-request-rejected', (data: any) => {
            this.emitRequestUpdated(data.requestId, 'rejected');
        });

        this.socketClient.on('contact-request-received', (data: any) => {
            this.emitNewRequest(data.request);
        });
    }
    
    private startPolling(): void {
        if(this.pollingInterval) clearInterval(this.pollingInterval);
        
        this.pollingInterval = setInterval(async () => {
            try {
                await this.pollForUpdates();
            } catch(err) {
                console.error('Error pollinf for contact updates: ', err);
            }
        }, 1000);
    }

    private async pollForUpdates(): Promise<void> {
        try {
            const contacts = await this.getContacts();
            const pendingRequests = await this.getPendingRequests();
            const event = new CustomEvent('contact-poll-update', {
                detail: { contacts, pendingRequests }
            });
            window.dispatchEvent(event);
        } catch(err) {
            console.error('Error polling for contact updates:', err);
        }
    }

    /**
     * 
     * Emitters
     * 
     */
    private emitContactAdded(contact: any): void {
        const event = new CustomEvent('contact-added', {
            detail: { contact }
        });
        window.dispatchEvent(event);
        console.log('Emitted contact-added event:', contact);
    }

    private emitContactRemoved(contactId: string): void {
        const event = new CustomEvent('contact-removed', {
            detail: { contactId }
        });
        window.dispatchEvent(event);
        console.log('Emitted contact-removed event:', contactId);
    }

    private emitRequestUpdated(requestId: string, status: string): void {
        const event = new CustomEvent('contact-request-updated', {
            detail: { requestId, status }
        });
        window.dispatchEvent(event);
        console.log('Emitted contact-request-updated event:', requestId, status);
    }

    private emitNewRequest(request: any): void {
        const event = new CustomEvent('contact-request-received', {
            detail: { request }
        });
        window.dispatchEvent(event);
        console.log('Emitted contact-request-received event:', request);
    }
}