CREATE TABLE IF NOT EXISTS group_invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    is_used INTEGER DEFAULT 0,
    used_at DATETIME NULL,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
)