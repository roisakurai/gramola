package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"

	"song-player/internal/model"
	"song-player/internal/service"

	"github.com/google/uuid"
)

type SongJob struct {
	FileBytes []byte
	Filename  string
	Extension string
}

type SongHandler struct {
	Service  *service.SongService
	JobQueue chan SongJob
}

func NewSongHandler(s *service.SongService) *SongHandler {
	h := &SongHandler{
		Service:  s,
		JobQueue: make(chan SongJob, 100), // Antrean bisa menampung 100 file
	}

	// Jalankan 3 background worker
	for i := 1; i <= 3; i++ {
		go h.worker()
	}

	return h
}

// ================= BACKGROUND WORKER =================
func (h *SongHandler) worker() {
	for job := range h.JobQueue {
		h.processUpload(job)
	}
}

func (h *SongHandler) processUpload(job SongJob) {
	fmt.Printf("🔄 Memproses: %s\n", job.Filename)

	// 1. Durasi (LANGSUNG DARI RAM, TIDAK PERLU FILE TEMP!) 🔥
	duration := service.GetDurationFromBytes(job.FileBytes)

	if duration == 0 {
		fmt.Println("⚠️ Peringatan: Durasi 0. Pastikan file benar-benar berformat MP3 standar.")
	}

	// 2. Metadata & Cover
	title, artist, album, _ := service.ExtractMetadataFromBytes(job.FileBytes)
	if title == "" {
		title = job.Filename
	}
	if artist == "" {
		artist = "Unknown Artist"
	}

	coverData, coverExt, _ := service.ExtractCoverFromBytes(job.FileBytes)
	var coverURL string
	if coverData != nil {
		if coverExt == "" {
			coverExt = "jpg"
		}
		coverName := uuid.New().String() + "." + coverExt
		coverURL, _ = service.UploadToR2(coverData, coverName, "covers")
	}

	// 3. Upload Audio ke R2
	audioName := uuid.New().String() + job.Extension
	audioURL, err := service.UploadToR2(job.FileBytes, audioName, "songs")
	if err != nil {
		fmt.Println("❌ Gagal upload R2:", err)
		return
	}

	// 4. Simpan ke Database
	_, err = h.Service.CreateSong(title, artist, album, duration, audioURL, coverURL)
	if err != nil {
		fmt.Println("❌ Gagal simpan DB:", err)
		return
	}

	fmt.Printf("✅ Selesai: %s (Duration: %ds)\n", title, duration)
}

// ================= UPLOAD HANDLERS =================
func (h *SongHandler) UploadSong(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method == http.MethodOptions {
		return
	}

	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "File required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	ext := filepath.Ext(fileHeader.Filename)
	if ext != ".mp3" && ext != ".wav" {
		http.Error(w, "Invalid format", http.StatusBadRequest)
		return
	}

	fileBytes, _ := io.ReadAll(file)

	h.JobQueue <- SongJob{
		FileBytes: fileBytes,
		Filename:  fileHeader.Filename,
		Extension: ext,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "File is being processed",
		"status":  "queued",
	})
}

func (h *SongHandler) UploadMultipleSongs(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	r.ParseMultipartForm(100 << 20)

	files := r.MultipartForm.File["files"]
	count := 0

	for _, fh := range files {
		ext := filepath.Ext(fh.Filename)
		if ext != ".mp3" && ext != ".wav" {
			continue // Abaikan file yang bukan mp3/wav
		}

		f, _ := fh.Open()
		fb, _ := io.ReadAll(f)
		f.Close()

		h.JobQueue <- SongJob{
			FileBytes: fb,
			Filename:  fh.Filename,
			Extension: filepath.Ext(fh.Filename),
		}
		count++
	}

	fmt.Fprintf(w, "Diterima: %d lagu sedang diproses di background", count)
}

// ================= SYNC UPLOAD HANDLER =================
func (h *SongHandler) UploadSingleSync(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method == http.MethodOptions {
		return
	}

	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "File required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	ext := filepath.Ext(fileHeader.Filename)
	if ext != ".mp3" && ext != ".wav" {
		http.Error(w, "Invalid format", http.StatusBadRequest)
		return
	}

	fileBytes, _ := io.ReadAll(file)
	filename := fileHeader.Filename

	fmt.Printf("🔄 Memproses Sync: %s\n", filename)

	duration := service.GetDurationFromBytes(fileBytes)

	title, artist, album, _ := service.ExtractMetadataFromBytes(fileBytes)
	if title == "" {
		title = filename
	}
	if artist == "" {
		artist = "Unknown Artist"
	}

	coverData, coverExt, _ := service.ExtractCoverFromBytes(fileBytes)
	var coverURL string
	if coverData != nil {
		if coverExt == "" {
			coverExt = "jpg"
		}
		coverName := uuid.New().String() + "." + coverExt
		coverURL, _ = service.UploadToR2(coverData, coverName, "covers")
	}

	audioName := uuid.New().String() + ext
	audioURL, err := service.UploadToR2(fileBytes, audioName, "songs")
	if err != nil {
		http.Error(w, "Gagal upload audio ke R2", http.StatusInternalServerError)
		return
	}

	song, err := h.Service.CreateSong(title, artist, album, duration, audioURL, coverURL)
	if err != nil {
		http.Error(w, "Gagal simpan ke DB", http.StatusInternalServerError)
		return
	}

	fmt.Printf("✅ Selesai Sync: %s\n", title)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(mapToResponse(song))
}

// ================= FETCH DATA HANDLERS =================
func (h *SongHandler) GetSongs(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method == http.MethodOptions {
		return
	}

	songs, err := h.Service.GetSongs()
	if err != nil {
		http.Error(w, "Error fetching songs", http.StatusInternalServerError)
		return
	}

	var response []SongResponse
	for _, s := range songs {
		response = append(response, mapToResponse(s))
	}

	// Jika daftar lagu kosong, pastikan mengembalikan array kosong [] bukan null
	if response == nil {
		response = []SongResponse{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *SongHandler) GetSongByID(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method == http.MethodOptions {
		return
	}

	idStr := r.URL.Query().Get("id")
	id, _ := strconv.Atoi(idStr)

	song, err := h.Service.FindSong(id)
	if err != nil {
		http.Error(w, "Song not found", http.StatusNotFound)
		return
	}

	resp := mapToResponse(song)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// ================= UTILS & DTO =================
func enableCORS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
}

type SongResponse struct {
	ID        int    `json:"id"`
	Title     string `json:"title"`
	Artist    string `json:"artist"`
	Album     string `json:"album"`
	Duration  int    `json:"duration"`
	AudioURL  string `json:"audio_url"`
	CoverURL  string `json:"cover_url"`
	CreatedAt string `json:"created_at"`
}

func mapToResponse(song model.Song) SongResponse {
	return SongResponse{
		ID:        song.ID,
		Title:     song.Title,
		Artist:    song.Artist,
		Album:     song.Album,
		Duration:  song.Duration,
		AudioURL:  song.FilePath,
		CoverURL:  song.CoverPath,
		CreatedAt: song.CreatedAt.Format("2006-01-02"),
	}
}

// ================= DELETE =================
func (h *SongHandler) DeleteSongHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method == http.MethodOptions {
		return
	}

	// Pastikan method-nya DELETE
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	idStr := r.URL.Query().Get("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid ID format", http.StatusBadRequest)
		return
	}

	err = h.Service.DeleteSong(id)
	if err != nil {
		http.Error(w, "Failed to delete song", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Lagu berhasil dihapus dari sistem",
	})
}
