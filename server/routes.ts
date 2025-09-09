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
import { insertCandidateSchema, insertProjectSchema, scoringWeightsSchema } from "@shared/schema";
import { z } from "zod";
import { OptimizedResumeProcessor } from "./services/optimizedResumeProcessor";
import { PerformanceMonitor } from "./services/performanceMonitor";
import { EeezoService } from "./services/eezoService";
import { sql } from "drizzle-orm";

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

  // Get all candidates with pagination and company filtering
  app.get("/api/candidates", async (req, res) => {
    try {
      const { com_id, limit = 50, offset = 0, priority } = req.query;
      
      if (!com_id) {
        return res.status(400).json({ 
          error: "Company ID (com_id) is required",
          code: "MISSING_COMPANY_ID"
        });
      }

      const limitNum = parseInt(limit as string) || 50;
      const offsetNum = parseInt(offset as string) || 0;

      let candidates;
      if (priority) {
        candidates = await storage.getCandidatesByPriority(priority as string, com_id as string);
      } else {
        candidates = await storage.getCandidates(com_id as string, limitNum, offsetNum);
      }

      res.json({
        success: true,
        data: candidates,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          count: candidates.length,
          hasMore: candidates.length === limitNum
        },
        company: com_id
      });
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch candidates",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get single candidate with company validation
  app.get("/api/candidates/:id", async (req, res) => {
    try {
      const { com_id } = req.query;
      
      if (!com_id) {
        return res.status(400).json({ 
          error: "Company ID (com_id) is required",
          code: "MISSING_COMPANY_ID"
        });
      }

      const candidate = await storage.getCandidate(req.params.id, com_id as string);
      if (!candidate) {
        return res.status(404).json({ 
          error: "Candidate not found",
          code: "CANDIDATE_NOT_FOUND"
        });
      }
      
      res.json({
        success: true,
        data: candidate,
        company: com_id
      });
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

  // Optimized single resume upload route
  app.post("/api/upload-single-resume", upload.single('file'), async (req: RequestWithFile, res) => {
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
        message: "Single resume uploaded",
        details: `${originalname} (${Math.round(size / 1024)}KB)`
      });

      // Use optimized processor for single resume with performance monitoring
      const optimizedProcessor = OptimizedResumeProcessor.getInstance();
      
      // Process with progress tracking and performance monitoring
      const progressCallback = async (progress: number, message: string) => {
        await storage.updateProcessingJob(processingJob.id, {
          progress,
          status: progress === 100 ? "completed" : "processing"
        });
        console.log(`Progress: ${progress}% - ${message}`);
      };

      // Process the single resume with performance monitoring
      const result = await PerformanceMonitor.getInstance().timeOperation(
        'single_resume_processing',
        () => optimizedProcessor.processSingleResume(buffer, originalname, {
          batchSize: 1,
          enableCaching: true,
          parallelProcessing: false,
          progressCallback
        }),
        { filename: originalname, fileSize: size }
      );

      if (result.success) {
        // Update job with results
        await storage.updateProcessingJob(processingJob.id, {
          status: "completed",
          progress: 100,
          totalRecords: result.candidates.length,
          processedRecords: result.candidates.length
        });

        // Log completion
        await storage.createActivity({
          type: "processing",
          message: "Single resume processing completed",
          details: `${result.candidates.length} candidates processed in ${result.processingTime}ms`
        });

        res.json({
          message: "Single resume processed successfully",
          jobId: processingJob.id,
          filename: originalname,
          candidatesProcessed: result.candidates.length,
          processingTime: result.processingTime,
          estimatedTimeSaved: "2-3x faster than batch processing"
        });
      } else {
        // Update job with failure
        await storage.updateProcessingJob(processingJob.id, {
          status: "failed",
          errorMessage: "Processing failed"
        });

        res.status(500).json({
          error: "Single resume processing failed",
          jobId: processingJob.id
        });
      }

    } catch (error) {
      console.error('Optimized upload error:', error);
      res.status(500).json({ 
        error: "Failed to process single resume",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Performance monitoring routes
  app.get("/api/performance/stats", async (req, res) => {
    try {
      const stats = PerformanceMonitor.getInstance().getOverallStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch performance stats",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/performance/operation/:operation", async (req, res) => {
    try {
      const stats = PerformanceMonitor.getInstance().getOperationStats(req.params.operation);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch operation stats",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/performance/slowest", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const slowest = PerformanceMonitor.getInstance().getSlowestOperations(limit);
      res.json(slowest);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch slowest operations",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/performance/trends", async (req, res) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const trends = PerformanceMonitor.getInstance().getPerformanceTrends(hours);
      res.json(trends);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch performance trends",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/performance/memory", async (req, res) => {
    try {
      const memoryStats = PerformanceMonitor.getInstance().getMemoryStats();
      res.json(memoryStats);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch memory stats",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/performance/clear", async (req, res) => {
    try {
      PerformanceMonitor.getInstance().clearMetrics();
      res.json({ message: "Performance metrics cleared successfully" });
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to clear performance metrics",
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

  // Get resume data (now consolidated in candidates table)
  app.get("/api/resume-data", async (req, res) => {
    try {
      const candidates = await storage.getCandidates(100, 0);
      res.json(candidates);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch resume data",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get resume data by candidate ID (now consolidated in candidates table)
  app.get("/api/resume-data/:candidateId", async (req, res) => {
    try {
      const { candidateId } = req.params;
      const candidate = await storage.getCandidate(candidateId);
      
      if (!candidate) {
        return res.status(404).json({ error: "Resume data not found" });
      }
      
      res.json(candidate);
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

  // ==================== EEEZO INTEGRATION ENDPOINTS ====================
  
  // Eeezo: Upload resume file with company ID
  app.post("/api/eezo/upload-resume", upload.single('file'), async (req: RequestWithFile, res) => {
    try {
      const { com_id } = req.body;
      
      // Validate required fields
      if (!com_id) {
        return res.status(400).json({ 
          error: "Company ID (com_id) is required",
          code: "MISSING_COM_ID"
        });
      }
      
      if (!req.file) {
        return res.status(400).json({ 
          error: "Resume file is required",
          code: "MISSING_FILE"
        });
      }

      const { originalname, buffer, size } = req.file;
      
      // Create processing job (use default project or create one)
      let projectId = "default-project";
      
      // Check if default project exists, if not create it
      try {
        const existingProject = await storage.getProject("default-project");
        if (!existingProject) {
          await storage.createProject({
            name: "Default Project",
            description: "Default project for Eeezo integration",
            status: "active"
          });
        }
      } catch (error) {
        console.log("Using existing default project");
      }

      const processingJob = await storage.createProcessingJob({
        projectId: projectId,
        fileName: originalname,
        fileSize: size,
        status: "processing",
        progress: 0,
        totalRecords: 0,
        processedRecords: 0
      });

      // Log activity
      await storage.createActivity({
        type: "eezo_upload",
        message: "Eeezo resume uploaded",
        details: `Company: ${com_id}, File: ${originalname}, Size: ${Math.round(size / 1024)}KB`
      });

      // Process the resume with Eeezo context
      const result = await EeezoService.processEeezoResume({
        comId: com_id,
        file: req.file,
        processingJobId: processingJob.id
      });

      res.json({
        success: true,
        message: "Resume uploaded and processing started",
        data: {
          jobId: processingJob.id,
          candidateId: result.candidateId,
          comId: com_id,
          status: "processing"
        }
      });

    } catch (error) {
      console.error('Eeezo upload error:', error);
      res.status(500).json({ 
        error: "Failed to process Eeezo resume",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "PROCESSING_ERROR"
      });
    }
  });

  // Eeezo: Get resume data by company ID
  app.get("/api/eezo/resume-data/:com_id", async (req, res) => {
    try {
      const { com_id } = req.params;
      const { status, limit = 100, offset = 0 } = req.query;
      
      if (!com_id) {
        return res.status(400).json({ 
          error: "Company ID (com_id) is required",
          code: "MISSING_COM_ID"
        });
      }

      // Get candidates for the company
      const candidates = await EeezoService.getCandidatesByCompanyId(com_id, {
        status: status as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      // Transform data for Eeezo format
      const transformedData = candidates.map(candidate => ({
        candidateId: candidate.id,
        comId: candidate.comId,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        title: candidate.title,
        company: candidate.company,
        location: candidate.location,
        linkedinUrl: candidate.linkedinUrl,
        githubUrl: candidate.githubUrl,
        portfolioUrl: candidate.portfolioUrl,
        summary: candidate.summary,
        skills: candidate.skills,
        experience: candidate.experience,
        education: candidate.education,
        projects: candidate.projects,
        achievements: candidate.achievements,
        certifications: candidate.certifications,
        languages: candidate.languages,
        interests: candidate.interests,
        score: candidate.score,
        priority: candidate.priority,
        openToWork: candidate.openToWork,
        hireabilityScore: candidate.hireabilityScore,
        potentialToJoin: candidate.potentialToJoin,
        enrichmentStatus: candidate.enrichmentStatus,
        eeezoStatus: candidate.eeezoStatus,
        confidence: candidate.confidence,
        processingTime: candidate.processingTime,
        createdAt: candidate.createdAt
      }));

      res.json({
        success: true,
        data: {
          comId: com_id,
          totalCandidates: candidates.length,
          candidates: transformedData
        }
      });

    } catch (error) {
      console.error('Eeezo fetch error:', error);
      res.status(500).json({ 
        error: "Failed to fetch Eeezo resume data",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "FETCH_ERROR"
      });
    }
  });

  // Eeezo: Get processing status
  app.get("/api/eezo/status/:com_id", async (req, res) => {
    try {
      const { com_id } = req.params;
      
      if (!com_id) {
        return res.status(400).json({ 
          error: "Company ID (com_id) is required",
          code: "MISSING_COM_ID"
        });
      }

      const status = await EeezoService.getEeezoProcessingStatus(com_id);
      
      res.json({
        success: true,
        data: {
          comId: com_id,
          status: status
        }
      });

    } catch (error) {
      console.error('Eeezo status error:', error);
      res.status(500).json({ 
        error: "Failed to fetch Eeezo status",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "STATUS_ERROR"
      });
    }
  });

  // Eeezo: Update candidate status
  app.patch("/api/eezo/candidate/:candidateId/status", async (req, res) => {
    try {
      const { candidateId } = req.params;
      const { eeezoStatus, notes } = req.body;
      
      if (!candidateId) {
        return res.status(400).json({ 
          error: "Candidate ID is required",
          code: "MISSING_CANDIDATE_ID"
        });
      }

      const updatedCandidate = await EeezoService.updateCandidateEeezoStatus(candidateId, {
        eeezoStatus,
        notes
      });

      res.json({
        success: true,
        data: updatedCandidate
      });

    } catch (error) {
      console.error('Eeezo update error:', error);
      res.status(500).json({ 
        error: "Failed to update candidate status",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "UPDATE_ERROR"
      });
    }
  });

  // Resume Status Management: Handle CORS preflight for resume status endpoint
  app.options("/api/candidates/:candidateId/resume-status", (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Max-Age', '86400');
    res.status(200).end();
  });

  // Resume Status Management: Update candidate resume status with company validation
  app.patch("/api/candidates/:candidateId/resume-status", async (req, res) => {
    try {
      const { candidateId } = req.params;
      const { status, com_id } = req.body;
      
      if (!candidateId) {
        return res.status(400).json({ 
          error: "Candidate ID is required",
          code: "MISSING_CANDIDATE_ID"
        });
      }

      if (!com_id) {
        return res.status(400).json({ 
          error: "Company ID (com_id) is required",
          code: "MISSING_COMPANY_ID"
        });
      }

      if (!status || !['active', 'inactive'].includes(status)) {
        return res.status(400).json({ 
          error: "Status must be 'active' or 'inactive'",
          code: "INVALID_STATUS"
        });
      }

      const updatedCandidate = await storage.updateCandidateResumeStatus(candidateId, status, com_id);

      if (!updatedCandidate) {
        return res.status(404).json({ 
          error: "Candidate not found or does not belong to this company",
          code: "CANDIDATE_NOT_FOUND"
        });
      }

      res.json({
        success: true,
        data: {
          candidateId: updatedCandidate.id,
          name: updatedCandidate.name,
          resumeStatus: updatedCandidate.resumeStatus,
          comId: updatedCandidate.comId,
          message: `Resume status updated to ${status}`
        }
      });

    } catch (error) {
      console.error('Resume status update error:', error);
      res.status(500).json({ 
        error: "Failed to update resume status",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "STATUS_UPDATE_ERROR"
      });
    }
  });

  // Debug endpoint: Get all unique com_id values
  app.get("/api/debug/com-ids", async (req, res) => {
    try {
      // Use direct database query to get all com_id values
      const { db } = await import('./db.js');
      const { candidates } = await import('@shared/schema');
      
      const result = await db.select({
        comId: candidates.comId
      }).from(candidates);
      
      // Group by com_id
      const comIdGroups: { [key: string]: number } = {};
      let candidatesWithoutComId = 0;
      
      for (const candidate of result) {
        if (candidate.comId) {
          comIdGroups[candidate.comId] = (comIdGroups[candidate.comId] || 0) + 1;
        } else {
          candidatesWithoutComId++;
        }
      }
      
      const comIds = Object.entries(comIdGroups).map(([comId, count]) => ({ com_id: comId, count }));
      
      res.json({
        success: true,
        data: {
          comIds: comIds.sort((a, b) => b.count - a.count),
          candidatesWithoutComId,
          totalUniqueComIds: comIds.length
        }
      });
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch com_id values",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get inactive resumes with company filtering and pagination
  app.get("/api/candidates/inactive", async (req, res) => {
    try {
      const { com_id, limit = 100, offset = 0 } = req.query;
      
      if (!com_id) {
        return res.status(400).json({ 
          error: "Company ID (com_id) is required",
          code: "MISSING_COMPANY_ID"
        });
      }
      
      const limitNum = parseInt(limit as string) || 100;
      const offsetNum = parseInt(offset as string) || 0;
      
      const inactiveCandidates = await storage.getCandidatesByResumeStatus('inactive', com_id as string, limitNum, offsetNum);
      
      res.json({
        success: true,
        data: inactiveCandidates,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          count: inactiveCandidates.length,
          hasMore: inactiveCandidates.length === limitNum
        },
        company: com_id,
        message: `Found ${inactiveCandidates.length} inactive candidates for company ${com_id}`
      });

    } catch (error) {
      console.error('Get inactive candidates error:', error);
      res.status(500).json({ 
        error: "Failed to fetch inactive candidates",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "FETCH_INACTIVE_ERROR"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
