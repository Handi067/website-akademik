package models

import (
	"time"
)

// Common models used across services
type BaseModel struct {
	ID        string    `json:"id" db:"id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type Pagination struct {
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
	Total    int `json:"total"`
}

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Message string      `json:"message"`
	Error   string      `json:"error,omitempty"`
}

type ErrorResponse struct {
	Error   string `json:"error"`
	Code    int    `json:"code"`
	Details string `json:"details,omitempty"`
}

// Student related models
type Student struct {
	BaseModel
	StudentID   string  `json:"student_id" db:"student_id"`
	Name        string  `json:"name" db:"name"`
	Email       string  `json:"email" db:"email"`
	Program     string  `json:"program" db:"program"`
	Year        int     `json:"year" db:"year"`
	GPA         float64 `json:"gpa" db:"gpa"`
	Status      string  `json:"status" db:"status"`
}

// Course related models
type Course struct {
	BaseModel
	CourseCode string `json:"course_code" db:"course_code"`
	Name      string `json:"name" db:"name"`
	Credits   int    `json:"credits" db:"credits"`
	Department string `json:"department" db:"department"`
}

// Faculty related models
type Faculty struct {
	BaseModel
	FacultyID   string `json:"faculty_id" db:"faculty_id"`
	Name        string `json:"name" db:"name"`
	Email       string `json:"email" db:"email"`
	Department  string `json:"department" db:"department"`
	Rank        string `json:"rank" db:"rank"`
}

// Analytics related models
type AnalyticsData struct {
	BaseModel
	DataType    string                 `json:"data_type" db:"data_type"`
	Metrics     map[string]interface{} `json:"metrics" db:"metrics"`
	Dimensions  map[string]interface{} `json:"dimensions" db:"dimensions"`
	Timestamp   time.Time              `json:"timestamp" db:"timestamp"`
}

// Risk related models
type RiskAssessment struct {
	BaseModel
	StudentID       string  `json:"student_id" db:"student_id"`
	RiskType        string  `json:"risk_type" db:"risk_type"`
	RiskLevel       string  `json:"risk_level" db:"risk_level"`
	RiskScore       float64 `json:"risk_score" db:"risk_score"`
	Factors         []string `json:"factors" db:"factors"`
	Recommendations  []string `json:"recommendations" db:"recommendations"`
}

// Recommendation related models
type Recommendation struct {
	BaseModel
	StudentID       string  `json:"student_id" db:"student_id"`
	RecommendationType string `json:"recommendation_type" db:"recommendation_type"`
	Content         string  `json:"content" db:"content"`
	Priority        string  `json:"priority" db:"priority"`
	Confidence      float64 `json:"confidence" db:"confidence"`
	Status          string  `json:"status" db:"status"`
}

// Simulation related models
type SimulationResult struct {
	BaseModel
	SimulationID   string                 `json:"simulation_id" db:"simulation_id"`
	ScenarioType   string                 `json:"scenario_type" db:"scenario_type"`
	Parameters     map[string]interface{} `json:"parameters" db:"parameters"`
	Results        map[string]interface{} `json:"results" db:"results"`
	Confidence     float64                `json:"confidence" db:"confidence"`
	Status         string                 `json:"status" db:"status"`
}
