package main

import (
	"fmt"
	"log"
	"os"
	"song-player/config"
	"song-player/internal/handler"
	"song-player/internal/repository"
	"song-player/internal/service"

	"net/http"

	"github.com/joho/godotenv"
)

func main() {
	// Abaikan error godotenv di production (Railway) karena kita pakai environment variables dari dashboard
	_ = godotenv.Load()

	db := config.ConnectDB()

	repo := repository.NewSongRepository(db)
	svc := service.NewSongService(repo)

	// Goroutine worker otomatis langsung jalan saat ini dipanggil.
	h := handler.NewSongHandler(svc)

	// --- DAFTAR RUTE API ---

	// 1. Rute Dummy untuk mengecek apakah server hidup
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Cek agar hanya merespons di root path "/", bukan catch-all
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Write([]byte("Backend API Song Player Menyala! 🚀"))
	})

	// 2. Rute Upload
	http.HandleFunc("/upload", h.UploadSong)
	http.HandleFunc("/upload-multiple", h.UploadMultipleSongs)
	http.HandleFunc("/upload-single", h.UploadSingleSync)

	http.HandleFunc("/songs", h.GetSongs)
	http.HandleFunc("/song", h.GetSongByID)

	http.HandleFunc("/song/delete", h.DeleteSongHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Gunakan fmt agar log di Railway rapi, dan dinamis menyesuaikan port Railway
	fmt.Printf("Server API running on port :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
