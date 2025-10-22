package com.app.main.root;
import org.springframework.beans.factory.BeanCreationException;
import org.springframework.boot.diagnostics.FailureAnalysis;
import org.springframework.boot.diagnostics.FailureAnalyzer;
import org.springframework.boot.web.server.PortInUseException;
import org.springframework.stereotype.Component;

@Component
public class StartupFailureAnalyzer implements FailureAnalyzer {
    @Override
    public FailureAnalysis analyze(Throwable failure) {
        StringBuilder description = new StringBuilder();
        StringBuilder action = new StringBuilder();

        description.append("Application failed to start:\n");
        description.append("Root cause: ").append(failure.getClass().getName()).append(" - ").append(failure.getMessage()).append("\n\n");

        if(failure instanceof BeanCreationException) {
            BeanCreationException bce = (BeanCreationException) failure;
            description.append("Bean creation failed for: ").append(bce.getBeanName()).append("\n");
            action.append("Check the bean configuration and dependencies\n");
        }
        if (failure instanceof PortInUseException) {
            action.append("The server port is already in use. Change the port in configuration\n");
        }

        action.append("Check the complete stack trace below for more details");
        return new FailureAnalysis(description.toString(), action.toString(), failure);
    }
}
