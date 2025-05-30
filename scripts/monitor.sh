#!/bin/bash

# System Monitoring Script
# This script monitors the health and performance of the Chat Rooms application

set -e

echo "📊 Chat Rooms Application Monitoring Dashboard"
echo "============================================"
echo ""

# Function to check service health
check_service_health() {
    local service=$1
    local url=$2
    
    if curl -f -s "$url" > /dev/null 2>&1; then
        echo "✅ $service: HEALTHY"
    else
        echo "❌ $service: UNHEALTHY"
    fi
}

# Function to get container stats
get_container_stats() {
    local container=$1
    
    if docker ps --format "table {{.Names}}" | grep -q "$container"; then
        echo "📈 $container Stats:"
        docker stats "$container" --no-stream --format "   CPU: {{.CPUPerc}}, Memory: {{.MemUsage}}, Network: {{.NetIO}}"
    else
        echo "❌ $container: NOT RUNNING"
    fi
}

# Check Docker service
echo "🐳 Docker Service Status:"
if systemctl is-active --quiet docker 2>/dev/null || docker info > /dev/null 2>&1; then
    echo "✅ Docker: RUNNING"
else
    echo "❌ Docker: NOT RUNNING"
    exit 1
fi
echo ""

# Check running containers
echo "📦 Container Status:"
docker-compose -f docker-compose.prod.yml ps 2>/dev/null || echo "Production containers not running"
echo ""

# Health checks
echo "🔍 Service Health Checks:"
check_service_health "MongoDB" "mongodb://localhost:27017"
check_service_health "API" "http://localhost:3001/health"
check_service_health "Frontend" "http://localhost:80/health"
echo ""

# Container statistics
echo "📊 Resource Usage:"
get_container_stats "chat-rooms-mongo-prod"
get_container_stats "chat-rooms-api-prod"
get_container_stats "chat-rooms-front-prod"
echo ""

# Disk usage
echo "💾 Disk Usage:"
echo "   MongoDB Data: $(du -sh data/mongo 2>/dev/null || echo 'N/A')"
echo "   Backups: $(du -sh backups 2>/dev/null || echo 'N/A')"
echo "   Logs: $(du -sh api/logs 2>/dev/null || echo 'N/A')"
echo ""

# Network connectivity
echo "🌐 Network Connectivity:"
if docker network ls | grep -q "chat-rooms-network"; then
    echo "✅ Network: chat-rooms-network exists"
else
    echo "❌ Network: chat-rooms-network missing"
fi
echo ""

# Recent logs (last 10 lines)
echo "📋 Recent Application Logs:"
echo "--- API Logs ---"
docker logs chat-rooms-api-prod --tail 5 2>/dev/null || echo "No API logs available"
echo ""
echo "--- Frontend Logs ---"
docker logs chat-rooms-front-prod --tail 5 2>/dev/null || echo "No Frontend logs available"
echo ""

# MongoDB status
echo "🗄️ Database Status:"
if docker exec chat-rooms-mongo-prod mongosh --eval "db.adminCommand('ping')" --quiet 2>/dev/null; then
    echo "✅ MongoDB: Connected"
    
    # Get database stats
    DB_STATS=$(docker exec chat-rooms-mongo-prod mongosh chat-rooms --eval "JSON.stringify(db.stats())" --quiet 2>/dev/null || echo '{}')
    if [ "$DB_STATS" != '{}' ]; then
        echo "   Collections: $(echo $DB_STATS | jq -r '.collections // "N/A"')"
        echo "   Documents: $(echo $DB_STATS | jq -r '.objects // "N/A"')"
        echo "   Data Size: $(echo $DB_STATS | jq -r '.dataSize // "N/A"') bytes"
    fi
else
    echo "❌ MongoDB: Connection failed"
fi
echo ""

# Security alerts
echo "🔒 Security Status:"
echo "   Non-root containers: $(docker inspect chat-rooms-api-prod chat-rooms-front-prod 2>/dev/null | jq -r '.[].Config.User // "root"' | grep -v root | wc -l)/2"
echo "   SSL enabled: $([ -f ssl/cert.pem ] && echo "✅ Yes" || echo "❌ No")"
echo ""

# Backup status
echo "📂 Backup Status:"
LATEST_BACKUP=$(ls -t backups/chat-rooms-backup-*.tar.gz 2>/dev/null | head -1)
if [ -n "$LATEST_BACKUP" ]; then
    echo "✅ Latest backup: $(basename "$LATEST_BACKUP")"
    echo "   Size: $(du -h "$LATEST_BACKUP" | cut -f1)"
    echo "   Age: $(find "$LATEST_BACKUP" -mtime -1 > /dev/null && echo "< 1 day" || echo "> 1 day")"
else
    echo "❌ No backups found"
fi
echo ""

echo "🔄 Monitoring completed at $(date)"
echo "💡 Tip: Run this script regularly or set up automated monitoring"
