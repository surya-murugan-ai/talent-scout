import { useState, useEffect } from "react";
import { Bell, X, AlertCircle, Info, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  details?: string;
  apiEndpoint?: string;
  statusCode?: number;
}

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Listen for API errors and system events
    const handleApiError = (event: CustomEvent) => {
      const { error, endpoint, statusCode } = event.detail;
      addNotification({
        type: 'error',
        title: 'API Error',
        message: error.message || 'An API error occurred',
        details: error.stack || error.toString(),
        apiEndpoint: endpoint,
        statusCode: statusCode
      });
    };

    const handleApiSuccess = (event: CustomEvent) => {
      const { message, endpoint, data } = event.detail;
      addNotification({
        type: 'success',
        title: 'API Success',
        message: message || 'Operation completed successfully',
        apiEndpoint: endpoint,
        details: data ? JSON.stringify(data, null, 2) : undefined
      });
    };

    const handleSystemLog = (event: CustomEvent) => {
      const { level, message, details } = event.detail;
      addNotification({
        type: level === 'error' ? 'error' : level === 'warn' ? 'warning' : 'info',
        title: `System ${level.toUpperCase()}`,
        message: message,
        details: details
      });
    };

    window.addEventListener('api-error', handleApiError as EventListener);
    window.addEventListener('api-success', handleApiSuccess as EventListener);
    window.addEventListener('system-log', handleSystemLog as EventListener);

    // Add some initial system notifications
    addNotification({
      type: 'info',
      title: 'System Started',
      message: 'AI-powered talent acquisition platform initialized',
      details: 'All services are running and ready for processing'
    });

    return () => {
      window.removeEventListener('api-error', handleApiError as EventListener);
      window.removeEventListener('api-success', handleApiSuccess as EventListener);
      window.removeEventListener('system-log', handleSystemLog as EventListener);
    };
  }, []);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    
    setNotifications(prev => [newNotification, ...prev].slice(0, 50)); // Keep only last 50 notifications
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return CheckCircle;
      case 'error': return XCircle;
      case 'warning': return AlertCircle;
      default: return Info;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'success': return 'default';
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      default: return 'outline';
    }
  };

  const unreadCount = notifications.length;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
        data-testid="notifications-toggle"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <Card className="absolute right-0 top-12 w-96 max-h-96 z-50 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">System Notifications</CardTitle>
              <div className="flex gap-2">
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllNotifications}
                    data-testid="clear-notifications"
                  >
                    Clear All
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  data-testid="close-notifications"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-80">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-2 p-3">
                  {notifications.map((notification) => {
                    const Icon = getIcon(notification.type);
                    return (
                      <div
                        key={notification.id}
                        className={`p-3 border rounded-lg ${getTypeColor(notification.type)}`}
                        data-testid={`notification-${notification.type}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-sm">{notification.title}</p>
                                <Badge variant={getBadgeVariant(notification.type)} className="text-xs">
                                  {notification.type}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-700 mb-1">{notification.message}</p>
                              {notification.apiEndpoint && (
                                <p className="text-xs text-gray-600 mb-1">
                                  Endpoint: {notification.apiEndpoint}
                                  {notification.statusCode && ` (${notification.statusCode})`}
                                </p>
                              )}
                              <p className="text-xs text-gray-500">
                                {notification.timestamp.toLocaleTimeString()}
                              </p>
                              {notification.details && (
                                <details className="mt-2">
                                  <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                                    View Details
                                  </summary>
                                  <pre className="text-xs text-gray-700 mt-1 p-2 bg-gray-100 rounded max-h-20 overflow-auto">
                                    {notification.details}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeNotification(notification.id)}
                            className="h-6 w-6 p-0 hover:bg-gray-200"
                            data-testid="remove-notification"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}