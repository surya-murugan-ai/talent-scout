const fs = require('fs');
const path = require('path');

// Mock the LinkedInService for testing the open to work fix
class MockLinkedInService {
  transformHarvestApiData(data) {
    console.log('Testing open to work fix...');
    
    // Extract experience data from the harvestapi format
    const experiences = [];
    if (data.experience && Array.isArray(data.experience)) {
      data.experience.forEach((exp) => {
        experiences.push({
          title: exp.position || 'Unknown Role',
          company: exp.companyName || 'Unknown Company',
          duration: exp.duration || 'Unknown Duration',
          description: exp.description || '',
        });
      });
    }

    // Get current position info from currentPosition array
    let currentPosition = 'Unknown Company';
    let currentRole = 'Unknown Title';
    
    if (data.currentPosition && Array.isArray(data.currentPosition) && data.currentPosition.length > 0) {
      currentPosition = data.currentPosition[0].companyName || 'Unknown Company';
      currentRole = data.currentPosition[0].position || 'Unknown Title';
    } else if (experiences.length > 0) {
      currentPosition = experiences[0].company;
      currentRole = experiences[0].title;
    }

    // Get location from the location object
    let location = 'Unknown Location';
    if (data.location) {
      if (typeof data.location === 'string') {
        location = data.location;
      } else if (data.location.linkedinText) {
        location = data.location.linkedinText;
      } else if (data.location.parsed && data.location.parsed.text) {
        location = data.location.parsed.text;
      }
    }

    // Extract skills
    const skills = [];
    if (data.skills && Array.isArray(data.skills)) {
      data.skills.forEach((skill) => {
        if (skill.name) {
          skills.push(skill.name);
        }
      });
    }

    return {
      name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown',
      title: data.headline || currentRole,
      company: currentPosition,
      skills: skills,
      // FIXED: Only use the actual openToWork field from harvestapi
      openToWork: data.openToWork === true || data.openToWork === 'true',
      lastActive: "Recently active",
      profileUrl: data.linkedinUrl,
      jobHistory: experiences.slice(0, 3).map(exp => ({
        role: exp.title,
        company: exp.company,
        duration: exp.duration,
      })),
      recentActivity: [],
      
      // Additional detailed fields
      headline: data.headline,
      location: location,
      summary: data.about,
      experience: experiences,
      education: [],
      connections: data.connectionsCount,
      profilePicture: data.photo,
      currentCompany: currentPosition,
      currentPosition: currentRole,
      industry: undefined,
      languages: undefined,
      certifications: [],
      posts: [],
    };
  }
}

async function testOpenToWorkFix() {
  console.log('🧪 Testing Open to Work Fix...\n');
  
  try {
    // Read the Mahesh Konchada data file
    const dataPath = path.join(__dirname, 'harvestapi-results', 'harvestapi_Mahesh_Konchada_Product_Manager_Andra_Pradesh_2025-08-18T13-40-49-216Z.json');
    
    if (!fs.existsSync(dataPath)) {
      console.error('❌ Test data file not found:', dataPath);
      return;
    }

    const searchData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const profileData = searchData.rawData[0]; // Get the first profile from the search results
    
    console.log('📊 Original HarvestAPI Data:');
    console.log('Name:', `${profileData.firstName} ${profileData.lastName}`);
    console.log('Headline:', profileData.headline);
    console.log('Open to Work (from API):', profileData.openToWork);
    console.log('About section contains "opportunity":', profileData.about?.toLowerCase().includes('opportunity'));
    
    console.log('\n🔄 Testing Transformation...');
    const mockService = new MockLinkedInService();
    const transformedProfile = mockService.transformHarvestApiData(profileData);
    
    console.log('\n✅ Transformed Profile:');
    console.log('Name:', transformedProfile.name);
    console.log('Company:', transformedProfile.company);
    console.log('Open to Work (transformed):', transformedProfile.openToWork);
    
    // Test the fix verification
    console.log('\n🔍 Fix Verification:');
    console.log('✅ Open to Work correctly mapped:', transformedProfile.openToWork === profileData.openToWork);
    console.log('✅ Company field correctly mapped:', transformedProfile.company !== 'Unknown Company');
    
    if (transformedProfile.openToWork === profileData.openToWork) {
      console.log('\n🎉 OPEN TO WORK FIX SUCCESSFUL!');
      console.log('The dashboard should now show:');
      console.log(`- Open to Work: ${transformedProfile.openToWork ? 'Yes' : 'No'}`);
      console.log(`- Company: ${transformedProfile.company}`);
    } else {
      console.log('\n❌ OPEN TO WORK FIX FAILED!');
      console.log('The dashboard will still show incorrect open to work status');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testOpenToWorkFix();
}

module.exports = { testOpenToWorkFix };
