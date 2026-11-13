package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/academic-system/auth-service/internal/config"
	"github.com/go-redis/redis/v8"
)

type Client struct {
	*redis.Client
}

func New(cfg config.RedisConfig) (*Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &Client{rdb}, nil
}

// SetSession stores session data with expiration
func (c *Client) SetSession(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return c.Set(ctx, key, value, expiration).Err()
}

// GetSession retrieves session data
func (c *Client) GetSession(ctx context.Context, key string) (string, error) {
	return c.Get(ctx, key).Result()
}

// DeleteSession removes session data
func (c *Client) DeleteSession(ctx context.Context, key string) error {
	return c.Del(ctx, key).Err()
}

// SetBlacklistToken adds token to blacklist with expiration
func (c *Client) SetBlacklistToken(ctx context.Context, tokenHash string, expiration time.Duration) error {
	key := fmt.Sprintf("blacklist:%s", tokenHash)
	return c.Set(ctx, key, "1", expiration).Err()
}

// IsTokenBlacklisted checks if token is blacklisted
func (c *Client) IsTokenBlacklisted(ctx context.Context, tokenHash string) (bool, error) {
	key := fmt.Sprintf("blacklist:%s", tokenHash)
	result, err := c.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return result > 0, nil
}

// SetRateLimit implements rate limiting
func (c *Client) SetRateLimit(ctx context.Context, key string, limit int, window time.Duration) (int, error) {
	pipe := c.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)

	_, err := pipe.Exec(ctx)
	if err != nil {
		return 0, err
	}

	return int(incr.Val()), nil
}

// GetRateLimit gets current rate limit count
func (c *Client) GetRateLimit(ctx context.Context, key string) (int, error) {
	result, err := c.Get(ctx, key).Int()
	if err == redis.Nil {
		return 0, nil
	}
	return result, err
}

// SetCache stores data with expiration
func (c *Client) SetCache(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return c.Set(ctx, key, value, expiration).Err()
}

// GetCache retrieves cached data
func (c *Client) GetCache(ctx context.Context, key string) (string, error) {
	return c.Get(ctx, key).Result()
}

// DeleteCache removes cached data
func (c *Client) DeleteCache(ctx context.Context, key string) error {
	return c.Del(ctx, key).Err()
}

// InvalidateUserCache invalidates all cache entries for a user
func (c *Client) InvalidateUserCache(ctx context.Context, userID string) error {
	pattern := fmt.Sprintf("user:%s:*", userID)
	keys, err := c.Keys(ctx, pattern).Result()
	if err != nil {
		return err
	}

	if len(keys) > 0 {
		return c.Del(ctx, keys...).Err()
	}

	return nil
}
