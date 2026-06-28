package service

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"strings"

	"song-player/internal/model"
	"song-player/internal/repository"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/tcolgate/mp3"
)

type SongService struct {
	Repo *repository.SongRepository
}

func NewSongService(repo *repository.SongRepository) *SongService {
	return &SongService{Repo: repo}
}

func (s *SongService) CreateSong(
	title, artist, album string,
	duration int,
	filePath, coverPath string,
) (model.Song, error) {

	song := model.Song{
		Title:     title,
		Artist:    artist,
		Album:     album,
		Duration:  duration,
		FilePath:  filePath,
		CoverPath: coverPath,
	}

	return s.Repo.SaveSong(song)
}

func (s *SongService) FindSong(id int) (model.Song, error) {
	return s.Repo.GetSongByID(id)
}

func (s *SongService) GetSongs() ([]model.Song, error) {
	return s.Repo.GetAllSongs()
}

func UploadToR2(fileBytes []byte, fileName string, folder string) (string, error) {
	key := folder + "/" + fileName

	fmt.Println("➡️ UPLOAD:", key)

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion("auto"),
		config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(
				os.Getenv("R2_ACCESS_KEY_ID"),
				os.Getenv("R2_SECRET_ACCESS_KEY"),
				"",
			),
		),
	)
	if err != nil {
		return "", err
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(os.Getenv("R2_ENDPOINT"))
	})

	_, err = client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket: aws.String(os.Getenv("R2_BUCKET")),
		Key:    aws.String(key), // ⬅️ penting
		Body:   bytes.NewReader(fileBytes),

		ContentType: aws.String(detectContentType(fileName)),

		CacheControl: aws.String("public, max-age=31536000"),
	})
	if err != nil {
		return "", err
	}

	url := os.Getenv("R2_PUBLIC_URL") + "/" + key

	return url, nil
}

// Tambahkan "bytes" dan "github.com/tcolgate/mp3" di bagian import atas jika belum ada

func GetDurationFromBytes(fileBytes []byte) int {
	d := mp3.NewDecoder(bytes.NewReader(fileBytes))
	var f mp3.Frame
	skipped := 0
	var totalDuration float64

	for {
		if err := d.Decode(&f, &skipped); err != nil {
			break // Berhenti jika sudah sampai akhir file (EOF) atau error
		}
		totalDuration += f.Duration().Seconds()
	}

	return int(totalDuration)
}

func DeleteFromR2(fileURL string) error {
	if fileURL == "" {
		return nil
	}

	prefix := os.Getenv("R2_PUBLIC_URL") + "/"
	// Ekstrak 'Key' (nama file/folder) dari URL lengkap
	if !strings.HasPrefix(fileURL, prefix) {
		return nil // Abaikan jika format URL tidak sesuai
	}
	key := strings.TrimPrefix(fileURL, prefix)

	fmt.Println("🗑️ MENGHAPUS DARI R2:", key)

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion("auto"),
		config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(
				os.Getenv("R2_ACCESS_KEY_ID"),
				os.Getenv("R2_SECRET_ACCESS_KEY"),
				"",
			),
		),
	)
	if err != nil {
		return err
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(os.Getenv("R2_ENDPOINT"))
	})

	_, err = client.DeleteObject(context.TODO(), &s3.DeleteObjectInput{
		Bucket: aws.String(os.Getenv("R2_BUCKET")),
		Key:    aws.String(key),
	})

	return err
}

// Fungsi utama untuk menghapus lagu (Storage + DB)
func (s *SongService) DeleteSong(id int) error {
	// 1. Cari lagunya dulu untuk mendapatkan URL file
	song, err := s.FindSong(id)
	if err != nil {
		return err // Lagu tidak ditemukan
	}

	// 2. Hapus file audio dari R2
	if song.FilePath != "" {
		errR2 := DeleteFromR2(song.FilePath)
		if errR2 != nil {
			fmt.Println("❌ Gagal hapus audio R2:", errR2)
		}
	}

	// 3. Hapus file cover dari R2 (jika ada)
	if song.CoverPath != "" {
		errR2Cover := DeleteFromR2(song.CoverPath)
		if errR2Cover != nil {
			fmt.Println("❌ Gagal hapus cover R2:", errR2Cover)
		}
	}

	// 4. Hapus dari Database
	return s.Repo.DeleteSong(id)
}
