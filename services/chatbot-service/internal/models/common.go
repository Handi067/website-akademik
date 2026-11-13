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

// Chatbot related models
type ChatMessage struct {
	BaseModel
	SessionID   string `json:"session_id" db:"session_id"`
	UserID      string `json:"user_id" db:"user_id"`
	MessageType string `json:"message_type" db:"message_type"`
	Content     string `json:"content" db:"content"`
	Intent      string `json:"intent" db:"intent"`
	Entities    string `json:"entities" db:"entities"`
	Response    string `json:"response" db:"response"`
	Confidence  float64 `json:"confidence" db:"confidence"`
}

type ChatSession struct {
	BaseModel
	SessionID    string    `json:"session_id" db:"session_id"`
	UserID       string    `json:"user_id" db:"user_id"`
	StartTime    time.Time `json:"start_time" db:"start_time"`
	EndTime      *time.Time `json:"end_time" db:"end_time"`
	Status       string    `json:"status" db:"status"`
	LastActivity time.Time `json:"last_activity" db:"last_activity"`
}

type NLPIntent struct {
	IntentID    string   `json:"intent_id" db:"intent_id"`
	Name        string   `json:"name" db:"name"`
	Description string   `json:"description" db:"description"`
	Examples    []string `json:"examples" db:"examples"`
	Responses   []string `json:"responses" db:"responses"`
}

type NLPEntity struct {
	EntityID    string `json:"entity_id" db:"entity_id"`
	Name        string `json:"name" db:"name"`
	Type        string `json:"type" db:"type"`
	Description string `json:"description" db:"description"`
}

type NLPProcessor struct {
	ModelPath     string            `json:"model_path"`
	Intents       map[string]Intent `json:"intents"`
	Entities      map[string]Entity `json:"entities"`
	IsInitialized bool              `json:"is_initialized"`
}

type Intent struct {
	Name        string   `json:"name"`
	Examples    []string `json:"examples"`
	Responses   []string `json:"responses"`
	Confidence  float64  `json:"confidence"`
}

type Entity struct {
	Name   string   `json:"name"`
	Type   string   `json:"type"`
	Values []string `json:"values"`
}
