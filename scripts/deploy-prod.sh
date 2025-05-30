#!/bin/bash

# Production Deployment Script
# This script deploys the Chat Rooms application in production mode

set -e

echo "🚀 Starting Chat Rooms Production Deployment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

# Check if required directories exist
echo "📁 Creating required directories..."
mkdir -p ssl secrets data/mongo backups

# Make scripts executable
echo "🔧 Setting script permissions..."
chmod +x scripts/*.sh

# Pull latest images if available
echo "📥 Pulling latest images..."
docker-compose -f docker-compose.prod.yml pull || true

# Build images
echo "🏗️ Building production images..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

# Start services
echo "▶️ Starting production services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
timeout 300 bash -c 'until docker-compose -f docker-compose.prod.yml ps | grep "healthy"; do sleep 5; done' || {
    echo "❌ Services failed to become healthy within 5 minutes"
    docker-compose -f docker-compose.prod.yml logs
    exit 1
}

# Run health checks
echo "🔍 Running health checks..."
sleep 10

# Check API health
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ API health check passed"
else
    echo "❌ API health check failed"
    docker-compose -f docker-compose.prod.yml logs api
    exit 1
fi

# Check Frontend health
if curl -f http://localhost:80/health > /dev/null 2>&1; then
    echo "✅ Frontend health check passed"
else
    echo "❌ Frontend health check failed"
    docker-compose -f docker-compose.prod.yml logs front
    exit 1
fi

echo "🎉 Production deployment completed successfully!"
echo "📊 Application Status:"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "🌐 Access your application:"
echo "   Frontend: http://localhost:80"
echo "   API: http://localhost:3001"
echo ""
echo "📖 Useful commands:"
echo "   View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "   Stop app: docker-compose -f docker-compose.prod.yml down"
echo "   Backup DB: docker exec chat-rooms-mongo-prod /scripts/backup.sh"
