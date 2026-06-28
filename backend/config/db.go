package config

import (
	"database/sql"
	"log"
	"os"

	_ "github.com/lib/pq"
)

func ConnectDB() *sql.DB {

	dsn := os.Getenv("DB_URL")

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal("DB open error:", err)
	}

	err = db.Ping()
	if err != nil {
		log.Fatal("DB ping error:", err)
	}

	log.Println("Connected to DB")
	return db
}
