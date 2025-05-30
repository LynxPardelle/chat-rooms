#!/bin/bash

# Automated Backup Script with Cron
# This script can be run via cron for automated backups

# Run backup
/scripts/backup.sh

# Send notification (optional - requires mail setup)
if [ $? -eq 0 ]; then
    echo "MongoDB backup completed successfully at $(date)" | logger -t mongodb-backup
else
    echo "MongoDB backup failed at $(date)" | logger -t mongodb-backup -p user.err
fi
