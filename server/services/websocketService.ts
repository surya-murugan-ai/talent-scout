import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export interface WebSocketMessage {
  type: 'resume_completed' | 'upload_progress' | 'upload_complete' | 'upload_error' | 'processing_started';
  data: any;
  timestamp: string;
  sessionId?: string;
}

export interface ResumeProgress {
  sessionId: string;
  comId: string;
  totalFiles: number;
  completedFiles: number;
  currentFile?: string;
  candidates: Array<{
    candidateId: string;
    name: string;
    email?: string;
    score?: number;
    priority?: string;
  }>;
  errors: Array<{
    fileName: string;
    error: string;
  }>;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocket> = new Map();
  private sessions: Map<string, ResumeProgress> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);
      
      console.log(`🔌 WebSocket client connected: ${clientId}`);
      
      // Send welcome message
      this.sendToClient(clientId, {
        type: 'processing_started',
        data: { message: 'Connected to TalentScout WebSocket', clientId },
        timestamp: new Date().toISOString()
      });

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          console.log(`📨 WebSocket message from ${clientId}:`, data);
          
          // Handle client messages (like joining a session)
          if (data.type === 'join_session' && data.sessionId) {
            this.joinSession(clientId, data.sessionId);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log(`🔌 WebSocket client disconnected: ${clientId}`);
        this.clients.delete(clientId);
        // Clean up any sessions this client was part of
        this.cleanupClientSessions(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });
    });

    console.log('🚀 WebSocket server initialized on /ws');
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private joinSession(clientId: string, sessionId: string) {
    // In a real implementation, you might want to track which clients are in which sessions
    console.log(`👥 Client ${clientId} joined session ${sessionId}`);
  }

  private cleanupClientSessions(clientId: string) {
    // Clean up any session data for this client
    // This is a placeholder for more complex session management
  }

  // Create a new upload session
  createUploadSession(sessionId: string, comId: string, totalFiles: number): ResumeProgress {
    const session: ResumeProgress = {
      sessionId,
      comId,
      totalFiles,
      completedFiles: 0,
      candidates: [],
      errors: []
    };
    
    this.sessions.set(sessionId, session);
    console.log(`📁 Created upload session: ${sessionId} for company ${comId} with ${totalFiles} files`);
    
    return session;
  }

  // Update progress for a session
  updateProgress(sessionId: string, update: Partial<ResumeProgress>) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`Session ${sessionId} not found`);
      return;
    }

    Object.assign(session, update);
    this.sessions.set(sessionId, session);

    // Broadcast progress update to all clients
    this.broadcastToAll({
      type: 'upload_progress',
      data: {
        sessionId,
        comId: session.comId,
        totalFiles: session.totalFiles,
        completedFiles: session.completedFiles,
        currentFile: session.currentFile,
        progress: Math.round((session.completedFiles / session.totalFiles) * 100)
      },
      timestamp: new Date().toISOString(),
      sessionId
    });
  }

  // Add completed candidate to session
  addCompletedCandidate(sessionId: string, candidate: {
    candidateId: string;
    name: string;
    email?: string;
    score?: number;
    priority?: string;
  }) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`Session ${sessionId} not found`);
      return;
    }

    session.candidates.push(candidate);
    session.completedFiles++;

    // Broadcast candidate completion
    this.broadcastToAll({
      type: 'resume_completed',
      data: {
        sessionId,
        comId: session.comId,
        candidate,
        totalCompleted: session.completedFiles,
        totalFiles: session.totalFiles
      },
      timestamp: new Date().toISOString(),
      sessionId
    });

    // Check if all files are completed
    if (session.completedFiles >= session.totalFiles) {
      this.completeSession(sessionId);
    }
  }

  // Add error to session
  addError(sessionId: string, fileName: string, error: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`Session ${sessionId} not found`);
      return;
    }

    session.errors.push({ fileName, error });
    session.completedFiles++;

    // Broadcast error
    this.broadcastToAll({
      type: 'upload_error',
      data: {
        sessionId,
        comId: session.comId,
        fileName,
        error,
        totalCompleted: session.completedFiles,
        totalFiles: session.totalFiles
      },
      timestamp: new Date().toISOString(),
      sessionId
    });

    // Check if all files are completed
    if (session.completedFiles >= session.totalFiles) {
      this.completeSession(sessionId);
    }
  }

  // Complete the session
  private completeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`Session ${sessionId} not found`);
      return;
    }

    // Broadcast completion
    this.broadcastToAll({
      type: 'upload_complete',
      data: {
        sessionId,
        comId: session.comId,
        totalCandidates: session.candidates.length,
        totalErrors: session.errors.length,
        candidates: session.candidates,
        errors: session.errors
      },
      timestamp: new Date().toISOString(),
      sessionId
    });

    console.log(`✅ Upload session completed: ${sessionId} - ${session.candidates.length} candidates, ${session.errors.length} errors`);
    
    // Clean up session after a delay
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, 30000); // Keep session data for 30 seconds
  }

  // Send message to specific client
  private sendToClient(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  // Broadcast message to all connected clients
  private broadcastToAll(message: WebSocketMessage) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client, clientId) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          console.error(`Error sending message to client ${clientId}:`, error);
          this.clients.delete(clientId);
        }
      }
    });
  }

  // Get session info
  getSession(sessionId: string): ResumeProgress | undefined {
    return this.sessions.get(sessionId);
  }

  // Get all active sessions
  getActiveSessions(): ResumeProgress[] {
    return Array.from(this.sessions.values());
  }

  // Get connected clients count
  getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

export const websocketService = new WebSocketService();
