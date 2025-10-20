package com.app.main.root.app.__config;
import com.app.main.root.app._server.MessageRouter;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;

@Component
public class MessageInterceptor implements ChannelInterceptor {
    private final MessageRouter messageRouter;
    private final ExpressionParser expressionParser;
    private final StandardEvaluationContext evaluationContext;

    public MessageInterceptor(MessageRouter messageRouter) {
        this.messageRouter = messageRouter;
        this.expressionParser = new SpelExpressionParser();
        this.evaluationContext = new StandardEvaluationContext();
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        return message;
    }
}
