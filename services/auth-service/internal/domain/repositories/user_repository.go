package repositories

import (
	"context"

	"github.com/academic-system/auth-service/internal/domain/entities"
	"github.com/google/uuid"
)

type UserRepository interface {
	// Create creates a new user
	Create(ctx context.Context, user *entities.User) error

	// FindByID finds a user by ID
	FindByID(ctx context.Context, id uuid.UUID) (*entities.User, error)

	// FindByEmail finds a user by email
	FindByEmail(ctx context.Context, email string) (*entities.User, error)

	// FindByUsername finds a user by username
	FindByUsername(ctx context.Context, username string) (*entities.User, error)

	// Update updates a user
	Update(ctx context.Context, user *entities.User) error

	// Delete deletes a user
	Delete(ctx context.Context, id uuid.UUID) error

	// List returns a list of users with pagination
	List(ctx context.Context, limit, offset int) ([]*entities.User, error)

	// Count returns the total number of users
	Count(ctx context.Context) (int64, error)

	// EmailExists checks if email already exists
	EmailExists(ctx context.Context, email string) (bool, error)

	// UsernameExists checks if username already exists
	UsernameExists(ctx context.Context, username string) (bool, error)

	// FindByRole returns users by role
	FindByRole(ctx context.Context, role entities.UserRole, limit, offset int) ([]*entities.User, error)

	// UpdateStatus updates user status
	UpdateStatus(ctx context.Context, id uuid.UUID, status entities.UserStatus) error

	// FindActive returns active users
	FindActive(ctx context.Context, limit, offset int) ([]*entities.User, error)

	// Search searches users by name or email
	Search(ctx context.Context, query string, limit, offset int) ([]*entities.User, error)
}

type SessionRepository interface {
	// Create creates a new session
	Create(ctx context.Context, session *entities.UserSession) error

	// FindByID finds a session by ID
	FindByID(ctx context.Context, id uuid.UUID) (*entities.UserSession, error)

	// FindByTokenHash finds a session by token hash
	FindByTokenHash(ctx context.Context, tokenHash string) (*entities.UserSession, error)

	// FindByUserID finds sessions by user ID
	FindByUserID(ctx context.Context, userID uuid.UUID) ([]*entities.UserSession, error)

	// Update updates a session
	Update(ctx context.Context, session *entities.UserSession) error

	// Delete deletes a session
	Delete(ctx context.Context, id uuid.UUID) error

	// InvalidateByTokenHash invalidates a session by token hash
	InvalidateByTokenHash(ctx context.Context, tokenHash string) error

	// InvalidateAllByUserID invalidates all sessions for a user
	InvalidateAllByUserID(ctx context.Context, userID uuid.UUID) error

	// CleanupExpired removes expired sessions
	CleanupExpired(ctx context.Context) error

	// CountActive returns the number of active sessions
	CountActive(ctx context.Context) (int64, error)
}

type RefreshTokenRepository interface {
	// Create creates a new refresh token
	Create(ctx context.Context, token *entities.RefreshToken) error

	// FindByID finds a refresh token by ID
	FindByID(ctx context.Context, id uuid.UUID) (*entities.RefreshToken, error)

	// FindByTokenHash finds a refresh token by token hash
	FindByTokenHash(ctx context.Context, tokenHash string) (*entities.RefreshToken, error)

	// FindByUserID finds refresh tokens by user ID
	FindByUserID(ctx context.Context, userID uuid.UUID) ([]*entities.RefreshToken, error)

	// Update updates a refresh token
	Update(ctx context.Context, token *entities.RefreshToken) error

	// Delete deletes a refresh token
	Delete(ctx context.Context, id uuid.UUID) error

	// Revoke revokes a refresh token
	Revoke(ctx context.Context, id uuid.UUID) error

	// RevokeAllByUserID revokes all refresh tokens for a user
	RevokeAllByUserID(ctx context.Context, userID uuid.UUID) error

	// CleanupExpired removes expired refresh tokens
	CleanupExpired(ctx context.Context) error

	// CountActive returns the number of active refresh tokens
	CountActive(ctx context.Context) (int64, error)
}

type PasswordResetRepository interface {
	// Create creates a new password reset token
	Create(ctx context.Context, reset *entities.PasswordReset) error

	// FindByID finds a password reset token by ID
	FindByID(ctx context.Context, id uuid.UUID) (*entities.PasswordReset, error)

	// FindByTokenHash finds a password reset token by token hash
	FindByTokenHash(ctx context.Context, tokenHash string) (*entities.PasswordReset, error)

	// FindByUserID finds password reset tokens by user ID
	FindByUserID(ctx context.Context, userID uuid.UUID) ([]*entities.PasswordReset, error)

	// Update updates a password reset token
	Update(ctx context.Context, reset *entities.PasswordReset) error

	// Delete deletes a password reset token
	Delete(ctx context.Context, id uuid.UUID) error

	// MarkAsUsed marks a password reset token as used
	MarkAsUsed(ctx context.Context, id uuid.UUID) error

	// CleanupExpired removes expired password reset tokens
	CleanupExpired(ctx context.Context) error
}
