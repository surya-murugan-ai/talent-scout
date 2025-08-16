#!/bin/bash

# LinkedIn Profile Finder Integration Setup Script
# This script helps configure the LinkedIn Profile Finder with TalentScout

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_status "LinkedIn Profile Finder Integration Setup"
echo ""

# Check if we're in the TalentScout directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the TalentScout project directory"
    exit 1
fi

# Get current directory
PROJECT_DIR=$(pwd)

print_status "Current project directory: $PROJECT_DIR"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from example..."
    cp .env.example .env
fi

# Get LinkedIn Finder URL
echo "Please provide the URL for your LinkedIn Profile Finder service:"
echo "Example: http://your-ec2-ip:3001 or http://localhost:3001"
read -p "LinkedIn Finder URL: " LINKEDIN_FINDER_URL

if [ -z "$LINKEDIN_FINDER_URL" ]; then
    print_error "LinkedIn Finder URL is required"
    exit 1
fi

# Update .env file
print_status "Updating .env file with LinkedIn Finder URL..."
if grep -q "LINKEDIN_FINDER_URL" .env; then
    # Update existing line
    sed -i "s|LINKEDIN_FINDER_URL=.*|LINKEDIN_FINDER_URL=$LINKEDIN_FINDER_URL|" .env
else
    # Add new line
    echo "LINKEDIN_FINDER_URL=$LINKEDIN_FINDER_URL" >> .env
fi
print_success "LinkedIn Finder URL updated in .env"

# Test LinkedIn Finder connection
print_status "Testing LinkedIn Finder connection..."
if command -v curl &> /dev/null; then
    if curl -s "$LINKEDIN_FINDER_URL/health" > /dev/null 2>&1; then
        print_success "LinkedIn Finder is accessible"
    else
        print_warning "Could not reach LinkedIn Finder at $LINKEDIN_FINDER_URL"
        print_warning "Make sure the service is running and accessible"
    fi
else
    print_warning "curl not available, skipping connection test"
fi

# Check if LinkedIn service is configured in the codebase
print_status "Checking LinkedIn service configuration..."
if [ -f "server/services/linkedin.ts" ]; then
    print_success "LinkedIn service file found"
    
    # Check if the service uses the environment variable
    if grep -q "LINKEDIN_FINDER_URL" server/services/linkedin.ts; then
        print_success "LinkedIn service is configured to use environment variable"
    else
        print_warning "LinkedIn service may need to be updated to use LINKEDIN_FINDER_URL"
    fi
else
    print_warning "LinkedIn service file not found at server/services/linkedin.ts"
fi

# Create test script for LinkedIn integration
print_status "Creating LinkedIn integration test script..."
cat > test-linkedin-integration.sh << 'EOF'
#!/bin/bash

# LinkedIn Integration Test Script

echo "Testing LinkedIn Profile Finder Integration..."

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$LINKEDIN_FINDER_URL" ]; then
    echo "ERROR: LINKEDIN_FINDER_URL not set in .env file"
    exit 1
fi

echo "LinkedIn Finder URL: $LINKEDIN_FINDER_URL"

# Test basic connectivity
echo "Testing connectivity..."
if curl -s "$LINKEDIN_FINDER_URL/health" > /dev/null 2>&1; then
    echo "✅ LinkedIn Finder is accessible"
else
    echo "❌ LinkedIn Finder is not accessible"
    echo "Make sure the service is running at: $LINKEDIN_FINDER_URL"
fi

# Test API endpoints if available
echo "Testing API endpoints..."

# Test search endpoint
if curl -s "$LINKEDIN_FINDER_URL/api/search" > /dev/null 2>&1; then
    echo "✅ Search endpoint is available"
else
    echo "⚠️  Search endpoint not found"
fi

# Test profile endpoint
if curl -s "$LINKEDIN_FINDER_URL/api/profile" > /dev/null 2>&1; then
    echo "✅ Profile endpoint is available"
else
    echo "⚠️  Profile endpoint not found"
fi

echo "LinkedIn integration test completed"
EOF

chmod +x test-linkedin-integration.sh
print_success "LinkedIn integration test script created"

# Create documentation
print_status "Creating LinkedIn integration documentation..."
cat > LINKEDIN-INTEGRATION.md << EOF
# LinkedIn Profile Finder Integration

## Configuration

The TalentScout application is configured to integrate with your LinkedIn Profile Finder service.

### Environment Variables

- \`LINKEDIN_FINDER_URL\`: URL of your LinkedIn Profile Finder service
  - Current value: \`$LINKEDIN_FINDER_URL\`

### Testing Integration

Run the test script to verify the integration:

\`\`\`bash
./test-linkedin-integration.sh
\`\`\`

### Manual Testing

1. **Health Check**:
   \`\`\`bash
   curl $LINKEDIN_FINDER_URL/health
   \`\`\`

2. **API Endpoints**:
   - Search: \`$LINKEDIN_FINDER_URL/api/search\`
   - Profile: \`$LINKEDIN_FINDER_URL/api/profile\`

### Troubleshooting

1. **Service Not Accessible**:
   - Check if LinkedIn Profile Finder is running
   - Verify the URL is correct
   - Check firewall settings
   - Ensure the service is listening on the correct port

2. **API Endpoints Not Found**:
   - Check the LinkedIn Profile Finder documentation
   - Verify endpoint paths
   - Check if the service requires authentication

3. **Integration Issues**:
   - Check TalentScout logs: \`pm2 logs talent-scout\`
   - Verify environment variables are loaded
   - Test with curl commands

### Updating Configuration

To update the LinkedIn Finder URL:

1. Edit the \`.env\` file:
   \`\`\`bash
   nano .env
   \`\`\`

2. Update the \`LINKEDIN_FINDER_URL\` variable

3. Restart the application:
   \`\`\`bash
   pm2 restart talent-scout
   \`\`\`

## Service Requirements

Your LinkedIn Profile Finder service should provide:

1. **Health Endpoint**: \`/health\` - Returns service status
2. **Search Endpoint**: \`/api/search\` - Search for LinkedIn profiles
3. **Profile Endpoint**: \`/api/profile\` - Get profile details

### Expected Response Format

The service should return JSON responses with appropriate HTTP status codes.

## Security Considerations

- Use HTTPS in production
- Implement proper authentication if required
- Rate limiting to prevent abuse
- Input validation and sanitization
EOF

print_success "LinkedIn integration documentation created"

# Final instructions
echo ""
print_success "LinkedIn Profile Finder integration setup completed!"
echo ""
print_status "Next steps:"
print_status "1. Ensure your LinkedIn Profile Finder service is running"
print_status "2. Test the integration: ./test-linkedin-integration.sh"
print_status "3. Restart TalentScout if needed: pm2 restart talent-scout"
print_status "4. Check the documentation: cat LINKEDIN-INTEGRATION.md"
echo ""
print_warning "Important:"
print_warning "- Make sure your LinkedIn Profile Finder service is accessible"
print_warning "- Update your .env file with proper API keys if needed"
print_warning "- Test the integration before using in production"
echo ""
print_success "Setup completed successfully!"
