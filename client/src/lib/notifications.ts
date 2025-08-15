// Notification system utilities
export const NotificationService = {
  // Emit API error notifications
  emitApiError: (error: Error, endpoint?: string, statusCode?: number) => {
    const event = new CustomEvent('api-error', {
      detail: { error, endpoint, statusCode }
    });
    window.dispatchEvent(event);
  },

  // Emit API success notifications
  emitApiSuccess: (message: string, endpoint?: string, data?: any) => {
    const event = new CustomEvent('api-success', {
      detail: { message, endpoint, data }
    });
    window.dispatchEvent(event);
  },

  // Emit system log notifications
  emitSystemLog: (level: 'info' | 'warn' | 'error', message: string, details?: string) => {
    const event = new CustomEvent('system-log', {
      detail: { level, message, details }
    });
    window.dispatchEvent(event);
  },

  // LinkedIn enrichment notifications
  emitLinkedInEnrichment: (candidateName: string, success: boolean, details?: string) => {
    if (success) {
      NotificationService.emitApiSuccess(
        `LinkedIn profile enriched for ${candidateName}`,
        '/api/candidates/*/enrich',
        { candidateName, enriched: true }
      );
    } else {
      NotificationService.emitApiError(
        new Error(`LinkedIn enrichment failed for ${candidateName}`),
        '/api/candidates/*/enrich'
      );
    }
  },

  // File processing notifications
  emitFileProcessing: (fileName: string, status: 'started' | 'completed' | 'failed', details?: string) => {
    const messages = {
      started: `Processing file: ${fileName}`,
      completed: `File processed successfully: ${fileName}`,
      failed: `File processing failed: ${fileName}`
    };

    if (status === 'failed') {
      NotificationService.emitApiError(
        new Error(messages[status]),
        '/api/upload',
        undefined
      );
    } else {
      NotificationService.emitSystemLog(
        status === 'completed' ? 'info' : 'info',
        messages[status],
        details
      );
    }
  },

  // Job processing notifications
  emitJobStatus: (jobId: string, status: 'started' | 'completed' | 'failed' | 'stopped', details?: string) => {
    const messages = {
      started: `Processing job started: ${jobId}`,
      completed: `Processing job completed: ${jobId}`,
      failed: `Processing job failed: ${jobId}`,
      stopped: `Processing job stopped: ${jobId}`
    };

    if (status === 'failed') {
      NotificationService.emitApiError(
        new Error(messages[status]),
        '/api/jobs',
        undefined
      );
    } else {
      NotificationService.emitSystemLog('info', messages[status], details);
    }
  }
};