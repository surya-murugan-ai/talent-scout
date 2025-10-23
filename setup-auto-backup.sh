#!/bin/bash
# Setup Automatic Daily Backups for TalentScout
# Run this ONCE on your production server to enable automatic backups

set -e

BACKUP_SCRIPT="/home/backup-production-db.sh"
CRON_SCHEDULE="0 2 * * *"  # Every day at 2 AM

echo "========================================="
echo "TalentScout Auto-Backup Setup"
echo "========================================="
echo ""

# Copy backup script to /home
if [ -f "backup-production-db.sh" ]; then
    cp backup-production-db.sh $BACKUP_SCRIPT
    chmod +x $BACKUP_SCRIPT
    echo "✅ Backup script installed: $BACKUP_SCRIPT"
else
    echo "❌ Error: backup-production-db.sh not found in current directory"
    exit 1
fi

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    echo "⚠️  Cron job already exists"
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_SCHEDULE $BACKUP_SCRIPT >> /var/log/talentscout-backup.log 2>&1") | crontab -
    echo "✅ Cron job added: Daily backups at 2 AM"
fi

# Create log file
touch /var/log/talentscout-backup.log
chmod 644 /var/log/talentscout-backup.log

echo ""
echo "========================================="
echo "✅ Auto-backup setup complete!"
echo "========================================="
echo ""
echo "📅 Schedule: Every day at 2 AM"
echo "📁 Backups: /home/backups/talentscout/"
echo "📋 Logs: /var/log/talentscout-backup.log"
echo ""
echo "To verify cron job:"
echo "  crontab -l"
echo ""
echo "To view backup logs:"
echo "  tail -f /var/log/talentscout-backup.log"
echo ""
echo "To run backup manually:"
echo "  $BACKUP_SCRIPT"
echo ""


