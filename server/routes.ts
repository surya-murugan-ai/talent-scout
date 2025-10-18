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
import { websocketService } from "./services/websocketService";
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

  // Get specific candidates by IDs and company ID
  app.post("/api/candidates/bulk", async (req, res) => {
    try {
      const { candidateIds, com_id } = req.body;
      
      if (!com_id) {
        return res.status(400).json({ 
          error: "Company ID (com_id) is required",
          code: "MISSING_COMPANY_ID"
        });
      }

      if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
        return res.status(400).json({ 
          error: "Candidate IDs array is required and must not be empty",
          code: "MISSING_CANDIDATE_IDS"
        });
      }

      // Validate that all IDs are strings
      const invalidIds = candidateIds.filter(id => typeof id !== 'string' || !id.trim());
      if (invalidIds.length > 0) {
        return res.status(400).json({ 
          error: "All candidate IDs must be non-empty strings",
          code: "INVALID_CANDIDATE_IDS"
        });
      }

      const candidates = await storage.getCandidatesByIds(candidateIds, com_id);
      
      res.json({
        success: true,
        data: {
          comId: com_id,
          requestedIds: candidateIds,
          foundCandidates: candidates.length,
          candidates: candidates
        }
      });
    } catch (error) {
      console.error('Bulk candidates fetch error:', error);
      res.status(500).json({ 
        error: "Failed to fetch candidates",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "BULK_FETCH_ERROR"
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
      const { com_id, ...weights } = req.body;
      
      if (!com_id) {
        return res.status(400).json({ error: "com_id is required" });
      }
      
      const validatedWeights = scoringWeightsSchema.parse(weights);
      
      // Validate weights sum to 100
      const total = validatedWeights.openToWork + validatedWeights.skillMatch + validatedWeights.jobStability + validatedWeights.platformEngagement;
      if (Math.abs(total - 100) > 0.1) {
        return res.status(400).json({ 
          error: "Scoring weights must sum to 100%" 
        });
      }

      // Check if config exists for this company
      const existingConfig = await storage.getScoringConfig(com_id);
      
      let config;
      if (existingConfig) {
        // Update existing config
        config = await storage.updateScoringConfig(com_id, validatedWeights);
      } else {
        // Create new config
        config = await storage.createScoringConfig({
          comId: com_id,
          ...validatedWeights
        });
      }

      if (!config) {
        return res.status(404).json({ error: "Failed to save scoring configuration" });
      }

      // Log activity
      await storage.createActivity({
        type: "scoring_update",
        message: "Scoring model updated",
        details: `Scoring weights updated for ${com_id}: OTW:${validatedWeights.openToWork}% SM:${validatedWeights.skillMatch}% JS:${validatedWeights.jobStability}% PE:${validatedWeights.platformEngagement}%`
      });

      res.json({
        success: true,
        message: "Scoring weights updated successfully",
        data: config
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
      const com_id = req.query.com_id as string;
      
      if (!com_id) {
        return res.status(400).json({ error: "com_id query parameter is required" });
      }
      
      const config = await storage.getScoringConfig(com_id);
      
      if (!config) {
        // Return default configuration if none exists
        const defaultConfig = {
          comId: com_id,
          openToWork: 25,
          skillMatch: 25,
          jobStability: 25,
          platformEngagement: 25
        };
        return res.json({
          success: true,
          data: defaultConfig,
          isDefault: true
        });
      }
      
      res.json({
        success: true,
        data: config,
        isDefault: false
      });
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

  // Quick Check: Search LinkedIn, score candidate, and save to database
  app.post('/api/quick-check', async (req, res) => {
    try {
      const { name, email, company, title, location, com_id, saveToDatabase = true } = req.body;
      
      // Validate required fields
      if (!name) {
        return res.status(400).json({ 
          error: "Name is required",
          code: "MISSING_NAME"
        });
      }

      const startTime = Date.now();
      
      console.log(`🔍 Quick Check for: ${name} (${title || 'N/A'}) at ${company || 'N/A'}`);

      // Step 1: Check if candidate already exists by email
      let existingCandidate = null;
      if (email && saveToDatabase) {
        try {
          existingCandidate = await storage.getCandidateByEmail(email);
        } catch (error) {
          console.log('Could not check for existing candidate');
        }
      }

      // Step 2: Search LinkedIn and get profile data (ONE API call)
      const { LinkedInService } = await import('./services/linkedin');
      const linkedInService = new LinkedInService();
      let linkedinUrl = null;
      let linkedinProfile = null;
      let profileValidation = null;
      
      try {
        console.log(`🔍 Searching LinkedIn with fuzzy search for: ${name}`);
        const result = await linkedInService.searchProfilesWithData(
          name,
          company,
          title
          // Note: location parameter removed - causes 0 results from Apify
        );
        
        if (result) {
          linkedinUrl = result.url;
          linkedinProfile = result.profile;
          profileValidation = result.validation;
          
          // Log validation results
          if (profileValidation && !profileValidation.isValid) {
            console.warn(`⚠️ LinkedIn profile found but validation failed:`, {
              url: linkedinUrl,
              confidence: profileValidation.confidence,
              errors: profileValidation.errors,
              warnings: profileValidation.warnings
            });
          }
          
          console.log(`✅ Found LinkedIn profile with data (single API call): ${linkedinUrl}`);
        } else {
          console.log(`⚠️ No LinkedIn profile found via Apify`);
        }
      } catch (error) {
        console.error('❌ LinkedIn search error:', error);
      }

      // Step 3: Get scoring weights
      let weights: { openToWork: number; skillMatch: number; jobStability: number; engagement: number; companyDifference: number } = {
        openToWork: 40,
        skillMatch: 30,
        jobStability: 15,
        engagement: 15,
        companyDifference: 15
      };

      if (com_id) {
        try {
          const config = await storage.getScoringConfig(com_id);
          if (config) {
            weights = {
              openToWork: config.openToWork,
              skillMatch: config.skillMatch,
              jobStability: config.jobStability,
              engagement: config.platformEngagement,
              companyDifference: 15
            };
          }
        } catch (error) {
          console.log('Using default weights');
        }
      }

      // Step 5: Analyze with AI
      const candidateData = {
        name,
        email,
        title,
        company,
        location,
        skills: linkedinProfile?.skills?.join(', ') || '',
        linkedinProfile: linkedinProfile,
        resumeCompany: company,
        linkedinCompany: linkedinProfile?.company
      };

      const analysis = await analyzeCandidate(candidateData, "", weights);
      console.log(`✅ AI analysis completed: Score ${analysis.overallScore}`);

      // Step 6: Calculate hireability
      const hasCompanyDifference = company && linkedinProfile?.company && 
        company !== linkedinProfile.company;
      
      let hireabilityScore = 0;
      // Base score from AI analysis (40%)
      hireabilityScore += analysis.overallScore * 4;
      // Company difference bonus (20%)
      if (hasCompanyDifference) hireabilityScore += 20;
      // Open to work bonus (20%)
      if (linkedinProfile?.openToWork) hireabilityScore += 20;
      // Recent activity bonus (10%)
      if (linkedinProfile?.lastActive && linkedinProfile.lastActive.includes('week')) hireabilityScore += 10;
      // Skills bonus (10%)
      if (linkedinProfile?.skills && linkedinProfile.skills.length >= 5) hireabilityScore += 10;
      hireabilityScore = Math.min(hireabilityScore, 100);

      const companyDifference = hasCompanyDifference ? "Different" : "Same";
      const companyDifferenceScore = hasCompanyDifference ? weights.companyDifference : 0;

      // Step 7: Save to database if requested
      let savedCandidate = null;
      if (saveToDatabase) {
        try {
          if (existingCandidate) {
            savedCandidate = await storage.updateCandidate(existingCandidate.id, {
              title: title || existingCandidate.title,
              company: company || existingCandidate.company,
              currentEmployer: linkedinProfile?.company || existingCandidate.currentEmployer,
              linkedinUrl: linkedinUrl || existingCandidate.linkedinUrl,
              location: location || existingCandidate.location,
              skills: linkedinProfile?.skills || existingCandidate.skills,
              score: analysis.overallScore,
              priority: analysis.priority,
              openToWork: linkedinProfile?.openToWork || false,
              lastActive: linkedinProfile?.lastActive || 'Unknown',
              notes: `Quick check: ${analysis.insights.join('; ')}`,
              companyDifference: companyDifference,
              companyDifferenceScore: companyDifferenceScore,
              hireabilityScore: hireabilityScore,
              potentialToJoin: hireabilityScore >= 70 ? 'High' : hireabilityScore >= 50 ? 'Medium' : 'Low',
              enrichedData: linkedinProfile,
              source: 'quick-check',
              comId: com_id || null
            });
            console.log(`✅ Updated existing candidate: ${existingCandidate.id}`);
          } else {
            savedCandidate = await storage.createCandidate({
              name,
              email: email || null,
              title: title || null,
              company: company || null,
              currentEmployer: linkedinProfile?.company || null,
              linkedinUrl: linkedinUrl || null,
              location: location || null,
              skills: linkedinProfile?.skills || [],
              score: analysis.overallScore,
              priority: analysis.priority,
              openToWork: linkedinProfile?.openToWork || false,
              lastActive: linkedinProfile?.lastActive || 'Unknown',
              notes: `Quick check: ${analysis.insights.join('; ')}`,
              companyDifference: companyDifference,
              companyDifferenceScore: companyDifferenceScore,
              hireabilityScore: hireabilityScore,
              potentialToJoin: hireabilityScore >= 70 ? 'High' : hireabilityScore >= 50 ? 'Medium' : 'Low',
              enrichedData: linkedinProfile,
              source: 'quick-check',
              comId: com_id || null
            });
            console.log(`✅ Created new candidate: ${savedCandidate.id}`);
          }

          await storage.createActivity({
            type: "quick_check",
            message: "Quick check completed",
            details: `${name} - Score: ${analysis.overallScore}, Priority: ${analysis.priority}`
          });
        } catch (dbError) {
          console.error('Failed to save to database:', dbError);
        }
      }

      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          candidateId: savedCandidate?.id || null,
          candidateInfo: {
            name,
            email,
            providedCompany: company,
            providedTitle: title,
            location
          },
          linkedinProfile: linkedinProfile ? {
            profileUrl: linkedinUrl,
            currentCompany: linkedinProfile.company,
            currentTitle: linkedinProfile.title,
            skills: linkedinProfile.skills,
            openToWork: linkedinProfile.openToWork,
            lastActive: linkedinProfile.lastActive,
            jobHistory: linkedinProfile.jobHistory,
            recentActivity: linkedinProfile.recentActivity,
            // Additional profile fields
            name: linkedinProfile.name,
            headline: linkedinProfile.headline,
            location: linkedinProfile.location,
            summary: linkedinProfile.summary,
            education: linkedinProfile.education,
            certifications: linkedinProfile.certifications,
            connections: linkedinProfile.connections,
            profilePicture: linkedinProfile.profilePicture,
            industry: linkedinProfile.industry,
            languages: linkedinProfile.languages
          } : null,
          dataQuality: profileValidation ? {
            isValid: profileValidation.isValid,
            confidence: profileValidation.confidence,
            warnings: profileValidation.warnings,
            errors: profileValidation.errors
          } : null,
          scoring: {
            skillMatch: analysis.skillMatch,
            openToWork: analysis.openToWork,
            jobStability: analysis.jobStability,
            engagement: analysis.engagement,
            companyConsistency: analysis.companyConsistency,
            overallScore: analysis.overallScore,
            priority: analysis.priority
          },
          hireability: {
            score: hireabilityScore,
            potentialToJoin: hireabilityScore >= 70 ? 'High' : hireabilityScore >= 50 ? 'Medium' : 'Low',
            factors: {
              openToWork: linkedinProfile?.openToWork || false,
              companyMatch: !hasCompanyDifference,
              recentActivity: linkedinProfile?.lastActive?.includes('week') || false,
              skillsAvailable: (linkedinProfile?.skills?.length || 0) > 0
            }
          },
          insights: analysis.insights,
          companyDifference: hasCompanyDifference ? 
            `Different (Resume: ${company}, LinkedIn: ${linkedinProfile?.company})` : 
            'Same',
          savedToDatabase: saveToDatabase && savedCandidate !== null,
          isExistingCandidate: existingCandidate !== null
        },
        processingTime,
        message: saveToDatabase ? 
          (existingCandidate ? "Candidate updated in database" : "New candidate saved to database") :
          "Quick check completed - data not saved"
      });

    } catch (error) {
      console.error('Quick check failed:', error);
      res.status(500).json({ 
        error: "Quick check failed",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "QUICK_CHECK_ERROR"
      });
    }
  });

  // Bulk Quick Check: Upload CSV/XLSX with multiple candidates
  app.post('/api/bulk-quick-check', upload.single('file'), async (req, res) => {
    try {
      const file = (req as any).file;
      const { com_id, saveToDatabase = true, page = 1, limit = 10 } = req.body;
      
      // Validate file upload
      if (!file) {
        return res.status(400).json({ 
          error: "No file uploaded",
          code: "MISSING_FILE"
        });
      }

      console.log(`📁 Bulk Quick Check: Processing ${file.originalname}`);
      
      // Parse CSV/XLSX file
      const candidates = await FileProcessor.processFile(file.buffer, file.originalname);
      
      if (!candidates || candidates.length === 0) {
        return res.status(400).json({ 
          error: "No valid candidates found in file",
          code: "EMPTY_FILE"
        });
      }

      console.log(`✅ Found ${candidates.length} candidates in file`);

      // Pagination
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 10;
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedCandidates = candidates.slice(startIndex, endIndex);

      console.log(`📄 Processing page ${pageNum}: ${paginatedCandidates.length} candidates (${startIndex + 1}-${Math.min(endIndex, candidates.length)} of ${candidates.length})`);

      // Process each candidate
      const results = [];
      const { LinkedInService } = await import('./services/linkedin');
      const linkedInService = new LinkedInService();

      for (let i = 0; i < paginatedCandidates.length; i++) {
        const candidate = paginatedCandidates[i];
        const startTime = Date.now();
        
        console.log(`\n🔍 [${i + 1}/${paginatedCandidates.length}] Processing: ${candidate.name}`);

        try {
          // Step 1: Check if candidate already exists by email
          let existingCandidate = null;
          if (candidate.email && saveToDatabase) {
            try {
              existingCandidate = await storage.getCandidateByEmail(candidate.email);
              if (existingCandidate) {
                console.log(`✅ Found existing candidate: ${existingCandidate.id}`);
                
                // Return existing candidate data
                results.push({
                  success: true,
                  candidateInfo: {
                    name: candidate.name,
                    email: candidate.email,
                    providedCompany: candidate.company,
                    providedTitle: candidate.title
                  },
                  existingCandidate: {
                    id: existingCandidate.id,
                    name: existingCandidate.name,
                    email: existingCandidate.email,
                    company: existingCandidate.company,
                    title: existingCandidate.title,
                    score: existingCandidate.score,
                    priority: existingCandidate.priority,
                    hireabilityScore: existingCandidate.hireabilityScore,
                    potentialToJoin: existingCandidate.potentialToJoin,
                    linkedinUrl: existingCandidate.linkedinUrl,
                    openToWork: existingCandidate.openToWork
                  },
                  isExistingCandidate: true,
                  processingTime: Date.now() - startTime
                });
                continue; // Skip to next candidate
              }
            } catch (error) {
              console.log('Could not check for existing candidate');
            }
          }

          // Step 2: Search LinkedIn and get profile data (ONE API call)
          let linkedinUrl = null;
          let linkedinProfile = null;
          try {
            const result = await linkedInService.searchProfilesWithData(
              candidate.name,
              candidate.company,
              candidate.title
              // Note: location parameter removed - causes 0 results from Apify
            );
            
            if (result) {
              linkedinUrl = result.url;
              linkedinProfile = result.profile;
              console.log(`✅ Found LinkedIn profile with data (single API call): ${linkedinUrl}`);
            } else {
              console.log(`⚠️ No LinkedIn profile found`);
            }
          } catch (error) {
            console.error('❌ LinkedIn search error:', error);
          }

          // Step 3: Get scoring weights
          let weights = {
            openToWork: 40,
            skillMatch: 30,
            jobStability: 15,
            engagement: 15,
            companyDifference: 15
          };

          if (com_id) {
            try {
              const config = await storage.getScoringConfig(com_id);
              if (config) {
                weights = {
                  openToWork: config.openToWork,
                  skillMatch: config.skillMatch,
                  jobStability: config.jobStability,
                  engagement: config.platformEngagement,
                  companyDifference: 15
                };
              }
            } catch (error) {
              console.log('Using default weights');
            }
          }

          // Step 5: AI Analysis
          const candidateData = {
            name: candidate.name,
            email: candidate.email,
            title: candidate.title,
            company: candidate.company,
            location: candidate.location,
            skills: linkedinProfile?.skills?.join(', ') || '',
            linkedinProfile: linkedinProfile,
            resumeCompany: candidate.company,
            linkedinCompany: linkedinProfile?.company
          };

          const analysis = await analyzeCandidate(candidateData, "", weights);
          console.log(`✅ AI analysis: Score ${analysis.overallScore}`);

          // Step 6: Calculate hireability
          const hasCompanyDifference = candidate.company && linkedinProfile?.company && 
            candidate.company !== linkedinProfile.company;
          
          let hireabilityScore = 0;
          hireabilityScore += analysis.overallScore * 4;
          if (hasCompanyDifference) hireabilityScore += 20;
          if (linkedinProfile?.openToWork) hireabilityScore += 20;
          if (linkedinProfile?.lastActive && linkedinProfile.lastActive.includes('week')) hireabilityScore += 10;
          if (linkedinProfile?.skills && linkedinProfile.skills.length >= 5) hireabilityScore += 10;
          hireabilityScore = Math.min(hireabilityScore, 100);

          const companyDifference = hasCompanyDifference ? "Different" : "Same";
          const companyDifferenceScore = hasCompanyDifference ? weights.companyDifference : 0;

          // Step 7: Save to database
          let savedCandidate = null;
          if (saveToDatabase) {
            try {
              savedCandidate = await storage.createCandidate({
                name: candidate.name,
                email: candidate.email || null,
                title: candidate.title || null,
                company: candidate.company || null,
                currentEmployer: linkedinProfile?.company || null,
                linkedinUrl: linkedinUrl || null,
                location: candidate.location || null,
                skills: linkedinProfile?.skills || [],
                score: analysis.overallScore,
                priority: analysis.priority,
                openToWork: linkedinProfile?.openToWork || false,
                lastActive: linkedinProfile?.lastActive || 'Unknown',
                notes: `Bulk quick check: ${analysis.insights.join('; ')}`,
                companyDifference: companyDifference,
                companyDifferenceScore: companyDifferenceScore,
                hireabilityScore: hireabilityScore,
                potentialToJoin: hireabilityScore >= 70 ? 'High' : hireabilityScore >= 50 ? 'Medium' : 'Low',
                enrichedData: linkedinProfile,
                source: 'bulk-quick-check',
                comId: com_id || null
              });
              console.log(`✅ Saved candidate: ${savedCandidate.id}`);
            } catch (dbError) {
              console.error('Failed to save to database:', dbError);
            }
          }

          const processingTime = Date.now() - startTime;

          // Add to results
          results.push({
            success: true,
            candidateId: savedCandidate?.id || null,
            candidateInfo: {
              name: candidate.name,
              email: candidate.email,
              providedCompany: candidate.company,
              providedTitle: candidate.title,
              location: candidate.location
            },
            linkedinProfile: linkedinProfile ? {
              profileUrl: linkedinUrl,
              name: linkedinProfile.name,
              currentCompany: linkedinProfile.company,
              currentTitle: linkedinProfile.title,
              headline: linkedinProfile.headline,
              location: linkedinProfile.location,
              summary: linkedinProfile.summary,
              connections: linkedinProfile.connections,
              skills: linkedinProfile.skills,
              education: linkedinProfile.education,
              certifications: linkedinProfile.certifications,
              openToWork: linkedinProfile.openToWork,
              lastActive: linkedinProfile.lastActive,
              jobHistory: linkedinProfile.jobHistory,
              recentActivity: linkedinProfile.recentActivity,
              profilePicture: linkedinProfile.profilePicture,
              industry: linkedinProfile.industry,
              languages: linkedinProfile.languages
            } : null,
            scoring: {
              skillMatch: analysis.skillMatch,
              openToWork: analysis.openToWork,
              jobStability: analysis.jobStability,
              engagement: analysis.engagement,
              companyConsistency: analysis.companyConsistency,
              overallScore: analysis.overallScore,
              priority: analysis.priority
            },
            hireability: {
              score: hireabilityScore,
              potentialToJoin: hireabilityScore >= 70 ? 'High' : hireabilityScore >= 50 ? 'Medium' : 'Low',
              factors: {
                openToWork: linkedinProfile?.openToWork || false,
                companyMatch: !hasCompanyDifference,
                recentActivity: linkedinProfile?.lastActive?.includes('week') || false,
                skillsAvailable: (linkedinProfile?.skills?.length || 0) > 0
              }
            },
            insights: analysis.insights,
            companyDifference: hasCompanyDifference ? 
              `Different (Provided: ${candidate.company}, LinkedIn: ${linkedinProfile?.company})` : 
              'Same',
            savedToDatabase: saveToDatabase && savedCandidate !== null,
            isExistingCandidate: false,
            processingTime
          });

        } catch (error) {
          console.error(`❌ Failed to process ${candidate.name}:`, error);
          results.push({
            success: false,
            candidateInfo: {
              name: candidate.name,
              email: candidate.email,
              providedCompany: candidate.company,
              providedTitle: candidate.title
            },
            error: error instanceof Error ? error.message : 'Unknown error',
            processingTime: Date.now() - startTime
          });
        }
      }

      // Calculate pagination metadata
      const totalPages = Math.ceil(candidates.length / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      // Log activity
      try {
        await storage.createActivity({
          type: "bulk_quick_check",
          message: "Bulk quick check completed",
          details: `Processed ${results.length} candidates from ${file.originalname} (Page ${pageNum}/${totalPages})`
        });
      } catch (error) {
        console.error('Failed to log activity:', error);
      }

      res.json({
        success: true,
        data: {
          results: results,
          pagination: {
            currentPage: pageNum,
            totalPages: totalPages,
            totalCandidates: candidates.length,
            candidatesPerPage: limitNum,
            processedInThisPage: results.length,
            hasNextPage: hasNextPage,
            hasPrevPage: hasPrevPage,
            nextPage: hasNextPage ? pageNum + 1 : null,
            prevPage: hasPrevPage ? pageNum - 1 : null
          },
          summary: {
            totalCandidates: candidates.length,
            processedInThisPage: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            existingCandidates: results.filter(r => r.isExistingCandidate).length,
            newCandidates: results.filter(r => r.success && !r.isExistingCandidate).length,
            savedToDatabase: saveToDatabase
          }
        },
        message: `Processed ${results.length} candidates from page ${pageNum} of ${totalPages}`
      });

    } catch (error) {
      console.error('Bulk quick check failed:', error);
      res.status(500).json({ 
        error: "Bulk quick check failed",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "BULK_QUICK_CHECK_ERROR"
      });
    }
  });

  // Real-time bulk quick check with Server-Sent Events (SSE)
  app.post('/api/bulk-quick-check/stream', upload.single('file'), async (req, res) => {
    try {
      const file = (req as any).file;
      const { com_id, saveToDatabase = true, page = 1, limit = 10 } = req.body;
      
      // Validate file upload
      if (!file) {
        return res.status(400).json({ 
          error: "No file uploaded",
          code: "MISSING_FILE"
        });
      }

      console.log(`📁 Bulk Quick Check (Streaming): Processing ${file.originalname}`);
      
      // Parse CSV/XLSX file
      const candidates = await FileProcessor.processFile(file.buffer, file.originalname);
      
      if (!candidates || candidates.length === 0) {
        return res.status(400).json({ 
          error: "No valid candidates found in file",
          code: "EMPTY_FILE"
        });
      }

      console.log(`✅ Found ${candidates.length} candidates in file`);

      // Pagination
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 10;
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedCandidates = candidates.slice(startIndex, endIndex);

      console.log(`📄 Processing page ${pageNum}: ${paginatedCandidates.length} candidates (${startIndex + 1}-${Math.min(endIndex, candidates.length)} of ${candidates.length})`);

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Send initial metadata
      res.write(`data: ${JSON.stringify({
        type: 'start',
        totalCandidates: paginatedCandidates.length,
        page: pageNum,
        totalPages: Math.ceil(candidates.length / limitNum)
      })}\n\n`);

      // Process each candidate and stream results
      const { LinkedInService } = await import('./services/linkedin');
      const linkedInService = new LinkedInService();
      
      let successCount = 0;
      let failureCount = 0;
      let existingCount = 0;

      for (let i = 0; i < paginatedCandidates.length; i++) {
        const candidate = paginatedCandidates[i];
        const startTime = Date.now();
        
        console.log(`\n🔍 [${i + 1}/${paginatedCandidates.length}] Processing: ${candidate.name}`);

        try {
          // Step 1: Check if candidate already exists by email
          let existingCandidate = null;
          if (candidate.email && saveToDatabase) {
            try {
              existingCandidate = await storage.getCandidateByEmail(candidate.email);
              if (existingCandidate) {
                console.log(`✅ Found existing candidate: ${existingCandidate.id}`);
                existingCount++;
                
                // Stream existing candidate data immediately
                res.write(`data: ${JSON.stringify({
                  type: 'candidate',
                  index: i + 1,
                  total: paginatedCandidates.length,
                  success: true,
                  candidateInfo: {
                    name: candidate.name,
                    email: candidate.email,
                    providedCompany: candidate.company,
                    providedTitle: candidate.title
                  },
                  existingCandidate: {
                    id: existingCandidate.id,
                    name: existingCandidate.name,
                    email: existingCandidate.email,
                    company: existingCandidate.company,
                    title: existingCandidate.title,
                    score: existingCandidate.score,
                    priority: existingCandidate.priority,
                    hireabilityScore: existingCandidate.hireabilityScore,
                    potentialToJoin: existingCandidate.potentialToJoin,
                    linkedinUrl: existingCandidate.linkedinUrl,
                    openToWork: existingCandidate.openToWork
                  },
                  isExistingCandidate: true,
                  processingTime: Date.now() - startTime
                })}\n\n`);
                continue; // Skip to next candidate
              }
            } catch (error) {
              console.log('Could not check for existing candidate');
            }
          }

          // Step 2: Search LinkedIn and get profile data (ONE API call)
          let linkedinUrl = null;
          let linkedinProfile = null;
          let profileValidation = null;
          try {
            const result = await linkedInService.searchProfilesWithData(
              candidate.name,
              candidate.company,
              candidate.title
              // Note: location parameter removed - causes 0 results from Apify
            );
            
            if (result) {
              linkedinUrl = result.url;
              linkedinProfile = result.profile;
              profileValidation = result.validation;
              console.log(`✅ Found LinkedIn profile with data (single API call): ${linkedinUrl}`);
              
              // Log validation results
              if (profileValidation && !profileValidation.isValid) {
                console.warn(`⚠️ Profile validation failed (${profileValidation.confidence}% confidence)`, {
                  errors: profileValidation.errors,
                  warnings: profileValidation.warnings
                });
              }
            } else {
              console.log(`⚠️ No LinkedIn profile found`);
            }
          } catch (error) {
            console.error('❌ LinkedIn search error:', error);
          }

          // Step 4: Get scoring weights
          let weights = {
            openToWork: 40,
            skillMatch: 30,
            jobStability: 15,
            engagement: 15,
            companyDifference: 15
          };

          if (com_id) {
            try {
              const config = await storage.getScoringConfig(com_id);
              if (config) {
                weights = {
                  openToWork: config.openToWork,
                  skillMatch: config.skillMatch,
                  jobStability: config.jobStability,
                  engagement: config.platformEngagement,
                  companyDifference: 15
                };
              }
            } catch (error) {
              console.log('Using default weights');
            }
          }

          // Step 5: AI Analysis
          const candidateData = {
            name: candidate.name,
            email: candidate.email,
            title: candidate.title,
            company: candidate.company,
            location: candidate.location,
            skills: linkedinProfile?.skills?.join(', ') || '',
            linkedinProfile: linkedinProfile,
            resumeCompany: candidate.company,
            linkedinCompany: linkedinProfile?.company
          };

          const analysis = await analyzeCandidate(candidateData, "", weights);
          console.log(`✅ AI analysis: Score ${analysis.overallScore}`);

          // Step 6: Calculate hireability
          const hasCompanyDifference = candidate.company && linkedinProfile?.company && 
            candidate.company !== linkedinProfile.company;
          
          let hireabilityScore = 0;
          hireabilityScore += analysis.overallScore * 4;
          if (hasCompanyDifference) hireabilityScore += 20;
          if (linkedinProfile?.openToWork) hireabilityScore += 20;
          if (linkedinProfile?.lastActive && linkedinProfile.lastActive.includes('week')) hireabilityScore += 10;
          if (linkedinProfile?.skills && linkedinProfile.skills.length >= 5) hireabilityScore += 10;
          hireabilityScore = Math.min(hireabilityScore, 100);

          const companyDifference = hasCompanyDifference ? "Different" : "Same";
          const companyDifferenceScore = hasCompanyDifference ? weights.companyDifference : 0;

          // Step 7: Save to database
          let savedCandidate = null;
          if (saveToDatabase) {
            try {
              savedCandidate = await storage.createCandidate({
                name: candidate.name,
                email: candidate.email || null,
                title: candidate.title || null,
                company: candidate.company || null,
                currentEmployer: linkedinProfile?.company || null,
                linkedinUrl: linkedinUrl || null,
                location: candidate.location || null,
                skills: linkedinProfile?.skills || [],
                score: analysis.overallScore,
                priority: analysis.priority,
                openToWork: linkedinProfile?.openToWork || false,
                lastActive: linkedinProfile?.lastActive || 'Unknown',
                notes: `Bulk quick check: ${analysis.insights.join('; ')}`,
                companyDifference: companyDifference,
                companyDifferenceScore: companyDifferenceScore,
                hireabilityScore: hireabilityScore,
                potentialToJoin: hireabilityScore >= 70 ? 'High' : hireabilityScore >= 50 ? 'Medium' : 'Low',
                enrichedData: linkedinProfile,
                source: 'bulk-quick-check-stream',
                comId: com_id || null
              });
              console.log(`✅ Saved candidate: ${savedCandidate.id}`);
            } catch (dbError) {
              console.error('Failed to save to database:', dbError);
            }
          }

          const processingTime = Date.now() - startTime;
          successCount++;

          // Stream successful result immediately
          res.write(`data: ${JSON.stringify({
            type: 'candidate',
            index: i + 1,
            total: paginatedCandidates.length,
            success: true,
            candidateId: savedCandidate?.id || null,
            candidateInfo: {
              name: candidate.name,
              email: candidate.email,
              providedCompany: candidate.company,
              providedTitle: candidate.title,
              location: candidate.location
            },
            linkedinProfile: linkedinProfile ? {
              profileUrl: linkedinUrl,
              name: linkedinProfile.name,
              currentCompany: linkedinProfile.company,
              currentTitle: linkedinProfile.title,
              headline: linkedinProfile.headline,
              location: linkedinProfile.location,
              summary: linkedinProfile.summary,
              connections: linkedinProfile.connections,
              skills: linkedinProfile.skills,
              education: linkedinProfile.education,
              certifications: linkedinProfile.certifications,
              openToWork: linkedinProfile.openToWork,
              lastActive: linkedinProfile.lastActive,
              jobHistory: linkedinProfile.jobHistory,
              recentActivity: linkedinProfile.recentActivity,
              profilePicture: linkedinProfile.profilePicture,
              industry: linkedinProfile.industry,
              languages: linkedinProfile.languages
            } : null,
            dataQuality: profileValidation ? {
              isValid: profileValidation.isValid,
              confidence: profileValidation.confidence,
              warnings: profileValidation.warnings,
              errors: profileValidation.errors
            } : null,
            scoring: {
              skillMatch: analysis.skillMatch,
              openToWork: analysis.openToWork,
              jobStability: analysis.jobStability,
              engagement: analysis.engagement,
              companyConsistency: analysis.companyConsistency,
              overallScore: analysis.overallScore,
              priority: analysis.priority
            },
            hireability: {
              score: hireabilityScore,
              potentialToJoin: hireabilityScore >= 70 ? 'High' : hireabilityScore >= 50 ? 'Medium' : 'Low',
              factors: {
                openToWork: linkedinProfile?.openToWork || false,
                companyMatch: !hasCompanyDifference,
                recentActivity: linkedinProfile?.lastActive?.includes('week') || false,
                skillsAvailable: (linkedinProfile?.skills?.length || 0) > 0
              }
            },
            insights: analysis.insights,
            companyDifference: hasCompanyDifference ? 
              `Different (Provided: ${candidate.company}, LinkedIn: ${linkedinProfile?.company})` : 
              'Same',
            savedToDatabase: saveToDatabase && savedCandidate !== null,
            isExistingCandidate: false,
            processingTime
          })}\n\n`);

        } catch (error) {
          // ✅ CRITICAL: Even if one fails, continue to next candidate
          console.error(`❌ Failed to process ${candidate.name}:`, error);
          failureCount++;
          
          // Stream failure immediately
          res.write(`data: ${JSON.stringify({
            type: 'candidate',
            index: i + 1,
            total: paginatedCandidates.length,
            success: false,
            candidateInfo: {
              name: candidate.name,
              email: candidate.email,
              providedCompany: candidate.company,
              providedTitle: candidate.title
            },
            error: error instanceof Error ? error.message : 'Unknown error',
            errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
            processingTime: Date.now() - startTime
          })}\n\n`);
          
          // ✅ Continue to next candidate - don't break the loop
        }
      }

      // Send completion summary
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        summary: {
          totalProcessed: paginatedCandidates.length,
          successful: successCount,
          failed: failureCount,
          existing: existingCount,
          new: successCount - existingCount
        },
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(candidates.length / limitNum),
          totalCandidates: candidates.length
        }
      })}\n\n`);

      // Log activity
      try {
        await storage.createActivity({
          type: "bulk_quick_check_stream",
          message: "Bulk quick check (streaming) completed",
          details: `Processed ${paginatedCandidates.length} candidates: ${successCount} successful, ${failureCount} failed, ${existingCount} existing`
        });
      } catch (error) {
        console.error('Failed to log activity:', error);
      }

      res.end();

    } catch (error) {
      console.error('Bulk quick check streaming failed:', error);
      
      // If headers not sent yet, send error as JSON
      if (!res.headersSent) {
        res.status(500).json({ 
          error: "Bulk quick check streaming failed",
          message: error instanceof Error ? error.message : "Unknown error",
          code: "BULK_QUICK_CHECK_STREAM_ERROR"
        });
      } else {
        // If streaming already started, send error event
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : "Unknown error"
        })}\n\n`);
        res.end();
      }
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

  // Async function to process bulk resumes with WebSocket updates
  async function processBulkResumesAsync(sessionId: string, comId: string, files: any[]) {
    try {
      console.log(`🔄 Processing ${files.length} resumes for session ${sessionId}`);
      
      // Update progress - starting
      websocketService.updateProgress(sessionId, {
        currentFile: "Starting processing..."
      });

      // Process each file sequentially to avoid overwhelming the system
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { originalname, buffer, size } = file;
        
        try {
          console.log(`📄 Processing file ${i + 1}/${files.length}: ${originalname}`);
          
          // Update progress - current file
          websocketService.updateProgress(sessionId, {
            currentFile: originalname
          });

          // Create processing job for this file
          const processingJob = await storage.createProcessingJob({
            projectId: "default-project",
            fileName: originalname,
            fileSize: size,
            status: "processing",
            progress: 0,
            totalRecords: 0,
            processedRecords: 0
          });

          // Process the resume using EeezoService
          const result = await EeezoService.processEeezoResume({
            comId: comId,
            file: file,
            processingJobId: processingJob.id
          });

          // Add completed candidate to WebSocket session
          websocketService.addCompletedCandidate(sessionId, {
            candidateId: result.candidateId,
            name: originalname.replace(/\.(pdf|docx|doc)$/i, ''),
            isUpdate: result.isUpdate || false,
            matchedBy: result.matchedBy,
            wasEnriched: result.wasEnriched || false
          });

          console.log(`✅ Completed file ${i + 1}/${files.length}: ${originalname} -> Candidate: ${result.candidateId}`);

          // Small delay between files to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`❌ Error processing file ${originalname}:`, error);
          
          // Add error to WebSocket session
          websocketService.addError(sessionId, originalname, 
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      }

      console.log(`🎉 Bulk processing completed for session ${sessionId}`);

    } catch (error) {
      console.error(`💥 Bulk processing failed for session ${sessionId}:`, error);
      
      // Add general error to session
      websocketService.addError(sessionId, "Bulk Processing", 
        error instanceof Error ? error.message : "Unknown error"
      );
    }
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
        message: result.message || "Resume uploaded and processing started",
        data: {
          jobId: processingJob.id,
          candidateId: result.candidateId,
          comId: com_id,
          status: "processing",
          isUpdate: result.isUpdate || false,
          matchedBy: result.matchedBy,
          wasEnriched: result.wasEnriched || false,
          changes: result.changes
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

  // ==================== BULK UPLOAD WITH WEBSOCKET ====================
  
  // Bulk resume upload with real-time WebSocket updates
  app.post("/api/eezo/upload-bulk-resumes", upload.array('files', 20), async (req: any, res) => {
    try {
      const { com_id } = req.body;
      
      // Validate required fields
      if (!com_id) {
        return res.status(400).json({ 
          error: "Company ID (com_id) is required",
          code: "MISSING_COM_ID"
        });
      }
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ 
          error: "At least one resume file is required",
          code: "MISSING_FILES"
        });
      }

      // Generate session ID for this bulk upload
      const sessionId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create WebSocket session for real-time updates
      const session = websocketService.createUploadSession(sessionId, com_id, req.files.length);
      
      console.log(`🚀 Starting bulk upload session: ${sessionId} for company ${com_id} with ${req.files.length} files`);

      // Log activity
      await storage.createActivity({
        type: "bulk_upload",
        message: "Bulk resume upload started",
        details: `Company: ${com_id}, Files: ${req.files.length}, Session: ${sessionId}`
      });

      // Process files asynchronously with WebSocket updates
      processBulkResumesAsync(sessionId, com_id, req.files);

      res.json({
        success: true,
        message: "Bulk upload started",
        data: {
          sessionId,
          comId: com_id,
          totalFiles: req.files.length,
          status: "processing",
          websocketUrl: `ws://localhost:${process.env.PORT || 5000}/ws`
        }
      });

    } catch (error) {
      console.error('Bulk upload error:', error);
      res.status(500).json({ 
        error: "Failed to start bulk upload",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "BULK_UPLOAD_ERROR"
      });
    }
  });

  // Get bulk upload session status
  app.get("/api/eezo/bulk-status/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = websocketService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ 
          error: "Session not found",
          code: "SESSION_NOT_FOUND"
        });
      }

      res.json({
        success: true,
        data: {
          sessionId,
          comId: session.comId,
          totalFiles: session.totalFiles,
          completedFiles: session.completedFiles,
          progress: Math.round((session.completedFiles / session.totalFiles) * 100),
          candidates: session.candidates,
          errors: session.errors,
          isComplete: session.completedFiles >= session.totalFiles
        }
      });

    } catch (error) {
      console.error('Bulk status error:', error);
      res.status(500).json({ 
        error: "Failed to fetch bulk status",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "STATUS_ERROR"
      });
    }
  });

  // Get WebSocket connection info
  app.get("/api/websocket/info", async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          websocketUrl: `ws://localhost:${process.env.PORT || 5000}/ws`,
          connectedClients: websocketService.getConnectedClientsCount(),
          activeSessions: websocketService.getActiveSessions().length,
          messageTypes: [
            'processing_started',
            'upload_progress', 
            'resume_completed',
            'upload_error',
            'upload_complete'
          ]
        }
      });
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch WebSocket info",
        message: error instanceof Error ? error.message : "Unknown error"
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

  // Update candidate scores (for external team integration)
  app.patch("/api/candidates/:candidateId/scores", async (req, res) => {
    try {
      const { candidateId } = req.params;
      const { com_id, skillMatchScore, totalScore, jobDescription } = req.body;
      
      if (!com_id) {
        return res.status(400).json({ 
          error: "Company ID (com_id) is required",
          code: "MISSING_COMPANY_ID"
        });
      }
      
      if (skillMatchScore === undefined && totalScore === undefined) {
        return res.status(400).json({ 
          error: "At least one score (skillMatchScore or totalScore) must be provided",
          code: "MISSING_SCORES"
        });
      }
      
      // Validate score ranges
      if (skillMatchScore !== undefined && (skillMatchScore < 0 || skillMatchScore > 10)) {
        return res.status(400).json({ 
          error: "skillMatchScore must be between 0 and 10",
          code: "INVALID_SCORE_RANGE"
        });
      }
      
      if (totalScore !== undefined && (totalScore < 0 || totalScore > 10)) {
        return res.status(400).json({ 
          error: "totalScore must be between 0 and 10",
          code: "INVALID_SCORE_RANGE"
        });
      }
      
      // Get existing candidate to verify it belongs to the company
      const existingCandidate = await storage.getCandidate(candidateId, com_id);
      if (!existingCandidate) {
        return res.status(404).json({ 
          error: "Candidate not found or doesn't belong to the specified company",
          code: "CANDIDATE_NOT_FOUND"
        });
      }
      
      // Prepare update data
      const updateData: any = {};
      if (skillMatchScore !== undefined) {
        updateData.skillMatchScore = skillMatchScore;
      }
      if (totalScore !== undefined) {
        updateData.score = totalScore;
        // Update priority based on total score
        if (totalScore >= 7) updateData.priority = 'High';
        else if (totalScore >= 5) updateData.priority = 'Medium';
        else updateData.priority = 'Low';
        updateData.hireabilityScore = totalScore;
        updateData.potentialToJoin = updateData.priority;
      }
      
      // Update candidate
      const updatedCandidate = await storage.updateCandidate(candidateId, updateData);
      
      if (!updatedCandidate) {
        return res.status(500).json({ 
          error: "Failed to update candidate scores",
          code: "UPDATE_FAILED"
        });
      }
      
      // Log activity
      await storage.createActivity({
        type: "score_update",
        message: "Candidate scores updated by external team",
        details: `Candidate ${candidateId}: skillMatch=${skillMatchScore}, totalScore=${totalScore}, jobDescription=${jobDescription || 'N/A'}`
      });
      
      res.json({
        success: true,
        data: {
          candidateId: candidateId,
          name: updatedCandidate.name,
          comId: com_id,
          skillMatchScore: updatedCandidate.skillMatchScore,
          totalScore: updatedCandidate.score,
          priority: updatedCandidate.priority,
          updatedAt: new Date().toISOString()
        },
        message: "Candidate scores updated successfully"
      });
      
    } catch (error) {
      console.error('Update candidate scores error:', error);
      res.status(500).json({ 
        error: "Failed to update candidate scores",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "UPDATE_SCORES_ERROR"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
