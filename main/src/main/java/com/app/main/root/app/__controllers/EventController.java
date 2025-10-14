package com.app.main.root.app.__controllers;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import com.app.main.root.app._server.EventRegistry;
import java.util.*;

@RestController
public class EventController {
    @GetMapping("/main/events")
    public List<String> getRegisteredEvents() {
        List<EventRegistry.EventHandlerConfig> events = EventRegistry.getAllEvents();
        List<String> names = new ArrayList<>();
        for(EventRegistry.EventHandlerConfig event : events) names.add(event.eventName);
        return names;
    }
}
