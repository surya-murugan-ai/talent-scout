import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Filter, Download, ExternalLink, Heart, Mail, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LinkedInTestDialog } from "./LinkedInTestDialog";
import { CandidateTableSkeleton } from "@/components/LoadingStates";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { Candidate } from "@shared/schema";

export default function CandidateTable() {
  const [currentPage, setCurrentPage] = useState(1);
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [showLinkedInTest, setShowLinkedInTest] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: candidates = [], isLoading, error } = useQuery<Candidate[]>({
    queryKey: filterPriority ? ["/api/candidates", `priority=${filterPriority}`] : ["/api/candidates"],
  });

  const exportMutation = useMutation({
    mutationFn: async (priority?: string) => {
      const url = priority ? `/api/export/csv?priority=${priority}` : "/api/export/csv";
      const response = await apiRequest("GET", url);
      return response.blob();
    },
    onSuccess: (blob, priority) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `candidates_export_${priority || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export successful",
        description: "Candidate data has been downloaded",
      });
    },
    onError: (error) => {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const getPriorityBadgeColor = (priority: string | null) => {
    switch (priority) {
      case "High":
        return "bg-red-100 text-red-800 hover:bg-red-200";
      case "Medium":
        return "bg-amber-100 text-amber-800 hover:bg-amber-200";
      case "Low":
        return "bg-slate-100 text-slate-800 hover:bg-slate-200";
      default:
        return "bg-slate-100 text-slate-800 hover:bg-slate-200";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-gradient-to-br from-primary to-secondary",
      "bg-gradient-to-br from-accent to-red-500",
      "bg-gradient-to-br from-purple-500 to-pink-500",
      "bg-gradient-to-br from-green-500 to-blue-500",
      "bg-gradient-to-br from-orange-500 to-red-500",
    ];
    const index = name.length % colors.length;
    return colors[index];
  };



  const handleExport = () => {
    exportMutation.mutate(filterPriority || undefined);
  };

  if (isLoading) {
    return <CandidateTableSkeleton />;
  }

  if (error) {
    return (
      <Card className="bg-white border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-500 font-medium">Error loading candidates</p>
              <p className="text-slate-500 text-sm mt-2">{error instanceof Error ? error.message : "Unknown error"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-slate-200 flex flex-col max-h-[800px]">
      <CardHeader className="border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Candidate Rankings
            </CardTitle>
            <p className="text-slate-600 mt-1">AI-scored and prioritized talent pipeline</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              className="text-slate-600 hover:text-slate-900 border-slate-300"
              data-testid="button-filter"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLinkedInTest(true)}
              className="text-blue-600 hover:text-blue-900 border-blue-300"
              data-testid="button-linkedin-test"
            >
              <Zap className="w-4 h-4 mr-2" />
              Test LinkedIn API
            </Button>
            
            <Button
              size="sm"
              onClick={handleExport}
              disabled={exportMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white border-green-600 shadow-sm"
              data-testid="button-export"
            >
              {exportMutation.isPending ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {exportMutation.isPending ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-auto">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[250px]">
                  Candidate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[200px]">
                  Current Employer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[100px]">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[120px]">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[150px]">
                  Open to Work
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[120px]">
                  Last Active
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[200px]">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[120px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="text-slate-500">
                      <p className="text-lg font-medium">No candidates found</p>
                      <p className="text-sm mt-1">Upload a CSV or Excel file to get started with candidate processing</p>
                    </div>
                  </td>
                </tr>
              ) : (
                candidates.map((candidate, index) => (
                  <tr key={candidate.id} className="hover:bg-slate-50" data-testid={`candidate-row-${index}`}>
                    {/* Candidate Info */}
                    <td className="px-6 py-4 whitespace-nowrap min-w-[250px]">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 ${getAvatarColor(candidate.name)} rounded-full flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white font-medium text-sm">
                            {getInitials(candidate.name)}
                          </span>
                        </div>
                        <div className="ml-4 min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-900 truncate" data-testid={`candidate-name-${index}`}>
                            {candidate.name}
                          </div>
                          <div className="text-sm text-slate-500 truncate" data-testid={`candidate-title-${index}`}>
                            {candidate.title || "Professional"}
                          </div>
                          <div className="text-xs text-slate-400 mt-1 truncate">
                            {candidate.company || "Unknown Company"}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    {/* Current Employer */}
                    <td className="px-6 py-4 whitespace-nowrap min-w-[200px]">
                      <div className="text-sm">
                        <div className="font-medium text-slate-900 truncate" title={candidate.currentEmployer || candidate.company || "Unknown"}>
                          {candidate.currentEmployer || candidate.company || "Unknown Company"}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center space-x-2 mt-1">
                          {candidate.email && (
                            <button
                              onClick={() => window.location.href = `mailto:${candidate.email}`}
                              className="text-slate-600 hover:text-primary"
                              title="Send Email"
                            >
                              <Mail className="w-3 h-3" />
                            </button>
                          )}
                          {candidate.linkedinUrl && (
                            <button
                              onClick={() => window.open(candidate.linkedinUrl!, '_blank')}
                              className="text-blue-600 hover:text-blue-800"
                              title="View LinkedIn Profile"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    {/* Score */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-lg font-bold text-slate-900" data-testid={`candidate-score-${index}`}>
                          {candidate.score ? candidate.score.toFixed(1) : "0.0"}
                        </span>
                        <div className="ml-2 w-12 h-2 bg-slate-200 rounded-full">
                          <div
                            className="bg-secondary h-2 rounded-full"
                            style={{ width: `${Math.min((candidate.score || 0) * 10, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    
                    {/* Priority */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        className={getPriorityBadgeColor(candidate.priority)}
                        data-testid={`candidate-priority-${index}`}
                      >
                        {candidate.priority || "Low"}
                      </Badge>
                    </td>
                    
                    {/* Open to Work */}
                    <td className="px-6 py-4 whitespace-nowrap min-w-[150px]">
                      <div className="flex items-center justify-center">
                        {candidate.openToWork ? (
                          <Badge className="bg-green-100 text-green-800 border-green-300">
                            <Heart className="w-3 h-3 mr-1" />
                            Open to work
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-600">
                            Not seeking
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Last Active */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 min-w-[120px]">
                      {candidate.linkedinLastActive ? (
                        <div className="text-center">
                          <div className="font-medium text-slate-700">
                            {new Date(candidate.linkedinLastActive).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-slate-500">LinkedIn</div>
                        </div>
                      ) : candidate.lastActive ? (
                        <div className="text-center">
                          {candidate.lastActive}
                        </div>
                      ) : (
                        <span className="text-slate-400">Unknown</span>
                      )}
                    </td>

                    {/* Source */}
                    <td className="px-6 py-4 whitespace-nowrap min-w-[200px]">
                      <div className="text-sm">
                        <Badge 
                          variant={candidate.source === "ats" ? "default" : candidate.source === "upload" ? "secondary" : "outline"}
                          className="mb-1"
                        >
                          {candidate.source === "ats" ? "ATS Import" : candidate.source === "upload" ? "File Upload" : "Manual"}
                        </Badge>
                        {candidate.atsId && (
                          <div className="text-xs text-slate-500 mt-1">
                            ATS ID: {candidate.atsId}
                          </div>
                        )}
                        {candidate.selectionStatus && (
                          <div className="text-xs text-slate-600 mt-1">
                            Status: {candidate.selectionStatus}
                          </div>
                        )}
                        {candidate.joiningOutcome && (
                          <div className="text-xs text-slate-500 mt-1">
                            Outcome: {candidate.joiningOutcome}
                          </div>
                        )}
                      </div>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {candidate.linkedinUrl && (
                        <button
                          onClick={() => window.open(candidate.linkedinUrl!, '_blank')}
                          className="text-primary hover:text-blue-700"
                          data-testid={`button-linkedin-${index}`}
                          title="View LinkedIn Profile"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        className="text-slate-400 hover:text-red-500"
                        data-testid={`button-favorite-${index}`}
                        title="Add to Favorites"
                      >
                        <Heart className="w-4 h-4" />
                      </button>
                      {candidate.email && (
                        <button
                          onClick={() => window.location.href = `mailto:${candidate.email}`}
                          className="text-slate-400 hover:text-slate-600"
                          data-testid={`button-email-${index}`}
                          title="Send Email"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {candidates.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="text-sm text-slate-700">
              Showing <span className="font-medium">1</span> to{" "}
              <span className="font-medium">{Math.min(candidates.length, 50)}</span> of{" "}
              <span className="font-medium">{candidates.length}</span> results
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                data-testid="button-previous-page"
              >
                Previous
              </Button>
              <span className="px-3 py-1 text-sm bg-primary text-white rounded">
                {currentPage}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => prev + 1)}
                data-testid="button-next-page"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      
      {/* LinkedIn API Test Dialog */}
      <LinkedInTestDialog
        open={showLinkedInTest}
        onOpenChange={setShowLinkedInTest}
      />
    </Card>
  );
}
