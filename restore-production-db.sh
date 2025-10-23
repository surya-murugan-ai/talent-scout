#!/bin/bash
# TalentScout Production Database Restore Script
# Run this on your production server to restore from backup

set -e

CONTAINER_NAME="talentscout-db"
DB_USER="talentscout"
DB_NAME="talentscout"

echo "========================================="
echo "TalentScout Database Restore"
echo "========================================="
echo ""

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "❌ Error: No backup file specified!"
    echo ""
    echo "Usage: $0 <backup_file>"
    echo "Example: $0 /home/backups/talentscout/talentscout_backup_20251018_140000.sql.gz"
    echo ""
    echo "Available backups:"
    ls -lh /home/backups/talentscout/talentscout_backup_*.sql.gz 2>/dev/null || echo "   No backups found"
    exit 1
fi

BACKUP_FILE=$1

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "📁 Backup file: $BACKUP_FILE"
echo "💾 Size: $(du -h $BACKUP_FILE | cut -f1)"
echo ""

# Warning
echo "⚠️  WARNING: This will overwrite the current database!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 1
fi

# Check if container is running
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "❌ Error: Container $CONTAINER_NAME is not running!"
    exit 1
fi

echo ""
echo "🔄 Starting restore process..."

# Decompress if needed
TEMP_FILE="/tmp/talentscout_restore_temp.sql"
if [[ $BACKUP_FILE == *.gz ]]; then
    echo "🗜️  Decompressing backup..."
    gunzip -c $BACKUP_FILE > $TEMP_FILE
else
    cp $BACKUP_FILE $TEMP_FILE
fi

# Drop existing data (optional - comment out if you want to merge)
echo "🗑️  Dropping existing data..."
docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restore
echo "📥 Restoring database..."
cat $TEMP_FILE | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME

if [ $? -eq 0 ]; then
    echo "✅ Database restored successfully!"
    
    # Show stats
    echo ""
    echo "📊 Restored Database Statistics:"
    docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM candidates" | xargs echo "   Candidates:"
    docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM projects" | xargs echo "   Projects:"
    docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM activities" | xargs echo "   Activities:"
    
    # Cleanup
    rm -f $TEMP_FILE
    
    echo ""
    echo "========================================="
    echo "✅ Restore completed successfully!"
    echo "========================================="
else
    echo "❌ Restore failed!"
    rm -f $TEMP_FILE
    exit 1
fi


