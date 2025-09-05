import './_styles/styles.scss';
import { Component } from 'react';
import { GroupLayout } from './layout/group';
import { MessageManager } from './message-manager';

interface Props {
    onCreateGroup: () => void;
    messageManager: MessageManager;
}

interface State {
    groups: any[];
}

export class Dashboard extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            groups: []
        }
    }

    render() {
        return (
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

                <GroupLayout messageManager={this.props.messageManager} />
            </div>
        );
    }
}