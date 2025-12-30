CREATE TABLE IF NOT EXISTS file_encryption_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id VARCHAR(255) NOT NULL,
    file_id_hash VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    encrypted_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (file_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_file_id ON file_encryption_keys(file_id);
CREATE INDEX IF NOT EXISTS idx_user_id ON file_encryption_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_file_id_hash ON file_encryption_keys(file_id_hash);