import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityFeedSkeleton } from "@/components/LoadingStates";
import type { Activity } from "@/types";

export default function ActivityFeed() {
  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return <ActivityFeedSkeleton />;
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case "processing":
        return "bg-secondary";
      case "upload":
        return "bg-primary";
      case "scoring_update":
        return "bg-accent";
      case "export":
        return "bg-purple-500";
      default:
        return "bg-slate-400";
    }
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return "Unknown time";
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
  };

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="text-lg font-semibold text-slate-900">
          Recent Activity
        </CardTitle>
        <p className="text-slate-600 mt-1 text-sm">Latest system operations</p>
      </CardHeader>
      <CardContent className="p-6">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500 text-sm">No recent activity</p>
            <p className="text-slate-400 text-xs mt-1">Activities will appear here as you use the system</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div key={activity.id} className="flex items-start space-x-3" data-testid={`activity-${index}`}>
                <div className={`flex-shrink-0 w-2 h-2 ${getActivityColor(activity.type)} rounded-full mt-2`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900" data-testid={`activity-message-${index}`}>
                    {activity.message}
                  </p>
                  {activity.details && (
                    <p className="text-xs text-slate-500" data-testid={`activity-details-${index}`}>
                      {activity.details}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-1" data-testid={`activity-time-${index}`}>
                    {formatTimeAgo(activity.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
