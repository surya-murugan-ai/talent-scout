import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Users, Trash2, Mail, AlertTriangle, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Candidate } from "@shared/schema";

export default function UploadedCandidatesTable() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
    refetchInterval: 5000, // Refresh every 5 seconds to catch new uploads
  });

  const deleteMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const response = await apiRequest("DELETE", `/api/candidates/${candidateId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Candidate deleted",
        description: "Candidate has been removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete candidate",
        variant: "destructive",
      });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/clear-all-data");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "All data cleared",
        description: "Database has been reset successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (error) => {
      toast({
        title: "Clear failed",
        description: error instanceof Error ? error.message : "Failed to clear data",
        variant: "destructive",
      });
    },
  });

  const handleClearAll = () => {
    if (window.confirm("⚠️ This will delete ALL candidate data, jobs, and activities. This action cannot be undone. Are you sure?")) {
      clearAllMutation.mutate();
    }
  };

  const handleDelete = (candidateId: string, candidateName: string) => {
    if (window.confirm(`Are you sure you want to delete ${candidateName}?`)) {
      deleteMutation.mutate(candidateId);
    }
  };

  // Get recently uploaded candidates (last 50)
  const recentCandidates = candidates
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 50);

  const totalPages = Math.ceil(recentCandidates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCandidates = recentCandidates.slice(startIndex, startIndex + itemsPerPage);

  const getSelectionStatusBadge = (status: string | null) => {
    if (!status) return <span className="text-slate-400 text-xs">Not set</span>;
    
    const variants: { [key: string]: string } = {
      "Offered": "bg-blue-100 text-blue-800 border-blue-300",
      "Selected": "bg-green-100 text-green-800 border-green-300",
      "Interviewed": "bg-yellow-100 text-yellow-800 border-yellow-300",
      "Rejected": "bg-red-100 text-red-800 border-red-300",
      "Pending": "bg-gray-100 text-gray-800 border-gray-300"
    };
    
    return (
      <Badge className={variants[status] || "bg-slate-100 text-slate-800 border-slate-300"}>
        {status}
      </Badge>
    );
  };

  const getJoiningOutcomeBadge = (outcome: string | null) => {
    if (!outcome) return <span className="text-slate-400 text-xs">Not set</span>;
    
    const variants: { [key: string]: string } = {
      "Joined": "bg-green-100 text-green-800 border-green-300",
      "Declined": "bg-red-100 text-red-800 border-red-300",
      "Dropped": "bg-orange-100 text-orange-800 border-orange-300",
      "No Communication": "bg-gray-100 text-gray-800 border-gray-300"
    };
    
    return (
      <Badge className={variants[outcome] || "bg-slate-100 text-slate-800 border-slate-300"}>
        {outcome}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card className="bg-white border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Uploaded Candidates
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recentCandidates.length === 0) {
    return (
      <Card className="bg-white border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Uploaded Candidates
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">No candidates uploaded yet</p>
          <p className="text-sm text-slate-500 mt-2">Upload a file or import from ATS to see candidates here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center justify-between">
          <div className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Uploaded Candidates ({recentCandidates.length})
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={clearAllMutation.isPending}
            className="text-red-600 hover:text-red-800 hover:bg-red-50 border-red-200"
          >
            <Database className="w-4 h-4 mr-1" />
            Clear All Data
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Contact Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Selection Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Selection Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Joining Outcome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {paginatedCandidates.map((candidate, index) => (
                <tr key={candidate.id} className="hover:bg-slate-50" data-testid={`candidate-row-${index}`}>
                  {/* Name */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8">
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                          <span className="text-xs font-medium text-slate-600">
                            {candidate.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-slate-900" data-testid={`candidate-name-${index}`}>
                          {candidate.name}
                        </div>
                        {candidate.title && (
                          <div className="text-xs text-slate-500">{candidate.title}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Contact Details */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm space-y-1">
                      {(() => {
                        const email = candidate.email || candidate.originalData?.["Contact Details"];
                        const phone = candidate.originalData?.["Phone"] || candidate.originalData?.["phone"];
                        
                        if (email || phone) {
                          return (
                            <>
                              {email && (
                                <div className="flex items-center text-slate-700">
                                  <Mail className="w-3 h-3 mr-1 text-slate-400" />
                                  <span className="truncate max-w-[200px]" title={email}>
                                    {email}
                                  </span>
                                </div>
                              )}
                              {phone && (
                                <div className="text-xs text-slate-500">{phone}</div>
                              )}
                            </>
                          );
                        } else {
                          return <span className="text-xs text-slate-400">No contact info</span>;
                        }
                      })()}
                    </div>
                  </td>

                  {/* Selection Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getSelectionStatusBadge(candidate.selectionStatus || candidate.originalData?.["Selection Status"])}
                  </td>

                  {/* Selection Date */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {(() => {
                      const date = candidate.selectionDate || candidate.originalData?.["Selection Date"];
                      if (date) {
                        try {
                          return new Date(date).toLocaleDateString();
                        } catch {
                          return date; // Return as-is if can't parse
                        }
                      }
                      return <span className="text-slate-400">Not set</span>;
                    })()}
                  </td>

                  {/* Joining Outcome */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getJoiningOutcomeBadge(candidate.joiningOutcome || candidate.originalData?.["Joining Outcome"])}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(candidate.id, candidate.name)}
                      disabled={deleteMutation.isPending}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                      data-testid={`delete-candidate-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 flex items-center justify-between border-t border-slate-200">
            <div className="text-sm text-slate-700">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, recentCandidates.length)} of {recentCandidates.length} candidates
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}