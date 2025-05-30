#!/bin/bash

# Docker Security Scanning Script
# This script scans Docker images for security vulnerabilities

set -e

echo "🔍 Starting Docker Security Scan..."

# Function to scan an image
scan_image() {
    local image=$1
    echo "🔬 Scanning image: $image"
    
    # Using docker scout if available, otherwise use trivy
    if command -v docker scout >/dev/null 2>&1; then
        docker scout cves "$image" || echo "⚠️ Docker Scout scan failed for $image"
    elif command -v trivy >/dev/null 2>&1; then
        trivy image "$image" || echo "⚠️ Trivy scan failed for $image"
    else
        echo "⚠️ No security scanner available. Please install Docker Scout or Trivy."
    fi
    echo ""
}

# Build images first
echo "🏗️ Building images for scanning..."
docker-compose -f docker-compose.prod.yml build

# Get image names
API_IMAGE=$(docker-compose -f docker-compose.prod.yml config | grep "image:" | grep api | awk '{print $2}' | head -1)
FRONT_IMAGE=$(docker-compose -f docker-compose.prod.yml config | grep "image:" | grep front | awk '{print $2}' | head -1)

# If no specific images found, try to find built images
if [ -z "$API_IMAGE" ]; then
    API_IMAGE="chat-rooms_api:latest"
fi

if [ -z "$FRONT_IMAGE" ]; then
    FRONT_IMAGE="chat-rooms_front:latest"
fi

# Scan API image
scan_image "$API_IMAGE"

# Scan Frontend image
scan_image "$FRONT_IMAGE"

# Scan base MongoDB image
scan_image "mongo:7.0"

echo "✅ Security scan completed!"
echo ""
echo "📋 Security Recommendations:"
echo "   1. Regularly update base images"
echo "   2. Use specific version tags instead of 'latest'"
echo "   3. Run containers as non-root users"
echo "   4. Limit container capabilities"
echo "   5. Use read-only filesystems where possible"
echo "   6. Implement network segmentation"
echo "   7. Monitor container behavior"
