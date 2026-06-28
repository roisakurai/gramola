CREATE TABLE songs (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT,
    file_path TEXT NOT NULL,
    cover_path TEXT,
    duration INTEGER NOT NULL DEFAULT 0, -- dalam detik
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);