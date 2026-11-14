# Microservices Project Structure

## 📁 **Root Directory Structure**

```
website-akademik/
├── 📁 services/                          # Microservices
│   ├── 📁 api-gateway/                   # Kong API Gateway
│   ├── 📁 auth-service/                  # Authentication Service
│   ├── 📁 student-service/               # Student Management
│   ├── 📁 lecturer-service/              # Lecturer Management
│   ├── 📁 course-service/                # Course Management
│   ├── 📁 krs-service/                   # KRS & Academic Records
│   ├── 📁 finance-service/               # Finance & Payments
│   ├── 📁 notification-service/          # Notifications
│   ├── 📁 analytics-service/             # Analytics & Dashboard
│   └── 📁 audit-service/                 # Audit & Logging
├── 📁 frontend/                          # React Frontend
│   ├── 📁 src/
│   │   ├── 📁 components/
│   │   ├── 📁 pages/
│   │   ├── 📁 services/
│   │   ├── 📁 store/
│   │   └── 📁 utils/
│   ├── 📁 public/
│   └── 📄 package.json
├── 📁 infrastructure/                    # Kubernetes & Infrastructure
│   ├── 📁 kubernetes/
│   │   ├── 📁 namespaces/
│   │   ├── 📁 deployments/
│   │   ├── 📁 services/
│   │   ├── 📁 configmaps/
│   │   ├── 📁 secrets/
│   │   └── 📁 ingress/
│   ├── 📁 helm/                          # Helm Charts
│   │   ├── 📁 api-gateway/
│   │   ├── 📁 auth-service/
│   │   ├── 📁 student-service/
│   │   └── 📁 monitoring/
│   ├── 📁 monitoring/
│   │   ├── 📁 prometheus/
│   │   ├── 📁 grafana/
│   │   └── 📁 elk/
│   └── 📁 scripts/
├── 📁 shared/                            # Shared Libraries
│   ├── 📁 proto/                         # gRPC Protobuf definitions
│   ├── 📁 events/                        # Kafka Event Schemas
│   ├── 📁 models/                        # Shared Data Models
│   └── 📁 utils/                         # Common Utilities
├── 📁 docs/                              # Documentation
│   ├── 📁 api/                           # API Documentation
│   ├── 📁 architecture/                  # Architecture Docs
│   └── 📁 deployment/                    # Deployment Guides
├── 📁 tests/                             # Integration & E2E Tests
│   ├── 📁 integration/
│   ├── 📁 e2e/
│   └── 📁 performance/
├── 📁 .github/                           # GitHub Actions Workflows
│   └── 📁 workflows/
│       ├── 📄 ci.yml
│       ├── 📄 cd.yml
│       └── 📄 security.yml
├── 📄 docker-compose.yml                 # Local Development
├── 📄 docker-compose.dev.yml             # Development Environment
├── 📄 Makefile                           # Build & Deploy Commands
├── 📄 README.md                          # Project Documentation
└── 📄 .gitignore                         # Git Ignore File
```

## 🏗️ **Individual Service Structure**

### **Golang Service Template**
```
service-name/
├── 📁 cmd/
│   └── 📁 server/
│       └── 📄 main.go                    # Application Entry Point
├── 📁 internal/
│   ├── 📁 config/                        # Configuration Management
│   │   └── 📄 config.go
│   ├── 📁 domain/                        # Domain Models & Business Logic
│   │   ├── 📁 entities/
│   │   ├── 📁 repositories/
│   │   └── 📁 services/
│   ├── 📁 infrastructure/                # External Dependencies
│   │   ├── 📁 database/
│   │   ├── 📁 messaging/
│   │   └── 📁 external/
│   ├── 📁 interfaces/                    # HTTP Handlers & gRPC
│   │   ├── 📁 http/
│   │   └── 📁 grpc/
│   └── 📁 application/                   # Application Services
│       └── 📁 usecases/
├── 📁 pkg/                               # Public Libraries
│   ├── 📁 logger/
│   ├── 📁 middleware/
│   └── 📁 utils/
├── 📁 migrations/                        # Database Migrations
├── 📁 tests/                             # Unit Tests
├── 📁 docs/                              # Service Documentation
├── 📄 Dockerfile                         # Container Definition
├── 📄 go.mod                             # Go Module File
├── 📄 go.sum                             # Go Module Checksums
└── 📄 README.md                          # Service Documentation
```

## 🐳 **Docker Configuration**

### **Multi-stage Dockerfile Template**
```dockerfile
# Build Stage
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main cmd/server/main.go

# Runtime Stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
COPY --from=builder /app/migrations ./migrations
EXPOSE 8000
CMD ["./main"]
```

## ☸️ **Kubernetes Configuration**

### **Deployment Template**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: service-name
  namespace: academic-system
spec:
  replicas: 3
  selector:
    matchLabels:
      app: service-name
  template:
    metadata:
      labels:
        app: service-name
    spec:
      containers:
      - name: service-name
        image: username/service-name:latest
        ports:
        - containerPort: 8000
        env:
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: service-config
              key: db-host
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: service-secrets
              key: db-password
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## 🔄 **CI/CD Pipeline Structure**

### **GitHub Actions Workflow**
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Go
      uses: actions/setup-go@v3
      with:
        go-version: 1.21
    - name: Run tests
      run: |
        go test -v ./...
        go test -race -coverprofile=coverage.out ./...
        go tool cover -html=coverage.out -o coverage.html
    - name: Upload coverage
      uses: codecov/codecov-action@v3

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Build Docker image
      run: |
        docker build -t username/service-name:${{ github.sha }} .
        docker tag username/service-name:${{ github.sha }} username/service-name:latest
    - name: Push to Docker Hub
      run: |
        echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
        docker push username/service-name:${{ github.sha }}
        docker push username/service-name:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - uses: actions/checkout@v3
    - name: Deploy to Kubernetes
      run: |
        kubectl set image deployment/service-name service-name=username/service-name:${{ github.sha }} -n academic-system
        kubectl rollout status deployment/service-name -n academic-system
```

## 📊 **Monitoring Configuration**

### **Prometheus Configuration**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
    scrape_configs:
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
```

### **Grafana Dashboard**
```json
{
  "dashboard": {
    "title": "Academic System Monitoring",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{service}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      }
    ]
  }
}
```

## 🔧 **Configuration Management**

### **Consul Configuration**
```hcl
# Service Registration
service {
  name = "auth-service"
  port = 8001
  tags = ["auth", "academic"]
  check {
    http = "http://localhost:8001/health"
    interval = "10s"
    timeout = "3s"
  }
}

# Key-Value Configuration
key_prefix = "academic-system/"
key = "auth-service/database/host"
value = "postgres-auth.default.svc.cluster.local"

key = "auth-service/jwt/secret"
value = "your-jwt-secret-key"
```

## 📝 **Environment Configuration**

### **Development Environment**
```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=auth_db

# Service Configuration
PORT=8001
LOG_LEVEL=debug
ENVIRONMENT=development

# External Services
KAFKA_BROKERS=localhost:9092
REDIS_HOST=localhost:6379
CONSUL_HOST=localhost:8500

# Monitoring
PROMETHEUS_PORT=9090
JAEGER_ENDPOINT=http://localhost:14268/api/traces
```

### **Production Environment**
```bash
# Database Configuration (from Kubernetes Secrets)
DB_HOST=postgres-auth.default.svc.cluster.local
DB_PORT=5432
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}

# Service Configuration
PORT=8001
LOG_LEVEL=info
ENVIRONMENT=production

# External Services
KAFKA_BROKERS=kafka.default.svc.cluster.local:9092
REDIS_HOST=redis.default.svc.cluster.local:6379
CONSUL_HOST=consul.default.svc.cluster.local:8500

# Monitoring
PROMETHEUS_PORT=9090
JAEGER_ENDPOINT=http://jaeger.default.svc.cluster.local:14268/api/traces
```

## 🧪 **Testing Strategy**

### **Unit Tests**
```go
// internal/domain/services/auth_service_test.go
package services_test

import (
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
)

func TestAuthService_Login(t *testing.T) {
    // Arrange
    mockRepo := &MockRepository{}
    service := NewAuthService(mockRepo)
    
    mockRepo.On("FindByEmail", "test@example.com").Return(&User{}, nil)
    mockRepo.On("ValidatePassword", "password", "hashed").Return(true)
    
    // Act
    result, err := service.Login("test@example.com", "password")
    
    // Assert
    assert.NoError(t, err)
    assert.NotNil(t, result)
    mockRepo.AssertExpectations(t)
}
```

### **Integration Tests**
```go
// tests/integration/auth_test.go
package integration_test

import (
    "testing"
    "net/http"
    "net/http/httptest"
    "github.com/gorilla/mux"
)

func TestAuthEndpoint(t *testing.T) {
    // Setup
    router := mux.NewRouter()
    SetupAuthRoutes(router)
    
    // Test
    req, _ := http.NewRequest("POST", "/auth/login", nil)
    rr := httptest.NewRecorder()
    router.ServeHTTP(rr, req)
    
    // Assert
    assert.Equal(t, http.StatusOK, rr.Code)
}
```

## 📚 **Documentation Structure**

### **API Documentation**
```markdown
# Auth Service API Documentation

## Authentication Endpoints

### POST /auth/login
Authenticates a user and returns JWT tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600,
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "student"
  }
}
```
```

---

**🚀 Struktur ini dirancang untuk mendukung development microservices yang scalable, maintainable, dan production-ready dengan best practices untuk deployment dan monitoring.**
