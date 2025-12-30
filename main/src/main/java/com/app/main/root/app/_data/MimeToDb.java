package com.app.main.root.app._data;
import java.util.Map;

public class MimeToDb {
    public static final Map<String, String> List = Map.ofEntries(
        Map.entry("image/jpeg", "image_data"),
        Map.entry("image/png", "image_data"),
        Map.entry("image/gif", "image_data"),
        Map.entry("image/webp", "image_data"),
        Map.entry("video/mp4", "video_data"),
        Map.entry("video/avi", "video_data"),
        Map.entry("video/mov", "video_data"),
        Map.entry("audio/mp3", "audio_data"),
        Map.entry("audio/wav", "audio_data"),
        Map.entry("audio/ogg", "audio_data"),
        Map.entry("application/pdf", "document_data"),
        Map.entry("application/msword", "document_data"),
        Map.entry("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "document_data"),
        Map.entry("text/plain", "document_data"),
        Map.entry("text/html", "document_data"),
        Map.entry("application/zip", "document_data"),
        Map.entry("application/x-rar-compressed", "document_data")
    );
}
