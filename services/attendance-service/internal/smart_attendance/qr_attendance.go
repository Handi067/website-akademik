package smart_attendance

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/big"
	"time"

	"github.com/academic-system/attendance-service/internal/models"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
	"github.com/skip2/go-qrcode"
)

type QRAttendanceSystem struct {
	db     *sql.DB
	redis  *redis.Client
	logger *logrus.Logger
}

type QRCode struct {
	CodeID        string    `json:"code_id"`
	CourseID      string    `json:"course_id"`
	SessionID     string    `json:"session_id"`
	GeneratedAt   time.Time `json:"generated_at"`
	ExpiresAt     time.Time `json:"expires_at"`
	IsActive      bool      `json:"is_active"`
	MaxScans      int       `json:"max_scans"`
	CurrentScans  int       `json:"current_scans"`
	Location      string    `json:"location"`
	Radius        float64   `json:"radius"`
	Geofence     bool      `json:"geofence"`
	RequiresPhoto  bool      `json:"requires_photo"`
	RequiresFace  bool      `json:"requires_face"`
}

type AttendanceRecord struct {
	RecordID      string    `json:"record_id"`
	StudentID     string    `json:"student_id"`
	CourseID      string    `json:"course_id"`
	SessionID     string    `json:"session_id"`
	QRCodeID      string    `json:"qr_code_id"`
	ScannedAt     time.Time `json:"scanned_at"`
	Location      Location  `json:"location"`
	DeviceID      string    `json:"device_id"`
	IPAddress     string    `json:"ip_address"`
	UserAgent      string    `json:"user_agent"`
	PhotoURL      string    `json:"photo_url"`
	FaceMatch     bool      `json:"face_match"`
	IsValid       bool      `json:"is_valid"`
	Status        string    `json:"status"`
	ValidationData ValidationData `json:"validation_data"`
}

type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Accuracy  float64 `json:"accuracy"`
	Timestamp time.Time `json:"timestamp"`
}

type ValidationData struct {
	LocationValid   bool      `json:"location_valid"`
	TimeValid      bool      `json:"time_valid"`
	DeviceValid    bool      `json:"device_valid"`
	FaceValid      bool      `json:"face_valid"`
	QRValid        bool      `json:"qr_valid"`
	ValidationTime time.Time `json:"validation_time"`
	RiskFactors    []string  `json:"risk_factors"`
}

type AttendanceSession struct {
	SessionID     string    `json:"session_id"`
	CourseID      string    `json:"course_id"`
	StartTime     time.Time `json:"start_time"`
	EndTime       time.Time `json:"end_time"`
	Location      string    `json:"location"`
	QRCodeEnabled bool      `json:"qr_code_enabled"`
	AutoExpire    bool      `json:"auto_expire"`
	ExpireMinutes int       `json:"expire_minutes"`
	MaxStudents   int       `json:"max_students"`
	CurrentCount  int       `json:"current_count"`
	Status        string    `json:"status"`
}

func NewQRAttendanceSystem(db *sql.DB, redis *redis.Client, logger *logrus.Logger) *QRAttendanceSystem {
	return &QRAttendanceSystem{
		db:     db,
		redis:  redis,
		logger: logger,
	}
}

func (qr *QRAttendanceSystem) GenerateQRCode(ctx context.Context, courseID, sessionID string, options QRCodeOptions) (*QRCode, error) {
	// Generate unique code ID
	codeID := qr.generateUniqueCode()
	
	// Set expiration time
	expiresAt := time.Now().Add(time.Duration(options.ValidMinutes) * time.Minute)
	
	// Create QR code record
	qrCode := &QRCode{
		CodeID:       codeID,
		CourseID:     courseID,
		SessionID:    sessionID,
		GeneratedAt:  time.Now(),
		ExpiresAt:    expiresAt,
		IsActive:     true,
		MaxScans:     options.MaxScans,
		CurrentScans: 0,
		Location:     options.Location,
		Radius:       options.Radius,
		Geofence:    options.Geofence,
		RequiresPhoto: options.RequiresPhoto,
		RequiresFace: options.RequiresFace,
	}
	
	// Save to database
	err := qr.saveQRCode(ctx, qrCode)
	if err != nil {
		return nil, fmt.Errorf("failed to save QR code: %w", err)
	}
	
	// Cache in Redis for quick access
	err = qr.cacheQRCode(ctx, qrCode)
	if err != nil {
		qr.logger.WithError(err).Warn("Failed to cache QR code")
	}
	
	return qrCode, nil
}

type QRCodeOptions struct {
	ValidMinutes int     `json:"valid_minutes"`
	MaxScans     int     `json:"max_scans"`
	Location     string  `json:"location"`
	Radius       float64 `json:"radius"`
	Geofence    bool    `json:"geofence"`
	RequiresPhoto bool    `json:"requires_photo"`
	RequiresFace bool    `json:"requires_face"`
}

func (qr *QRAttendanceSystem) generateUniqueCode() string {
	// Generate cryptographically secure random code
	bytes := make([]byte, 16)
	rand.Read(bytes)
	
	// Convert to hex string
	code := fmt.Sprintf("%x", bytes)
	
	// Add timestamp for uniqueness
	timestamp := time.Now().Unix()
	
	return fmt.Sprintf("%s_%d", code, timestamp)
}

func (qr *QRAttendanceSystem) saveQRCode(ctx context.Context, qrCode *QRCode) error {
	query := `
		INSERT INTO qr_codes (
			code_id, course_id, session_id, generated_at, expires_at,
			is_active, max_scans, current_scans, location, radius,
			geofence, requires_photo, requires_face
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (code_id) 
		DO UPDATE SET 
			expires_at = EXCLUDED.expires_at,
			is_active = EXCLUDED.is_active,
			max_scans = EXCLUDED.max_scans,
			current_scans = EXCLUDED.current_scans
	`
	
	_, err := qr.db.ExecContext(ctx, query,
		qrCode.CodeID, qrCode.CourseID, qrCode.SessionID,
		qrCode.GeneratedAt, qrCode.ExpiresAt, qrCode.IsActive,
		qrCode.MaxScans, qrCode.CurrentScans, qrCode.Location,
		qrCode.Radius, qrCode.Geofence, qrCode.RequiresPhoto, qrCode.RequiresFace,
	)
	
	return err
}

func (qr *QRAttendanceSystem) cacheQRCode(ctx context.Context, qrCode *QRCode) error {
	qrCodeJSON, _ := json.Marshal(qrCode)
	cacheKey := fmt.Sprintf("qr_code:%s", qrCode.CodeID)
	
	return qr.redis.Set(ctx, cacheKey, qrCodeJSON, time.Duration(qrCode.ValidMinutes)*time.Minute).Err()
}

func (qr *QRAttendanceSystem) ValidateQRCode(ctx context.Context, codeID string, scanData ScanData) (*AttendanceRecord, error) {
	// Get QR code from cache first
	qrCode, err := qr.getQRCode(ctx, codeID)
	if err != nil {
		return nil, fmt.Errorf("QR code not found or expired: %w", err)
	}
	
	// Check if QR code is still valid
	if !qr.isQRCodeValid(qrCode) {
		return nil, fmt.Errorf("QR code is invalid or expired")
	}
	
	// Create attendance record
	record := &AttendanceRecord{
		RecordID:   qr.generateRecordID(),
		StudentID:  scanData.StudentID,
		CourseID:   qrCode.CourseID,
		SessionID:  qrCode.SessionID,
		QRCodeID:   codeID,
		ScannedAt:  time.Now(),
		Location:   scanData.Location,
		DeviceID:   scanData.DeviceID,
		IPAddress:  scanData.IPAddress,
		UserAgent:   scanData.UserAgent,
		PhotoURL:   scanData.PhotoURL,
	}
	
	// Validate attendance
	validationData := qr.validateAttendance(ctx, qrCode, scanData)
	record.ValidationData = validationData
	record.IsValid = validationData.LocationValid && validationData.TimeValid && 
		validationData.DeviceValid && validationData.QRValid
	
	if record.IsValid {
		record.Status = "present"
	} else {
		record.Status = "invalid"
	}
	
	// Update QR code scan count
	err = qr.incrementScanCount(ctx, codeID)
	if err != nil {
		qr.logger.WithError(err).Error("Failed to increment scan count")
	}
	
	// Save attendance record
	err = qr.saveAttendanceRecord(ctx, record)
	if err != nil {
		return nil, fmt.Errorf("failed to save attendance record: %w", err)
	}
	
	// Check for duplicate attendance
	isDuplicate, err := qr.checkDuplicateAttendance(ctx, record)
	if err != nil {
		qr.logger.WithError(err).Warn("Failed to check duplicate attendance")
	} else if isDuplicate {
		record.Status = "duplicate"
		record.IsValid = false
	}
	
	return record, nil
}

type ScanData struct {
	StudentID string    `json:"student_id"`
	Location  Location  `json:"location"`
	DeviceID  string    `json:"device_id"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	PhotoURL  string    `json:"photo_url"`
}

func (qr *QRAttendanceSystem) getQRCode(ctx context.Context, codeID string) (*QRCode, error) {
	// Try cache first
	cacheKey := fmt.Sprintf("qr_code:%s", codeID)
	cachedQR, err := qr.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var qrCode QRCode
		err = json.Unmarshal([]byte(cachedQR), &qrCode)
		if err == nil {
			return &qrCode, nil
		}
	}
	
	// Get from database
	query := `
		SELECT code_id, course_id, session_id, generated_at, expires_at,
			is_active, max_scans, current_scans, location, radius,
			geofence, requires_photo, requires_face
		FROM qr_codes
		WHERE code_id = $1
	`
	
	var qrCode QRCode
	err = qr.db.QueryRowContext(ctx, query, codeID).Scan(
		&qrCode.CodeID, &qrCode.CourseID, &qrCode.SessionID,
		&qrCode.GeneratedAt, &qrCode.ExpiresAt, &qrCode.IsActive,
		&qrCode.MaxScans, &qrCode.CurrentScans, &qrCode.Location,
		&qrCode.Radius, &qrCode.Geofence, &qrCode.RequiresPhoto, &qrCode.RequiresFace,
	)
	
	if err != nil {
		return nil, err
	}
	
	return &qrCode, nil
}

func (qr *QRAttendanceSystem) isQRCodeValid(qrCode *QRCode) bool {
	now := time.Now()
	
	// Check if active
	if !qrCode.IsActive {
		return false
	}
	
	// Check if expired
	if now.After(qrCode.ExpiresAt) {
		return false
	}
	
	// Check scan limit
	if qrCode.CurrentScans >= qrCode.MaxScans {
		return false
	}
	
	return true
}

func (qr *QRAttendanceSystem) validateAttendance(ctx context.Context, qrCode *QRCode, scanData ScanData) ValidationData {
	validation := ValidationData{
		ValidationTime: time.Now(),
		RiskFactors:   []string{},
	}
	
	// Validate location
	if qrCode.Geofence {
		validation.LocationValid = qr.validateLocation(qrCode, scanData.Location)
		if !validation.LocationValid {
			validation.RiskFactors = append(validation.RiskFactors, "location_outside_geofence")
		}
	} else {
		validation.LocationValid = true
	}
	
	// Validate time
	validation.TimeValid = qr.validateTime(ctx, qrCode.CourseID, qrCode.SessionID)
	if !validation.TimeValid {
		validation.RiskFactors = append(validation.RiskFactors, "invalid_scan_time")
	}
	
	// Validate device (simplified)
	validation.DeviceValid = qr.validateDevice(scanData.DeviceID)
	if !validation.DeviceValid {
		validation.RiskFactors = append(validation.RiskFactors, "suspicious_device")
	}
	
	// Validate QR code
	validation.QRValid = qrCode.IsActive && time.Now().Before(qrCode.ExpiresAt)
	if !validation.QRValid {
		validation.RiskFactors = append(validation.RiskFactors, "invalid_qr_code")
	}
	
	// Validate face if required
	if qrCode.RequiresFace && scanData.PhotoURL != "" {
		validation.FaceValid = qr.validateFace(ctx, scanData.StudentID, scanData.PhotoURL)
		if !validation.FaceValid {
			validation.RiskFactors = append(validation.RiskFactors, "face_mismatch")
		}
	} else {
		validation.FaceValid = true
	}
	
	return validation
}

func (qr *QRAttendanceSystem) validateLocation(qrCode *QRCode, location Location) bool {
	if qrCode.Radius <= 0 {
		return true // No location validation required
	}
	
	// Calculate distance between QR code location and scan location
	distance := qr.calculateDistance(
		qrCode.Location, // This would need to be parsed from qrCode.Location
		location,
	)
	
	return distance <= qrCode.Radius
}

func (qr *QRAttendanceSystem) calculateDistance(loc1, loc2 string) float64 {
	// Simplified distance calculation
	// In production, use proper geolocation parsing and Haversine formula
	return 0.0 // Placeholder
}

func (qr *QRAttendanceSystem) validateTime(ctx context.Context, courseID, sessionID string) bool {
	// Get session time
	query := `
		SELECT start_time, end_time
		FROM course_sessions
		WHERE course_id = $1 AND session_id = $2
	`
	
	var startTime, endTime time.Time
	err := qr.db.QueryRowContext(ctx, query, courseID, sessionID).Scan(&startTime, &endTime)
	if err != nil {
		return false
	}
	
	now := time.Now()
	return now.After(startTime.Add(-15*time.Minute)) && now.Before(endTime.Add(15*time.Minute))
}

func (qr *QRAttendanceSystem) validateDevice(deviceID string) bool {
	// Simple device validation - in production, use device fingerprinting
	return deviceID != ""
}

func (qr *QRAttendanceSystem) validateFace(ctx context.Context, studentID, photoURL string) bool {
	// Get student's reference photo
	query := `
		SELECT reference_photo_url
		FROM students
		WHERE id = $1
	`
	
	var referencePhotoURL string
	err := qr.db.QueryRowContext(ctx, query, studentID).Scan(&referencePhotoURL)
	if err != nil {
		return false
	}
	
	// In production, use face recognition service
	// For now, just check if photo exists
	return referencePhotoURL != "" && photoURL != ""
}

func (qr *QRAttendanceSystem) incrementScanCount(ctx context.Context, codeID string) error {
	query := `
		UPDATE qr_codes
		SET current_scans = current_scans + 1
		WHERE code_id = $1
	`
	
	_, err := qr.db.ExecContext(ctx, query, codeID)
	return err
}

func (qr *QRAttendanceSystem) generateRecordID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return fmt.Sprintf("att_%x", bytes)
}

func (qr *QRAttendanceSystem) saveAttendanceRecord(ctx context.Context, record *AttendanceRecord) error {
	query := `
		INSERT INTO attendance_records (
			record_id, student_id, course_id, session_id, qr_code_id,
			scanned_at, location, device_id, ip_address, user_agent,
			photo_url, is_valid, status, validation_data
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`
	
	validationJSON, _ := json.Marshal(record.ValidationData)
	locationJSON, _ := json.Marshal(record.Location)
	
	_, err := qr.db.ExecContext(ctx, query,
		record.RecordID, record.StudentID, record.CourseID, record.SessionID,
		record.QRCodeID, record.ScannedAt, locationJSON, record.DeviceID,
		record.IPAddress, record.UserAgent, record.PhotoURL,
		record.IsValid, record.Status, validationJSON,
	)
	
	return err
}

func (qr *QRAttendanceSystem) checkDuplicateAttendance(ctx context.Context, record *AttendanceRecord) (bool, error) {
	query := `
		SELECT COUNT(*)
		FROM attendance_records
		WHERE student_id = $1
		AND course_id = $2
		AND session_id = $3
		AND scanned_at >= $4
		AND status = 'present'
	`
	
	// Check for attendance within last 5 minutes
	fiveMinutesAgo := record.ScannedAt.Add(-5 * time.Minute)
	
	var count int
	err := qr.db.QueryRowContext(ctx, query, record.StudentID, record.CourseID, 
		record.SessionID, fiveMinutesAgo).Scan(&count)
	
	return count > 0, err
}

func (qr *QRAttendanceSystem) GetQRCodeImage(ctx context.Context, codeID string) ([]byte, error) {
	// Get QR code data
	qrCode, err := qr.getQRCode(ctx, codeID)
	if err != nil {
		return nil, fmt.Errorf("QR code not found: %w", err)
	}
	
	// Generate QR code image
	qrData := fmt.Sprintf("academic://attendance/%s", codeID)
	qrCode, err := qrcode.New(qrData)
	if err != nil {
		return nil, fmt.Errorf("failed to generate QR code: %w", err)
	}
	
	// Convert to PNG
	return qrCode.PNG(256), nil
}

func (qr *QRAttendanceSystem) CreateAttendanceSession(ctx context.Context, session AttendanceSession) error {
	query := `
		INSERT INTO attendance_sessions (
			session_id, course_id, start_time, end_time, location,
			qr_code_enabled, auto_expire, expire_minutes, max_students,
			status
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (session_id) 
		DO UPDATE SET 
			start_time = EXCLUDED.start_time,
			end_time = EXCLUDED.end_time,
			location = EXCLUDED.location,
			qr_code_enabled = EXCLUDED.qr_code_enabled,
			auto_expire = EXCLUDED.auto_expire,
			expire_minutes = EXCLUDED.expire_minutes,
			max_students = EXCLUDED.max_students,
			status = EXCLUDED.status
	`
	
	_, err := qr.db.ExecContext(ctx, query,
		session.SessionID, session.CourseID, session.StartTime, session.EndTime,
		session.Location, session.QRCodeEnabled, session.AutoExpire,
		session.ExpireMinutes, session.MaxStudents, session.Status,
	)
	
	return err
}

func (qr *QRAttendanceSystem) GetAttendanceReport(ctx context.Context, courseID, sessionID string, dateRange DateRange) (*AttendanceReport, error) {
	query := `
		SELECT 
			ar.student_id,
			s.name as student_name,
			ar.scanned_at,
			ar.status,
			ar.is_valid,
			ar.validation_data
		FROM attendance_records ar
		JOIN students s ON ar.student_id = s.id
		WHERE ar.course_id = $1
		AND ar.session_id = $2
		AND ar.scanned_at BETWEEN $3 AND $4
		ORDER BY ar.scanned_at
	`
	
	rows, err := qr.db.QueryContext(ctx, query, courseID, sessionID, dateRange.Start, dateRange.End)
	if err != nil {
		return nil, fmt.Errorf("failed to get attendance records: %w", err)
	}
	defer rows.Close()
	
	var records []AttendanceRecord
	for rows.Next() {
		var record AttendanceRecord
		var validationJSON string
		
		err := rows.Scan(
			&record.StudentID, &record.CourseName, &record.ScannedAt,
			&record.Status, &record.IsValid, &validationJSON,
		)
		if err != nil {
			continue
		}
		
		json.Unmarshal([]byte(validationJSON), &record.ValidationData)
		records = append(records, record)
	}
	
	// Generate report statistics
	stats := qr.calculateAttendanceStats(records)
	
	return &AttendanceReport{
		CourseID:    courseID,
		SessionID:   sessionID,
		DateRange:   dateRange,
		Records:     records,
		Statistics:  stats,
		GeneratedAt: time.Now(),
	}, nil
}

type AttendanceReport struct {
	CourseID    string             `json:"course_id"`
	SessionID   string             `json:"session_id"`
	DateRange   DateRange           `json:"date_range"`
	Records     []AttendanceRecord  `json:"records"`
	Statistics  AttendanceStatistics `json:"statistics"`
	GeneratedAt time.Time          `json:"generated_at"`
}

type AttendanceStatistics struct {
	TotalStudents     int     `json:"total_students"`
	PresentStudents   int     `json:"present_students"`
	AbsentStudents   int     `json:"absent_students"`
	InvalidStudents   int     `json:"invalid_students"`
	DuplicateStudents int     `json:"duplicate_students"`
	AttendanceRate    float64 `json:"attendance_rate"`
	ValidAttendanceRate float64 `json:"valid_attendance_rate"`
	AverageScanTime   time.Time `json:"average_scan_time"`
}

func (qr *QRAttendanceSystem) calculateAttendanceStats(records []AttendanceRecord) AttendanceStatistics {
	stats := AttendanceStatistics{
		TotalStudents:   len(records),
		PresentStudents:  0,
		AbsentStudents:  0,
		InvalidStudents:  0,
		DuplicateStudents: 0,
	}
	
	var totalScanTime time.Duration
	validScanCount := 0
	
	for _, record := range records {
		switch record.Status {
		case "present":
			stats.PresentStudents++
			if record.IsValid {
				stats.ValidAttendanceRate++
				validScanCount++
				totalScanTime += record.ScannedAt.Sub(time.Time{}) // Simplified
			}
		case "absent":
			stats.AbsentStudents++
		case "invalid":
			stats.InvalidStudents++
		case "duplicate":
			stats.DuplicateStudents++
		}
	}
	
	if stats.TotalStudents > 0 {
		stats.AttendanceRate = float64(stats.PresentStudents) / float64(stats.TotalStudents) * 100
	}
	
	if validScanCount > 0 {
		stats.ValidAttendanceRate = float64(stats.ValidAttendanceRate) / float64(validScanCount) * 100
		avgTime := totalScanTime / time.Duration(validScanCount)
		stats.AverageScanTime = time.Time{}.Add(avgTime)
	}
	
	return stats
}

type DateRange struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}
