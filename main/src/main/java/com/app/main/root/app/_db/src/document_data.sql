CREATE TABLE IF NOT EXISTS document_data(
    file_id VARCHAR(255) PRIMARY KEY,
    content BLOB NOT NULL,
    compressed BOOLEAN DEFAULT FALSE,
    extracted_text TEXT,
    title TEXT
);