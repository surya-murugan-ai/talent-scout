import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LinkedInTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TestResult {
  success: boolean;
  profile?: any;
  error?: string;
  details?: string;
}

export function LinkedInTestDialog({ open, onOpenChange }: LinkedInTestDialogProps) {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleTest = async () => {
    if (!linkedinUrl.trim()) {
      setResult({
        success: false,
        error: "LinkedIn URL is required"
      });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-linkedin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          linkedinUrl: linkedinUrl.trim(),
          name: name.trim() || undefined,
          company: company.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          profile: data.profile
        });
      } else {
        setResult({
          success: false,
          error: data.error || 'Test failed',
          details: data.details
        });
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'Network error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleClose = () => {
    setLinkedinUrl("");
    setName("");
    setCompany("");
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Test LinkedIn API Integration
          </DialogTitle>
          <DialogDescription>
            Test the real LinkedIn profile enrichment using Apify. Enter a LinkedIn profile URL to see the enriched data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linkedin-url">LinkedIn Profile URL *</Label>
            <Input
              id="linkedin-url"
              placeholder="https://linkedin.com/in/username"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              data-testid="input-linkedin-url"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="test-name">Name (optional)</Label>
              <Input
                id="test-name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-test-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-company">Company (optional)</Label>
              <Input
                id="test-company"
                placeholder="Tech Corp"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                data-testid="input-test-company"
              />
            </div>
          </div>

          <Button 
            onClick={handleTest} 
            disabled={testing || !linkedinUrl.trim()}
            className="w-full"
            data-testid="button-test-linkedin"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing LinkedIn Enrichment...
              </>
            ) : (
              'Test LinkedIn Enrichment'
            )}
          </Button>

          {result && (
            <div className="mt-4">
              {result.success ? (
                <div className="space-y-4">
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      LinkedIn profile enrichment successful!
                    </AlertDescription>
                  </Alert>

                  {result.profile && (
                    <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                      <h4 className="font-medium text-slate-900">Enriched Profile Data:</h4>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong>Name:</strong> {result.profile.name || 'N/A'}
                        </div>
                        <div>
                          <strong>Title:</strong> {result.profile.title || 'N/A'}
                        </div>
                        <div>
                          <strong>Company:</strong> {result.profile.company || 'N/A'}
                        </div>
                        <div>
                          <strong>Open to Work:</strong> {result.profile.openToWork ? 'Yes' : 'No'}
                        </div>
                        <div>
                          <strong>Last Active:</strong> {result.profile.lastActive || 'N/A'}
                        </div>
                        <div>
                          <strong>Skills Count:</strong> {result.profile.skills?.length || 0}
                        </div>
                      </div>

                      {result.profile.skills && result.profile.skills.length > 0 && (
                        <div>
                          <strong>Skills:</strong>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.profile.skills.slice(0, 10).map((skill: string, index: number) => (
                              <span
                                key={index}
                                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                              >
                                {skill}
                              </span>
                            ))}
                            {result.profile.skills.length > 10 && (
                              <span className="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded">
                                +{result.profile.skills.length - 10} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {result.profile.jobHistory && result.profile.jobHistory.length > 0 && (
                        <div>
                          <strong>Recent Work History:</strong>
                          <div className="space-y-2 mt-1">
                            {result.profile.jobHistory.slice(0, 3).map((job: any, index: number) => (
                              <div key={index} className="text-sm bg-white p-2 rounded border">
                                <div className="font-medium">{job.role}</div>
                                <div className="text-slate-600">{job.company} • {job.duration}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.profile.recentActivity && result.profile.recentActivity.length > 0 && (
                        <div>
                          <strong>Recent Activity:</strong>
                          <ul className="list-disc list-inside text-sm text-slate-600 mt-1">
                            {result.profile.recentActivity.slice(0, 3).map((activity: string, index: number) => (
                              <li key={index}>{activity}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <div className="font-medium mb-1">{result.error}</div>
                    {result.details && (
                      <div className="text-sm text-red-700">{result.details}</div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}