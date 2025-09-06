import './_styles/styles.scss';
import { Component } from 'react';
import { MessageManager } from './message-manager';
import { SocketClient } from '../.server/socket-client';
import { Dashboard } from './dashboard';

interface State {
    groupManager: MessageManager['groupManager'] | null;
}

export class Main extends Component<any, State> {
    private messageManager: MessageManager;
    private socketClient: SocketClient;

    constructor(props: any) {
        super(props);
        this.socketClient = SocketClient.getInstance();
        this.messageManager = new MessageManager(this.socketClient);
        this.state = { groupManager: null }
    }

    componentDidMount(): void {
        this.connect();
    }

    private connect(): void {
        if(!this.socketClient || this.socketClient['isConnected']) return;
        this.socketClient.connect();
        this.messageManager.init();
        this.setState({ groupManager: this.messageManager.groupManager });
    }

    //Create Group
    private handleCreateGroup = (): void => {
        this.messageManager.groupManager.showMenu();
    }

    render() {
        return (
            <div className='app'>
                <div className='screen join-screen active'>
                    <div className='form'>
                        <h2>Join chatroom</h2>
                        <div className="form-input">
                            <label>Username</label>
                            <input type="text" id="username" />
                        </div>
                        <div className='form-input'>
                            <button 
                                id='join-user' 
                                onClick={() => this.messageManager.handleJoin()}
                            >
                                Join
                            </button>
                        </div>
                    </div>
                </div>
                <Dashboard 
                    onCreateGroup={this.handleCreateGroup}
                    messageManager={this.messageManager}
                    groupManager={this.state.groupManager!}
                />
            </div>
        );
    }
}