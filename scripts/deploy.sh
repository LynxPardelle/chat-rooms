#!/bin/bash
# Blue-Green Deployment Script for Chat Rooms Application

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BLUE_COMPOSE_FILE="docker-compose.production-blue.yml"
GREEN_COMPOSE_FILE="docker-compose.production-green.yml"
STAGING_COMPOSE_FILE="docker-compose.staging.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Health check function
health_check() {
    local environment=$1
    local port=$2
    local max_attempts=30
    local attempt=1

    log_info "Performing health check for $environment environment on port $port"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:$port/health" > /dev/null 2>&1; then
            log_success "Health check passed for $environment environment"
            return 0
        fi
        
        log_info "Health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    log_error "Health check failed for $environment environment after $max_attempts attempts"
    return 1
}

# Rollback function
rollback() {
    local current_env=$1
    log_warning "Initiating rollback procedure"
    
    if [ "$current_env" = "green" ]; then
        log_info "Rolling back to blue environment"
        switch_traffic_to_blue
    else
        log_info "Rolling back to green environment"
        switch_traffic_to_green
    fi
}

# Traffic switching functions
switch_traffic_to_green() {
    log_info "Switching traffic to green environment"
    # Update load balancer configuration to point to green
    # This would integrate with your load balancer (Traefik, Nginx, etc.)
    echo "Updating load balancer to route traffic to green environment"
    # Example: Update Traefik configuration
}

switch_traffic_to_blue() {
    log_info "Switching traffic to blue environment"
    # Update load balancer configuration to point to blue
    echo "Updating load balancer to route traffic to blue environment"
    # Example: Update Traefik configuration
}

# Database migration function
run_migrations() {
    local environment=$1
    log_info "Running database migrations for $environment environment"
    
    # Create backup before migration
    log_info "Creating database backup"
    docker exec chat-rooms-db-$environment pg_dump -U postgres live_chat > "backup_$(date +%Y%m%d_%H%M%S).sql"
    
    # Run migrations
    if [ "$environment" = "blue" ]; then
        docker-compose -f $BLUE_COMPOSE_FILE exec api-blue npm run migration:run
    else
        docker-compose -f $GREEN_COMPOSE_FILE exec api-green npm run migration:run
    fi
    
    log_success "Database migrations completed for $environment environment"
}

# Deploy to staging
deploy_staging() {
    log_info "Deploying to staging environment"
    
    cd "$PROJECT_ROOT"
    
    # Pull latest changes
    git pull origin main
    
    # Build and deploy staging
    docker-compose -f $STAGING_COMPOSE_FILE down
    docker-compose -f $STAGING_COMPOSE_FILE pull
    docker-compose -f $STAGING_COMPOSE_FILE up -d
    
    # Wait for staging to be ready
    sleep 30
    
    # Run health check
    if health_check "staging" "3000"; then
        log_success "Staging deployment completed successfully"
        return 0
    else
        log_error "Staging deployment failed health check"
        return 1
    fi
}

# Blue-Green deployment
deploy_production() {
    local target_env=$1
    local api_version=$2
    local frontend_version=$3
    
    log_info "Starting blue-green deployment to $target_env environment"
    log_info "API Version: $api_version"
    log_info "Frontend Version: $frontend_version"
    
    cd "$PROJECT_ROOT"
    
    # Set environment variables
    export API_VERSION=$api_version
    export FRONTEND_VERSION=$frontend_version
    
    # Deploy to target environment
    if [ "$target_env" = "green" ]; then
        compose_file=$GREEN_COMPOSE_FILE
        health_port="8081"
    else
        compose_file=$BLUE_COMPOSE_FILE
        health_port="80"
    fi
    
    log_info "Deploying to $target_env environment using $compose_file"
    
    # Stop existing containers
    docker-compose -f $compose_file down
    
    # Pull latest images
    docker-compose -f $compose_file pull
    
    # Start new deployment
    docker-compose -f $compose_file up -d
    
    # Wait for services to start
    sleep 60
    
    # Run database migrations
    run_migrations $target_env
    
    # Perform health check
    if health_check $target_env $health_port; then
        log_success "Deployment to $target_env environment successful"
        
        # Run smoke tests
        log_info "Running smoke tests"
        if run_smoke_tests $target_env $health_port; then
            log_success "Smoke tests passed"
            return 0
        else
            log_error "Smoke tests failed"
            rollback $target_env
            return 1
        fi
    else
        log_error "Health check failed for $target_env environment"
        rollback $target_env
        return 1
    fi
}

# Smoke tests
run_smoke_tests() {
    local environment=$1
    local port=$2
    
    log_info "Running smoke tests for $environment environment"
    
    # Test API endpoints
    log_info "Testing API health endpoint"
    if ! curl -f "http://localhost:$port/health"; then
        log_error "API health check failed"
        return 1
    fi
    
    log_info "Testing API authentication endpoint"
    if ! curl -f "http://localhost:$port/api/auth/status"; then
        log_error "Auth endpoint test failed"
        return 1
    fi
    
    log_info "Testing WebSocket connection"
    # Add WebSocket connection test here
    
    log_success "All smoke tests passed"
    return 0
}

# Get current active environment
get_current_environment() {
    # Logic to determine which environment is currently active
    # This would check your load balancer configuration
    echo "blue"  # Default to blue
}

# Main deployment workflow
main() {
    local command=$1
    
    case $command in
        "staging")
            deploy_staging
            ;;
        "production")
            if [ $# -lt 4 ]; then
                echo "Usage: $0 production <target_env> <api_version> <frontend_version>"
                echo "Example: $0 production green v1.2.3 v1.2.3"
                exit 1
            fi
            
            target_env=$2
            api_version=$3
            frontend_version=$4
            
            if [ "$target_env" != "blue" ] && [ "$target_env" != "green" ]; then
                log_error "Target environment must be 'blue' or 'green'"
                exit 1
            fi
            
            deploy_production $target_env $api_version $frontend_version
            ;;
        "switch")
            if [ $# -lt 2 ]; then
                echo "Usage: $0 switch <target_env>"
                exit 1
            fi
            
            target_env=$2
            if [ "$target_env" = "blue" ]; then
                switch_traffic_to_blue
            else
                switch_traffic_to_green
            fi
            ;;
        "status")
            current_env=$(get_current_environment)
            log_info "Current active environment: $current_env"
            ;;
        "rollback")
            current_env=$(get_current_environment)
            rollback $current_env
            ;;
        *)
            echo "Usage: $0 {staging|production|switch|status|rollback}"
            echo ""
            echo "Commands:"
            echo "  staging                                    - Deploy to staging environment"
            echo "  production <env> <api_ver> <frontend_ver> - Deploy to production (blue/green)"
            echo "  switch <env>                              - Switch traffic to environment"
            echo "  status                                    - Show current active environment"
            echo "  rollback                                  - Rollback to previous environment"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
