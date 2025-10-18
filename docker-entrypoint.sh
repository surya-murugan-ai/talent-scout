#!/bin/sh
set -e

echo "🔄 Waiting for database to be ready..."
# Wait for database to be accessible and run migrations
until npx drizzle-kit push --force 2>/dev/null; do
  echo "⏳ Database not ready yet, retrying in 5 seconds..."
  sleep 5
done

echo "✅ Database migrations completed successfully!"
echo "🚀 Starting TalentScout application..."

# Start the application
exec npx tsx server/index.ts

