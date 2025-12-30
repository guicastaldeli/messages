CREATE TABLE IF NOT EXISTS image_data(
    file_id VARCHAR(255) PRIMARY KEY,
    content BLOB NOT NULL,
    thumbnail BLOB,
    width INTEGER,
    height INTEGER,
    resolution VARCHAR(20)
);