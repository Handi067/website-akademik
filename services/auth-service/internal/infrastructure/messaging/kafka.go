package messaging

import (
	"context"
	"fmt"

	"github.com/academic-system/auth-service/internal/config"
)

// MockProducer is a placeholder implementation
type MockProducer struct {
	topics config.TopicsConfig
}

type Event struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data"`
	Timestamp string      `json:"timestamp"`
	UserID    string      `json:"user_id,omitempty"`
	RequestID string      `json:"request_id,omitempty"`
}

// MockConsumer is a placeholder implementation
type MockConsumer struct{}

func NewProducer(cfg config.KafkaConfig) (*MockProducer, error) {
	return &MockProducer{
		topics: cfg.Topics,
	}, nil
}

func (p *MockProducer) Publish(ctx context.Context, topic string, event Event) error {
	// Mock implementation - just log the event
	fmt.Printf("Mock publishing to topic %s: %+v\n", topic, event)
	return nil
}

func (p *MockProducer) Close() error {
	fmt.Println("Mock producer closed")
	return nil
}

func NewConsumer(cfg config.KafkaConfig) (*MockConsumer, error) {
	return &MockConsumer{}, nil
}

func (c *MockConsumer) Subscribe(topics []string) error {
	fmt.Printf("Mock subscribing to topics: %v\n", topics)
	return nil
}

func (c *MockConsumer) Close() error {
	fmt.Println("Mock consumer closed")
	return nil
}
