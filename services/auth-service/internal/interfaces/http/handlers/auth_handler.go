package handlers

import (
	"net/http"

	"github.com/academic-system/auth-service/internal/config"
	"github.com/academic-system/auth-service/internal/domain/services"
	"github.com/academic-system/auth-service/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AuthHandler struct {
	authService *services.AuthService
	config      *config.Config
	logger      *logger.Logger
}

func NewAuthHandler(authService *services.AuthService, config *config.Config, logger *logger.Logger) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		config:      config,
		logger:      logger,
	}
}

// Login handles user login
func (h *AuthHandler) Login(c *gin.Context) {
	var req services.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	tokenPair, user, err := h.authService.Login(c.Request.Context(), &req)
	if err != nil {
		switch err {
		case services.ErrInvalidCredentials:
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "invalid_credentials",
				"message": "Invalid email or password",
			})
		case services.ErrUserNotFound:
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "user_not_found",
				"message": "User not found",
			})
		case services.ErrUserInactive:
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "user_inactive",
				"message": "User account is inactive",
			})
		default:
			h.logger.Error("Login failed", "error", err, "email", req.Email)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "internal_error",
				"message": "Internal server error",
			})
		}
		return
	}

	h.logger.Info("User logged in", "user_id", user.ID, "email", user.Email, "request_id", c.GetString("requestID"))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"tokens": tokenPair,
			"user": gin.H{
				"id":         user.ID,
				"username":   user.Username,
				"email":      user.Email,
				"first_name": user.FirstName,
				"last_name":  user.LastName,
				"role":       user.Role,
				"status":     user.Status,
			},
		},
	})
}

// Register handles user registration
func (h *AuthHandler) Register(c *gin.Context) {
	var req services.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	user, err := h.authService.Register(c.Request.Context(), &req)
	if err != nil {
		switch err {
		case services.ErrEmailAlreadyExists:
			c.JSON(http.StatusConflict, gin.H{
				"error":   "email_already_exists",
				"message": "Email already exists",
			})
		case services.ErrUsernameExists:
			c.JSON(http.StatusConflict, gin.H{
				"error":   "username_already_exists",
				"message": "Username already exists",
			})
		default:
			h.logger.Error("Registration failed", "error", err, "email", req.Email)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "internal_error",
				"message": "Internal server error",
			})
		}
		return
	}

	h.logger.Info("User registered", "user_id", user.ID, "email", user.Email, "role", user.Role, "request_id", c.GetString("requestID"))

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": gin.H{
			"user": gin.H{
				"id":         user.ID,
				"username":   user.Username,
				"email":      user.Email,
				"first_name": user.FirstName,
				"last_name":  user.LastName,
				"role":       user.Role,
				"status":     user.Status,
			},
		},
	})
}

// RefreshToken handles token refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req services.RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	tokenPair, err := h.authService.RefreshToken(c.Request.Context(), &req)
	if err != nil {
		switch err {
		case services.ErrTokenExpired:
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "token_expired",
				"message": "Refresh token has expired",
			})
		case services.ErrTokenInvalid:
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "token_invalid",
				"message": "Invalid refresh token",
			})
		default:
			h.logger.Error("Token refresh failed", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "internal_error",
				"message": "Internal server error",
			})
		}
		return
	}

	h.logger.Info("Token refreshed", "request_id", c.GetString("requestID"))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"tokens": tokenPair,
		},
	})
}

// Logout handles user logout
func (h *AuthHandler) Logout(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User not authenticated",
		})
		return
	}

	tokenHash, exists := c.Get("token_hash")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "Invalid token",
		})
		return
	}

	userIDStr := userID.(string)
	userIDUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": "Invalid user ID format",
		})
		return
	}

	err = h.authService.Logout(c.Request.Context(), userIDUUID, tokenHash.(string))
	if err != nil {
		h.logger.Error("Logout failed", "error", err, "user_id", userID)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "internal_error",
			"message": "Internal server error",
		})
		return
	}

	h.logger.Info("User logged out", "user_id", userID, "request_id", c.GetString("requestID"))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Logged out successfully",
	})
}

// ChangePassword handles password change
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User not authenticated",
		})
		return
	}

	var req services.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	userIDStr := userID.(string)
	userIDUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": "Invalid user ID format",
		})
		return
	}

	err = h.authService.ChangePassword(c.Request.Context(), userIDUUID, &req)
	if err != nil {
		switch err {
		case services.ErrInvalidCredentials:
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "invalid_credentials",
				"message": "Current password is incorrect",
			})
		default:
			h.logger.Error("Password change failed", "error", err, "user_id", userID)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "internal_error",
				"message": "Internal server error",
			})
		}
		return
	}

	h.logger.Info("Password changed", "user_id", userID, "request_id", c.GetString("requestID"))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Password changed successfully",
	})
}

// ValidateToken handles token validation
func (h *AuthHandler) ValidateToken(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "missing_token",
			"message": "Authorization header is required",
		})
		return
	}

	// Extract token from "Bearer <token>"
	tokenString := authHeader[7:] // Remove "Bearer " prefix
	if len(tokenString) < 10 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "invalid_token",
			"message": "Invalid authorization header",
		})
		return
	}

	user, err := h.authService.ValidateToken(c.Request.Context(), tokenString)
	if err != nil {
		switch err {
		case services.ErrTokenExpired:
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "token_expired",
				"message": "Token has expired",
			})
		case services.ErrTokenInvalid:
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "token_invalid",
				"message": "Invalid token",
			})
		case services.ErrUserNotFound:
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "user_not_found",
				"message": "User not found",
			})
		case services.ErrUserInactive:
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "user_inactive",
				"message": "User account is inactive",
			})
		default:
			h.logger.Error("Token validation failed", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "internal_error",
				"message": "Internal server error",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"user": gin.H{
				"id":         user.ID,
				"username":   user.Username,
				"email":      user.Email,
				"first_name": user.FirstName,
				"last_name":  user.LastName,
				"role":       user.Role,
				"status":     user.Status,
			},
		},
	})
}

// GetProfile handles getting user profile
func (h *AuthHandler) GetProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User not authenticated",
		})
		return
	}

	// This would typically call a user service to get full profile
	// For now, return basic user info from token
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"user_id": userID,
			"message": "Profile endpoint - to be implemented with user service integration",
		},
	})
}
