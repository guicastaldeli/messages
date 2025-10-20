package com.app.main.root.app._server;
import java.lang.annotation.ElementType;
import java.lang.annotation.*;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface MessageRouting {
    String[] routes() default {};
    RouteStrategy strategy() default RouteStrategy.BROADCAST;
    String condition() default "";
}

enum RouteStrategy {
    BROADCAST,
    UNICAST,
    MULTICAST,
    SESSION_AWARE
}
