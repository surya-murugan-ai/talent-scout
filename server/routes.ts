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

  // Upload and process candidate file
  app.post("/api/upload", upload.single('file'), async (req: RequestWithFile, res) => {
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

      const csvRows = candidates.map(candidate => {
        // Handle skills properly - they can be array of strings or objects
        let skillsString = '';
        if (Array.isArray(candidate.skills)) {
          skillsString = candidate.skills.map(skill => {
            if (typeof skill === 'string') {
              return skill;
            } else if (typeof skill === 'object' && skill !== null) {
              // If skill is an object, try to extract the name or value
              return skill.name || skill.value || skill.skill || JSON.stringify(skill);
            }
            return String(skill);
          }).join('; ');
        } else if (typeof candidate.skills === 'string') {
          skillsString = candidate.skills;
        }

        return [
          candidate.name || '',
          candidate.email || '',
          candidate.title || '',
          candidate.company || '',
          candidate.score || 0,
          candidate.priority || 'Low',
          candidate.openToWork ? 'Yes' : 'No',
          candidate.lastActive || '',
          skillsString,
          candidate.linkedinUrl || ''
        ];
      });

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

  // Database health check endpoint
  app.get('/api/database/health', async (req, res) => {
    try {
      const { checkDatabaseHealth } = await import('./db-health');
      const health = await checkDatabaseHealth();
      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionTest: false,
        tables: [],
        totalRecords: 0
      });
    }
  });

  // Database optimization endpoint
  app.post('/api/database/optimize', async (req, res) => {
    try {
      const { optimizeDatabase } = await import('./db-health');
      const result = await optimizeDatabase();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        operations: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test LinkedIn API integration
  app.post('/api/test-linkedin', async (req, res) => {
    try {
      const { linkedinUrl, name, company, title, location } = req.body;
      
      if (!linkedinUrl && !name) {
        return res.status(400).json({ error: 'Either LinkedIn URL or name is required' });
      }

      console.log(`Testing LinkedIn enrichment for: ${name || linkedinUrl} ${title ? `(${title})` : ''} ${company ? `at ${company}` : ''} ${location ? `in ${location}` : ''}`);
      
      const enrichedProfile = await enrichLinkedInProfile(linkedinUrl, name || 'Test User', company, title, location, []);
      
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

  // Test LinkedIn search with scoring
  app.post('/api/test-linkedin-search', async (req, res) => {
    try {
      const { name, title, company, location, maxResults = 10 } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Name is required for search' });
      }

      console.log(`Testing LinkedIn search for: ${name} ${title ? `(${title})` : ''} ${company ? `at ${company}` : ''} ${location ? `in ${location}` : ''}`);
      
      const linkedInService = (await import('./services/linkedin')).linkedInService;
      const searchResult = await linkedInService.searchProfilesWithScoring(name, title, company, location, maxResults);
      
      res.json({
        success: true,
        selectedUrl: searchResult,
        message: 'LinkedIn search completed successfully'
      });

    } catch (error) {
      console.error('LinkedIn search test failed:', error);
      res.status(500).json({
        error: 'LinkedIn search failed',
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
      const enrichedProfile = await enrichLinkedInProfile(linkedinUrl, candidate.name, candidate.company || undefined, undefined, undefined, []);

      // Re-analyze with new data
      const project = await storage.getProject("default-project");
      const weights = project?.scoringWeights || {
        openToWork: 40,
        skillMatch: 30,
        jobStability: 15,
        engagement: 15
      };

      const analysis = await analyzeCandidate({
        name: candidate.name,
        email: candidate.email,
        skills: enrichedProfile.skills.join(', '),
        company: enrichedProfile.company,
        linkedinProfile: enrichedProfile
      }, "", weights as { openToWork: number; skillMatch: number; jobStability: number; engagement: number });

      // Update candidate with enriched data
      await storage.updateCandidate(id, {
        title: enrichedProfile.title || candidate.title,
        company: enrichedProfile.company || candidate.company,
        linkedinUrl: linkedinUrl,
        skills: enrichedProfile.skills.length > 0 ? enrichedProfile.skills : candidate.skills,
        score: analysis.overallScore,
        priority: analysis.priority,
        openToWork: enrichedProfile.openToWork,
        lastActive: enrichedProfile.lastActive,
        notes: candidate.notes ? `${candidate.notes} | LinkedIn enriched: ${analysis.insights.join('; ')}` : `LinkedIn enriched: ${analysis.insights.join('; ')}`,
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

  // ATS Integration Routes
  app.post("/api/ats/import", async (req, res) => {
    try {
      const { method, data } = req.body;
      
      if (!method || !data) {
        return res.status(400).json({ error: "Method and data are required" });
      }

      let candidates: any[] = [];
      
      if (method === "json") {
        try {
          candidates = JSON.parse(data);
        } catch (error) {
          return res.status(400).json({ error: "Invalid JSON format" });
        }
      } else if (method === "csv") {
        // Parse CSV data
        const lines = data.trim().split('\n');
        if (lines.length < 2) {
          return res.status(400).json({ error: "CSV must have header and at least one data row" });
        }
        
        const headers = lines[0].split(',').map((h: string) => h.trim());
        candidates = lines.slice(1).map((line: string) => {
          const values = line.split(',').map((v: string) => v.trim());
          const candidate: any = {};
          headers.forEach((header: string, index: number) => {
            candidate[header] = values[index] || '';
          });
          return candidate;
        });
      }

      if (!Array.isArray(candidates) || candidates.length === 0) {
        return res.status(400).json({ error: "No candidate data found" });
      }

      let imported = 0;
      const errors: string[] = [];

      for (const candidateData of candidates) {
        try {
          // Validate required fields
          if (!candidateData.name || !candidateData.atsId) {
            errors.push(`Missing required fields for candidate: ${candidateData.name || 'Unknown'}`);
            continue;
          }

          const candidate = await storage.createCandidate({
            name: candidateData.name,
            email: candidateData.email || null,
            title: candidateData.title || null,
            company: candidateData.company || null,
            atsId: candidateData.atsId,
            selectionStatus: candidateData.selectionStatus || null,
            selectionDate: candidateData.selectionDate ? new Date(candidateData.selectionDate) : null,
            joiningOutcome: candidateData.joiningOutcome || null,
            atsNotes: candidateData.atsNotes || null,
            source: "ats",
            score: 0,
            priority: "Low",
            openToWork: false,
            skills: []
          });

          imported++;
          console.log(`ATS candidate imported: ${candidate.name}`);
        } catch (error) {
          errors.push(`Failed to import ${candidateData.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Create activity record
      await storage.createActivity({
        type: "ats_import",
        message: `Imported ${imported} candidates from ATS`,
        details: errors.length > 0 ? `Errors: ${errors.join(', ')}` : undefined,
      });

      res.json({ 
        imported, 
        total: candidates.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("ATS import error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "ATS import failed" 
      });
    }
  });

  // Delete candidate endpoint
  app.delete("/api/candidates/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const candidate = await storage.getCandidate(id);
      if (!candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      await storage.deleteCandidate(id);
      
      // Log activity
      await storage.createActivity({
        type: "delete",
        message: "Candidate deleted",
        details: `${candidate.name} removed from database`
      });

      res.json({ success: true, message: "Candidate deleted successfully" });
    } catch (error) {
      console.error("Delete candidate error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to delete candidate" 
      });
    }
  });

  // Clear all data endpoint for testing
  app.delete("/api/clear-all-data", async (req, res) => {
    try {
      // Use storage methods to clear all data
      const allCandidates = await storage.getCandidates(1000);
      for (const candidate of allCandidates) {
        await storage.deleteCandidate(candidate.id);
      }
      
      const allJobs = await storage.getProcessingJobs();
      for (const job of allJobs) {
        await storage.deleteProcessingJob(job.id);
      }
      
      // Log the clear action
      await storage.createActivity({
        type: "system",
        message: "All data cleared",
        details: "Database reset for testing"
      });

      res.json({ 
        success: true, 
        message: "All candidate data cleared successfully" 
      });
    } catch (error) {
      console.error("Clear data error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to clear data" 
      });
    }
  });

  // Stop processing job endpoint
  app.post("/api/jobs/:id/stop", async (req, res) => {
    try {
      const { id } = req.params;
      
      const job = await storage.getProcessingJob(id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.status !== "processing") {
        return res.status(400).json({ error: "Job is not currently processing" });
      }

      // Update job status to stopped
      await storage.updateProcessingJob(id, {
        status: "stopped",
        errorMessage: "Processing stopped by user"
      });
      
      // Log activity
      await storage.createActivity({
        type: "info",
        message: "Processing stopped",
        details: `Processing job for ${job.fileName} was stopped by user`
      });

      res.json({ 
        success: true, 
        message: "Processing job stopped successfully" 
      });
    } catch (error) {
      console.error("Stop job error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to stop job" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

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
    const weights = project?.scoringWeights || {
      openToWork: 40,
      skillMatch: 30,
      jobStability: 15,
      engagement: 15
    };

    // Process candidates in batches
    let processed = 0;
    for (const candidateData of candidates) {
      try {
        // Debug logging to see what LinkedIn URLs are found
        console.log(`Processing candidate: ${candidateData.name}`);
        console.log(`  Original LinkedIn URL: ${candidateData.linkedinUrl || 'None'}`);

        // Enrich with LinkedIn data by searching by name, title, company, and location
        const linkedInProfile = await enrichLinkedInProfile(
          candidateData.linkedinUrl,
          candidateData.name,
          candidateData.company,
          candidateData.title,
          candidateData.location,
          candidates // Pass all candidates for company URL extraction
        );

        console.log(`  Found LinkedIn URL: ${linkedInProfile.profileUrl || 'None'}`);

        // Analyze with OpenAI
        const analysis = await analyzeCandidate({
          ...candidateData,
          linkedinProfile: linkedInProfile
        }, "", weights as { openToWork: number; skillMatch: number; jobStability: number; engagement: number });

        // Create candidate record with enhanced data
        await storage.createCandidate({
          name: candidateData.name,
          email: candidateData.email,
          title: linkedInProfile.title || candidateData.title,
          company: linkedInProfile.company || candidateData.company,
          linkedinUrl: linkedInProfile.profileUrl || candidateData.linkedinUrl, // Use found URL or fallback to CSV URL
          skills: linkedInProfile.skills.length > 0 ? linkedInProfile.skills : candidateData.skills,
          score: analysis.overallScore,
          priority: analysis.priority,
          openToWork: linkedInProfile.openToWork,
          lastActive: linkedInProfile.lastActive,
          notes: analysis.insights.join('; '),
          originalData: candidateData.originalData,
          enrichedData: linkedInProfile,
          // Additional fields from CSV
          atsId: candidateData.atsId,
          selectionStatus: candidateData.selectionStatus,
          selectionDate: candidateData.selectionDate ? new Date(candidateData.selectionDate) : null,
          joiningOutcome: candidateData.joiningOutcome,
          atsNotes: candidateData.atsNotes
        });

        console.log(`  Final LinkedIn URL saved: ${linkedInProfile.profileUrl || candidateData.linkedinUrl}`);

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
        
        // Log the error but continue with next candidate
        await storage.createActivity({
          type: "error",
          message: `Failed to process candidate: ${candidateData.name}`,
          details: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // Continue with next candidate instead of stopping the entire process
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
      details: `${processed} candidates processed via OpenAI + LinkedIn API`
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
