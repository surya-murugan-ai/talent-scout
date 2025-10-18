# TalentScout Quick Setup Guide
## For Your Specific Setup (Port 5001 + Existing PostgreSQL)

---

## ✅ What's Done

- ✅ All code built and ready
- ✅ Port changed to **5001** (since 5000 is taken by scriptsensei-app)
- ✅ Docker files configured
- ✅ GitHub Actions workflow ready
- ✅ API-only mode enabled (UI disabled)
- ✅ Duplicate detection with LinkedIn re-enrichment implemented

---

## 🚀 Step-by-Step Setup (5 minutes)

### Step 1: Prepare Your Droplet (1 min)

**Open firewall for TalentScout ports:**

```bash
# SSH into your droplet (you're already there)
ssh root@139.59.24.123

# Open firewall for port 5001 (API)
ufw allow 5001/tcp

# Open firewall for port 5433 (PostgreSQL - if you want external access)
ufw allow 5433/tcp

# Reload firewall
ufw reload

# Verify
ufw status | grep -E "5001|5433"
```

**Note:** PostgreSQL container will be created automatically by GitHub Actions on first deployment!

---

### Step 2: Generate SSH Key for GitHub Actions (2 min)

On your **local machine** (not the droplet):

```bash
# Generate new SSH key
ssh-keygen -t ed25519 -C "github-actions-talentscout" -f ~/.ssh/talentscout_deploy

# It will ask for passphrase - just press Enter (no passphrase)

# Copy the PUBLIC key
cat ~/.ssh/talentscout_deploy.pub
```

On your **droplet** (SSH session):

```bash
# Add the public key to authorized_keys
echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys

# Verify
tail ~/.ssh/authorized_keys
```

Back on your **local machine**:

```bash
# Test the connection
ssh -i ~/.ssh/talentscout_deploy root@139.59.24.123

# If it works without password, you're good!

# Get the PRIVATE key for GitHub secret
cat ~/.ssh/talentscout_deploy
# Copy the entire output (including BEGIN and END lines)
```

---

### Step 3: Add GitHub Secrets (1 min)

Go to: **Your GitHub Repo → Settings → Secrets and variables → Actions → New repository secret**

Add these **7 secrets**:

| Secret Name | Value |
|------------|-------|
| `POSTGRES_PASSWORD` | Choose a secure password (e.g., `TalentScout2025!SecureDB`) |
| `OPENAI_API_KEY` | Your OpenAI key (starts with `sk-`) |
| `APIFY_API_TOKEN` | Your Apify token |
| `DO_HOST` | `139.59.24.123` |
| `DO_USER` | `root` |
| `DO_SSH_KEY` | Paste the entire private key from `cat ~/.ssh/talentscout_deploy` |

**Note:** We removed `DATABASE_URL` because it's auto-generated from `POSTGRES_PASSWORD` in the Docker containers!

---

### Step 4: Deploy! (Automatic)

From your **local machine** in the TalentScout directory:

```bash
# Check what's changed
git status

# Add all changes
git add .

# Commit
git commit -m "feat: add duplicate detection, Docker deployment, port 5001, API-only mode"

# Push to main (this triggers automatic deployment)
git push origin main
```

**Watch the deployment:**
1. Go to GitHub → Your Repo → **Actions** tab
2. Click on the latest workflow run
3. Watch it build and deploy (takes ~5-10 minutes)
4. All steps should show ✅

---

### Step 5: Test Your Deployment

After GitHub Actions finishes:

```bash
# On your local machine:
node test-production-api.js http://139.59.24.123:5001 test-company-123

# Or test manually:
curl http://139.59.24.123:5001/health
```

**Expected output:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-18T...",
  "environment": "production",
  "uptime": 123.45
}
```

---

## 🧪 Test Duplicate Detection

### Upload a resume:
```bash
curl -X POST "http://139.59.24.123:5001/api/eezo/upload-resume" \
  -F "com_id=test-company" \
  -F "file=@path/to/resume.pdf"
```

**First upload response:**
```json
{
  "success": true,
  "message": "Resume processed successfully",
  "data": {
    "candidateId": "uuid-here",
    "isUpdate": false,
    "wasEnriched": true
  }
}
```

### Upload the same resume again:
```bash
# Same command - upload the same file again
curl -X POST "http://139.59.24.123:5001/api/eezo/upload-resume" \
  -F "com_id=test-company" \
  -F "file=@path/to/resume.pdf"
```

**Second upload response:**
```json
{
  "success": true,
  "message": "Resume updated successfully (matched by email)",
  "data": {
    "candidateId": "same-uuid",
    "isUpdate": true,
    "matchedBy": "email_and_linkedin",
    "wasEnriched": true
  }
}
```

✅ **Duplicate detected! Candidate updated with latest LinkedIn data!**

---

## 📊 Monitor Your Deployment

### SSH into droplet and check:
```bash
ssh root@139.59.24.123

# Check if TalentScout is running
docker ps | grep talentscout

# View logs
docker logs -f talentscout

# Check health
docker inspect --format='{{.State.Health.Status}}' talentscout

# Test locally on droplet
curl http://localhost:5001/health
```

---

## 🎯 Your Setup Summary

```
Droplet IP: 139.59.24.123
TalentScout API Port: 5001
TalentScout DB Port: 5433 (external)
ScriptSensei Port: 5000 (existing, unchanged)
ScriptSensei DB Port: 5432 (existing, unchanged)
```

**Containers on your droplet:**
1. **scriptsensei-app** (port 5000) - Your existing project
2. **scriptsensei-db** (port 5432) - Your existing PostgreSQL
3. **talentscout** (port 5001) - NEW: TalentScout API
4. **talentscout-db** (port 5433) - NEW: TalentScout PostgreSQL

**Both projects fully isolated - separate databases!**
- ScriptSensei: http://139.59.24.123:5000
- TalentScout: http://139.59.24.123:5001

---

## ⚠️ Troubleshooting

### Container won't start:
```bash
docker logs talentscout
```

### Database connection issues:
```bash
# Test database connection from droplet
docker exec -it talentscout-db psql -U talentscout -d talentscout -c "SELECT version();"

# Check database logs
docker logs talentscout-db
```

### GitHub Actions fails:
- Check all 6 secrets are correct
- Verify SSH key is in droplet's authorized_keys
- Check Actions logs for specific error

### Port already in use:
```bash
# Verify port 5001 is free
lsof -i :5001
```

---

## 🔄 Future Updates

Just push to main and it auto-deploys:

```bash
# Make your changes
git add .
git commit -m "your message"
git push origin main

# GitHub Actions automatically deploys!
```

---

## 📚 Full Documentation

- `DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `IMPLEMENTATION_SUMMARY.md` - What was built
- `API_QUICK_START.md` - API reference
- `test-production-api.js` - Test all endpoints

---

**You're all set! Follow the 5 steps above and you'll be live in 5 minutes! 🚀**

