const fs = require('fs');
const path = require('path');

// Mock the LinkedInService for testing
class MockLinkedInService {
  transformHarvestApiData(data) {
    console.log('Transforming harvestapi data:', JSON.stringify(data, null, 2));
    
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

    // Extract education data
    const education = [];
    if (data.education && Array.isArray(data.education)) {
      data.education.forEach((edu) => {
        education.push({
          school: edu.schoolName || 'Unknown School',
          degree: edu.degree || 'Unknown Degree',
          field: edu.fieldOfStudy || 'Unknown Field',
          years: edu.period || 'Unknown Period',
        });
      });
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

    // Extract certifications
    const certifications = [];
    if (data.certifications && Array.isArray(data.certifications)) {
      data.certifications.forEach((cert) => {
        certifications.push({
          name: cert.title || 'Unknown Certification',
          issuer: cert.issuedBy || 'Unknown Issuer',
          date: cert.issuedAt || 'Unknown Date',
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
      // Fallback to first experience if currentPosition is not available
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

    // Parse connections count
    let connections = undefined;
    if (data.connectionsCount) {
      const connectionsStr = data.connectionsCount.toString();
      if (connectionsStr.includes('+')) {
        connections = parseInt(connectionsStr.replace('+', ''));
      } else {
        connections = parseInt(connectionsStr);
      }
    }

    return {
      // Required fields for our interface
      name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown',
      title: data.headline || currentRole,
      company: currentPosition,
      skills: skills,
      openToWork: data.openToWork === true || data.openToWork === 'true',
      lastActive: "Recently active",
      profileUrl: data.linkedinUrl,
      jobHistory: experiences.slice(0, 3).map(exp => ({
        role: exp.title,
        company: exp.company,
        duration: exp.duration,
      })),
      recentActivity: [], // Not available in search results
      
      // Additional detailed fields
      headline: data.headline,
      location: location,
      summary: data.about,
      experience: experiences,
      education: education,
      connections: connections,
      profilePicture: data.photo,
      currentCompany: currentPosition,
      currentPosition: currentRole,
      industry: undefined, // Not directly available
      languages: undefined, // Not directly available
      certifications: certifications,
      posts: [], // Not available in search results
    };
  }
}

async function testRealDataTransformation() {
  console.log('🧪 Testing Real HarvestAPI Data Transformation...\n');
  
  try {
    // Read the real harvestapi data file
    const dataPath = path.join(__dirname, 'harvestapi-results', 'harvestapi_Surya_Murugan_Full_Stack_Developer_Mumbai_2025-08-18T13-22-54-369Z.json');
    
    if (!fs.existsSync(dataPath)) {
      console.error('❌ Test data file not found:', dataPath);
      console.log('Please run the application first to generate harvestapi results.');
      return;
    }

    const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const profileData = rawData.rawData[0]; // Get the first profile from the results
    
    console.log('📊 Original HarvestAPI Data Structure:');
    console.log('Name:', `${profileData.firstName} ${profileData.lastName}`);
    console.log('Headline:', profileData.headline);
    console.log('Current Position:', profileData.currentPosition);
    console.log('Location:', profileData.location);
    console.log('Experience Count:', profileData.experience?.length || 0);
    console.log('Skills Count:', profileData.skills?.length || 0);
    console.log('Education Count:', profileData.education?.length || 0);
    console.log('Certifications Count:', profileData.certifications?.length || 0);
    console.log('Connections:', profileData.connectionsCount);
    console.log('Open to Work:', profileData.openToWork);
    
    console.log('\n🔄 Transforming Data...');
    const mockService = new MockLinkedInService();
    const transformedProfile = mockService.transformHarvestApiData(profileData);
    
    console.log('\n✅ Transformed Profile:');
    console.log('Name:', transformedProfile.name);
    console.log('Title:', transformedProfile.title);
    console.log('Company:', transformedProfile.company);
    console.log('Location:', transformedProfile.location);
    console.log('Skills:', transformedProfile.skills.slice(0, 5).join(', ') + (transformedProfile.skills.length > 5 ? '...' : ''));
    console.log('Open to Work:', transformedProfile.openToWork);
    console.log('Connections:', transformedProfile.connections);
    console.log('Experience Count:', transformedProfile.experience.length);
    console.log('Education Count:', transformedProfile.education.length);
    console.log('Certifications Count:', transformedProfile.certifications.length);
    
    console.log('\n📋 Experience Details:');
    transformedProfile.experience.forEach((exp, index) => {
      console.log(`  ${index + 1}. ${exp.title} at ${exp.company} (${exp.duration})`);
    });
    
    console.log('\n🎓 Education Details:');
    transformedProfile.education.forEach((edu, index) => {
      console.log(`  ${index + 1}. ${edu.degree} in ${edu.field} at ${edu.school} (${edu.years})`);
    });
    
    console.log('\n🏆 Certifications:');
    transformedProfile.certifications.forEach((cert, index) => {
      console.log(`  ${index + 1}. ${cert.name} by ${cert.issuer} (${cert.date})`);
    });
    
    // Test specific field mappings
    console.log('\n🔍 Field Mapping Verification:');
    console.log('✅ Company field correctly mapped:', transformedProfile.company !== 'Unknown Company');
    console.log('✅ Location field correctly mapped:', transformedProfile.location !== 'Unknown Location');
    console.log('✅ Skills array populated:', transformedProfile.skills.length > 0);
    console.log('✅ Experience array populated:', transformedProfile.experience.length > 0);
    console.log('✅ Education array populated:', transformedProfile.education.length > 0);
    
    console.log('\n🎉 Transformation test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testRealDataTransformation();
}

module.exports = { testRealDataTransformation };
