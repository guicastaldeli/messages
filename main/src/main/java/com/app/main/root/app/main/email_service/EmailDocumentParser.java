package com.app.main.root.app.main.email_service;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPath;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathException;
import javax.xml.xpath.XPathFactory;
import org.w3c.dom.Document;
import org.w3c.dom.NamedNodeMap;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.w3c.dom.*;
import java.util.concurrent.*;
import java.util.*;

@Component
public class EmailDocumentParser {
    private final XPath xPath;
    private final Map<String, Document> templateCache = new ConcurrentHashMap<>();
    private final Map<String, ElementRenderer> elementRenderers;
    
    public EmailDocumentParser() {
        this.xPath = XPathFactory.newInstance().newXPath();
        this.elementRenderers = new HashMap<>();
    }

    @FunctionalInterface
    public interface ElementRenderer {
        String render(
            Element element,
            Map<String, Object> context,
            EmailDocumentParser parser
        );
    }

    public String render(String name, Map<String, Object> context) {
        try {
            Document content = load(name);
            return getDocument(content, context);
        } catch(Exception err) {
            throw new RuntimeException("Template rendering failed" + name, err);
        }
    }

    private Document load(String name) throws Exception {
        Resource resource = new ClassPathResource("./" + name + ".xml");
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        DocumentBuilder builder = factory.newDocumentBuilder();
        return builder.parse(resource.getInputStream());
    }

    private String getDocument(Document doc, Map<String, Object> context) throws XPathException {
        String el = doc.getDocumentElement().getNodeName();

        String subject = renderTextContent(
            (String) xPath.evaluate("./" + el + "/content/subject" , doc, XPathConstants.STRING),
            context
        );
        String preheader = renderTextContent(
            (String) xPath.evaluate("/welcome-email/content/preheader", doc, XPathConstants.STRING),
            context
        );
        Node layoutNode = (Node) xPath.evaluate("/" + el + "/content/layout", doc, XPathConstants.NODE);
        String body = layoutNode != null ? renderElement((Element) layoutNode, context) : "";

        return String.format(
            "<html><head><title>%s</title></head><body><div class='preheader'>%s</div>%s</body></html>",
            subject, preheader, body
        );
    }

    public String renderElement(Element element, Map<String, Object> context) {
        String tagName = element.getTagName();
        ElementRenderer renderer = elementRenderers.get(tagName);
        if (renderer != null) return renderer.render(element, context, this);
        return renderDynamicElement(element, context);
    }
    
    private String renderDynamicElement(Element element, Map<String, Object> context) {
        String tagName = element.getTagName();
        
        StringBuilder attributes = new StringBuilder();
        NamedNodeMap attrs = element.getAttributes();
        for (int i = 0; i < attrs.getLength(); i++) {
            Node attr = attrs.item(i);
            attributes.append(" ")
                .append(attr.getNodeName())
                .append("=\"")
                .append(renderTextContent(attr.getNodeValue(), context))
                .append("\"");
        }
    
        if (attributes.indexOf("class=") == -1) {
            attributes.append(" class=\"").append(tagName).append("\"");
        }
        
        String content = renderChildren(element, context);
        
        return String.format("<%s%s>%s</%s>", tagName, attributes, content, tagName);
    }
    
    public String renderChildren(Element parent, Map<String, Object> context) {
        StringBuilder result = new StringBuilder();
        NodeList children = parent.getChildNodes();
        
        for (int i = 0; i < children.getLength(); i++) {
            Node child = children.item(i);
            if (child.getNodeType() == Node.ELEMENT_NODE) {
                result.append(renderElement((Element) child, context));
            } else if (child.getNodeType() == Node.TEXT_NODE) {
                result.append(renderTextContent(child.getTextContent(), context));
            }
        }
        
        return result.toString();
    }
    
    public String renderTextContent(String text, Map<String, Object> context) {
        if (text == null || text.trim().isEmpty()) return "";
        String result = text;
        for (Map.Entry<String, Object> entry : context.entrySet()) {
            String placeholder = "{{" + entry.getKey() + "}}";
            String value = entry.getValue() != null ? entry.getValue().toString() : "";
            result = result.replace(placeholder, value);
        }
        return result.trim();
    }
    
    private static String getAttribute(Element element, String attrName, String defaultValue) {
        String value = element.getAttribute(attrName);
        return value.isEmpty() ? defaultValue : value;
    }
    
    public void registerRenderer(String elementName, ElementRenderer renderer) {
        elementRenderers.put(elementName, renderer);
    }
    
    public void clearCache() {
        templateCache.clear();
    }
    
    public void clearCache(String templateName) {
        templateCache.remove(templateName);
    }
}
