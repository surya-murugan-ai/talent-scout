# TalentScout API Endpoints

## 📊 Dashboard & Stats
- `GET /api/stats` - Get dashboard statistics
- `GET /api/database/health` - Check database health
- `POST /api/database/optimize` - Optimize database performance

## 👥 Candidates Management
- `GET /api/candidates` - Get all candidates (with pagination)
- `GET /api/candidates/:id` - Get specific candidate by ID
- `GET /api/candidates/inactive` - Get inactive candidates
- `POST /api/candidates/bulk` - Bulk create candidates
- `PATCH /api/candidates/:id/enrich` - Enrich candidate with LinkedIn data
- `PATCH /api/candidates/:candidateId/resume-status` - Update resume status
- `PATCH /api/candidates/:candidateId/scores` - Update candidate scores

## 📁 File Upload & Processing
- `POST /api/upload` - Upload multiple files (up to 20)
- `POST /api/upload-multiple` - Upload multiple files (up to 10)
- `POST /api/upload-file` - Upload single file
- `POST /api/upload-single-resume` - Upload single resume file

## 🔍 LinkedIn & Enrichment
- `POST /api/test-linkedin` - Test LinkedIn integration
- `POST /api/quick-check` - Quick LinkedIn profile check
- `POST /api/bulk-quick-check` - Bulk LinkedIn profile check
- `POST /api/bulk-quick-check/stream` - Streaming bulk LinkedIn check

## 📈 Performance Monitoring
- `GET /api/performance/stats` - Get performance statistics
- `GET /api/performance/operation/:operation` - Get operation-specific stats
- `GET /api/performance/slowest` - Get slowest operations
- `GET /api/performance/trends` - Get performance trends
- `GET /api/performance/memory` - Get memory usage stats
- `POST /api/performance/clear` - Clear performance data

## 📋 Jobs & Processing
- `GET /api/jobs` - Get all processing jobs
- `GET /api/jobs/:id` - Get specific job by ID

## 🎯 Scoring & Analysis
- `GET /api/scoring` - Get scoring configuration
- `POST /api/scoring` - Update scoring configuration

## 📤 Export & Data
- `GET /api/export/csv` - Export candidates to CSV
- `GET /api/resume-data` - Get resume data
- `GET /api/resume-data/:candidateId` - Get specific resume data
- `DELETE /api/clear-all-data` - Clear all data

## 📊 Activities & Logs
- `GET /api/activities` - Get system activities

## 🔌 Eeezo Integration
- `POST /api/eezo/upload-resume` - Upload resume via Eeezo
- `GET /api/eezo/resume-data/:com_id` - Get Eeezo resume data by company ID
- `GET /api/eezo/status/:com_id` - Get Eeezo processing status
- `PATCH /api/eezo/candidate/:candidateId/status` - Update Eeezo candidate status
- `POST /api/eezo/upload-bulk-resumes` - Bulk upload resumes via Eeezo
- `GET /api/eezo/bulk-status/:sessionId` - Get bulk upload status

## 🌐 WebSocket
- `GET /api/websocket/info` - Get WebSocket connection info

## 🐛 Debug & Utilities
- `GET /api/debug/com-ids` - Debug company IDs

## 📝 Notes
- All file uploads support PDF, DOC, DOCX, CSV, and Excel files
- File size limit: 50MB per file
- Most endpoints support pagination with `limit` and `offset` parameters
- Authentication may be required for certain endpoints (check implementation)
