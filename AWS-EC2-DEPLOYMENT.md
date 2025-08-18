# AWS EC2 Deployment Guide for TalentScout

## Overview

This guide will help you deploy your TalentScout application to AWS EC2. The deployment includes both the frontend React application and the backend Express.js server.

## Prerequisites

- AWS Account with EC2 access
- EC2 instance running Ubuntu 20.04 or later
- Domain name (optional, for SSL)
- SSH access to your EC2 instance

## Step 1: EC2 Instance Setup

### 1.1 Launch EC2 Instance

1. **Instance Type**: t3.medium or larger (recommended: t3.large for production)
2. **AMI**: Ubuntu Server 20.04 LTS or 22.04 LTS
3. **Storage**: At least 20GB EBS volume
4. **Security Groups**: 
   - HTTP (80)
   - HTTPS (443)
   - SSH (22)
   - Custom TCP (5000) for development

### 1.2 Connect to Your Instance

```bash
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

## Step 2: Server Environment Setup

### 2.1 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Install Node.js 18+

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 2.3 Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE talent_scout;"
sudo -u postgres psql -c "CREATE USER talent_scout_user WITH PASSWORD 'your_secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE talent_scout TO talent_scout_user;"
sudo -u postgres psql -c "ALTER USER talent_scout_user CREATEDB;"
```

### 2.4 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 2.5 Install Nginx

```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Step 3: Application Deployment

### 3.1 Clone Repository

```bash
# Navigate to home directory
cd ~

# Clone the repository with the specific branch
git clone -b feature/finding-linkedin-url https://github.com/surya-murugan-ai/talent-scout.git

# Navigate to project directory
cd talent-scout
```

### 3.2 Install Dependencies

```bash
# Install dependencies
npm install

# Install PM2 globally if not already installed
sudo npm install -g pm2
```

### 3.3 Environment Configuration

```bash
# Copy environment file
cp .env.example .env

# Edit environment variables
nano .env
```

Add the following environment variables:

```env
# Database Configuration
DATABASE_URL=postgresql://talent_scout_user:your_secure_password@localhost:5432/talent_scout

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# Apify Configuration
APIFY_API_TOKEN=your-apify-token

# Application Configuration
NODE_ENV=production
PORT=5000

# LinkedIn Profile Finder Configuration
LINKEDIN_FINDER_URL=http://localhost:3001
```

### 3.4 Database Setup

```bash
# Push database schema
npm run db:push
```

### 3.5 Build Application

```bash
# Build the application
npm run build
```

## Step 4: PM2 Configuration

### 4.1 Create PM2 Ecosystem File

```bash
# Create ecosystem file
nano ecosystem.config.js
```

Add the following configuration:

```javascript
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
```

### 4.2 Start Application with PM2

```bash
# Start the application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## Step 5: Nginx Configuration

### 5.1 Create Nginx Configuration

```bash
# Create nginx configuration
sudo nano /etc/nginx/sites-available/talent-scout
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

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
```

### 5.2 Enable Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/talent-scout /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

## Step 6: SSL Certificate (Optional but Recommended)

### 6.1 Install Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y
```

### 6.2 Obtain SSL Certificate

```bash
# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## Step 7: LinkedIn Profile Finder Integration

Since you mentioned you already have the LinkedIn Profile Finder set up, you'll need to:

### 7.1 Update Environment Variables

Make sure your `.env` file includes the correct URL for your LinkedIn Profile Finder:

```env
LINKEDIN_FINDER_URL=http://your-linkedin-finder-ip:port
```

### 7.2 Test Integration

```bash
# Test the LinkedIn integration
curl http://localhost:5000/api/linkedin/status
```

## Step 8: Monitoring and Maintenance

### 8.1 PM2 Monitoring

```bash
# View application status
pm2 status

# View logs
pm2 logs talent-scout

# Monitor resources
pm2 monit
```

### 8.2 Application Health Check

```bash
# Test health endpoint
curl http://localhost:5000/health
```

### 8.3 Database Monitoring

```bash
# Connect to database
sudo -u postgres psql -d talent_scout

# Check database status
\l
\dt
```

## Step 9: Backup and Security

### 9.1 Database Backup

```bash
# Create backup script
nano backup-db.sh
```

Add the following content:

```bash
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="talent_scout_$DATE.sql"

mkdir -p $BACKUP_DIR
sudo -u postgres pg_dump talent_scout > $BACKUP_DIR/$BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "talent_scout_*.sql" -mtime +7 -delete
```

```bash
# Make script executable
chmod +x backup-db.sh

# Add to crontab for daily backups
crontab -e
# Add: 0 2 * * * /home/ubuntu/backups/backup-db.sh
```

### 9.2 Security Updates

```bash
# Set up automatic security updates
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Step 10: Troubleshooting

### 10.1 Common Issues

1. **Application not starting**:
   ```bash
   pm2 logs talent-scout
   pm2 restart talent-scout
   ```

2. **Database connection issues**:
   ```bash
   sudo systemctl status postgresql
   sudo -u postgres psql -c "\l"
   ```

3. **Nginx issues**:
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   sudo tail -f /var/log/nginx/error.log
   ```

4. **Port conflicts**:
   ```bash
   sudo netstat -tlnp | grep :5000
   sudo lsof -i :5000
   ```

### 10.2 Performance Optimization

1. **Enable Nginx caching**:
   ```nginx
   # Add to nginx configuration
   location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

2. **Database optimization**:
   ```sql
   -- Add indexes for better performance
   CREATE INDEX idx_candidates_email ON candidates(email);
   CREATE INDEX idx_candidates_created_at ON candidates(created_at);
   ```

## Step 11: Deployment Verification

### 11.1 Test Application

1. **Frontend**: Visit `http://your-domain.com`
2. **API Health**: Visit `http://your-domain.com/health`
3. **File Upload**: Test candidate file upload
4. **LinkedIn Integration**: Test LinkedIn profile enrichment

### 11.2 Performance Testing

```bash
# Install Apache Bench for load testing
sudo apt install apache2-utils -y

# Test API endpoints
ab -n 100 -c 10 http://your-domain.com/health
```

## Step 12: Continuous Deployment (Optional)

### 12.1 Setup Git Hooks

```bash
# Create deployment script
nano deploy.sh
```

Add the following content:

```bash
#!/bin/bash
cd /home/ubuntu/talent-scout
git pull origin feature/finding-linkedin-url
npm install
npm run build
pm2 restart talent-scout
```

```bash
# Make executable
chmod +x deploy.sh
```

## Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**:
   - Check PM2 logs for errors
   - Monitor disk space
   - Review application performance

2. **Monthly**:
   - Update system packages
   - Review security logs
   - Backup verification

3. **Quarterly**:
   - Security audit
   - Performance optimization
   - Database maintenance

### Useful Commands

```bash
# View application status
pm2 status

# Restart application
pm2 restart talent-scout

# View real-time logs
pm2 logs talent-scout --lines 100

# Monitor system resources
htop

# Check disk usage
df -h

# Check memory usage
free -h
```

## Conclusion

Your TalentScout application is now deployed on AWS EC2 with:
- ✅ Production-ready Node.js environment
- ✅ PostgreSQL database
- ✅ Nginx reverse proxy
- ✅ PM2 process management
- ✅ SSL certificate (if configured)
- ✅ Automated backups
- ✅ Security configurations
- ✅ Monitoring and logging

The application should be accessible at `http://your-domain.com` (or your EC2 public IP if no domain is configured).



