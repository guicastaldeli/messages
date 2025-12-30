CREATE TABLE IF NOT EXISTS video_data(
    file_id VARCHAR(255) PRIMARY KEY,
    content BLOB NOT NULL,
    thumbnail BLOB,
    duration INTEGER,
    resolution VARCHAR(20)
);