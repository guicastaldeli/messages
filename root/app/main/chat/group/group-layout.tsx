import '../../_styles/styles.scss';
import { Component, createRef } from 'react';
import { MessageManager } from '../../message-manager';
import { GroupManager } from './group-manager';

interface Props {
    messageManager: MessageManager;
    groupManager: GroupManager;
}

interface State {
    creationComplete: boolean;
    groupName: string;
    isLoading: boolean;
    error: string | null;
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
            error: null
        }
    }

    componentDidMount(): void {
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

    handleCreationComplete = (event: CustomEvent) => {
        this.setState({
            creationComplete: true,
            groupName: event.detail.groupName,
            isLoading: false,
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
                        error: 'Timout. try again ;-;'
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

    render() {
        return (
            <>
                {/* Info */}
                <div className="group-info form">
                    <input 
                        type="text" 
                        id="group-info-name"
                        ref={this.nameInputRef}
                        placeholder="Enter group name"
                        disabled={this.state.isLoading}
                    />
                    <button 
                        id="create-group button"
                        disabled={this.state.isLoading}
                        onClick={() => {
                            this.handleCreate();
                            this.resetForm()
                        }}
                    >
                        {this.state.isLoading ? 'Creating...' : 'Create Group'}
                    </button>

                    {/* Loading */}
                    {this.state.isLoading && (
                        <div className="loading">Creating group, please wait...</div>
                    )}

                    {/* Error */}
                    {this.state.error && (
                        <div className="error">
                            <p>{this.state.error}</p>
                            <button onClick={this.handleRetry}>Try Again</button>
                        </div>
                    )}
                </div>

                {/* Layout */}
                {this.state.creationComplete && (
                    <div className="screen chat-screen">
                        <div className="header">
                            <div id="group-name">{this.state.groupName}</div>
                            <button 
                                id="exit-chat"
                                onClick={() => this.messageManager.exitChat()}
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