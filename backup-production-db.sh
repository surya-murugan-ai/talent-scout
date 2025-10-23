#!/bin/bash
# TalentScout Production Database Backup Script
# Run this on your production server (139.59.24.123)

set -e

# Configuration
BACKUP_DIR="/home/backups/talentscout"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/talentscout_backup_$DATE.sql"
CONTAINER_NAME="talentscout-db"
DB_USER="talentscout"
DB_NAME="talentscout"
RETENTION_DAYS=7

# Create backup directory
mkdir -p $BACKUP_DIR

echo "========================================="
echo "TalentScout Database Backup"
echo "========================================="
echo "Date: $(date)"
echo "Container: $CONTAINER_NAME"
echo "Database: $DB_NAME"
echo ""

# Check if container is running
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "❌ Error: Container $CONTAINER_NAME is not running!"
    exit 1
fi

# Create backup
echo "📦 Creating backup..."
docker exec $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME > $BACKUP_FILE

if [ $? -eq 0 ]; then
    echo "✅ SQL dump created successfully"
    
    # Compress backup
    echo "🗜️  Compressing backup..."
    gzip $BACKUP_FILE
    
    # Get final size
    BACKUP_SIZE=$(du -h "$BACKUP_FILE.gz" | cut -f1)
    
    echo "✅ Backup completed!"
    echo "📁 File: $BACKUP_FILE.gz"
    echo "💾 Size: $BACKUP_SIZE"
    
    # Count records
    echo ""
    echo "📊 Database Statistics:"
    docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM candidates" | xargs echo "   Candidates:"
    docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM projects" | xargs echo "   Projects:"
    docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM activities" | xargs echo "   Activities:"
    
    # Cleanup old backups
    echo ""
    echo "🧹 Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
    find $BACKUP_DIR -name "talentscout_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    
    # List recent backups
    echo ""
    echo "📋 Recent Backups:"
    ls -lh $BACKUP_DIR/talentscout_backup_*.sql.gz | tail -5
    
    echo ""
    echo "========================================="
    echo "✅ Backup process completed successfully!"
    echo "========================================="
else
    echo "❌ Backup failed!"
    exit 1
fi


