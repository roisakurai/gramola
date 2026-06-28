package model

import "time"

type Song struct {
	ID        int
	Title     string
	Artist    string
	Album     string
	Duration  int // dalam detik
	FilePath  string
	CoverPath string
	CreatedAt time.Time
}
