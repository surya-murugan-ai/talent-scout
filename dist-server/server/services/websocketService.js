import { WebSocketServer, WebSocket } from 'ws';
class WebSocketService {
    wss = null;
    clients = new Map();
    sessions = new Map();
    initialize(server) {
        this.wss = new WebSocketServer({
            server,
            path: '/ws'
        });
        this.wss.on('connection', (ws, req) => {
            const clientId = this.generateClientId();
            this.clients.set(clientId, ws);
            console.log(`🔌 WebSocket client connected: ${clientId}`);
            // Send welcome message
            this.sendToClient(clientId, {
                type: 'processing_started',
                data: { message: 'Connected to TalentScout WebSocket', clientId },
                timestamp: new Date().toISOString()
            });
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    console.log(`📨 WebSocket message from ${clientId}:`, data);
                    // Handle client messages (like joining a session)
                    if (data.type === 'join_session' && data.sessionId) {
                        this.joinSession(clientId, data.sessionId);
                    }
                }
                catch (error) {
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
    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    joinSession(clientId, sessionId) {
        // In a real implementation, you might want to track which clients are in which sessions
        console.log(`👥 Client ${clientId} joined session ${sessionId}`);
    }
    cleanupClientSessions(clientId) {
        // Clean up any session data for this client
        // This is a placeholder for more complex session management
    }
    // Create a new upload session
    createUploadSession(sessionId, comId, totalFiles) {
        const session = {
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
    updateProgress(sessionId, update) {
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
    addCompletedCandidate(sessionId, candidate) {
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
    addError(sessionId, fileName, error) {
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
    completeSession(sessionId) {
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
    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    }
    // Broadcast message to all connected clients
    broadcastToAll(message) {
        const messageStr = JSON.stringify(message);
        this.clients.forEach((client, clientId) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(messageStr);
                }
                catch (error) {
                    console.error(`Error sending message to client ${clientId}:`, error);
                    this.clients.delete(clientId);
                }
            }
        });
    }
    // Get session info
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    // Get all active sessions
    getActiveSessions() {
        return Array.from(this.sessions.values());
    }
    // Get connected clients count
    getConnectedClientsCount() {
        return this.clients.size;
    }
}
export const websocketService = new WebSocketService();
