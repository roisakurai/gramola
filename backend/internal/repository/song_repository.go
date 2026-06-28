package repository

import (
	"database/sql"
	"song-player/internal/model"
)

type SongRepository struct {
	DB *sql.DB
}

func NewSongRepository(db *sql.DB) *SongRepository {
	return &SongRepository{DB: db}
}

func (r *SongRepository) SaveSong(song model.Song) (model.Song, error) {
	query := `
	INSERT INTO songs (title, artist, album, duration, file_path, cover_path, created_at)
	VALUES ($1, $2, $3, $4, $5, $6, NOW())
	RETURNING id, created_at
	`

	err := r.DB.QueryRow(
		query,
		song.Title,
		song.Artist,
		song.Album,
		song.Duration,
		song.FilePath,
		song.CoverPath,
	).Scan(&song.ID, &song.CreatedAt)

	return song, err
}

func (r *SongRepository) GetSongByID(id int) (model.Song, error) {
	query := `SELECT id, title, artist, album, duration, file_path, cover_path, created_at 
              FROM songs WHERE id = $1`
	var s model.Song
	err := r.DB.QueryRow(query, id).Scan(
		&s.ID, &s.Title, &s.Artist, &s.Album,
		&s.Duration, &s.FilePath, &s.CoverPath, &s.CreatedAt,
	)
	return s, err
}

func (r *SongRepository) GetAllSongs() ([]model.Song, error) {
	rows, err := r.DB.Query(`
		SELECT id, title, artist, album, duration, file_path, cover_path, created_at
		FROM songs
		ORDER BY id DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var songs []model.Song

	for rows.Next() {
		var s model.Song
		err := rows.Scan(
			&s.ID,
			&s.Title,
			&s.Artist,
			&s.Album,
			&s.Duration, // 🔥 WAJIB
			&s.FilePath,
			&s.CoverPath,
			&s.CreatedAt, // 🔥 WAJIB
		)
		if err != nil {
			return nil, err
		}
		songs = append(songs, s)
	}

	return songs, nil
}

func (r *SongRepository) DeleteSong(id int) error {
	query := `DELETE FROM songs WHERE id = $1`
	_, err := r.DB.Exec(query, id)
	return err
}
