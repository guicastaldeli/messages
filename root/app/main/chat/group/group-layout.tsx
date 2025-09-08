import '../../_styles/styles.scss';
import { Component, createRef } from 'react';
import { MessageManager } from '../../message-manager';
import { GroupManager } from './group-manager';

interface Props {
    messageManager: MessageManager;
    groupManager: GroupManager;
    onSuccess?: (data: any) => void;
    onError?: (error: any) => void;
}

interface State {
    creationComplete: boolean;
    groupName: string;
    isLoading: boolean;
    error: string | null;
    managerState: {
        showForm: boolean;
        showChat: boolean;
        groupName: string;
    }
}

export class GroupLayout extends Component<Props, State> {
    private messageManager: MessageManager;
    private groupManager: GroupManager;

    private timeout: number = 5000;
    private nameInputRef = createRef<HTMLInputElement>();
    private containerRef = createRef<HTMLDivElement>();

    constructor(props: Props) {
        super(props);
        this.messageManager = this.props.messageManager;
        this.groupManager = this.props.groupManager;

        this.state = {
            creationComplete: false,
            groupName: '',
            isLoading: false,
            error: null,
            managerState: {
                showForm: true,
                showChat: false,
                groupName: ''
            }
        }
    }

    componentDidMount(): void {
        this.groupManager.setStateChange((state: any) => {
            this.setState({ managerState: state });
        });
        window.addEventListener(
            'group-creation-complete',
            this.handleCreationComplete as EventListener
        );
    }
    componentWillUnmount(): void {
        window.removeEventListener(
            'group-creation-complete',
            this.handleCreationComplete as EventListener
        );
    }

    handleCreationComplete = () => {
        this.setState({
            isLoading: false,
            creationComplete: true,
            error: null
        });
    }

    handleCreate = () => {
        const groupName = this.nameInputRef.current?.value || '';
        if(!groupName.trim()) {
            alert('Enter a group name');
            return;
        }

        this.setState({
            isLoading: true,
            groupName,
            error: null
        });

        try {
            this.groupManager.manageCreate(groupName);

            setTimeout(() => {
                if(this.state.isLoading && !this.state.creationComplete) {
                    this.setState({
                        isLoading: false,
                        error: 'Timeout. try again ;-;'
                    });
                }
            }, this.timeout);
        } catch(err) {
            console.log(err);
            throw new Error('Failed to create');
        }
    }

    handleRetry = () => {
        this.setState({ error: null });
    }

    resetForm = () => {
        if(this.nameInputRef.current) this.nameInputRef.current.value = '';
        this.setState({
            creationComplete: false,
            groupName: '',
            isLoading: false,
            error: null
        });
    }

    handleExitChat = () => {
        this.messageManager.exitChat();
        this.resetForm();
        this.groupManager.updateState({
            showForm: false,
            showChat: false,
            groupName: ''
        });
    }

    render() {
        const { isLoading, error } = this.state;
        const { showForm, showChat, groupName } = this.state.managerState;
        
        return (
            <>
                {/* Info */}
                {showForm && (
                    <div className="group-info form">
                        <input 
                            type="text" 
                            id="group-info-name"
                            ref={this.nameInputRef}
                            placeholder="Enter group name"
                            disabled={isLoading}
                            defaultValue={groupName}
                        />
                        <button 
                            id="create-group button"
                            disabled={isLoading}
                            onClick={() => {
                                this.handleCreate();
                                //this.resetForm();
                            }}
                        >
                            {isLoading ? 'Creating...' : 'Create Group'}
                        </button>

                        {/* Loading */}
                        {isLoading && (
                            <div className="loading">Creating group, please wait...</div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="error">
                                <p>{error}</p>
                                <button onClick={this.handleRetry}>Try Again</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Layout */}
                {showChat && (
                    <div className="screen chat-screen">
                        <div className="header">
                            <div id="group-name">{groupName}</div>
                            <button 
                                id="exit-chat"
                                onClick={this.handleExitChat}
                            >
                                Exit Group
                            </button>
                        </div>
                        <div className="messages"></div>
                        <div className="typebox">
                            <input type="text" id="message-input" />
                            <button 
                                id="send-message" 
                                onClick={() => this.messageManager.handleChatMessage()}
                            >
                                Send
                            </button>
                        </div>
                    </div>
                )}
            </>
        );
    }
}