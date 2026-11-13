package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Environment string `mapstructure:"ENVIRONMENT"`
	Port        int    `mapstructure:"PORT"`
	Version     string `mapstructure:"VERSION"`
	LogLevel    string `mapstructure:"LOG_LEVEL"`

	Database DatabaseConfig `mapstructure:"database"`
	Redis    RedisConfig    `mapstructure:"redis"`
	Kafka    KafkaConfig    `mapstructure:"kafka"`
	JWT      JWTConfig      `mapstructure:"jwt"`
	JaegerEndpoint string   `mapstructure:"JAEGER_ENDPOINT"`
}

type DatabaseConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	User         string `mapstructure:"user"`
	Password     string `mapstructure:"password"`
	Database     string `mapstructure:"database"`
	SSLMode      string `mapstructure:"sslmode"`
	MaxOpenConns int    `mapstructure:"max_open_conns"`
	MaxIdleConns int    `mapstructure:"max_idle_conns"`
	MigrationPath string `mapstructure:"migration_path"`
}

type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

type KafkaConfig struct {
	Brokers []string `mapstructure:"brokers"`
	Topics  TopicsConfig `mapstructure:"topics"`
}

type TopicsConfig struct {
	UserEvents    string `mapstructure:"user_events"`
	AuthEvents    string `mapstructure:"auth_events"`
	AuditEvents   string `mapstructure:"audit_events"`
}

type JWTConfig struct {
	Secret         string        `mapstructure:"secret"`
	AccessExpiry   string        `mapstructure:"access_expiry"`
	RefreshExpiry  string        `mapstructure:"refresh_expiry"`
	Issuer         string        `mapstructure:"issuer"`
	Algorithm      string        `mapstructure:"algorithm"`
}

func Load() (*Config, error) {
	// Set default values
	setDefaults()

	// Load environment variables
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// Load config file if exists
	if configPath := os.Getenv("CONFIG_PATH"); configPath != "" {
		viper.SetConfigFile(configPath)
		if err := viper.ReadInConfig(); err != nil {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Validate configuration
	if err := validate(&cfg); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return &cfg, nil
}

func setDefaults() {
	// Application defaults
	viper.SetDefault("ENVIRONMENT", "development")
	viper.SetDefault("PORT", 8001)
	viper.SetDefault("VERSION", "1.0.0")
	viper.SetDefault("LOG_LEVEL", "info")
	viper.SetDefault("JAEGER_ENDPOINT", "http://localhost:14268/api/traces")

	// Database defaults
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 5432)
	viper.SetDefault("database.user", "postgres")
	viper.SetDefault("database.password", "password")
	viper.SetDefault("database.database", "auth_db")
	viper.SetDefault("database.sslmode", "disable")
	viper.SetDefault("database.max_open_conns", 25)
	viper.SetDefault("database.max_idle_conns", 5)
	viper.SetDefault("database.migration_path", "./migrations")

	// Redis defaults
	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", 6379)
	viper.SetDefault("redis.password", "")
	viper.SetDefault("redis.db", 0)

	// Kafka defaults
	viper.SetDefault("kafka.brokers", []string{"localhost:9092"})
	viper.SetDefault("kafka.topics.user_events", "user-events")
	viper.SetDefault("kafka.topics.auth_events", "auth-events")
	viper.SetDefault("kafka.topics.audit_events", "audit-events")

	// JWT defaults
	viper.SetDefault("jwt.secret", "your-super-secret-jwt-key")
	viper.SetDefault("jwt.access_expiry", "15m")
	viper.SetDefault("jwt.refresh_expiry", "7d")
	viper.SetDefault("jwt.issuer", "academic-system")
	viper.SetDefault("jwt.algorithm", "HS256")
}

func validate(cfg *Config) error {
	if cfg.Port <= 0 || cfg.Port > 65535 {
		return fmt.Errorf("invalid port number: %d", cfg.Port)
	}

	if cfg.Database.Host == "" {
		return fmt.Errorf("database host is required")
	}

	if cfg.Database.User == "" {
		return fmt.Errorf("database user is required")
	}

	if cfg.Database.Database == "" {
		return fmt.Errorf("database name is required")
	}

	if cfg.Redis.Host == "" {
		return fmt.Errorf("redis host is required")
	}

	if len(cfg.Kafka.Brokers) == 0 {
		return fmt.Errorf("at least one kafka broker is required")
	}

	if cfg.JWT.Secret == "" {
		return fmt.Errorf("jwt secret is required")
	}

	if cfg.JWT.AccessExpiry == "" {
		return fmt.Errorf("jwt access expiry is required")
	}

	if cfg.JWT.RefreshExpiry == "" {
		return fmt.Errorf("jwt refresh expiry is required")
	}

	return nil
}

// Helper functions to parse environment variables
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getEnvAsSlice(key string, defaultValue []string, separator string) []string {
	if value := os.Getenv(key); value != "" {
		return strings.Split(value, separator)
	}
	return defaultValue
}
