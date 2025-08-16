#!/bin/bash

# TalentScout AWS EC2 Deployment Script
# This script automates the deployment of TalentScout to AWS EC2

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as ubuntu user."
   exit 1
fi

# Configuration variables
PROJECT_NAME="talent-scout"
PROJECT_DIR="/home/ubuntu/$PROJECT_NAME"
BRANCH="feature/finding-linkedin-url"
REPO_URL="https://github.com/surya-murugan-ai/talent-scout.git"

print_status "Starting TalentScout deployment to AWS EC2..."

# Step 1: Update system packages
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y
print_success "System packages updated"

# Step 2: Install Node.js 18+
print_status "Installing Node.js 18..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_success "Node.js installed"
else
    print_warning "Node.js already installed: $(node --version)"
fi

# Step 3: Install PostgreSQL
print_status "Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
    sudo apt install postgresql postgresql-contrib -y
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    print_success "PostgreSQL installed and started"
else
    print_warning "PostgreSQL already installed"
fi

# Step 4: Setup PostgreSQL database
print_status "Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE DATABASE talent_scout;" 2>/dev/null || print_warning "Database already exists"
sudo -u postgres psql -c "CREATE USER talent_scout_user WITH PASSWORD 'talent_scout_password_2024';" 2>/dev/null || print_warning "User already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE talent_scout TO talent_scout_user;" 2>/dev/null || true
sudo -u postgres psql -c "ALTER USER talent_scout_user CREATEDB;" 2>/dev/null || true
print_success "PostgreSQL database configured"

# Step 5: Install PM2
print_status "Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    print_success "PM2 installed"
else
    print_warning "PM2 already installed"
fi

# Step 6: Install Nginx
print_status "Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install nginx -y
    sudo systemctl start nginx
    sudo systemctl enable nginx
    print_success "Nginx installed and started"
else
    print_warning "Nginx already installed"
fi

# Step 7: Clone or update repository
print_status "Setting up project repository..."
if [ -d "$PROJECT_DIR" ]; then
    print_warning "Project directory already exists, updating..."
    cd "$PROJECT_DIR"
    git fetch origin
    git checkout $BRANCH
    git pull origin $BRANCH
else
    print_status "Cloning repository..."
    cd /home/ubuntu
    git clone -b $BRANCH $REPO_URL $PROJECT_NAME
    cd "$PROJECT_DIR"
fi
print_success "Repository setup complete"

# Step 8: Install dependencies
print_status "Installing Node.js dependencies..."
npm install
print_success "Dependencies installed"

# Step 9: Setup environment file
print_status "Setting up environment configuration..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    print_warning "Please edit .env file with your configuration:"
    print_warning "  - DATABASE_URL"
    print_warning "  - OPENAI_API_KEY"
    print_warning "  - APIFY_API_TOKEN"
    print_warning "  - LINKEDIN_FINDER_URL"
    echo ""
    print_status "Press Enter to continue after editing .env file..."
    read -r
else
    print_warning ".env file already exists"
fi

# Step 10: Setup database schema
print_status "Setting up database schema..."
npm run db:push
print_success "Database schema updated"

# Step 11: Build application
print_status "Building application..."
npm run build
print_success "Application built successfully"

# Step 12: Create PM2 ecosystem file
print_status "Creating PM2 configuration..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'talent-scout',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
};
EOF
print_success "PM2 configuration created"

# Step 13: Start application with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
print_success "Application started with PM2"

# Step 14: Create Nginx configuration
print_status "Creating Nginx configuration..."
sudo tee /etc/nginx/sites-available/talent-scout > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss;

    # Static files
    location / {
        root /home/ubuntu/talent-scout/dist/public;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/talent-scout /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
sudo nginx -t
sudo systemctl restart nginx
print_success "Nginx configured and restarted"

# Step 15: Create backup script
print_status "Creating backup script..."
mkdir -p /home/ubuntu/backups
cat > /home/ubuntu/backups/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="talent_scout_$DATE.sql"

mkdir -p $BACKUP_DIR
sudo -u postgres pg_dump talent_scout > $BACKUP_DIR/$BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "talent_scout_*.sql" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
EOF

chmod +x /home/ubuntu/backups/backup-db.sh
print_success "Backup script created"

# Step 16: Create deployment script
print_status "Creating deployment script..."
cat > /home/ubuntu/deploy.sh << 'EOF'
#!/bin/bash
cd /home/ubuntu/talent-scout
git pull origin feature/finding-linkedin-url
npm install
npm run build
pm2 restart talent-scout
echo "Deployment completed at $(date)"
EOF

chmod +x /home/ubuntu/deploy.sh
print_success "Deployment script created"

# Step 17: Setup security updates
print_status "Setting up automatic security updates..."
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
print_success "Automatic security updates configured"

# Step 18: Final verification
print_status "Performing final verification..."

# Check if application is running
if pm2 list | grep -q "talent-scout.*online"; then
    print_success "Application is running"
else
    print_error "Application is not running. Check logs with: pm2 logs talent-scout"
fi

# Check if Nginx is running
if sudo systemctl is-active --quiet nginx; then
    print_success "Nginx is running"
else
    print_error "Nginx is not running"
fi

# Check if PostgreSQL is running
if sudo systemctl is-active --quiet postgresql; then
    print_success "PostgreSQL is running"
else
    print_error "PostgreSQL is not running"
fi

# Get EC2 public IP
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "unknown")

print_success "Deployment completed successfully!"
echo ""
print_status "Your TalentScout application is now deployed!"
print_status "Access your application at: http://$EC2_IP"
print_status "Health check: http://$EC2_IP/health"
echo ""
print_status "Useful commands:"
print_status "  - View application status: pm2 status"
print_status "  - View logs: pm2 logs talent-scout"
print_status "  - Restart application: pm2 restart talent-scout"
print_status "  - Deploy updates: ./deploy.sh"
print_status "  - Backup database: ./backups/backup-db.sh"
echo ""
print_warning "Don't forget to:"
print_warning "  1. Configure your domain name in Nginx if you have one"
print_warning "  2. Set up SSL certificate with Certbot"
print_warning "  3. Update your .env file with proper API keys"
print_warning "  4. Configure your LinkedIn Profile Finder URL"
echo ""
print_success "Deployment script completed!"
