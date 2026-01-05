CREATE TABLE IF NOT EXISTS files_metadata(
    file_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    original_filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    database_name TEXT,
    chat_id VARCHAR(255) DEFAULT 'root',
    file_path TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1,
    thumbnail_path TEXT,
    iv BLOB,
    tag BLOB
);
