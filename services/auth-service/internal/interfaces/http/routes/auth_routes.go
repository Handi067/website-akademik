package routes

import (
	"net/http"

	"github.com/academic-system/auth-service/internal/config"
	"github.com/academic-system/auth-service/internal/domain/repositories"
	"github.com/academic-system/auth-service/internal/domain/services"
	"github.com/academic-system/auth-service/internal/infrastructure/messaging"
	"github.com/academic-system/auth-service/internal/interfaces/http/handlers"
	"github.com/academic-system/auth-service/internal/interfaces/http/middleware"
	"github.com/academic-system/auth-service/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

func SetupRoutes(
	router *gin.Engine,
	db interface{},
	redisClient *redis.Client,
	kafkaProducer *messaging.MockProducer,
	cfg *config.Config,
	logger *logger.Logger,
) {
	// Initialize repositories
	userRepo := repositories.NewUserRepository(db)
	sessionRepo := repositories.NewSessionRepository(db)
	refreshTokenRepo := repositories.NewRefreshTokenRepository(db)

	// Initialize services
	authService := services.NewAuthService(userRepo, sessionRepo, refreshTokenRepo, cfg)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authService, cfg, logger)

	// Initialize middleware
	authMiddleware := middleware.NewAuthMiddleware(authService)

	// API version 1
	v1 := router.Group("/api/v1")
	{
		// Public routes
		public := v1.Group("/auth")
		{
			public.POST("/login", authHandler.Login)
			public.POST("/register", authHandler.Register)
			public.POST("/refresh", authHandler.RefreshToken)
		}

		// Protected routes
		protected := v1.Group("/")
		protected.Use(authMiddleware.RequireAuth())
		{
			// Auth routes
			auth := protected.Group("/auth")
			{
				auth.POST("/logout", authHandler.Logout)
				auth.POST("/change-password", authHandler.ChangePassword)
				auth.GET("/profile", authHandler.GetProfile)
			}

			// Admin routes
			admin := protected.Group("/admin")
			admin.Use(authMiddleware.RequireRole("admin"))
			{
				// Admin endpoints will be added here
				admin.GET("/dashboard", func(c *gin.Context) {
					c.JSON(200, gin.H{
						"message": "Admin dashboard",
						"user_id": c.GetString("user_id"),
					})
				})
			}

			// Lecturer routes
			lecturer := protected.Group("/lecturer")
			lecturer.Use(authMiddleware.RequireRole("lecturer"))
			{
				// Lecturer endpoints will be added here
				lecturer.GET("/dashboard", func(c *gin.Context) {
					c.JSON(200, gin.H{
						"message": "Lecturer dashboard",
						"user_id": c.GetString("user_id"),
					})
				})
			}

			// Student routes
			student := protected.Group("/student")
			student.Use(authMiddleware.RequireRole("student"))
			{
				// Student endpoints will be added here
				student.GET("/dashboard", func(c *gin.Context) {
					c.JSON(200, gin.H{
						"message": "Student dashboard",
						"user_id": c.GetString("user_id"),
					})
				})
			}
		}
	}

	// Health check endpoints
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "auth-service",
		})
	})

	router.GET("/ready", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ready",
		})
	})
}
