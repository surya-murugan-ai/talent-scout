import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import StatsCards from "@/components/StatsCards";
import FileUpload from "@/components/FileUpload";
import ProcessingPipeline from "@/components/ProcessingPipeline";
import CandidateTable from "@/components/CandidateTable";
import UploadedCandidatesTable from "@/components/UploadedCandidatesTable";
import ATSIntegration from "@/components/ATSIntegration";
import ScoringConfig from "@/components/ScoringConfig";
import AIStatus from "@/components/AIStatus";
import ActivityFeed from "@/components/ActivityFeed";
import NotificationsPanel from "@/components/NotificationsPanel";
import DatabaseStatus from "@/components/DatabaseStatus";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const clearAllDataMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/clear-all-data");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Data cleared successfully",
        description: "All candidate data and processing history has been deleted",
      });
      // Invalidate all queries to refresh the UI
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast({
        title: "Clear data failed",
        description: error instanceof Error ? error.message : "Failed to clear data",
        variant: "destructive",
      });
    },
  });

  const handleClearAllData = () => {
    if (window.confirm("Are you sure you want to delete ALL data? This will permanently remove all candidates, processing jobs, and activities. This cannot be undone.")) {
      clearAllDataMutation.mutate();
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <>
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600">Overview of your talent acquisition pipeline</p>
              </div>
              <div className="flex items-center gap-3">
                <NotificationsPanel />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAllData}
                  disabled={clearAllDataMutation.isPending}
                  className="text-red-600 hover:text-red-800 hover:bg-red-50 border-red-200"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear All Data
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <StatsCards />

            {/* AI Processing Pipeline - Full Width */}
            <div className="mt-8">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Processing Pipeline</h2>
                <ProcessingPipeline />
              </div>
            </div>

            {/* Candidate Rankings - Full Width */}
            <div className="mt-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Candidate Rankings</h2>
                <CandidateTable />
              </div>
            </div>

            {/* Status Row - AI Integration Status (Left) and PostgreSQL Database (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* AI Integration Status - Left */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-md font-semibold text-gray-900 mb-4">AI Integration Status</h3>
                <AIStatus />
              </div>

              {/* PostgreSQL Database - Right */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-md font-semibold text-gray-900 mb-4">PostgreSQL Database</h3>
                <DatabaseStatus />
              </div>
            </div>

            {/* Recent Activity - Full Width */}
            <div className="mt-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-md font-semibold text-gray-900 mb-4">Recent Activity</h3>
                <ActivityFeed />
              </div>
            </div>
          </>
        );

      case "upload":
        return (
          <div className="max-w-7xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Upload Candidates</h1>
              <p className="text-gray-600">Upload CSV/Excel files or import from ATS system for AI-powered talent analysis.</p>
            </div>
            <div className="space-y-8">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <FileUpload />
                <ATSIntegration />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-1">
                  <ProcessingPipeline />
                </div>
                <div className="xl:col-span-2">
                  <UploadedCandidatesTable />
                </div>
              </div>
            </div>
          </div>
        );

      case "scoring":
        return (
          <div className="max-w-4xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Scoring Configuration</h1>
              <p className="text-gray-600">Configure the AI scoring algorithm weights and parameters for candidate evaluation.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ScoringConfig />
              <AIStatus />
            </div>
          </div>
        );

      case "analytics":
        return (
          <div className="max-w-6xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Analytics & Reports</h1>
              <p className="text-gray-600">View detailed analytics on candidate processing, scores, and system performance.</p>
            </div>
            <StatsCards />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
              <CandidateTable />
              <div className="space-y-6">
                <AIStatus />
                <ActivityFeed />
              </div>
            </div>
          </div>
        );

      case "history":
        return (
          <div className="max-w-7xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Processing History</h1>
              <p className="text-gray-600">View the complete history of file uploads, processing jobs, and system activities.</p>
            </div>
            
            {/* AI Processing Pipeline - Full Width */}
            <div className="mt-8">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Processing Pipeline</h2>
                <ProcessingPipeline />
              </div>
            </div>

            {/* Candidate Rankings - Full Width */}
            <div className="mt-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Candidate Rankings</h2>
                <CandidateTable />
              </div>
            </div>

            {/* Status Row - AI Integration Status (Left) and PostgreSQL Database (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* AI Integration Status - Left */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-md font-semibold text-gray-900 mb-4">AI Integration Status</h3>
                <AIStatus />
              </div>

              {/* PostgreSQL Database - Right */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-md font-semibold text-gray-900 mb-4">PostgreSQL Database</h3>
                <DatabaseStatus />
              </div>
            </div>

            {/* Recent Activity - Full Width */}
            <div className="mt-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-md font-semibold text-gray-900 mb-4">Recent Activity</h3>
                <ActivityFeed />
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Page not found</h2>
            <p className="text-gray-600">The requested page could not be found.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="min-h-full max-w-7xl mx-auto">
            {renderTabContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
