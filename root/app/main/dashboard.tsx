import './_styles/styles.scss';
import React, { Component } from 'react';
import { MessageManager } from './message-manager';
import { GroupManager } from './chat/group/group-manager';

interface Props {
    onCreateGroup: () => void;
    messageManager: MessageManager;
    groupManager: GroupManager;
}

interface State {
    groups: any[];
}

export class Dashboard extends Component<Props, State> {
    private groupContainerRef: React.RefObject<HTMLDivElement | null>;

    constructor(props: Props) {
        super(props);
        this.state = {
            groups: []
        }
        this.groupContainerRef = React.createRef();
    }

    componentDidMount(): void {
        if(!this.groupContainerRef.current || !this.props.groupManager) return;
        this.props.groupManager.setContainer(this.groupContainerRef.current);
    }

    componentDidUpdate(prevProps: Props): void {
        if(
            this.props.groupManager && 
            this.props.groupManager !== prevProps.groupManager &&
            this.groupContainerRef.current 
        ) {
            this.props.groupManager.setContainer(this.groupContainerRef.current);
        }
    }

    render() {
        return (
            <>
                <div className="screen main-dashboard">
                    <header>
                        <div id="actions-bar">
                            <button 
                                id="action-chat"
                                onClick={() => this.props.onCreateGroup()}
                            >
                                Chat++++
                            </button>
                        </div>
                    </header>
                </div>

                <div className="group-container" ref={this.groupContainerRef}></div>
            </>
        );
    }
}