package service

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"

	"github.com/dhowden/tag"
)

func ExtractMetadata(filePath string) (title, artist, album string, err error) {
	f, err := os.Open(filePath)
	if err != nil {
		return "", "", "", err
	}
	defer f.Close()

	m, err := tag.ReadFrom(f)
	if err != nil {
		return "", "", "", err
	}

	title = m.Title()
	artist = m.Artist()
	album = m.Album()

	return
}

func ExtractCover(filePath string) ([]byte, string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, "", err
	}
	defer f.Close()

	m, err := tag.ReadFrom(f)
	if err != nil {
		return nil, "", err
	}

	picture := m.Picture()
	if picture == nil {
		return nil, "", nil // tidak ada cover
	}

	return picture.Data, picture.Ext, nil
}

func ExtractCoverFromBytes(data []byte) ([]byte, string, error) {
	r := bytes.NewReader(data)

	m, err := tag.ReadFrom(r)
	if err != nil {
		return nil, "", err
	}

	pic := m.Picture()
	if pic == nil {
		return nil, "", nil
	}

	ext := "jpg"
	if pic.MIMEType == "image/png" {
		ext = "png"
	}

	return pic.Data, ext, nil
}

func detectContentType(fileName string) string {
	ext := filepath.Ext(fileName)

	switch ext {
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	default:
		return "application/octet-stream"
	}
}

func ExtractMetadataFromBytes(fileBytes []byte) (title, artist, album string, duration int) {
	r := bytes.NewReader(fileBytes)

	meta, err := tag.ReadFrom(r)
	if err != nil {
		return "", "", "", 0
	}

	title = meta.Title()
	artist = meta.Artist()
	album = meta.Album()

	// ❗ duration tidak selalu tersedia dari tag
	// fallback manual (optional)
	duration = 0

	return
}

type FFProbeResult struct {
	Format struct {
		Duration string `json:"duration"`
	} `json:"format"`
}

func GetDuration(filePath string) int {
	cmd := exec.Command(
		"ffprobe",
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		filePath,
	)

	output, err := cmd.Output()
	if err != nil {
		return 0
	}

	var result FFProbeResult
	json.Unmarshal(output, &result)

	// convert string ke float
	durFloat, err := strconv.ParseFloat(result.Format.Duration, 64)
	if err != nil {
		return 0
	}

	return int(durFloat) // detik
}
