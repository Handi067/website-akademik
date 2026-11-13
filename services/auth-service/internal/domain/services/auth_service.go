package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/academic-system/auth-service/internal/config"
	"github.com/academic-system/auth-service/internal/domain/entities"
	"github.com/academic-system/auth-service/internal/domain/repositories"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserNotFound       = errors.New("user not found")
	ErrUserInactive       = errors.New("user is inactive")
	ErrTokenExpired       = errors.New("token has expired")
	ErrTokenInvalid       = errors.New("token is invalid")
	ErrEmailAlreadyExists = errors.New("email already exists")
	ErrUsernameExists     = errors.New("username already exists")
)

type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresIn    int       `json:"expires_in"`
	TokenType    string    `json:"token_type"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type RegisterRequest struct {
	Username  string            `json:"username" binding:"required,min=3,max=50"`
	Email     string            `json:"email" binding:"required,email"`
	Password  string            `json:"password" binding:"required,min=6"`
	FirstName string            `json:"first_name" binding:"required,min=1,max=50"`
	LastName  string            `json:"last_name" binding:"max=50"`
	Role      entities.UserRole `json:"role" binding:"required,oneof=admin lecturer student staff"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=6"`
}

type AuthService struct {
	userRepo         repositories.UserRepository
	sessionRepo      repositories.SessionRepository
	refreshTokenRepo repositories.RefreshTokenRepository
	config           *config.Config
}

func NewAuthService(
	userRepo repositories.UserRepository,
	sessionRepo repositories.SessionRepository,
	refreshTokenRepo repositories.RefreshTokenRepository,
	config *config.Config,
) *AuthService {
	return &AuthService{
		userRepo:         userRepo,
		sessionRepo:      sessionRepo,
		refreshTokenRepo: refreshTokenRepo,
		config:           config,
	}
}

// Login authenticates a user and returns JWT tokens
func (s *AuthService) Login(ctx context.Context, req *LoginRequest) (*TokenPair, *entities.User, error) {
	// Find user by email
	user, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		return nil, nil, ErrUserNotFound
	}

	// Validate password
	if err := user.ValidatePassword(req.Password); err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	// Check if user is active
	if !user.IsActive() {
		return nil, nil, ErrUserInactive
	}

	// Update last login
	user.UpdateLastLogin()
	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, nil, fmt.Errorf("failed to update user: %w", err)
	}

	// Generate tokens
	tokenPair, err := s.generateTokenPair(user)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	return tokenPair, user, nil
}

// Register creates a new user account
func (s *AuthService) Register(ctx context.Context, req *RegisterRequest) (*entities.User, error) {
	// Check if email already exists
	if exists, err := s.userRepo.EmailExists(ctx, req.Email); err != nil {
		return nil, fmt.Errorf("failed to check email existence: %w", err)
	} else if exists {
		return nil, ErrEmailAlreadyExists
	}

	// Check if username already exists
	if exists, err := s.userRepo.UsernameExists(ctx, req.Username); err != nil {
		return nil, fmt.Errorf("failed to check username existence: %w", err)
	} else if exists {
		return nil, ErrUsernameExists
	}

	// Create new user
	user, err := entities.NewUser(req.Username, req.Email, req.Password, req.FirstName, req.LastName, req.Role)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Save user to database
	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to save user: %w", err)
	}

	return user, nil
}

// RefreshToken generates new access token using refresh token
func (s *AuthService) RefreshToken(ctx context.Context, req *RefreshTokenRequest) (*TokenPair, error) {
	// Parse and validate refresh token
	claims, err := s.parseRefreshToken(req.RefreshToken)
	if err != nil {
		return nil, ErrTokenInvalid
	}

	// Check if refresh token exists in database
	refreshToken, err := s.refreshTokenRepo.FindByTokenHash(ctx, (*claims)["token_hash"].(string))
	if err != nil {
		return nil, ErrTokenInvalid
	}

	// Check if refresh token is valid
	if !refreshToken.IsValid() {
		return nil, ErrTokenExpired
	}

	// Find user
	userID, err := uuid.Parse((*claims)["user_id"].(string))
	if err != nil {
		return nil, ErrTokenInvalid
	}
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, ErrUserNotFound
	}

	// Check if user is active
	if !user.IsActive() {
		return nil, ErrUserInactive
	}

	// Generate new token pair
	tokenPair, err := s.generateTokenPair(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	// Revoke old refresh token
	if err := s.refreshTokenRepo.Revoke(ctx, refreshToken.ID); err != nil {
		return nil, fmt.Errorf("failed to revoke refresh token: %w", err)
	}

	return tokenPair, nil
}

// Logout invalidates user sessions
func (s *AuthService) Logout(ctx context.Context, userID uuid.UUID, tokenHash string) error {
	// Invalidate session
	if err := s.sessionRepo.InvalidateByTokenHash(ctx, tokenHash); err != nil {
		return fmt.Errorf("failed to invalidate session: %w", err)
	}

	// Invalidate all refresh tokens for the user
	if err := s.refreshTokenRepo.RevokeAllByUserID(ctx, userID); err != nil {
		return fmt.Errorf("failed to revoke refresh tokens: %w", err)
	}

	return nil
}

// ChangePassword changes user password
func (s *AuthService) ChangePassword(ctx context.Context, userID uuid.UUID, req *ChangePasswordRequest) error {
	// Find user
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return ErrUserNotFound
	}

	// Validate current password
	if err := user.ValidatePassword(req.CurrentPassword); err != nil {
		return ErrInvalidCredentials
	}

	// Update password
	if err := user.UpdatePassword(req.NewPassword); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Save user
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to save user: %w", err)
	}

	// Invalidate all sessions and refresh tokens for the user
	if err := s.sessionRepo.InvalidateAllByUserID(ctx, userID); err != nil {
		return fmt.Errorf("failed to invalidate sessions: %w", err)
	}

	if err := s.refreshTokenRepo.RevokeAllByUserID(ctx, userID); err != nil {
		return fmt.Errorf("failed to revoke refresh tokens: %w", err)
	}

	return nil
}

// ValidateToken validates JWT access token and returns user information
func (s *AuthService) ValidateToken(ctx context.Context, tokenString string) (*entities.User, error) {
	// Parse and validate token
	claims, err := s.ParseAccessToken(tokenString)
	if err != nil {
		return nil, ErrTokenInvalid
	}

	// Check if session exists and is valid
	session, err := s.sessionRepo.FindByTokenHash(ctx, (*claims)["token_hash"].(string))
	if err != nil || !session.IsActive || session.IsExpired() {
		return nil, ErrTokenInvalid
	}

	// Find user
	userID, err := uuid.Parse((*claims)["user_id"].(string))
	if err != nil {
		return nil, ErrTokenInvalid
	}
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, ErrUserNotFound
	}

	// Check if user is active
	if !user.IsActive() {
		return nil, ErrUserInactive
	}

	return user, nil
}

// generateTokenPair generates access and refresh tokens
func (s *AuthService) generateTokenPair(user *entities.User) (*TokenPair, error) {
	now := time.Now()

	// Parse expiry durations
	accessExpiry, err := time.ParseDuration(s.config.JWT.AccessExpiry)
	if err != nil {
		return nil, fmt.Errorf("invalid access token expiry: %w", err)
	}

	refreshExpiry, err := time.ParseDuration(s.config.JWT.RefreshExpiry)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token expiry: %w", err)
	}

	// Generate token hashes
	accessTokenHash := s.generateTokenHash()
	refreshTokenHash := s.generateTokenHash()

	// Create access token claims
	accessClaims := jwt.MapClaims{
		"user_id":    user.ID.String(),
		"username":   user.Username,
		"email":      user.Email,
		"role":       string(user.Role),
		"token_hash": accessTokenHash,
		"exp":        now.Add(accessExpiry).Unix(),
		"iat":        now.Unix(),
		"iss":        s.config.JWT.Issuer,
		"sub":        user.ID.String(),
	}

	// Create refresh token claims
	refreshClaims := jwt.MapClaims{
		"user_id":    user.ID.String(),
		"token_hash": refreshTokenHash,
		"exp":        now.Add(refreshExpiry).Unix(),
		"iat":        now.Unix(),
		"iss":        s.config.JWT.Issuer,
		"sub":        user.ID.String(),
		"type":       "refresh",
	}

	// Generate tokens
	accessToken := jwt.NewWithClaims(jwt.GetSigningMethod(s.config.JWT.Algorithm), accessClaims)
	refreshToken := jwt.NewWithClaims(jwt.GetSigningMethod(s.config.JWT.Algorithm), refreshClaims)

	// Sign tokens
	accessTokenString, err := accessToken.SignedString([]byte(s.config.JWT.Secret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	refreshTokenString, err := refreshToken.SignedString([]byte(s.config.JWT.Secret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	// Save session
	session := entities.NewUserSession(user.ID, accessTokenHash, now.Add(accessExpiry))
	if err := s.sessionRepo.Create(context.Background(), session); err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	// Save refresh token
	refreshTokenEntity := entities.NewRefreshToken(user.ID, refreshTokenHash, now.Add(refreshExpiry))
	if err := s.refreshTokenRepo.Create(context.Background(), refreshTokenEntity); err != nil {
		return nil, fmt.Errorf("failed to create refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessTokenString,
		RefreshToken: refreshTokenString,
		ExpiresIn:    int(accessExpiry.Seconds()),
		TokenType:    "Bearer",
		ExpiresAt:    now.Add(accessExpiry),
	}, nil
}

// ParseAccessToken parses and validates access token
func (s *AuthService) ParseAccessToken(tokenString string) (*jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.config.JWT.Secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return &claims, nil
	}

	return nil, ErrTokenInvalid
}

// parseRefreshToken parses and validates refresh token
func (s *AuthService) parseRefreshToken(tokenString string) (*jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.config.JWT.Secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		// Check if it's a refresh token
		if tokenType, exists := claims["type"]; !exists || tokenType != "refresh" {
			return nil, ErrTokenInvalid
		}
		return &claims, nil
	}

	return nil, ErrTokenInvalid
}

// generateTokenHash generates a random token hash
func (s *AuthService) generateTokenHash() string {
	return uuid.New().String()
}
