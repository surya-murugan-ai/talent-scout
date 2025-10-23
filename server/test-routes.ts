import type { Express } from "express";

export function registerTestRoutes(app: Express) {
  // Simple test endpoint
  app.post("/api/test/streaming", (req, res) => {
    res.json({
      success: true,
      message: "Test streaming endpoint is working!",
      timestamp: new Date().toISOString()
    });
  });
}
