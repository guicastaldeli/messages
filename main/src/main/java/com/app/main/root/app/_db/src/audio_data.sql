CREATE TABLE IF NOT EXISTS audio_data(
    file_id VARCHAR(255) PRIMARY KEY,
    content BLOB NOT NULL,
    waveform BLOB,
    duration INTEGER,
    format VARCHAR(10)
);