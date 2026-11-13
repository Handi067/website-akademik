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
	Capacity   int    `json:"capacity" db:"capacity"`
	Enrolled   int    `json:"enrolled" db:"enrolled"`
}

// Faculty related models
type Faculty struct {
	BaseModel
	FacultyID   string `json:"faculty_id" db:"faculty_id"`
	Name        string  `json:"name" db:"name"`
	Email       string  `json:"email" db:"email"`
	Department  string  `json:"department" db:"department"`
	Rank        string  `json:"rank" db:"rank"`
}

// Academic related models
type Enrollment struct {
	BaseModel
	StudentID  string `json:"student_id" db:"student_id"`
	CourseID   string `json:"course_id" db:"course_id"`
	Semester   string `json:"semester" db:"semester"`
	Year       int    `json:"year" db:"year"`
	Status     string `json:"status" db:"status"`
	Grade      string `json:"grade" db:"grade"`
}

// Simulation related models
type CourseResource struct {
	CourseID     string `json:"course_id" db:"course_id"`
	ResourceType string `json:"resource_type" db:"resource_type"`
	ResourceID   string `json:"resource_id" db:"resource_id"`
	Quantity     int    `json:"quantity" db:"quantity"`
}

type EnrollmentMetrics struct {
	TotalEnrolled    int     `json:"total_enrolled"`
	AvailableSlots   int     `json:"available_slots"`
	UtilizationRate  float64 `json:"utilization_rate"`
	PredictedDemand  int     `json:"predicted_demand"`
	WaitlistCount    int     `json:"waitlist_count"`
}

type SimulationScenario struct {
	ScenarioID      string                 `json:"scenario_id" db:"scenario_id"`
	Name            string                 `json:"name" db:"name"`
	Description     string                 `json:"description" db:"description"`
	Parameters      map[string]interface{} `json:"parameters" db:"parameters"`
	CreatedBy       string                 `json:"created_by" db:"created_by"`
	Status          string                 `json:"status" db:"status"`
}
