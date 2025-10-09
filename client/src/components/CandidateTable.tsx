import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Filter, Download, ExternalLink, Heart, Mail, Zap, Eye, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LinkedInTestDialog } from "./LinkedInTestDialog";
import { CandidateDetailsModal } from "./CandidateDetailsModal";
import { CandidateTableSkeleton } from "@/components/LoadingStates";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { Candidate } from "@shared/schema";

export default function CandidateTable() {
  const [currentPage, setCurrentPage] = useState(1);
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [showLinkedInTest, setShowLinkedInTest] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showCandidateDetails, setShowCandidateDetails] = useState(false);
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

  const calculateHireability = (candidate: Candidate) => {
    const resumeCompany = candidate.company;
    const linkedinCompany = candidate.currentEmployer;
    
    // If companies are the same, show "Hireable" (green)
    if (resumeCompany && linkedinCompany && resumeCompany === linkedinCompany) {
      return { status: "Hireable", color: "bg-green-100 text-green-800 border-green-300" };
    }
    
    // If companies are different, show "Potential" (orange)
    // Note: Duration comparison logic can be enhanced later when duration data is available
    if (resumeCompany && linkedinCompany && resumeCompany !== linkedinCompany) {
      return { status: "Potential", color: "bg-orange-100 text-orange-800 border-orange-300" };
    }
    
    // If no company data on either resume or LinkedIn, show "Fresher" (blue)
    if ((!resumeCompany || resumeCompany === "Not mentioned") && (!linkedinCompany || linkedinCompany === "Not mentioned")) {
      return { status: "Fresher", color: "bg-blue-100 text-blue-800 border-blue-300" };
    }
    
    // Default case - if only one has company data, show "Potential"
    return { status: "Potential", color: "bg-orange-100 text-orange-800 border-orange-300" };
  };

  const getHireabilityBadgeColor = (potentialToJoin: string) => {
    switch (potentialToJoin) {
      case "High":
        return "bg-green-100 text-green-800 border-green-300";
      case "Medium":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "Low":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };



  const handleExport = () => {
    exportMutation.mutate(filterPriority || undefined);
  };

  const handleViewDetails = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setShowCandidateDetails(true);
  };

  const handleCloseDetails = () => {
    setShowCandidateDetails(false);
    setSelectedCandidate(null);
  };

  const handleAnalyzeCompany = async (candidateId: string) => {
    try {
      const response = await fetch(`/api/candidates/${candidateId}/analyze-company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to analyze company');
      }

      const result = await response.json();
      
      // Refresh the candidates data
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      
      toast({
        title: "Company analysis completed",
        description: result.message,
      });
    } catch (error) {
      toast({
        title: "Company analysis failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleAnalyzeAllCompanies = async () => {
    try {
      const response = await fetch('/api/candidates/analyze-all-companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to analyze all companies');
      }

      const result = await response.json();
      
      // Refresh the candidates data
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      
      toast({
        title: "Bulk company analysis completed",
        description: result.message,
      });
    } catch (error) {
      toast({
        title: "Bulk company analysis failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
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
              variant="outline"
              size="sm"
              onClick={handleAnalyzeAllCompanies}
              className="text-green-600 hover:text-green-900 border-green-300"
              data-testid="button-analyze-all-companies"
            >
              <Zap className="w-4 h-4 mr-2" />
              Analyze All Companies
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
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 relative">
          <table className="w-full min-w-[1800px]">
            <thead className="sticky-table-header">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[250px]">
                  Candidate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[200px]">
                  Resume Current Employer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[200px]">
                  LinkedIn Current Employer
                </th>
                {/* <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[180px]">
                  Company Difference
                </th> */}
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
                  Hireability
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[200px]">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[200px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
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
                            {candidate.company || "Not mentioned"}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    {/* Resume Current Employer */}
                    <td className="px-6 py-4 whitespace-nowrap min-w-[200px]">
                      <div className="text-sm">
                        <div className="font-medium text-slate-900 truncate" title={candidate.company || "Not mentioned"}>
                          {candidate.company || "Not mentioned"}
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
                        </div>
                      </div>
                    </td>
                    
                    {/* LinkedIn Current Employer */}
                    <td className="px-6 py-4 whitespace-nowrap min-w-[200px]">
                      <div className="text-sm">
                        <div className="font-medium text-slate-900 truncate" title={candidate.currentEmployer || "Not mentioned"}>
                          {candidate.currentEmployer || "Not mentioned"}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center space-x-2 mt-1">
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
                    
                    {/* Company Difference - Commented Out
                    <td className="px-6 py-4 whitespace-nowrap min-w-[180px]">
                      <div className="text-sm">
                        <div className="font-medium text-slate-900 truncate" title={candidate.companyDifference || "No analysis available"}>
                          {candidate.companyDifference || "No analysis"}
                        </div>
                        {candidate.companyDifferenceScore !== undefined && (
                          <div className="text-xs text-slate-500 mt-1">
                            Score: {candidate.companyDifferenceScore.toFixed(1)}/10
                          </div>
                        )}
                      </div>
                    </td>
                    */}
                    
                    {/* Score */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-lg font-bold text-slate-900" data-testid={`candidate-score-${index}`}>
                        {candidate.score ? candidate.score.toFixed(1) : "0.0"}
                      </span>
                      {/* Score Details Info */}
                      <div className="group relative ml-2">
                        <Info className="w-3 h-3 text-slate-400 cursor-help" />
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                          <div className="font-medium mb-2">Score Breakdown</div>
                          <div className="space-y-1 text-left">
                            <div><span className="text-blue-300">Open to Work:</span> {candidate.openToWork ? "10/10" : "3/10"} (40%)</div>
                            <div><span className="text-green-300">Skill Match:</span> {(() => {
                              const skills = candidate.skills;
                              if (skills && Array.isArray(skills) && skills.length > 0) {
                                return `${Math.min(skills.length, 10)}/10`;
                              }
                              return "5/10";
                            })()} (30%)</div>
                            <div><span className="text-yellow-300">Job Stability:</span> {/* Company consistency logic */} (15%)</div>
                            <div><span className="text-purple-300">Engagement:</span> {/* LinkedIn activity logic */} (15%)</div>
                          </div>
                          <div className="mt-2 text-slate-300 text-xs border-t border-slate-700 pt-2">
                            <div className="font-medium">Formula:</div>
                            <div>Score = (Open to Work × 0.4) + (Skill Match × 0.3) + (Job Stability × 0.15) + (Engagement × 0.15)</div>
                          </div>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                        </div>
                      </div>
                    </td>
                    {/* <td className="px-6 py-4 whitespace-nowrap">
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
                    </td> */}
                    
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
                    
                    {/* Hireability */}
                    <td className="px-6 py-4 whitespace-nowrap min-w-[120px]">
                      <div className="text-center">
                        <div className="flex items-center justify-center">
                          {(() => {
                            const hireability = calculateHireability(candidate);
                            return (
                              <Badge 
                                className={hireability.color}
                                title={`Resume: ${candidate.company || 'Unknown'}, LinkedIn: ${candidate.currentEmployer || 'Unknown'}`}
                              >
                                {hireability.status}
                              </Badge>
                            );
                          })()}
                        </div>
                      </div>
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
                      <button
                        onClick={() => handleViewDetails(candidate)}
                        className="text-blue-600 hover:text-blue-800"
                        data-testid={`button-view-details-${index}`}
                        title="View Detailed Information"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      {/* Company Analysis Button - Commented Out
                      <button
                        onClick={() => handleAnalyzeCompany(candidate.id)}
                        className="text-green-600 hover:text-green-800"
                        data-testid={`button-analyze-company-${index}`}
                        title="Analyze Company Difference"
                      >
                        <Zap className="w-4 h-4" />
                      </button>
                      */}
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
      
      {/* Candidate Details Modal */}
      <CandidateDetailsModal
        candidate={selectedCandidate}
        isOpen={showCandidateDetails}
        onClose={handleCloseDetails}
      />
    </Card>
  );
}
