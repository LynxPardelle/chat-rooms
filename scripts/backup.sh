#!/bin/bash

# MongoDB Backup Script
# This script creates a backup of the MongoDB database

set -e

# Configuration
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="chat-rooms-backup-${DATE}"
MONGO_URI=${MONGO_URI:-"mongodb://localhost:27017/chat-rooms"}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

echo "Starting MongoDB backup at $(date)"

# Create the backup
mongodump --uri="${MONGO_URI}" --out="${BACKUP_DIR}/${BACKUP_NAME}"

# Compress the backup
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
rm -rf "${BACKUP_NAME}"

echo "Backup created: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"

# Clean up old backups (older than RETENTION_DAYS)
find "${BACKUP_DIR}" -name "chat-rooms-backup-*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete

echo "Backup completed at $(date)"

# Verify backup
if [ -f "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" ]; then
    echo "Backup verification: SUCCESS"
    # Get backup size
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)
    echo "Backup size: ${BACKUP_SIZE}"
else
    echo "Backup verification: FAILED"
    exit 1
fi
