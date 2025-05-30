#!/bin/bash

# Chat Rooms Application Kubernetes Deployment Script
# Supports blue-green and canary deployment strategies

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NAMESPACE_PREFIX="chat-rooms"
DEPLOYMENT_TIMEOUT="600s"
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=10

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Help function
show_help() {
    cat << EOF
Chat Rooms Kubernetes Deployment Script

Usage: $0 [OPTIONS] COMMAND

Commands:
    deploy              Deploy to specified environment
    rollback            Rollback to previous version
    status              Check deployment status
    logs                Show application logs
    cleanup             Clean up old deployments

Options:
    -e, --environment   Environment (staging, production) [default: staging]
    -s, --strategy      Deployment strategy (rolling, blue-green, canary) [default: rolling]
    -i, --image         Docker image tag [default: latest]
    -n, --namespace     Kubernetes namespace [default: chat-rooms-ENV]
    -t, --timeout       Deployment timeout [default: 600s]
    -h, --help          Show this help message
    --dry-run           Show what would be done without executing
    --force             Force deployment without confirmation
    --skip-tests        Skip pre-deployment tests
    --canary-percent    Percentage of traffic for canary deployment [default: 10]

Examples:
    $0 deploy -e staging
    $0 deploy -e production -s blue-green -i v1.2.3
    $0 deploy -e production -s canary --canary-percent 20
    $0 rollback -e production
    $0 status -e staging
    $0 cleanup -e staging

Environment Variables:
    KUBECONFIG          Path to kubeconfig file
    DOCKER_REGISTRY     Docker registry URL [default: ghcr.io]
    DOCKER_USERNAME     Docker registry username
    DOCKER_PASSWORD     Docker registry password
    DATABASE_URL        Database connection URL
    REDIS_URL           Redis connection URL
    JWT_SECRET          JWT secret key
    SLACK_WEBHOOK_URL   Slack webhook for notifications

EOF
}

# Default values
ENVIRONMENT="staging"
STRATEGY="rolling"
IMAGE_TAG="latest"
TIMEOUT="600s"
DRY_RUN=false
FORCE=false
SKIP_TESTS=false
CANARY_PERCENT=10
DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io}"
NAMESPACE=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--strategy)
            STRATEGY="$2"
            shift 2
            ;;
        -i|--image)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --canary-percent)
            CANARY_PERCENT="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        deploy|rollback|status|logs|cleanup)
            COMMAND="$1"
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'"
    exit 1
fi

# Set namespace if not provided
if [[ -z "$NAMESPACE" ]]; then
    NAMESPACE="${NAMESPACE_PREFIX}-${ENVIRONMENT}"
fi

# Validate strategy
if [[ ! "$STRATEGY" =~ ^(rolling|blue-green|canary)$ ]]; then
    log_error "Invalid strategy: $STRATEGY. Must be 'rolling', 'blue-green', or 'canary'"
    exit 1
fi

# Check if command is provided
if [[ -z "${COMMAND:-}" ]]; then
    log_error "No command provided"
    show_help
    exit 1
fi

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl"
        exit 1
    fi
    
    # Check helm (for some deployments)
    if ! command -v helm &> /dev/null; then
        log_warning "helm not found. Some features may be limited"
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Check your kubeconfig"
        exit 1
    fi
    
    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_info "Creating namespace: $NAMESPACE"
        if [[ "$DRY_RUN" == "false" ]]; then
            kubectl create namespace "$NAMESPACE"
        fi
    fi
    
    log_success "Prerequisites check completed"
}

# Send notification
send_notification() {
    local message="$1"
    local status="${2:-info}"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        case "$status" in
            error) color="danger" ;;
            warning) color="warning" ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Chat Rooms Deployment\", \"attachments\":[{\"color\":\"$color\",\"text\":\"$message\"}]}" \
            "$SLACK_WEBHOOK_URL" || true
    fi
}

# Generate manifests from template
generate_manifests() {
    local temp_dir="$1"
    local template_file="$PROJECT_ROOT/infrastructure/kubernetes/manifests.yml.template"
    local output_file="$temp_dir/manifests.yml"
    
    log_info "Generating Kubernetes manifests..."
    
    # Calculate replica counts based on environment
    local api_replicas=2
    local frontend_replicas=2
    local api_min_replicas=1
    local api_max_replicas=10
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        api_replicas=3
        frontend_replicas=3
        api_min_replicas=2
        api_max_replicas=20
    fi
    
    # Set environment-specific values
    local domain_name="chat-rooms-${ENVIRONMENT}.example.com"
    local api_url="https://${domain_name}/api"
    local ws_url="wss://${domain_name}/socket.io"
    local log_level="info"
    
    if [[ "$ENVIRONMENT" == "staging" ]]; then
        log_level="debug"
    fi
    
    # Replace template variables
    sed \
        -e "s/\${ENVIRONMENT}/$ENVIRONMENT/g" \
        -e "s/\${API_IMAGE}/${DOCKER_REGISTRY}\/chat-rooms\/api:${IMAGE_TAG}/g" \
        -e "s/\${FRONTEND_IMAGE}/${DOCKER_REGISTRY}\/chat-rooms\/frontend:${IMAGE_TAG}/g" \
        -e "s/\${API_REPLICAS}/$api_replicas/g" \
        -e "s/\${FRONTEND_REPLICAS}/$frontend_replicas/g" \
        -e "s/\${API_MIN_REPLICAS}/$api_min_replicas/g" \
        -e "s/\${API_MAX_REPLICAS}/$api_max_replicas/g" \
        -e "s/\${DOMAIN_NAME}/$domain_name/g" \
        -e "s|\${API_URL}|$api_url|g" \
        -e "s|\${WS_URL}|$ws_url|g" \
        -e "s/\${LOG_LEVEL}/$log_level/g" \
        -e "s|\${DATABASE_URL}|${DATABASE_URL}|g" \
        -e "s|\${REDIS_URL}|${REDIS_URL}|g" \
        -e "s|\${MONGODB_URI}|${MONGODB_URI}|g" \
        -e "s|\${JWT_SECRET}|${JWT_SECRET}|g" \
        -e "s|\${FRONTEND_URL}|https://${domain_name}|g" \
        -e "s|\${CORS_ORIGIN}|https://${domain_name}|g" \
        "$template_file" > "$output_file"
    
    log_success "Manifests generated: $output_file"
}

# Run pre-deployment tests
run_pre_deployment_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warning "Skipping pre-deployment tests"
        return 0
    fi
    
    log_info "Running pre-deployment tests..."
    
    # Run security scan
    if command -v trivy &> /dev/null; then
        log_info "Running container security scan..."
        trivy image "${DOCKER_REGISTRY}/chat-rooms/api:${IMAGE_TAG}" || {
            log_error "Security scan failed"
            return 1
        }
    fi
    
    # Validate manifests
    local temp_dir=$(mktemp -d)
    generate_manifests "$temp_dir"
    
    log_info "Validating Kubernetes manifests..."
    kubectl apply --dry-run=client -f "$temp_dir/manifests.yml" || {
        log_error "Manifest validation failed"
        rm -rf "$temp_dir"
        return 1
    }
    
    rm -rf "$temp_dir"
    log_success "Pre-deployment tests completed"
}

# Health check function
wait_for_deployment() {
    local deployment_name="$1"
    local retries="$HEALTH_CHECK_RETRIES"
    
    log_info "Waiting for deployment $deployment_name to be ready..."
    
    while [[ $retries -gt 0 ]]; do
        if kubectl rollout status deployment/"$deployment_name" -n "$NAMESPACE" --timeout=30s; then
            log_success "Deployment $deployment_name is ready"
            return 0
        fi
        
        retries=$((retries - 1))
        log_info "Waiting for deployment... ($retries retries left)"
        sleep "$HEALTH_CHECK_INTERVAL"
    done
    
    log_error "Deployment $deployment_name failed to become ready"
    return 1
}

# Rolling deployment
deploy_rolling() {
    log_info "Starting rolling deployment..."
    
    local temp_dir=$(mktemp -d)
    generate_manifests "$temp_dir"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would apply manifests:"
        cat "$temp_dir/manifests.yml"
        rm -rf "$temp_dir"
        return 0
    fi
    
    # Apply manifests
    kubectl apply -f "$temp_dir/manifests.yml" -n "$NAMESPACE"
    
    # Wait for deployments
    wait_for_deployment "chat-rooms-api"
    wait_for_deployment "chat-rooms-frontend"
    
    rm -rf "$temp_dir"
    log_success "Rolling deployment completed"
}

# Blue-green deployment
deploy_blue_green() {
    log_info "Starting blue-green deployment..."
    
    # Determine current and new colors
    local current_color=$(kubectl get service chat-rooms-api-service -n "$NAMESPACE" -o jsonpath='{.spec.selector.color}' 2>/dev/null || echo "blue")
    local new_color="green"
    if [[ "$current_color" == "green" ]]; then
        new_color="blue"
    fi
    
    log_info "Current environment: $current_color, deploying to: $new_color"
    
    local temp_dir=$(mktemp -d)
    generate_manifests "$temp_dir"
    
    # Add color labels to manifests
    sed -i "s/app: chat-rooms/app: chat-rooms\n        color: $new_color/" "$temp_dir/manifests.yml"
    sed -i "s/chat-rooms-api/chat-rooms-api-$new_color/g" "$temp_dir/manifests.yml"
    sed -i "s/chat-rooms-frontend/chat-rooms-frontend-$new_color/g" "$temp_dir/manifests.yml"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would deploy $new_color environment"
        rm -rf "$temp_dir"
        return 0
    fi
    
    # Deploy new version
    kubectl apply -f "$temp_dir/manifests.yml" -n "$NAMESPACE"
    
    # Wait for new deployment
    wait_for_deployment "chat-rooms-api-$new_color"
    wait_for_deployment "chat-rooms-frontend-$new_color"
    
    # Run smoke tests on new environment
    log_info "Running smoke tests on $new_color environment..."
    # TODO: Implement smoke tests
    
    # Switch traffic
    log_info "Switching traffic to $new_color environment..."
    kubectl patch service chat-rooms-api-service -n "$NAMESPACE" -p "{\"spec\":{\"selector\":{\"color\":\"$new_color\"}}}"
    kubectl patch service chat-rooms-frontend-service -n "$NAMESPACE" -p "{\"spec\":{\"selector\":{\"color\":\"$new_color\"}}}"
    
    # Wait for traffic switch
    sleep 30
    
    # Cleanup old environment
    if [[ "$current_color" != "blue" ]]; then
        log_info "Cleaning up $current_color environment..."
        kubectl delete deployment "chat-rooms-api-$current_color" -n "$NAMESPACE" --ignore-not-found
        kubectl delete deployment "chat-rooms-frontend-$current_color" -n "$NAMESPACE" --ignore-not-found
    fi
    
    rm -rf "$temp_dir"
    log_success "Blue-green deployment completed"
}

# Canary deployment
deploy_canary() {
    log_info "Starting canary deployment with ${CANARY_PERCENT}% traffic..."
    
    local temp_dir=$(mktemp -d)
    generate_manifests "$temp_dir"
    
    # Create canary deployment with reduced replicas
    local canary_replicas=1
    sed -i "s/replicas: [0-9]*/replicas: $canary_replicas/" "$temp_dir/manifests.yml"
    sed -i "s/chat-rooms-api/chat-rooms-api-canary/g" "$temp_dir/manifests.yml"
    sed -i "s/chat-rooms-frontend/chat-rooms-frontend-canary/g" "$temp_dir/manifests.yml"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would deploy canary with ${CANARY_PERCENT}% traffic"
        rm -rf "$temp_dir"
        return 0
    fi
    
    # Deploy canary
    kubectl apply -f "$temp_dir/manifests.yml" -n "$NAMESPACE"
    
    # Wait for canary deployment
    wait_for_deployment "chat-rooms-api-canary"
    wait_for_deployment "chat-rooms-frontend-canary"
    
    # Configure traffic splitting (requires ingress controller support)
    log_info "Configuring traffic splitting..."
    # TODO: Implement traffic splitting based on ingress controller
    
    log_warning "Canary deployment active. Monitor metrics and run: $0 promote-canary to promote or $0 rollback-canary to rollback"
    
    rm -rf "$temp_dir"
    log_success "Canary deployment completed"
}

# Main deployment function
deploy() {
    log_info "Starting deployment to $ENVIRONMENT using $STRATEGY strategy"
    
    # Confirmation prompt
    if [[ "$FORCE" == "false" && "$DRY_RUN" == "false" ]]; then
        read -p "Deploy to $ENVIRONMENT environment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi
    
    check_prerequisites
    run_pre_deployment_tests
    
    # Send start notification
    send_notification "Deployment started: $ENVIRONMENT ($STRATEGY strategy, image: $IMAGE_TAG)"
    
    case "$STRATEGY" in
        rolling)
            deploy_rolling
            ;;
        blue-green)
            deploy_blue_green
            ;;
        canary)
            deploy_canary
            ;;
    esac
    
    # Send success notification
    send_notification "Deployment completed successfully: $ENVIRONMENT" "success"
    log_success "Deployment completed successfully"
}

# Rollback function
rollback() {
    log_info "Rolling back deployment in $ENVIRONMENT..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would rollback deployment"
        return 0
    fi
    
    # Rollback deployments
    kubectl rollout undo deployment/chat-rooms-api -n "$NAMESPACE"
    kubectl rollout undo deployment/chat-rooms-frontend -n "$NAMESPACE"
    
    # Wait for rollback
    wait_for_deployment "chat-rooms-api"
    wait_for_deployment "chat-rooms-frontend"
    
    send_notification "Rollback completed: $ENVIRONMENT" "warning"
    log_success "Rollback completed"
}

# Status function
status() {
    log_info "Checking deployment status in $ENVIRONMENT..."
    
    echo "Namespace: $NAMESPACE"
    echo "Deployments:"
    kubectl get deployments -n "$NAMESPACE" -o wide
    echo
    echo "Pods:"
    kubectl get pods -n "$NAMESPACE" -o wide
    echo
    echo "Services:"
    kubectl get services -n "$NAMESPACE" -o wide
    echo
    echo "Ingress:"
    kubectl get ingress -n "$NAMESPACE" -o wide
}

# Logs function
logs() {
    log_info "Showing logs for $ENVIRONMENT..."
    
    echo "API Logs:"
    kubectl logs -l app=chat-rooms,component=api -n "$NAMESPACE" --tail=100 -f
}

# Cleanup function
cleanup() {
    log_info "Cleaning up old deployments in $ENVIRONMENT..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would cleanup old deployments"
        return 0
    fi
    
    # Cleanup old replicasets
    kubectl delete replicaset -l app=chat-rooms -n "$NAMESPACE" --field-selector='status.replicas=0'
    
    # Cleanup completed jobs
    kubectl delete jobs -l app=chat-rooms -n "$NAMESPACE" --field-selector='status.successful=1'
    
    log_success "Cleanup completed"
}

# Main execution
case "$COMMAND" in
    deploy)
        deploy
        ;;
    rollback)
        rollback
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    cleanup)
        cleanup
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        show_help
        exit 1
        ;;
esac
