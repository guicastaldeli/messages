package com.app.main.root.app._utils;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.app._data.CommandSystemMessageList;
import com.app.main.root.app._data.MessagePerspective;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import java.util.function.Function;
import java.util.*;

@Component
public class MessageTemplateResolver {
    private ServiceManager serviceManager;
    private final Map<String, Function<MessagePerspective, String>> templateResolvers = new HashMap<>();
    
    public MessageTemplateResolver(@Lazy ServiceManager serviceManager) {
        this.serviceManager = serviceManager;
        this.initResolvers();
    }

    private void initResolvers() {
        /* User */
        templateResolvers.put("USER_ACTION", ctx -> {
            String username = (String) ctx.getContext().get("username");
            String action = (String) ctx.getContext().get("username");
            
            if(ctx.isSelf()) {
                return resolveSelfAction(action, ctx);
            } else {
                return  resolveGroupAction(username, action, ctx);
            }
        });
        /* Group */
        templateResolvers.put("GROUP_ACTION", ctx -> {
            String username = (String) ctx.getContext().get("username");
            String action = (String) ctx.getContext().get("action");
            String groupName = (String) ctx.getContext().get("groupName");
            
            return String.format("%s %s the group %s", 
                    ctx.isSelf() ? "You" : username,
                    action,
                    groupName != null ? groupName : "");
        });
        /* Message */
        templateResolvers.put("MESSAGE_ACTION", ctx -> {
            String action = (String) ctx.getContext().get("action");
            return ctx.isSelf() ?
                String.format("Your message was %s", action) :
                String.format("A message was %s", action);
        });
    }

    public String resolve() {
        
    }
}
