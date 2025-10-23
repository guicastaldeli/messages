import React, { ReactElement } from 'react';
import * as ReactDOMServer from 'react-dom/server';

export class ContentGetter {
    /*
    -----------------------

        MESSAGES CONTENT

    -----------------------
    */

    //Self
    __self(message: any): React.ReactElement {
        const content = (
            <div className="message self-message">
                <div className="user">{message.username}</div>
                <div className="content">{message.content}</div>
            </div>
        );
        return content;
    }

    //Other
    __other(message: any): React.ReactElement {
        const content =
        <div className="message other-message">
            <div className="user">{message.username}</div>
            <div className="content">{message.content}</div>
        </div>;
        return content;
    }

    //Join Message Content
    __userEventMessageContent(data: any): ReactElement {
        const content = 
        <div className="user-event-message-content">
            {data.content}
        </div>
        return content;
    }

    //Update
    __update(data: { data: string }): React.ReactElement {
        const content = <div className="update">{data.data}</div>;
        return content;
    }

    //Message Content
    __messageContent(
        messageTypes: Record<string, (data: any) => React.ReactNode>,
        type: string,
        data: any
    ): ReactElement {
        const messageData = messageTypes[type](data);
        const content = <div className="message-content">{messageData}</div>
        return content;
    }
}