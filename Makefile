# Makefile for Academic Information System

.PHONY: help build build-auth build-student build-course build-frontend build-all \
        run run-dev run-prod run-auth run-student run-course run-frontend \
        test test-auth test-student test-course test-frontend test-all \
        clean clean-docker clean-volumes clean-all \
        deploy deploy-dev deploy-prod \
        logs logs-auth logs-student logs-course logs-frontend logs-all \
        migrate migrate-auth migrate-student migrate-course \
        status health check \
        setup-dev setup-prod \
        docker-build docker-push docker-clean \
        k8s-deploy k8s-delete k8s-status \
        helm-install helm-upgrade helm-uninstall \
        monitoring logs-monitoring

# Default target
help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Build targets
build: ## Build all services
	@echo "Building all services..."
	$(MAKE) build-auth
	$(MAKE) build-student
	$(MAKE) build-course
	$(MAKE) build-frontend

build-auth: ## Build auth service
	@echo "Building auth service..."
	cd services/auth-service && go build -o bin/auth-service cmd/server/main.go

build-student: ## Build student service
	@echo "Building student service..."
	cd services/student-service && go build -o bin/student-service cmd/server/main.go

build-course: ## Build course service
	@echo "Building course service..."
	cd services/course-service && go build -o bin/course-service cmd/server/main.go

build-frontend: ## Build frontend
	@echo "Building frontend..."
	cd frontend && npm run build

build-all: ## Build all Docker images
	@echo "Building all Docker images..."
	docker-compose -f docker-compose.microservices.yml build

# Run targets
run: ## Run all services in development mode
	@echo "Starting all services..."
	docker-compose -f docker-compose.microservices.yml up -d

run-dev: ## Run services in development mode with hot reload
	@echo "Starting services in development mode..."
	docker-compose -f docker-compose.microservices.yml up

run-prod: ## Run services in production mode
	@echo "Starting services in production mode..."
	docker-compose -f docker-compose.microservices.yml -f docker-compose.prod.yml up -d

run-auth: ## Run only auth service
	@echo "Starting auth service..."
	cd services/auth-service && go run cmd/server/main.go

run-student: ## Run only student service
	@echo "Starting student service..."
	cd services/student-service && go run cmd/server/main.go

run-course: ## Run only course service
	@echo "Starting course service..."
	cd services/course-service && go run cmd/server/main.go

run-frontend: ## Run only frontend
	@echo "Starting frontend..."
	cd frontend && npm start

# Test targets
test: ## Run all tests
	@echo "Running all tests..."
	$(MAKE) test-auth
	$(MAKE) test-student
	$(MAKE) test-course
	$(MAKE) test-frontend

test-auth: ## Run auth service tests
	@echo "Running auth service tests..."
	cd services/auth-service && go test -v ./...

test-student: ## Run student service tests
	@echo "Running student service tests..."
	cd services/student-service && go test -v ./...

test-course: ## Run course service tests
	@echo "Running course service tests..."
	cd services/course-service && go test -v ./...

test-frontend: ## Run frontend tests
	@echo "Running frontend tests..."
	cd frontend && npm test

test-all: ## Run all tests including integration
	@echo "Running all tests including integration..."
	$(MAKE) test
	cd tests && go test -v ./...

# Clean targets
clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	find . -name "bin" -type d -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.log" -delete 2>/dev/null || true
	find . -name "*.tmp" -delete 2>/dev/null || true

clean-docker: ## Clean Docker containers and images
	@echo "Cleaning Docker containers and images..."
	docker-compose -f docker-compose.microservices.yml down -v
	docker system prune -f

clean-volumes: ## Remove all Docker volumes
	@echo "Removing Docker volumes..."
	docker volume prune -f

clean-all: ## Clean everything
	@echo "Cleaning everything..."
	$(MAKE) clean
	$(MAKE) clean-docker
	$(MAKE) clean-volumes

# Deploy targets
deploy: ## Deploy to production
	@echo "Deploying to production..."
	$(MAKE) k8s-deploy

deploy-dev: ## Deploy to development
	@echo "Deploying to development..."
	kubectl apply -f infrastructure/kubernetes/namespaces/
	kubectl apply -f infrastructure/kubernetes/configmaps/
	kubectl apply -f infrastructure/kubernetes/secrets/
	kubectl apply -f infrastructure/kubernetes/deployments/
	kubectl apply -f infrastructure/kubernetes/services/
	kubectl apply -f infrastructure/kubernetes/ingress/

deploy-prod: ## Deploy to production
	@echo "Deploying to production..."
	$(MAKE) helm-install

# Log targets
logs: ## Show logs for all services
	@echo "Showing logs for all services..."
	docker-compose -f docker-compose.microservices.yml logs -f

logs-auth: ## Show auth service logs
	@echo "Showing auth service logs..."
	docker-compose -f docker-compose.microservices.yml logs -f auth-service

logs-student: ## Show student service logs
	@echo "Showing student service logs..."
	docker-compose -f docker-compose.microservices.yml logs -f student-service

logs-course: ## Show course service logs
	@echo "Showing course service logs..."
	docker-compose -f docker-compose.microservices.yml logs -f course-service

logs-frontend: ## Show frontend logs
	@echo "Showing frontend logs..."
	docker-compose -f docker-compose.microservices.yml logs -f frontend

logs-all: ## Show all logs including infrastructure
	@echo "Showing all logs..."
	docker-compose -f docker-compose.microservices.yml logs -f

# Migration targets
migrate: ## Run all database migrations
	@echo "Running all database migrations..."
	$(MAKE) migrate-auth
	$(MAKE) migrate-student
	$(MAKE) migrate-course

migrate-auth: ## Run auth service migrations
	@echo "Running auth service migrations..."
	cd services/auth-service && go run cmd/migrate/main.go up

migrate-student: ## Run student service migrations
	@echo "Running student service migrations..."
	cd services/student-service && go run cmd/migrate/main.go up

migrate-course: ## Run course service migrations
	@echo "Running course service migrations..."
	cd services/course-service && go run cmd/migrate/main.go up

# Status and health targets
status: ## Show status of all services
	@echo "Showing status of all services..."
	docker-compose -f docker-compose.microservices.yml ps

health: ## Check health of all services
	@echo "Checking health of all services..."
	@curl -s http://localhost:8001/health | jq . || echo "Auth service: DOWN"
	@curl -s http://localhost:8002/health | jq . || echo "Student service: DOWN"
	@curl -s http://localhost:8004/health | jq . || echo "Course service: DOWN"
	@curl -s http://localhost:3000 | grep -q "React" && echo "Frontend: UP" || echo "Frontend: DOWN"

check: ## Comprehensive system check
	@echo "Running comprehensive system check..."
	$(MAKE) status
	$(MAKE) health
	@echo "Checking resource usage..."
	docker stats --no-stream

# Setup targets
setup-dev: ## Setup development environment
	@echo "Setting up development environment..."
	@echo "Installing dependencies..."
	cd services/auth-service && go mod download
	cd services/student-service && go mod download
	cd services/course-service && go mod download
	cd frontend && npm install
	@echo "Creating environment files..."
	cp services/auth-service/.env.example services/auth-service/.env
	cp services/student-service/.env.example services/student-service/.env
	cp services/course-service/.env.example services/course-service/.env
	cp frontend/.env.example frontend/.env
	@echo "Development environment setup complete!"

setup-prod: ## Setup production environment
	@echo "Setting up production environment..."
	@echo "Creating production secrets..."
	kubectl create secret generic auth-service-secrets --from-env-file=infrastructure/secrets/prod.env
	@echo "Production environment setup complete!"

# Docker targets
docker-build: ## Build all Docker images
	@echo "Building all Docker images..."
	docker build -t academic-system/auth-service:latest ./services/auth-service
	docker build -t academic-system/student-service:latest ./services/student-service
	docker build -t academic-system/course-service:latest ./services/course-service
	docker build -t academic-system/frontend:latest ./frontend

docker-push: ## Push all Docker images to registry
	@echo "Pushing all Docker images to registry..."
	docker push academic-system/auth-service:latest
	docker push academic-system/student-service:latest
	docker push academic-system/course-service:latest
	docker push academic-system/frontend:latest

docker-clean: ## Clean Docker images
	@echo "Cleaning Docker images..."
	docker rmi academic-system/auth-service:latest || true
	docker rmi academic-system/student-service:latest || true
	docker rmi academic-system/course-service:latest || true
	docker rmi academic-system/frontend:latest || true

# Kubernetes targets
k8s-deploy: ## Deploy to Kubernetes
	@echo "Deploying to Kubernetes..."
	kubectl apply -f infrastructure/kubernetes/namespaces/
	kubectl apply -f infrastructure/kubernetes/configmaps/
	kubectl apply -f infrastructure/kubernetes/secrets/
	kubectl apply -f infrastructure/kubernetes/deployments/
	kubectl apply -f infrastructure/kubernetes/services/
	kubectl apply -f infrastructure/kubernetes/ingress/

k8s-delete: ## Delete from Kubernetes
	@echo "Deleting from Kubernetes..."
	kubectl delete -f infrastructure/kubernetes/ingress/
	kubectl delete -f infrastructure/kubernetes/services/
	kubectl delete -f infrastructure/kubernetes/deployments/
	kubectl delete -f infrastructure/kubernetes/secrets/
	kubectl delete -f infrastructure/kubernetes/configmaps/

k8s-status: ## Show Kubernetes status
	@echo "Showing Kubernetes status..."
	kubectl get pods -n academic-system
	kubectl get services -n academic-system
	kubectl get ingress -n academic-system

# Helm targets
helm-install: ## Install using Helm
	@echo "Installing using Helm..."
	helm install auth-service ./infrastructure/helm/auth-service -n academic-system

helm-upgrade: ## Upgrade using Helm
	@echo "Upgrading using Helm..."
	helm upgrade auth-service ./infrastructure/helm/auth-service -n academic-system

helm-uninstall: ## Uninstall using Helm
	@echo "Uninstalling using Helm..."
	helm uninstall auth-service -n academic-system

# Monitoring targets
monitoring: ## Setup monitoring stack
	@echo "Setting up monitoring stack..."
	kubectl apply -f infrastructure/monitoring/
	@echo "Monitoring stack setup complete!"
	@echo "Grafana: http://localhost:3000 (admin/admin)"
	@echo "Prometheus: http://localhost:9090"
	@echo "Jaeger: http://localhost:16686"

logs-monitoring: ## Show monitoring logs
	@echo "Showing monitoring logs..."
	kubectl logs -n monitoring -l app=prometheus -f
	kubectl logs -n monitoring -l app=grafana -f
	kubectl logs -n monitoring -l app=jaeger -f

# Development utilities
dev-setup: ## Complete development setup
	@echo "Setting up complete development environment..."
	$(MAKE) setup-dev
	$(MAKE) docker-build
	@echo "Starting services..."
	$(MAKE) run
	@echo "Waiting for services to be ready..."
	sleep 30
	$(MAKE) health
	@echo "Development setup complete!"
	@echo "Services available at:"
	@echo "- API Gateway: http://localhost:8080"
	@echo "- Auth Service: http://localhost:8001"
	@echo "- Student Service: http://localhost:8002"
	@echo "- Course Service: http://localhost:8004"
	@echo "- Frontend: http://localhost:3000"
	@echo "- Grafana: http://localhost:3000 (admin/admin)"
	@echo "- Prometheus: http://localhost:9090"
	@echo "- Jaeger: http://localhost:16686"
	@echo "- Kafka UI: http://localhost:8081"

# Production utilities
prod-deploy: ## Complete production deployment
	@echo "Starting production deployment..."
	$(MAKE) setup-prod
	$(MAKE) docker-build
	$(MAKE) docker-push
	$(MAKE) k8s-deploy
	$(MAKE) monitoring
	@echo "Production deployment complete!"

# Backup and restore
backup: ## Backup all databases
	@echo "Backing up all databases..."
	docker exec postgres-auth pg_dump -U postgres auth_db > backup/auth_db_$(shell date +%Y%m%d_%H%M%S).sql
	docker exec postgres-student pg_dump -U postgres student_db > backup/student_db_$(shell date +%Y%m%d_%H%M%S).sql
	docker exec postgres-course pg_dump -U postgres course_db > backup/course_db_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "Backup complete!"

restore: ## Restore databases (usage: make restore DB_NAME=auth_db BACKUP_FILE=backup.sql)
	@echo "Restoring database $(DB_NAME) from $(BACKUP_FILE)..."
	docker exec postgres-$(shell echo $(DB_NAME) | cut -d'_' -f1) psql -U postgres -c "DROP DATABASE IF EXISTS $(DB_NAME);"
	docker exec postgres-$(shell echo $(DB_NAME) | cut -d'_' -f1) psql -U postgres -c "CREATE DATABASE $(DB_NAME);"
	docker exec -i postgres-$(shell echo $(DB_NAME) | cut -d'_' -f1) psql -U postgres $(DB_NAME) < $(BACKUP_FILE)
	@echo "Restore complete!"

# Security
security-scan: ## Run security scan on all services
	@echo "Running security scan on all services..."
	cd services/auth-service && gosec ./...
	cd services/student-service && gosec ./...
	cd services/course-service && gosec ./...
	cd frontend && npm audit
	@echo "Security scan complete!"

# Performance
load-test: ## Run load tests
	@echo "Running load tests..."
	cd tests/load && ./run_load_tests.sh
	@echo "Load tests complete!"

# Documentation
docs: ## Generate documentation
	@echo "Generating documentation..."
	cd services/auth-service && swag init -g cmd/server/main.go
	cd services/student-service && swag init -g cmd/server/main.go
	cd services/course-service && swag init -g cmd/server/main.go
	@echo "Documentation generated!"

# Linting
lint: ## Run linting on all services
	@echo "Running linting on all services..."
	cd services/auth-service && golangci-lint run
	cd services/student-service && golangci-lint run
	cd services/course-service && golangci-lint run
	cd frontend && npm run lint
	@echo "Linting complete!"

# Code formatting
format: ## Format all code
	@echo "Formatting all code..."
	cd services/auth-service && go fmt ./...
	cd services/student-service && go fmt ./...
	cd services/course-service && go fmt ./...
	cd frontend && npm run format
	@echo "Code formatting complete!"
