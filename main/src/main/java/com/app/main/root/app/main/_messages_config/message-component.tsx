import React, { ReactElement } from 'react';
import * as ReactDOMServer from 'react-dom/server';
import { UserColorGenerator } from "@/app/_utils/UserColorGenerator";

export interface MessageProps {
    username: string | null;
    content: string;
    timestamp: number;
    messageId: string;
    type: string;
    priority: number;
    isDirect: boolean;
    isGroup: boolean;
    isSystem: boolean;
    perspective: any;
    direction: 'self' | 'other';
    userColor?: string;
    chatType: 'DIRECT' | 'GROUP' | 'SYSTEM_MESSAGE';
    currentUserId?: string;
}

const MessageWrapper: React.FC<MessageProps> = ({
    username,
    content,
    timestamp,
    messageId,
    type,
    priority,
    isDirect,
    isGroup,
    isSystem,
    perspective,
    direction,
    userColor,
    chatType,
    currentUserId
}) => {
    const isSelf = direction === 'self';
    const selfColor = UserColorGenerator.getColor('softBlue')?.value;

    const getMessageColor = () => {
        if(isSelf) return { backgroundColor: selfColor };
        if(userColor) return { backgroundColor: userColor }
        return {};
    }
    const messageColor = getMessageColor();

    /* System Messages */
    if(isSystem) {
        return (
            <div className="system-message-content">
                {content}
            </div>
        );
    }

    /* User Messages */
    return (
        <div 
            className={`message ${isSelf ? 'self-message' : 'other-message'}`}
            style={messageColor}
            data-message-id={messageId}
            data-direction={direction}
            data-type={type}
        >
            <div className="user">{username}</div>
            <div className="content">{content}</div>
        </div>
    )
}

export class MessageComponentGetter {
    private currentUserId: string | undefined;

    public setCurrentUserId(userId: string) {
        this.currentUserId = userId;
    }

    __message(data: any): React.ReactElement {
        const {
            username,
            content,
            timestamp,
            messageId,
            type,
            priority,
            isDirect,
            isGroup,
            isSystem,
            perspective,
            direction,
            userColor,
            chatType
        } = data;
        return (
            <MessageWrapper
                username={username}
                content={content}
                timestamp={timestamp}
                messageId={messageId}
                type={type}
                priority={priority}
                isDirect={isDirect}
                isGroup={isGroup}
                isSystem={isSystem}
                perspective={perspective}
                direction={direction}
                userColor={userColor}
                chatType={chatType}
                currentUserId={this.currentUserId}
            />
        )
    }
}