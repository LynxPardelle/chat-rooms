#!/bin/bash

# MongoDB Restore Script
# This script restores a MongoDB database from backup

set -e

# Configuration
BACKUP_DIR="/backups"
MONGO_URI=${MONGO_URI:-"mongodb://localhost:27017/chat-rooms"}

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backup-file.tar.gz>"
    echo "Available backups:"
    ls -la "${BACKUP_DIR}"/chat-rooms-backup-*.tar.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Check if backup file exists
if [ ! -f "${BACKUP_PATH}" ]; then
    echo "Error: Backup file ${BACKUP_PATH} not found"
    exit 1
fi

echo "Starting MongoDB restore from ${BACKUP_FILE} at $(date)"

# Extract backup
cd "${BACKUP_DIR}"
EXTRACT_DIR=$(basename "${BACKUP_FILE}" .tar.gz)
tar -xzf "${BACKUP_FILE}"

# Restore the database
mongorestore --uri="${MONGO_URI}" --drop "${EXTRACT_DIR}/chat-rooms"

# Clean up extracted files
rm -rf "${EXTRACT_DIR}"

echo "Restore completed at $(date)"
echo "Database restored from: ${BACKUP_FILE}"
