import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, StopCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProcessingJobSkeleton } from "@/components/LoadingStates";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { ProcessingJob } from "@/types";

export default function ProcessingPipeline() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<ProcessingJob[]>({
    queryKey: ["/api/jobs"],
    refetchInterval: 2000, // Refresh every 2 seconds for real-time updates
  });

  const activeJob = jobs.find(job => job.status === "processing");
  const activeProgress = typeof activeJob?.progress === "number" ? activeJob.progress : 0;

  const stopJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/stop`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Processing stopped",
        description: "The job has been stopped successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (error) => {
      toast({
        title: "Stop failed",
        description: error instanceof Error ? error.message : "Failed to stop processing",
        variant: "destructive",
      });
    },
  });

  const handleStopJob = (jobId: string) => {
    if (window.confirm("Are you sure you want to stop the current processing job?")) {
      stopJobMutation.mutate(jobId);
    }
  };
  
  const steps = [
    {
      id: 1,
      name: "Data Ingestion",
      description: "Importing candidate profiles from uploaded files",
      status: activeJob ? (activeProgress >= 25 ? "completed" : "active") : "completed",
    },
    {
      id: 2,
      name: "LinkedIn Enrichment",
      description: "Fetching profile data using OpenAI + LinkedIn API",
      status: activeJob ? 
        (activeProgress >= 95 ? "completed" : activeProgress >= 25 ? "active" : "pending") 
        : "completed",
    },
    {
      id: 3,
      name: "AI Scoring & Categorization",
      description: "Calculating composite scores using OpenAI models",
      status: activeJob ?
        (activeProgress >= 100 ? "completed" : activeProgress >= 95 ? "active" : "pending")
        : "completed",
    },
    {
      id: 4,
      name: "Output Generation",
      description: "Generating ranked shortlists and reports",
      status: activeJob ? "pending" : "completed",
    },
  ];

  const getStepIcon = (status: string, stepId: number) => {
    if (status === "completed") {
      return (
        <div className="flex-shrink-0 w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
          <Check className="text-white text-sm" />
        </div>
      );
    } else if (status === "active") {
      return (
        <div className="flex-shrink-0 w-8 h-8 bg-accent rounded-full flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-white animate-spin" />
        </div>
      );
    } else {
      return (
        <div className="flex-shrink-0 w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center">
          <span className="text-slate-600 text-sm font-bold">{stepId}</span>
        </div>
      );
    }
  };

  const getStatusText = (status: string, stepId: number) => {
    if (status === "completed") return "Complete";
    if (status === "active") {
      if (stepId === 2 && activeJob) {
        return `In Progress (${activeProgress}%)`;
      }
      return "In Progress";
    }
    return "Pending";
  };

  const getStatusColor = (status: string) => {
    if (status === "completed") return "text-secondary";
    if (status === "active") return "text-accent";
    return "text-slate-500";
  };

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">
              AI Processing Pipeline
            </CardTitle>
            <p className="text-slate-600 mt-1">
              Real-time status of enrichment and scoring operations
            </p>
          </div>
          {activeJob && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStopJob(activeJob.id)}
              disabled={stopJobMutation.isPending}
              data-testid="stop-process-button"
              className="text-red-600 hover:text-red-800 hover:bg-red-50 border-red-200"
            >
              {stopJobMutation.isPending ? (
                <LoadingSpinner size="sm" className="mr-1" />
              ) : (
                <StopCircle className="w-4 h-4 mr-1" />
              )}
              Stop Process
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center" data-testid={`pipeline-step-${step.id}`}>
              {getStepIcon(step.status, step.id)}
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-slate-900">{step.name}</h4>
                  <span className={`text-sm font-medium ${getStatusColor(step.status)}`}>
                    {getStatusText(step.status, step.id)}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{step.description}</p>
                {step.status === "active" && step.id === 2 && activeJob && (
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-accent h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(activeProgress, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {activeJob && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Processing: {activeJob.fileName}
                </p>
                <p className="text-sm text-slate-600">
                  {activeJob.processedRecords} / {activeJob.totalRecords} candidates processed
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-accent">{activeProgress}%</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
