import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, Upload, FileText, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ATSCandidate {
  name: string;
  email?: string;
  title?: string;
  company?: string;
  atsId: string;
  selectionStatus: string;
  selectionDate?: string;
  joiningOutcome?: string;
  atsNotes?: string;
}

export default function ATSIntegration() {
  const [atsData, setATSData] = useState("");
  const [importMethod, setImportMethod] = useState<"json" | "csv">("json");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const atsImportMutation = useMutation({
    mutationFn: async (data: { method: string; data: string }) => {
      const response = await apiRequest("POST", "/api/ats/import", {
        method: data.method,
        data: data.data
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "ATS import successful",
        description: `Imported ${data.imported} candidates from ATS system`,
      });
      
      setATSData("");
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
    onError: (error) => {
      toast({
        title: "ATS import failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    if (!atsData.trim()) {
      toast({
        title: "No data provided",
        description: "Please enter ATS data before importing",
        variant: "destructive",
      });
      return;
    }

    atsImportMutation.mutate({
      method: importMethod,
      data: atsData
    });
  };

  const sampleJSON = `[
  {
    "name": "John Smith",
    "email": "john.smith@email.com",
    "title": "Senior Software Engineer",
    "company": "Tech Corp",
    "atsId": "ATS-12345",
    "selectionStatus": "Offered",
    "selectionDate": "2024-01-15",
    "joiningOutcome": "Declined",
    "atsNotes": "Strong technical skills, declined due to salary expectations"
  },
  {
    "name": "Jane Doe",
    "email": "jane.doe@email.com",
    "title": "Product Manager",
    "company": "Startup Inc",
    "atsId": "ATS-12346",
    "selectionStatus": "Selected",
    "selectionDate": "2024-02-01",
    "joiningOutcome": "Joined",
    "atsNotes": "Excellent cultural fit, started on time"
  }
]`;

  const sampleCSV = `name,email,title,company,atsId,selectionStatus,selectionDate,joiningOutcome,atsNotes
John Smith,john.smith@email.com,Senior Software Engineer,Tech Corp,ATS-12345,Offered,2024-01-15,Declined,Strong technical skills
Jane Doe,jane.doe@email.com,Product Manager,Startup Inc,ATS-12346,Selected,2024-02-01,Joined,Excellent cultural fit`;

  return (
    <div className="space-y-6">
      <Card className="bg-white border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center">
            <Database className="w-5 h-5 mr-2" />
            ATS Integration
          </CardTitle>
          <p className="text-slate-600 text-sm">
            Import candidate history from your Applicant Tracking System (ATS) for comprehensive talent analysis
          </p>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Import Method Selection */}
          <div className="space-y-2">
            <Label htmlFor="import-method">Import Format</Label>
            <Select value={importMethod} onValueChange={(value: "json" | "csv") => setImportMethod(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select import format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON Format</SelectItem>
                <SelectItem value="csv">CSV Format</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data Input */}
          <div className="space-y-2">
            <Label htmlFor="ats-data">
              ATS Data ({importMethod.toUpperCase()})
            </Label>
            <Textarea
              id="ats-data"
              placeholder={`Paste your ${importMethod.toUpperCase()} data here...`}
              value={atsData}
              onChange={(e) => setATSData(e.target.value)}
              rows={12}
              className="font-mono text-sm"
              data-testid="textarea-ats-data"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={() => setATSData(importMethod === "json" ? sampleJSON : sampleCSV)}
              data-testid="button-load-sample"
            >
              <FileText className="w-4 h-4 mr-2" />
              Load Sample Data
            </Button>

            <Button
              onClick={handleImport}
              disabled={atsImportMutation.isPending || !atsData.trim()}
              data-testid="button-import-ats"
            >
              {atsImportMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {atsImportMutation.isPending ? "Importing..." : "Import from ATS"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-900">Required ATS Fields</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>Required:</strong> name, atsId, selectionStatus</p>
                <p><strong>Optional:</strong> email, title, company, selectionDate, joiningOutcome, atsNotes</p>
              </div>
              <div className="text-sm text-blue-700 mt-3">
                <strong>Selection Status Options:</strong> Offered, Selected, Interviewed, Rejected, Pending
              </div>
              <div className="text-sm text-blue-700">
                <strong>Joining Outcome Options:</strong> Joined, Declined, Dropped, No Communication
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}