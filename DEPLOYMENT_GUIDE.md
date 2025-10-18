# TalentScout Deployment Guide

## 🎯 Overview

This guide will help you deploy TalentScout API to Digital Ocean using GitHub Actions and GitHub Container Registry.

## ✨ New Features Implemented

### 1. **Duplicate Detection with LinkedIn Re-Enrichment**
   - Automatically detects duplicate candidates by email and/or LinkedIn URL
   - Re-fetches latest LinkedIn data when duplicate is found
   - Handles edge cases:
     - Email changed → Moves old email to `alternateEmail`, updates primary
     - LinkedIn URL changed → Updates LinkedIn URL
     - Both changed → Creates new candidate
   - Returns detailed information about matches and updates

### 2. **API-Only Mode**
   - Frontend/UI disabled
   - Serves only API endpoints
   - Reduced container size and faster deployments

### 3. **Docker Containerization**
   - Multi-stage build for optimized image size
   - Health checks built-in
   - Production-ready configuration

### 4. **Automated CI/CD**
   - GitHub Actions workflow
   - Automatic deployment on push to `main`
   - Uses GitHub Container Registry (free for public repos)

---

## 📋 Prerequisites

Before you begin, ensure you have:

1. **Digital Ocean Account** with an active droplet
2. **GitHub Repository** (private or public)
3. **Environment Variables**:
   - `DATABASE_URL` - PostgreSQL connection string
   - `OPENAI_API_KEY` - OpenAI API key
   - `APIFY_API_TOKEN` - Apify API token

---

## 🔧 Step 1: Check Digital Ocean Resources

SSH into your Digital Ocean droplet and check available resources:

```bash
# SSH into your droplet
ssh root@your-droplet-ip

# Check disk space (need ~5-10GB free)
df -h

# Check memory
free -h

# Check existing Docker containers
docker ps -a

# Check Docker images
docker images

# Check Docker disk usage
docker system df

# Check which ports are in use
netstat -tuln | grep LISTEN

# Or check if port 5000 is available
lsof -i :5000
```

**Important Notes:**
- If port 5000 is already in use by another project, you'll need to:
  - Either stop that container, OR
  - Change TalentScout to use a different port (e.g., 5001)
  - Update `Dockerfile`, `docker-compose.yml`, and GitHub Actions workflow

---

## 🔐 Step 2: Setup GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

| Secret Name | Description | Example |
|------------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `APIFY_API_TOKEN` | Apify API token | `apify_api_...` |
| `DO_HOST` | Digital Ocean droplet IP | `123.45.67.89` |
| `DO_USER` | SSH username (usually `root`) | `root` |
| `DO_SSH_KEY` | SSH private key (see below) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

### Generating SSH Key for GitHub Actions

On your **local machine** (not the droplet):

```bash
# Generate a new SSH key pair
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/talentscout_deploy

# Copy the public key
cat ~/.ssh/talentscout_deploy.pub

# Copy the private key (this goes to GitHub Secrets as DO_SSH_KEY)
cat ~/.ssh/talentscout_deploy
```

On your **Digital Ocean droplet**:

```bash
# Add the public key to authorized_keys
echo "paste-public-key-here" >> ~/.ssh/authorized_keys

# Test the connection from your local machine
ssh -i ~/.ssh/talentscout_deploy root@your-droplet-ip
```

---

## 🐳 Step 3: Prepare Digital Ocean Droplet

SSH into your droplet and prepare it for deployment:

```bash
# Install Docker (if not already installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Verify Docker installation
docker --version

# Start Docker service
systemctl start docker
systemctl enable docker

# Configure firewall (if using UFW)
ufw allow 5000/tcp
ufw reload

# Create a directory for application data (optional)
mkdir -p /var/talentscout
```

---

## 🚀 Step 4: Deploy

### Option A: Automatic Deployment (Recommended)

Simply push your code to the `main` branch:

```bash
git add .
git commit -m "feat: add duplicate detection and Docker deployment"
git push origin main
```

GitHub Actions will automatically:
1. Build the Docker image
2. Push to GitHub Container Registry
3. Deploy to your Digital Ocean droplet
4. Verify the deployment

### Option B: Manual Deployment

If you want to test locally first:

```bash
# Build the image
docker build -t talentscout:latest .

# Run locally with docker-compose
docker-compose up -d

# Test the API
node test-production-api.js http://localhost:5000 test-company-123

# Stop the container
docker-compose down
```

---

## 🧪 Step 5: Verify Deployment

After deployment completes, verify it's working:

### 1. Check GitHub Actions

Go to your repository → Actions → Latest workflow run

Look for:
- ✅ Build and push Docker image
- ✅ Deploy to Digital Ocean
- ✅ Verify deployment

### 2. SSH into Droplet and Check

```bash
ssh root@your-droplet-ip

# Check if container is running
docker ps | grep talentscout

# Check container logs
docker logs talentscout

# Check container health
docker inspect --format='{{.State.Health.Status}}' talentscout

# Test health endpoint
curl http://localhost:5000/health
```

### 3. Test API from Your Machine

```bash
# Run the comprehensive test suite
node test-production-api.js http://your-droplet-ip:5000 your-company-id

# Test individual endpoints
curl http://your-droplet-ip:5000/health
curl http://your-droplet-ip:5000/api/database/health
curl "http://your-droplet-ip:5000/api/candidates?com_id=test-123"
```

---

## 📝 Using the Duplicate Detection Feature

### Upload Resume API

**Endpoint:** `POST /api/eezo/upload-resume`

**Request:**
```bash
curl -X POST "http://your-droplet-ip:5000/api/eezo/upload-resume" \
  -F "com_id=your-company-id" \
  -F "file=@resume.pdf"
```

**Response (New Candidate):**
```json
{
  "success": true,
  "message": "Resume processed successfully",
  "data": {
    "candidateId": "uuid-here",
    "comId": "your-company-id",
    "isUpdate": false,
    "wasEnriched": true
  }
}
```

**Response (Duplicate Found - Updated):**
```json
{
  "success": true,
  "message": "Resume updated successfully (matched by email)",
  "data": {
    "candidateId": "existing-uuid",
    "comId": "your-company-id",
    "isUpdate": true,
    "matchedBy": "email",
    "wasEnriched": true,
    "changes": {
      "linkedinUrl": {
        "from": "old-url",
        "to": "new-url"
      }
    }
  }
}
```

### How It Works

1. **Upload Resume** → System extracts email and LinkedIn URL
2. **Check for Duplicates**:
   - Tries exact match (email + LinkedIn)
   - Tries email-only match
   - Tries LinkedIn-only match
3. **If Duplicate Found**:
   - Re-scrapes LinkedIn for latest data
   - Merges: Latest LinkedIn > New Resume > Existing DB
   - Updates candidate with fresh information
   - Returns `isUpdate: true` with match details
4. **If New Candidate**:
   - Optionally enriches from LinkedIn
   - Creates new candidate
   - Returns `isUpdate: false`

---

## 🔄 Managing Multiple Projects on Same Droplet

If you have another project running on port 5000:

### Option 1: Use Different Port

1. Update `Dockerfile`:
```dockerfile
EXPOSE 5001
```

2. Update `docker-compose.yml`:
```yaml
ports:
  - "5001:5001"
environment:
  - PORT=5001
```

3. Update GitHub Actions workflow:
```yaml
-p 5001:5001 \
-e PORT=5001 \
```

4. Update firewall:
```bash
ufw allow 5001/tcp
```

### Option 2: Use Nginx Reverse Proxy

Configure Nginx to route by subdomain/path:

```nginx
# /etc/nginx/sites-available/apps

server {
    listen 80;
    server_name talentscout.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name other-project.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5001;
        # ... same proxy settings
    }
}
```

---

## 🐛 Troubleshooting

### Container won't start

```bash
# Check logs
docker logs talentscout

# Check if port is already in use
lsof -i :5000

# Remove and restart
docker stop talentscout
docker rm talentscout
docker pull ghcr.io/your-username/talentscout:latest
docker run -d --name talentscout -p 5000:5000 ...
```

### Database connection issues

```bash
# Test database connection from droplet
docker exec -it talentscout sh
# Inside container:
node -e "const { Pool } = require('@neondatabase/serverless'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT NOW()').then(r => console.log(r.rows)).catch(e => console.error(e));"
```

### Out of disk space

```bash
# Clean up Docker
docker system prune -af
docker volume prune -f

# Check space
df -h
```

### GitHub Actions fails

- Check repository secrets are set correctly
- Verify SSH key has access to droplet
- Check droplet has Docker installed
- Review Actions logs for specific error

---

## 📊 Monitoring

### View Container Logs

```bash
# Real-time logs
docker logs -f talentscout

# Last 100 lines
docker logs --tail 100 talentscout
```

### Check Container Stats

```bash
# Resource usage
docker stats talentscout

# Container details
docker inspect talentscout
```

### Set up Log Rotation

```bash
# Create Docker daemon config
cat > /etc/docker/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

# Restart Docker
systemctl restart docker
```

---

## 🔄 Updates and Rollbacks

### Deploy Update

Just push to `main` branch - GitHub Actions handles everything!

### Rollback to Previous Version

```bash
# SSH into droplet
ssh root@your-droplet-ip

# Stop current container
docker stop talentscout
docker rm talentscout

# Pull specific version (using commit SHA)
docker pull ghcr.io/your-username/talentscout:abc123def

# Run previous version
docker run -d --name talentscout -p 5000:5000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="..." \
  ... \
  ghcr.io/your-username/talentscout:abc123def
```

---

## 🎉 Success Checklist

- [ ] Digital Ocean droplet has sufficient resources
- [ ] Docker installed on droplet
- [ ] All GitHub secrets configured
- [ ] SSH key added to droplet
- [ ] GitHub Actions workflow runs successfully
- [ ] Container is running (`docker ps`)
- [ ] Health check passes (`curl http://localhost:5000/health`)
- [ ] API test suite passes (`node test-production-api.js`)
- [ ] Duplicate detection works (upload same resume twice)
- [ ] LinkedIn re-enrichment works (check logs)

---

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Digital Ocean Droplet Guide](https://docs.digitalocean.com/products/droplets/)
- [Nginx Reverse Proxy Setup](https://nginx.org/en/docs/)

---

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review GitHub Actions logs
3. Check container logs: `docker logs talentscout`
4. Verify all environment variables are set correctly
5. Test database connectivity separately

---

**Happy Deploying! 🚀**

