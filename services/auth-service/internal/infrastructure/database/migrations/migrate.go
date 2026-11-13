package migrations

import (
	"database/sql"
	"fmt"
	"io/ioutil"
	"path/filepath"
	"sort"
	"strings"

	"github.com/academic-system/auth-service/pkg/logger"
)

// RunMigrations runs all database migrations
func RunMigrations(db *sql.DB, migrationPath string) error {
	log := logger.New("info")
	
	// Create migrations table if it doesn't exist
	if err := createMigrationsTable(db); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Get all migration files
	files, err := filepath.Glob(filepath.Join(migrationPath, "*.sql"))
	if err != nil {
		return fmt.Errorf("failed to read migration files: %w", err)
	}

	// Sort files to ensure they run in order
	sort.Strings(files)

	for _, file := range files {
		filename := filepath.Base(file)
		
		// Check if migration has already been run
		if isMigrationRun(db, filename) {
			log.Info("Migration already run", "file", filename)
			continue
		}

		// Read migration file
		content, err := ioutil.ReadFile(file)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", filename, err)
		}

		// Run migration
		log.Info("Running migration", "file", filename)
		if err := runMigration(db, filename, string(content)); err != nil {
			return fmt.Errorf("failed to run migration %s: %w", filename, err)
		}

		log.Info("Migration completed", "file", filename)
	}

	log.Info("All migrations completed successfully")
	return nil
}

func createMigrationsTable(db *sql.DB) error {
	query := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename VARCHAR(255) PRIMARY KEY,
			executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);
	`
	
	_, err := db.Exec(query)
	return err
}

func isMigrationRun(db *sql.DB, filename string) bool {
	var count int
	query := "SELECT COUNT(*) FROM schema_migrations WHERE filename = $1"
	err := db.QueryRow(query, filename).Scan(&count)
	if err != nil {
		return false
	}
	return count > 0
}

func runMigration(db *sql.DB, filename, content string) error {
	// Start transaction
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Split content by semicolon to handle multiple statements
	statements := strings.Split(content, ";")
	
	for _, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}

		// Skip comments
		if strings.HasPrefix(stmt, "--") {
			continue
		}

		if _, err := tx.Exec(stmt); err != nil {
			return fmt.Errorf("failed to execute statement: %w", err)
		}
	}

	// Record migration
	if _, err := tx.Exec(
		"INSERT INTO schema_migrations (filename) VALUES ($1)",
		filename,
	); err != nil {
		return err
	}

	// Commit transaction
	return tx.Commit()
}
