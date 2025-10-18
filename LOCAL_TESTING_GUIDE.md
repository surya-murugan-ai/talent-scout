# Local Docker Testing Guide

## 🧪 Test Before Deploying (Recommended!)

Always test your Docker setup locally before pushing to production.

---

## Step 1: Create .env File

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your actual values
# Use any text editor or:
notepad .env  # Windows
```

**Add your actual credentials:**
```env
POSTGRES_PASSWORD=MyLocalPassword123!
OPENAI_API_KEY=sk-your-actual-key
APIFY_API_TOKEN=your-actual-token
NODE_ENV=production
PORT=5001
```

---

## Step 2: Build Docker Image

```bash
# Build the image (this tests if Dockerfile works)
docker build -t talentscout:test .

# This should complete without errors
# You'll see: "Successfully built ..." and "Successfully tagged talentscout:test"
```

**If build fails:**
- Check the error message
- Verify all files are present
- Make sure package.json is valid

---

## Step 3: Start Containers with Docker Compose

```bash
# Start both containers (database + app)
docker-compose up -d

# View logs (watch for errors)
docker-compose logs -f
```

**What you should see:**
```
talentscout-db  | database system is ready to accept connections
talentscout     | serving on port 5001
talentscout     | Environment: production
talentscout     | Running in API-only mode (UI disabled)
```

---

## Step 4: Test Locally

### Test 1: Health Check
```bash
curl http://localhost:5001/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-18T...",
  "environment": "production",
  "uptime": 5.123
}
```

### Test 2: Database Health
```bash
curl http://localhost:5001/api/database/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "..."
}
```

### Test 3: Run Full Test Suite
```bash
node test-production-api.js http://localhost:5001 test-company-123
```

### Test 4: Upload a Resume
```bash
curl -X POST "http://localhost:5001/api/eezo/upload-resume" \
  -F "com_id=test-local" \
  -F "file=@path/to/your/resume.pdf"
```

---

## Step 5: Check Containers

```bash
# View running containers
docker-compose ps

# You should see both:
# NAME            STATUS
# talentscout     Up (healthy)
# talentscout-db  Up (healthy)

# View logs
docker-compose logs talentscout

# Access database
docker-compose exec talentscout-db psql -U talentscout -d talentscout
```

---

## Step 6: Stop Containers

```bash
# Stop containers
docker-compose down

# Remove volumes too (deletes database data)
docker-compose down -v
```

---

## ✅ Success Checklist

Before pushing to GitHub, verify:

- [ ] Docker image builds successfully
- [ ] Containers start without errors
- [ ] Health endpoint responds
- [ ] Database connection works
- [ ] Can upload a resume
- [ ] No error messages in logs
- [ ] Both containers show "healthy" status

---

## 🐛 Troubleshooting

### Build fails with npm error:
```bash
# Clear Docker cache and rebuild
docker builder prune -a
docker build --no-cache -t talentscout:test .
```

### Container exits immediately:
```bash
# Check logs
docker-compose logs talentscout

# Common issues:
# - Missing environment variables
# - Database connection failed
# - Port already in use
```

### Database connection error:
```bash
# Check if database container is running
docker-compose ps

# Check database logs
docker-compose logs talentscout-db

# Verify DATABASE_URL is correct
docker-compose exec talentscout env | grep DATABASE_URL
```

### Port already in use:
```bash
# Check what's using port 5001
lsof -i :5001  # Mac/Linux
netstat -ano | findstr :5001  # Windows

# Change port in docker-compose.yml if needed
```

---

## 🚀 After Local Testing Succeeds

Once everything works locally:

1. Commit your changes:
```bash
git add .
git commit -m "fix: update Dockerfile for npm ci compatibility"
```

2. Add GitHub secrets (if not done already)

3. Push to main:
```bash
git push origin main
```

4. GitHub Actions will build and deploy automatically!

---

## 📊 Expected Build Time

- **First build:** 5-10 minutes (downloads dependencies)
- **Subsequent builds:** 2-3 minutes (uses cache)

---

## 💡 Tips

1. **Always test locally first** - Saves time debugging in production
2. **Use docker-compose** - Easier than manual Docker commands
3. **Check logs frequently** - Helps catch issues early
4. **Keep .env private** - Never commit to git (.gitignore includes it)

---

**Happy testing! 🧪**

