/**
 * Test script to check OpenAI resume parsing with actual PDF/DOCX files
 * Usage: npx tsx test-resume-extraction.ts <path-to-resume.pdf>
 */

import 'dotenv/config';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || ""
});

interface Experience {
  jobTitle: string;
  company: string;
  duration: string | null;
  startDate: string | null;
  endDate: string | null;
  techUsed: string[];
  description: string;
  achievements?: string[];
}

const EXTRACTION_PROMPT = (resumeText: string) => `
Extract work experience information from this resume text and return it as a JSON array with the following structure:

CRITICAL INSTRUCTIONS:
1. Look carefully for date ranges next to company names (e.g., "Company Name    Dec 2023 - Feb 2025")
2. Extract EXACT start and end dates as they appear
3. If end date is "Present", "Current", or similar, use "Present" as endDate
4. Parse dates into YYYY-MM format for startDate and endDate
5. Include the raw duration string as found in the resume
6. Pay special attention to spacing - dates might have extra spaces before them

{
  "experience": [
    {
      "jobTitle": "Job Title",
      "company": "Company Name",
      "duration": "Start Date - End Date (as shown in resume)",
      "startDate": "YYYY-MM (parsed start date)",
      "endDate": "YYYY-MM or Present (parsed end date)",
      "techUsed": ["Technology1", "Technology2"],
      "description": "Job description",
      "achievements": []
    }
  ]
}

EXAMPLES:
- If resume shows: "TrioNxt Software Private Ltd                Dec 2023 - Feb 2025"
  Extract: duration: "Dec 2023 - Feb 2025", startDate: "2023-12", endDate: "2025-02"

- If resume shows: "Google Inc.    Jan 2020 - Present"
  Extract: duration: "Jan 2020 - Present", startDate: "2020-01", endDate: "Present"

Resume Text:
${resumeText}

Return ONLY valid JSON without any markdown formatting or code blocks.
`;

async function extractTextFromFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.pdf') {
    console.log('📄 Extracting text from PDF...');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } else if (ext === '.docx') {
    console.log('📄 Extracting text from DOCX...');
    const dataBuffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer: dataBuffer });
    return result.value;
  } else {
    throw new Error(`Unsupported file type: ${ext}. Please use PDF or DOCX files.`);
  }
}

async function testOpenAI(resumeText: string): Promise<any> {
  console.log('\n🤖 Testing OpenAI GPT-4o...\n');
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert resume parser. Extract work experience with accurate dates. Pay special attention to date ranges that appear next to company names. Return valid JSON ONLY.'
      },
      {
        role: 'user',
        content: EXTRACTION_PROMPT(resumeText)
      }
    ],
    temperature: 0.1,
    max_tokens: 3000
  });

  const content = response.choices[0]?.message?.content || '';
  
  // Clean markdown code blocks if present
  let cleanContent = content.trim();
  if (cleanContent.startsWith('```json')) {
    cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
  } else if (cleanContent.startsWith('```')) {
    cleanContent = cleanContent.replace(/```\n?/g, '');
  }

  return JSON.parse(cleanContent);
}


function displayExperience(exp: any, index: number) {
  console.log(`\n  Experience #${index + 1}:`);
  console.log(`    Company: ${exp?.company || 'NOT EXTRACTED'}`);
  console.log(`    Job Title: ${exp?.jobTitle || 'NOT EXTRACTED'}`);
  console.log(`    Duration: ${exp?.duration || 'null'}`);
  console.log(`    Start Date: ${exp?.startDate || 'null'}`);
  console.log(`    End Date: ${exp?.endDate || 'null'}`);
  
  if (exp?.techUsed && exp.techUsed.length > 0) {
    console.log(`    Technologies: ${exp.techUsed.slice(0, 5).join(', ')}${exp.techUsed.length > 5 ? '...' : ''}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Error: Please provide a resume file path');
    console.error('\nUsage: npx tsx test-resume-extraction.ts <path-to-resume.pdf>');
    console.error('Example: npx tsx test-resume-extraction.ts "./PRAVIN PATIL.pdf"');
    process.exit(1);
  }
  
  const resumePath = args[0];
  
  if (!fs.existsSync(resumePath)) {
    console.error(`❌ Error: File not found: ${resumePath}`);
    process.exit(1);
  }
  
  console.log('='.repeat(80));
  console.log('AI RESUME PARSING COMPARISON TEST - ACTUAL FILE');
  console.log('='.repeat(80));
  console.log(`\n📁 Resume File: ${path.basename(resumePath)}`);
  console.log(`📂 Full Path: ${path.resolve(resumePath)}\n`);
  
  try {
    // Step 1: Extract text from file
    const resumeText = await extractTextFromFile(resumePath);
    console.log(`✅ Text extracted: ${resumeText.length} characters`);
    
    // Show a preview of the extracted text
    console.log('\n📝 Text Preview (first 800 characters):');
    console.log('-'.repeat(80));
    console.log(resumeText.substring(0, 800));
    console.log('-'.repeat(80));
    
    // Save extracted text for debugging
    const textOutputPath = path.join(process.cwd(), 'extracted-resume-text.txt');
    fs.writeFileSync(textOutputPath, resumeText);
    console.log(`\n💾 Full extracted text saved to: ${textOutputPath}`);
    
    // Check if dates are present in the text
    const datePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/gi;
    const foundDates = resumeText.match(datePattern);
    if (foundDates) {
      console.log(`\n🔍 Found ${foundDates.length} date(s) in text:`, foundDates.slice(0, 10));
    } else {
      console.warn('\n⚠️  WARNING: No date patterns found in extracted text!');
      console.warn('   This might be why extraction is failing.');
    }
    
    // Step 2: Test OpenAI
    let openaiResult;
    try {
      openaiResult = await testOpenAI(resumeText);
      console.log('✅ OpenAI extraction completed');
    } catch (error) {
      console.error('❌ OpenAI extraction failed:', error);
      openaiResult = { experience: [] };
    }
    
    // Step 3: Display results
    console.log('\n' + '='.repeat(80));
    console.log('EXTRACTION RESULTS');
    console.log('='.repeat(80));
    
    console.log('\n🔵 OpenAI GPT-4o Results:');
    if (openaiResult.experience && openaiResult.experience.length > 0) {
      openaiResult.experience.forEach((exp: any, idx: number) => displayExperience(exp, idx));
    } else {
      console.log('  ❌ No experiences extracted');
    }
    
    // Step 4: Analysis and verdict
    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS & VERDICT');
    console.log('='.repeat(80));
    
    const openaiExpCount = openaiResult.experience?.length || 0;
    
    console.log(`\n📊 Experiences Extracted: ${openaiExpCount}`);
    
    // Check if dates were extracted
    const openaiHasDates = openaiResult.experience?.some((exp: any) => 
      exp.startDate || exp.endDate || exp.duration
    );
    
    console.log(`\n📅 Date Extraction: ${openaiHasDates ? '✅ Extracted dates' : '❌ No dates extracted'}`);
    
    console.log('\n💡 Analysis:');
    if (!foundDates || foundDates.length === 0) {
      console.log('   ⚠️  PROBLEM: No dates found in extracted text');
      console.log('   → The PDF text extraction is removing dates');
      console.log('   → Check the extracted-resume-text.txt file');
      console.log('   → Consider using a different PDF parser');
    } else if (openaiHasDates) {
      console.log('   ✅ OpenAI successfully extracted dates from the text');
      console.log('   → Dates found in text: ' + foundDates.join(', '));
      console.log('   → System is working correctly');
    } else {
      console.log('   ⚠️  Dates are in text but OpenAI did not extract them');
      console.log('   → The AI prompt might need improvement');
      console.log('   → Or the text format is unusual');
    }
    
    // Step 5: Save full results
    const results = {
      timestamp: new Date().toISOString(),
      resumeFile: path.basename(resumePath),
      textLength: resumeText.length,
      datesFoundInText: foundDates || [],
      extractedText: resumeText,
      openai: openaiResult,
      analysis: {
        openaiExpCount,
        openaiHasDates
      }
    };
    
    const outputPath = path.join(process.cwd(), 'resume-parsing-comparison.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n📁 Full results saved to: ${outputPath}`);
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error during testing:', error);
    throw error;
  }
}

// Run the test
main().catch(console.error);

