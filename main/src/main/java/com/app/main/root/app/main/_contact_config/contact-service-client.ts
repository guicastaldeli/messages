import React from 'react';
import { SocketClientConnect } from '../socket-client-connect';
import { MessageManager } from '../_messages_config/message-manager';
import { Contact, ContactLayoutProps, ContactRequest, ContactServiceClientProps } from './contact-interface';
import { ContactLayout } from './contact-layout';

export class ContactServiceClient {
    private socketClient: SocketClientConnect;
    private messageManager: MessageManager;
    private userId: string;
    private username: string;
    private contactLayout: React.FC<ContactLayoutProps> | null = null;

    constructor(props: ContactServiceClientProps) {
        this.socketClient = props.socketClient;
        this.messageManager = props.messageManager;
        this.userId = props.userId;
        this.username = props.username;
        this.contactLayout = null;
    }

    /*
    ** Send Contact Request
    */
    public async sendContactRequest(username: string): Promise<void> {
        const responseDestination = '/queue/contact-request-scss';
        const errDestination = '/queue/contact-request-err';
        const requestDestination = '/app/send-contact-request';

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
                if(response.error) {
                    rej(new Error(response.message));
                } else {
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

    setupEventListeners(): void {
        this.socketClient.onDestination('/user/queue/contact-request', (message: any) => {
            console.log(`New contact request from ${message.fromUsername}`);
        });
        this.socketClient.onDestination('/user/queue/contact-request-response', (message: any) => {
            const action = message.accepted ? 'accepted' : 'rejected';
            console.log(`Your request was ${action} by ${message.respondentUsername}`);
        });
        this.socketClient.onDestination('/user/queue/contact-added', (message: any) => {
            console.log(`New contact added ${message.username}`);
            /*
            window.dispatchEvent(new CustomEvent('contact-added', {
                detail: { username: message.username }
            }));
            */
        });
    }
}