package repositories

import (
	"context"
	"time"

	"github.com/academic-system/auth-service/internal/domain/entities"
	"github.com/google/uuid"
)

// MockUserRepository is a mock implementation of UserRepository
type MockUserRepository struct{}

func NewUserRepository(db interface{}) UserRepository {
	return &MockUserRepository{}
}

func (r *MockUserRepository) Create(ctx context.Context, user *entities.User) error {
	// Mock implementation
	return nil
}

func (r *MockUserRepository) FindByID(ctx context.Context, id uuid.UUID) (*entities.User, error) {
	// Mock implementation
	return &entities.User{
		ID:        id,
		Email:     "test@example.com",
		Username:  "testuser",
		FirstName: "Test",
		LastName:  "User",
		Role:      entities.RoleStudent,
		Status:    entities.StatusActive,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}, nil
}

func (r *MockUserRepository) FindByEmail(ctx context.Context, email string) (*entities.User, error) {
	// Mock implementation
	return &entities.User{
		ID:        uuid.New(),
		Email:     email,
		Username:  "testuser",
		FirstName: "Test",
		LastName:  "User",
		Role:      entities.RoleStudent,
		Status:    entities.StatusActive,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}, nil
}

func (r *MockUserRepository) FindByUsername(ctx context.Context, username string) (*entities.User, error) {
	// Mock implementation
	return &entities.User{
		ID:        uuid.New(),
		Email:     "test@example.com",
		Username:  username,
		FirstName: "Test",
		LastName:  "User",
		Role:      entities.RoleStudent,
		Status:    entities.StatusActive,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}, nil
}

func (r *MockUserRepository) Update(ctx context.Context, user *entities.User) error {
	// Mock implementation
	return nil
}

func (r *MockUserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	// Mock implementation
	return nil
}

func (r *MockUserRepository) List(ctx context.Context, limit, offset int) ([]*entities.User, error) {
	// Mock implementation
	return []*entities.User{}, nil
}

func (r *MockUserRepository) Count(ctx context.Context) (int64, error) {
	// Mock implementation
	return 0, nil
}

func (r *MockUserRepository) EmailExists(ctx context.Context, email string) (bool, error) {
	// Mock implementation
	return false, nil
}

func (r *MockUserRepository) UsernameExists(ctx context.Context, username string) (bool, error) {
	// Mock implementation
	return false, nil
}

func (r *MockUserRepository) FindByRole(ctx context.Context, role entities.UserRole, limit, offset int) ([]*entities.User, error) {
	// Mock implementation
	return []*entities.User{}, nil
}

func (r *MockUserRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status entities.UserStatus) error {
	// Mock implementation
	return nil
}

func (r *MockUserRepository) FindActive(ctx context.Context, limit, offset int) ([]*entities.User, error) {
	// Mock implementation
	return []*entities.User{}, nil
}

func (r *MockUserRepository) Search(ctx context.Context, query string, limit, offset int) ([]*entities.User, error) {
	// Mock implementation
	return []*entities.User{}, nil
}

// MockSessionRepository is a mock implementation of SessionRepository
type MockSessionRepository struct{}

func NewSessionRepository(db interface{}) SessionRepository {
	return &MockSessionRepository{}
}

func (r *MockSessionRepository) Create(ctx context.Context, session *entities.UserSession) error {
	return nil
}

func (r *MockSessionRepository) FindByID(ctx context.Context, id uuid.UUID) (*entities.UserSession, error) {
	return &entities.UserSession{
		ID:        id,
		TokenHash: "mock-token",
		UserID:    uuid.New(),
		IsActive:  true,
		ExpiresAt: time.Now().Add(24 * time.Hour),
		CreatedAt: time.Now(),
	}, nil
}

func (r *MockSessionRepository) FindByTokenHash(ctx context.Context, tokenHash string) (*entities.UserSession, error) {
	return &entities.UserSession{
		ID:        uuid.New(),
		TokenHash: tokenHash,
		UserID:    uuid.New(),
		IsActive:  true,
		ExpiresAt: time.Now().Add(24 * time.Hour),
		CreatedAt: time.Now(),
	}, nil
}

func (r *MockSessionRepository) FindByUserID(ctx context.Context, userID uuid.UUID) ([]*entities.UserSession, error) {
	// Mock implementation
	return []*entities.UserSession{}, nil
}

func (r *MockSessionRepository) Update(ctx context.Context, session *entities.UserSession) error {
	// Mock implementation
	return nil
}

func (r *MockSessionRepository) Delete(ctx context.Context, id uuid.UUID) error {
	// Mock implementation
	return nil
}

func (r *MockSessionRepository) InvalidateByTokenHash(ctx context.Context, tokenHash string) error {
	// Mock implementation
	return nil
}

func (r *MockSessionRepository) InvalidateAllByUserID(ctx context.Context, userID uuid.UUID) error {
	// Mock implementation
	return nil
}

func (r *MockSessionRepository) CleanupExpired(ctx context.Context) error {
	// Mock implementation
	return nil
}

func (r *MockSessionRepository) CountActive(ctx context.Context) (int64, error) {
	// Mock implementation
	return 0, nil
}

// MockRefreshTokenRepository is a mock implementation of RefreshTokenRepository
type MockRefreshTokenRepository struct{}

func NewRefreshTokenRepository(db interface{}) RefreshTokenRepository {
	return &MockRefreshTokenRepository{}
}

func (r *MockRefreshTokenRepository) Create(ctx context.Context, token *entities.RefreshToken) error {
	return nil
}

func (r *MockRefreshTokenRepository) FindByID(ctx context.Context, id uuid.UUID) (*entities.RefreshToken, error) {
	return &entities.RefreshToken{
		ID:        id,
		TokenHash: "mock-token",
		UserID:    uuid.New(),
		IsRevoked: false,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
		CreatedAt: time.Now(),
	}, nil
}

func (r *MockRefreshTokenRepository) FindByTokenHash(ctx context.Context, tokenHash string) (*entities.RefreshToken, error) {
	return &entities.RefreshToken{
		ID:        uuid.New(),
		TokenHash: tokenHash,
		UserID:    uuid.New(),
		IsRevoked: false,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
		CreatedAt: time.Now(),
	}, nil
}

func (r *MockRefreshTokenRepository) FindByUserID(ctx context.Context, userID uuid.UUID) ([]*entities.RefreshToken, error) {
	// Mock implementation
	return []*entities.RefreshToken{}, nil
}

func (r *MockRefreshTokenRepository) Update(ctx context.Context, token *entities.RefreshToken) error {
	// Mock implementation
	return nil
}

func (r *MockRefreshTokenRepository) Delete(ctx context.Context, id uuid.UUID) error {
	// Mock implementation
	return nil
}

func (r *MockRefreshTokenRepository) Revoke(ctx context.Context, id uuid.UUID) error {
	// Mock implementation
	return nil
}

func (r *MockRefreshTokenRepository) RevokeAllByUserID(ctx context.Context, userID uuid.UUID) error {
	// Mock implementation
	return nil
}

func (r *MockRefreshTokenRepository) CleanupExpired(ctx context.Context) error {
	// Mock implementation
	return nil
}

func (r *MockRefreshTokenRepository) CountActive(ctx context.Context) (int64, error) {
	// Mock implementation
	return 0, nil
}
