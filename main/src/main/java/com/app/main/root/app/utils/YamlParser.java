package com.app.main.root.app.utils;
import java.io.*;
import java.util.*;

public class YamlParser {

    public static Map<String, Object> parseFile(String filePath) throws IOException {
        try (BufferedReader reader = new BufferedReader(new FileReader(filePath))) {
            return parse(reader);
        }
    }

    public static Map<String, Object> parseString(String yamlContent) throws IOException {
        try (BufferedReader reader = new BufferedReader(new StringReader(yamlContent))) {
            return parse(reader);
        }
    }

    private static Map<String, Object> parse(BufferedReader reader) throws IOException {
        Map<String, Object> root = new LinkedHashMap<>();
        Deque<Map<String, Object>> stack = new ArrayDeque<>();
        Deque<Integer> indentStack = new ArrayDeque<>();
        stack.push(root);
        indentStack.push(0);

        String line;
        while((line = reader.readLine()) != null) {
            if(line.trim().isEmpty() || line.trim().startsWith("#")) continue;

            int indent = countIndent(line);
            String trimmed = line.trim();

            while(indent < indentStack.peek()) {
                stack.pop();
                indentStack.pop();
            }

            if(trimmed.startsWith("- ")) {
                String value = trimmed.substring(2).trim();
                Map<String, Object> current = stack.peek();
                String lastKey = getLastKey(current);
                List<Object> list;
                if(lastKey != null && current.get(lastKey) instanceof List) {
                    list = (List<Object>) current.get(lastKey);
                } else {
                    list = new ArrayList<>();
                    current.put(lastKey, list);
                }
                list.add(value);
            } else if(trimmed.contains(":")) {
                String[] parts = trimmed.split(":", 2);
                String key = parts[0].trim();
                String value = parts[1].trim();

                Map<String, Object> current = stack.peek();
                if(value.isEmpty()) {
                    Map<String, Object> child = new LinkedHashMap<>();
                    current.put(key, child);
                    stack.push(child);
                    indentStack.push(indent + 2);
                } else {
                    current.put(key, parseValue(value));
                }
            }
        }
        return root;
    }

    private static int countIndent(String line) {
        int count = 0;
        while(count < line.length() && (line.charAt(count) == ' ' || line.charAt(count) == '\t')) {
            count++;
        }
        return count;
    }

    private static String getLastKey(Map<String, Object> map) {
        if(map.isEmpty()) return null;
        Iterator<String> it = map.keySet().iterator();
        String last = null;
        while(it.hasNext()) last = it.next();
        return last;
    }

    private static Object parseValue(String value) {
        if("true".equalsIgnoreCase(value)) return true;
        if("false".equalsIgnoreCase(value)) return false;
        try {
            if(value.contains(".")) return Double.parseDouble(value);
            return Integer.parseInt(value);
        } catch(NumberFormatException e) {
            return value;
        }
    }
}