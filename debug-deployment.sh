#!/bin/bash
# Debug TalentScout Deployment
# Run this on your Digital Ocean droplet

echo "=== TalentScout Deployment Debug ==="
echo ""

echo "1. Check if containers are running:"
docker ps | grep talentscout
echo ""

echo "2. Check TalentScout app container status:"
docker inspect talentscout --format='Status: {{.State.Status}}, Health: {{.State.Health.Status}}'
echo ""

echo "3. Check TalentScout app logs (last 50 lines):"
docker logs --tail 50 talentscout
echo ""

echo "4. Check if port 5001 is listening:"
netstat -tuln | grep 5001
echo ""

echo "5. Check firewall status:"
ufw status | grep 5001
echo ""

echo "6. Test health endpoint from inside droplet:"
curl http://localhost:5001/health
echo ""

echo "7. Check database container:"
docker ps | grep talentscout-db
echo ""

echo "8. Test database connection:"
docker exec talentscout-db psql -U talentscout -d talentscout -c "SELECT version();"
echo ""

echo "=== End Debug ==="

