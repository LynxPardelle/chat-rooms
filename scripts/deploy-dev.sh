#!/bin/bash

# Development Environment Setup Script
# This script sets up the development environment with hot reload

set -e

echo "🚀 Starting Chat Rooms Development Environment..."

# Build development images
echo "🏗️ Building development images..."
docker-compose -f docker-compose.dev.yml build

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.dev.yml down

# Start services
echo "▶️ Starting development services..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 15

echo "🎉 Development environment started successfully!"
echo ""
echo "🌐 Access your application:"
echo "   Frontend: http://localhost:5173"
echo "   API: http://localhost:3001"
echo "   MongoDB Express: http://localhost:8081 (admin/admin123)"
echo "   Redis: localhost:6379"
echo ""
echo "📖 Useful commands:"
echo "   View logs: docker-compose -f docker-compose.dev.yml logs -f"
echo "   Stop app: docker-compose -f docker-compose.dev.yml down"
echo "   Restart API: docker-compose -f docker-compose.dev.yml restart api"
echo ""
echo "🔍 Debug info:"
echo "   API Debug Port: 9229 (for Node.js debugging)"
echo "   Hot reload is enabled for both frontend and backend"
