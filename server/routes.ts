import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";

// Extend Express Request type to include file property
interface RequestWithFile extends Request {
  file?: Express.Multer.File;
}

import { storage } from "./storage";
import { FileProcessor } from "./services/fileProcessor";
import { analyzeCandidate, enrichLinkedInProfile, batchAnalyzeCandidates } from "./services/openai";
import { ResumeDataService } from "./services/resumeDataService";
import { insertCandidateSchema, insertProjectSchema, scoringWeightsSchema } from "@shared/schema";
import { z } from "zod";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (FileProcessor.validateFileType(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are supported.'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Dashboard stats
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getCandidatesStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch stats",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Database health check
  app.get("/api/database/health", async (req, res) => {
    try {
      const { checkDatabaseHealth } = await import("./db-health");
      const health = await checkDatabaseHealth();
      res.json(health);
    } catch (error) {
      console.error('Database health check failed:', error);
      res.status(500).json({ 
        error: "Failed to check database health",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Database optimization
  app.post("/api/database/optimize", async (req, res) => {
    try {
      const { optimizeDatabase } = await import("./db-health");
      const result = await optimizeDatabase();
      res.json(result);
    } catch (error) {
      console.error('Database optimization failed:', error);
      res.status(500).json({ 
        error: "Failed to optimize database",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get all candidates with pagination
  app.get("/api/candidates", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const priority = req.query.priority as string;

      let candidates;
      if (priority) {
        candidates = await storage.getCandidatesByPriority(priority);
      } else {
        candidates = await storage.getCandidates(limit, offset);
      }

      res.json(candidates);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch candidates",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get single candidate
  app.get("/api/candidates/:id", async (req, res) => {
    try {
      const candidate = await storage.getCandidate(req.params.id);
      if (!candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }
      res.json(candidate);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch candidate",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Upload and process candidate file - using 'files' field name
  app.post("/api/upload", upload.array('files', 20), async (req: any, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const uploadedFiles = [];
      
      for (const file of req.files) {
        const { originalname, buffer, size } = file;
        
        // Create processing job for each file
        const processingJob = await storage.createProcessingJob({
          projectId: "default-project",
          fileName: originalname,
          fileSize: size,
          status: "processing",
          progress: 0,
          totalRecords: 0,
          processedRecords: 0
        });

        // Log activity
        await storage.createActivity({
          type: "upload",
          message: "New file uploaded",
          details: `${originalname} (${Math.round(size / 1024)}KB)`
        });

        // Process file asynchronously
        processFileAsync(processingJob.id, buffer, originalname);

        uploadedFiles.push({
          jobId: processingJob.id,
          filename: originalname,
          size
        });
      }

      res.json({
        message: `${uploadedFiles.length} files uploaded successfully`,
        files: uploadedFiles
      });

    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ 
        error: "Failed to upload file",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Multiple file upload route for 'files' field name
  app.post("/api/upload-multiple", upload.array('files', 10), async (req: any, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const uploadedFiles = [];
      
      for (const file of req.files) {
        const { originalname, buffer, size } = file;
        
        // Create processing job for each file
        const processingJob = await storage.createProcessingJob({
          projectId: "default-project",
          fileName: originalname,
          fileSize: size,
          status: "processing",
          progress: 0,
          totalRecords: 0,
          processedRecords: 0
        });

        // Log activity
        await storage.createActivity({
          type: "upload",
          message: "New file uploaded",
          details: `${originalname} (${Math.round(size / 1024)}KB)`
        });

        // Process file asynchronously
        processFileAsync(processingJob.id, buffer, originalname);

        uploadedFiles.push({
          jobId: processingJob.id,
          filename: originalname,
          size
        });
      }

      res.json({
        message: `${uploadedFiles.length} files uploaded successfully`,
        files: uploadedFiles
      });

    } catch (error) {
      console.error('Multiple upload error:', error);
      res.status(500).json({ 
        error: "Failed to upload files",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Alternative upload route for 'file' field name
  app.post("/api/upload-file", upload.single('file'), async (req: RequestWithFile, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { originalname, buffer, size } = req.file;
      
      // Create processing job
      const processingJob = await storage.createProcessingJob({
        projectId: "default-project",
        fileName: originalname,
        fileSize: size,
        status: "processing",
        progress: 0,
        totalRecords: 0,
        processedRecords: 0
      });

      // Log activity
      await storage.createActivity({
        type: "upload",
        message: "New file uploaded",
        details: `${originalname} (${Math.round(size / 1024)}KB)`
      });

      // Process file asynchronously
      processFileAsync(processingJob.id, buffer, originalname);

      res.json({
        message: "File uploaded successfully",
        jobId: processingJob.id,
        filename: originalname,
        size
      });

    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ 
        error: "Failed to upload file",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get processing jobs
  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.getProcessingJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch processing jobs",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get single processing job
  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getProcessingJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Processing job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch processing job",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Update scoring configuration
  app.post("/api/scoring", async (req, res) => {
    try {
      const weights = scoringWeightsSchema.parse(req.body);
      
      // Validate weights sum to 100
      const total = weights.openToWork + weights.skillMatch + weights.jobStability + weights.engagement;
      if (Math.abs(total - 100) > 0.1) {
        return res.status(400).json({ 
          error: "Scoring weights must sum to 100%" 
        });
      }

      // Update default project scoring weights
      const project = await storage.updateProject("default-project", {
        scoringWeights: weights
      });

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Log activity
      await storage.createActivity({
        type: "scoring_update",
        message: "Scoring model updated",
        details: `OpenAI weights reconfigured: OTW:${weights.openToWork}% SM:${weights.skillMatch}% JS:${weights.jobStability}% E:${weights.engagement}%`
      });

      res.json({
        message: "Scoring weights updated successfully",
        weights
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid scoring weights",
          details: error.errors
        });
      }
      res.status(500).json({ 
        error: "Failed to update scoring weights",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Export candidates as CSV
  app.get("/api/export/csv", async (req, res) => {
    try {
      const priority = req.query.priority as string;
      let candidates;
      
      if (priority) {
        candidates = await storage.getCandidatesByPriority(priority);
      } else {
        candidates = await storage.getCandidates(1000, 0); // Export up to 1000
      }

      // Convert to CSV format
      const csvHeaders = [
        'Name', 'Email', 'Title', 'Company', 'Score', 'Priority', 
        'Open to Work', 'Last Active', 'Skills', 'LinkedIn URL'
      ];

      const csvRows = candidates.map(candidate => [
        candidate.name || '',
        candidate.email || '',
        candidate.title || '',
        candidate.company || '',
        candidate.score || 0,
        candidate.priority || 'Low',
        candidate.openToWork ? 'Yes' : 'No',
        candidate.lastActive || '',
        Array.isArray(candidate.skills) ? candidate.skills.join('; ') : '',
        candidate.linkedinUrl || ''
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(field => 
          typeof field === 'string' && field.includes(',') 
            ? `"${field.replace(/"/g, '""')}"` 
            : field
        ).join(','))
      ].join('\n');

      // Log activity
      await storage.createActivity({
        type: "export",
        message: "Candidate data exported",
        details: `${priority ? priority + ' priority ' : ''}shortlist (${candidates.length} candidates)`
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 
        `attachment; filename="candidates_export_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);

    } catch (error) {
      res.status(500).json({ 
        error: "Failed to export candidates",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get recent activities
  app.get("/api/activities", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const activities = await storage.getRecentActivities(limit);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch activities",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get resume data
  app.get("/api/resume-data", async (req, res) => {
    try {
      const allResumeData = await ResumeDataService.getAllResumeData();
      res.json(allResumeData);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch resume data",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get resume data by candidate ID
  app.get("/api/resume-data/:candidateId", async (req, res) => {
    try {
      const { candidateId } = req.params;
      const resumeData = await ResumeDataService.getResumeDataByCandidateId(candidateId);
      
      if (!resumeData) {
        return res.status(404).json({ error: "Resume data not found" });
      }
      
      res.json(resumeData);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch resume data",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Clear all data endpoint
  app.delete("/api/clear-all-data", async (req, res) => {
    try {
      // Clear all candidates
      await storage.clearAllCandidates();
      
      // Clear all processing jobs
      await storage.clearAllProcessingJobs();
      
      // Clear all activities
      await storage.clearAllActivities();
      
      // Log the activity
      await storage.createActivity({
        type: "clear_data",
        message: "All data cleared",
        details: "All candidates, jobs, and activities have been removed"
      });
      
      res.json({ 
        success: true,
        message: "All data cleared successfully" 
      });
      
    } catch (error) {
      console.error('Clear data failed:', error);
      res.status(500).json({ 
        error: "Failed to clear data",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get current scoring configuration
  app.get("/api/scoring", async (req, res) => {
    try {
      const project = await storage.getProject("default-project");
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project.scoringWeights);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch scoring configuration",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Test LinkedIn API integration
  app.post('/api/test-linkedin', async (req, res) => {
    try {
      const { linkedinUrl, name, company } = req.body;
      
      if (!linkedinUrl) {
        return res.status(400).json({ error: 'LinkedIn URL is required' });
      }

      console.log(`Testing LinkedIn enrichment for: ${linkedinUrl}`);
      
      const enrichedProfile = await enrichLinkedInProfile(linkedinUrl, name || 'Test User', company);
      
      res.json({
        success: true,
        profile: enrichedProfile,
        message: 'LinkedIn profile enrichment successful'
      });

    } catch (error) {
      console.error('LinkedIn test failed:', error);
      res.status(500).json({
        error: 'LinkedIn enrichment failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Enrich existing candidate with real LinkedIn data
  app.patch('/api/candidates/:id/enrich', async (req, res) => {
    try {
      const { id } = req.params;
      const { linkedinUrl } = req.body;

      if (!linkedinUrl) {
        return res.status(400).json({ error: 'LinkedIn URL is required' });
      }

      const candidate = await storage.getCandidate(id);
      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }

      console.log(`Enriching candidate ${candidate.name} with LinkedIn data`);

      // Enrich with real LinkedIn data
      const enrichedProfile = await enrichLinkedInProfile(linkedinUrl, candidate.name, candidate.company || undefined);

      // Re-analyze with new data
      const project = await storage.getProject("default-project");
      const weights: { openToWork: number; skillMatch: number; jobStability: number; engagement: number; companyDifference: number } = (project?.scoringWeights as { openToWork: number; skillMatch: number; jobStability: number; engagement: number; companyDifference: number }) || {
        openToWork: 40,
        skillMatch: 30,
        jobStability: 15,
        engagement: 15,
        companyDifference: 15
      };

      const analysis = await analyzeCandidate({
        name: candidate.name,
        email: candidate.email,
        skills: enrichedProfile.skills.join(', '),
        company: enrichedProfile.company,
        linkedinProfile: enrichedProfile
      }, "", weights as { openToWork: number; skillMatch: number; jobStability: number; engagement: number; companyDifference: number });

      // Calculate company difference
      const hasCompanyDifference = candidate.company && enrichedProfile.company && 
        candidate.company !== enrichedProfile.company;
      const companyDifference = hasCompanyDifference ? "Different" : "Same";

      // Update candidate with enriched data
      await storage.updateCandidate(id, {
        title: enrichedProfile.title || candidate.title,
        company: enrichedProfile.company || candidate.company,
        currentEmployer: enrichedProfile.company || candidate.company, // Set current employer from LinkedIn
        linkedinUrl: linkedinUrl,
        skills: enrichedProfile.skills.length > 0 ? enrichedProfile.skills : candidate.skills,
        score: analysis.overallScore,
        priority: analysis.priority,
        openToWork: enrichedProfile.openToWork,
        lastActive: enrichedProfile.lastActive,
        notes: candidate.notes ? `${candidate.notes} | LinkedIn enriched: ${analysis.insights.join('; ')}` : `LinkedIn enriched: ${analysis.insights.join('; ')}`,
        companyDifference: companyDifference,
        companyDifferenceScore: hasCompanyDifference ? weights.companyDifference : 0,
        enrichedData: enrichedProfile
      });

      // Log activity
      await storage.createActivity({
        type: "enrichment",
        message: "Candidate enriched with LinkedIn data",
        details: `${candidate.name} profile updated with real LinkedIn data`
      });

      const updatedCandidate = await storage.getCandidate(id);

      res.json({
        success: true,
        candidate: updatedCandidate,
        profile: enrichedProfile,
        analysis: analysis
      });

    } catch (error) {
      console.error('Candidate enrichment failed:', error);
      res.status(500).json({
        error: 'Failed to enrich candidate',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Async function to process uploaded files
  async function processFileAsync(jobId: string, buffer: Buffer, filename: string) {
    try {
      // Update job status
      await storage.updateProcessingJob(jobId, {
        status: "processing",
        progress: 10
      });

      // Process the file
      const candidates = await FileProcessor.processFile(buffer, filename);
      
      await storage.updateProcessingJob(jobId, {
        totalRecords: candidates.length,
        progress: 25
      });

      // Get current scoring weights
      const project = await storage.getProject("default-project");
      const weights: { openToWork: number; skillMatch: number; jobStability: number; engagement: number; companyDifference: number } = (project?.scoringWeights as { openToWork: number; skillMatch: number; jobStability: number; engagement: number; companyDifference: number }) || {
        openToWork: 30,
        skillMatch: 25,
        jobStability: 15,
        engagement: 15,
        companyDifference: 15
      };

      // Process candidates in batches
      let processed = 0;
      for (const candidateData of candidates) {
        try {
          // Check if candidate already exists (by email or name + company)
          let existingCandidate = null;
          if (candidateData.email) {
            existingCandidate = await storage.getCandidateByEmail(candidateData.email);
          }
          
          if (!existingCandidate && candidateData.name && candidateData.company) {
            // Try to find by name and company
            const candidates = await storage.getCandidates(1000, 0);
            existingCandidate = candidates.find(c => 
              c.name?.toLowerCase() === candidateData.name?.toLowerCase() && 
              c.company?.toLowerCase() === candidateData.company?.toLowerCase()
            );
          }

          let resumeCandidate;
          if (existingCandidate) {
            // Update existing candidate with resume data
            resumeCandidate = await storage.updateCandidate(existingCandidate.id, {
              title: candidateData.title || existingCandidate.title,
              company: candidateData.company || existingCandidate.company,
              currentEmployer: candidateData.company || existingCandidate.currentEmployer,
              skills: candidateData.skills || existingCandidate.skills,
              extractedData: candidateData,
              source: 'resume'
            });
            resumeCandidate = await storage.getCandidate(existingCandidate.id);
          } else {
            // Create new candidate with resume data
            resumeCandidate = await storage.createCandidate({
              name: candidateData.name,
              email: candidateData.email,
              title: candidateData.title,
              company: candidateData.company,
              currentEmployer: candidateData.company, // Initially set from resume
              linkedinUrl: candidateData.linkedinUrl || `https://linkedin.com/in/${candidateData.name.toLowerCase().replace(/\s+/g, '-')}`,
              skills: candidateData.skills,
              score: 0, // Will be updated after LinkedIn enrichment
              priority: 'Low', // Will be updated after LinkedIn enrichment
              openToWork: false, // Will be updated after LinkedIn enrichment
              lastActive: 'Unknown', // Will be updated after LinkedIn enrichment
              notes: 'Resume processed, awaiting LinkedIn enrichment',
              originalData: candidateData.originalData,
              extractedData: candidateData,
              source: 'resume'
            });
          }

          // Now enrich with LinkedIn data
          const linkedInUrl = candidateData.linkedinUrl || `https://linkedin.com/in/${candidateData.name.toLowerCase().replace(/\s+/g, '-')}`;
          const linkedInProfile = await enrichLinkedInProfile(
            linkedInUrl,
            candidateData.name,
            candidateData.company
          );

          // Analyze with OpenAI including company difference calculation
          const analysis = await analyzeCandidate({
            ...candidateData,
            linkedinProfile: linkedInProfile,
            resumeCompany: candidateData.company,
            linkedinCompany: linkedInProfile.company
          }, "", weights as { openToWork: number; skillMatch: number; jobStability: number; engagement: number; companyDifference: number });

          // Calculate company difference between resume and LinkedIn
          const resumeCompany = candidateData.company;
          const linkedinCompany = linkedInProfile.company;
          const hasCompanyDifference = resumeCompany && linkedinCompany && 
            resumeCompany !== linkedinCompany;
          const companyDifference = hasCompanyDifference ? "Different" : "Same";
          const companyDifferenceScore = hasCompanyDifference ? weights.companyDifference : 0;
          
          console.log(`🔍 Company Comparison for ${candidateData.name}:`);
          console.log(`   Resume Company: ${resumeCompany}`);
          console.log(`   LinkedIn Company: ${linkedinCompany}`);
          console.log(`   Company Difference: ${companyDifference}`);

          // Calculate hireability based on duration and other factors
          const hireabilityScore = calculateHireabilityScore(candidateData, linkedInProfile, analysis);
          const hireabilityFactors = calculateHireabilityFactors(candidateData, linkedInProfile, analysis);

          // Update the candidate with LinkedIn data
          if (!resumeCandidate) {
            console.error(`Failed to create/update candidate ${candidateData.name}`);
            continue;
          }
          
          await storage.updateCandidate(resumeCandidate.id, {
            title: linkedInProfile.title || candidateData.title,
            company: candidateData.company, // ALWAYS keep resume company
            currentEmployer: linkedInProfile.company, // ALWAYS use LinkedIn company (even if "Unknown")
            skills: linkedInProfile.skills.length > 0 ? linkedInProfile.skills : candidateData.skills,
            score: analysis.overallScore,
            priority: analysis.priority,
            openToWork: linkedInProfile.openToWork,
            lastActive: linkedInProfile.lastActive,
            notes: analysis.insights.join('; '),
            companyDifference: companyDifference,
            companyDifferenceScore: companyDifferenceScore,
            hireabilityScore: hireabilityScore,
            hireabilityFactors: hireabilityFactors,
            enrichedData: linkedInProfile
          });

          processed++;
          const progress = 25 + Math.round((processed / candidates.length) * 70);
          
          await storage.updateProcessingJob(jobId, {
            processedRecords: processed,
            progress
          });

          // Small delay to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
          console.error(`Error processing candidate ${candidateData.name}:`, error);
          // Continue with next candidate
        }
      }

      // Complete the job
      await storage.updateProcessingJob(jobId, {
        status: "completed",
        progress: 100,
        processedRecords: processed
      });

      // Log completion activity
      await storage.createActivity({
        type: "processing",
        message: "Profile enrichment completed",
        details: `${processed} candidates processed via Resume + LinkedIn API`
      });

      console.log(`Processing job ${jobId} completed: ${processed}/${candidates.length} candidates processed`);

    } catch (error) {
      console.error(`Processing job ${jobId} failed:`, error);
      
      await storage.updateProcessingJob(jobId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  // Helper function to calculate hireability score
  function calculateHireabilityScore(resumeData: any, linkedInProfile: any, analysis: any): number {
    let score = 0;
    
    // Base score from analysis
    score += analysis.overallScore * 0.4;
    
    // Company difference bonus (if different, might indicate job seeking)
    if (resumeData.company && linkedInProfile.company && 
        resumeData.company !== linkedInProfile.company) {
      score += 20;
    }
    
    // Open to work bonus
    if (linkedInProfile.openToWork) {
      score += 15;
    }
    
    // Recent activity bonus
    if (linkedInProfile.lastActive && linkedInProfile.lastActive.includes('Recently')) {
      score += 10;
    }
    
    // Skills match bonus
    if (linkedInProfile.skills && linkedInProfile.skills.length > 0) {
      score += Math.min(linkedInProfile.skills.length * 2, 20);
    }
    
    return Math.min(score, 100);
  }

  // Helper function to calculate hireability factors
  function calculateHireabilityFactors(resumeData: any, linkedInProfile: any, analysis: any): any {
    const factors: any = {};
    
    // Company difference factor
    if (resumeData.company && linkedInProfile.company && 
        resumeData.company !== linkedInProfile.company) {
      factors['companyChange'] = {
        resumeCompany: resumeData.company,
        linkedinCompany: linkedInProfile.company,
        indicatesJobSeeking: true
      };
    }
    
    // Open to work factor
    if (linkedInProfile.openToWork) {
      factors['openToWork'] = {
        status: true,
        confidence: 'high'
      };
    }
    
    // Activity level factor
    if (linkedInProfile.lastActive) {
      factors['activityLevel'] = {
        status: linkedInProfile.lastActive,
        indicatesEngagement: linkedInProfile.lastActive.includes('Recently')
      };
    }
    
    // Skills alignment factor
    if (linkedInProfile.skills && linkedInProfile.skills.length > 0) {
      factors['skillsAlignment'] = {
        skillCount: linkedInProfile.skills.length,
        indicatesReadiness: linkedInProfile.skills.length >= 5
      };
    }
    
    return factors;
  }

  const httpServer = createServer(app);
  return httpServer;
}
