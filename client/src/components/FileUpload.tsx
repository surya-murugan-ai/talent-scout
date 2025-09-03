import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CloudUpload, FileSpreadsheet, X, Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { NotificationService } from "@/lib/notifications";
import { LoadingSpinner, LoadingDots } from "@/components/ui/loading-spinner";

interface UploadedFile {
  name: string;
  size: number;
  status: "uploading" | "processed" | "processing" | "error";
  jobId?: string;
}

export default function FileUpload() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => {
        formData.append("files", file);
      });
      
      const response = await apiRequest("POST", "/api/upload", formData);
      return response.json();
    },
    onSuccess: (data, files) => {
      // Update file statuses based on processing results
      if (data.processingResults && Array.isArray(data.processingResults)) {
        data.processingResults.forEach((result: any) => {
          setUploadedFiles(prev => 
            prev.map(f => 
              f.name === result.filename 
                ? { 
                    ...f, 
                    status: result.success ? "processing" : "error",
                    jobId: result.jobId 
                  }
                : f
            )
          );
        });
      }
      
      toast({
        title: "Files uploaded successfully",
        description: `${files.length} file(s) are now being processed`,
      });
      
      // Invalidate all relevant queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
    onError: (error, files) => {
      // Mark all files as error
      files.forEach(file => {
        setUploadedFiles(prev => 
          prev.map(f => 
            f.name === file.name 
              ? { ...f, status: "error" }
              : f
          )
        );
      });
      
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Add all files to the list first
    const newUploadedFiles = acceptedFiles.map(file => ({
      name: file.name,
      size: file.size,
      status: "uploading" as const,
    }));
    
    setUploadedFiles(prev => [...prev, ...newUploadedFiles]);
    
    // Upload all files as a batch
    uploadMutation.mutate(acceptedFiles);
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple: true,
    maxFiles: 20,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const removeFile = (fileName: string) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const getStatusIcon = (status: UploadedFile["status"]) => {
    switch (status) {
      case "uploading":
        return <LoadingSpinner size="sm" className="text-accent" />;
      case "processing":
        return <LoadingSpinner size="sm" className="text-accent" />;
      case "processed":
        return <Check className="w-4 h-4 text-secondary" />;
      case "error":
        return <X className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: UploadedFile["status"]) => {
    const badges = {
      uploading: "px-2 py-1 bg-accent/10 text-accent text-xs font-medium rounded",
      processing: "px-2 py-1 bg-accent/10 text-accent text-xs font-medium rounded",
      processed: "px-2 py-1 bg-secondary/10 text-secondary text-xs font-medium rounded",
      error: "px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded",
    };

    const labels = {
      uploading: "Uploading",
      processing: "Processing", 
      processed: "Processed",
      error: "Error",
    };

    const showDots = status === "uploading" || status === "processing";

    return (
      <span className={badges[status]} data-testid={`file-status-${status}`}>
        {labels[status]}
        {showDots && <LoadingDots className="inline-flex ml-1" />}
      </span>
    );
  };

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="text-lg font-semibold text-slate-900">
          Upload Candidate Data
        </CardTitle>
        <p className="text-slate-600 mt-1">
          Import your ATS data or CSV files to begin enrichment
        </p>
      </CardHeader>
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-slate-300 hover:border-primary"
          }`}
          data-testid="file-upload-area"
        >
          <input {...getInputProps()} />
          <div className="mx-auto w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
            <CloudUpload className="text-slate-500 text-xl" />
          </div>
          <h4 className="text-lg font-medium text-slate-900 mb-2">
            Drop files here or click to browse
          </h4>
                      <p className="text-slate-600 mb-4">
              Supports CSV, Excel, PDF, and DOCX files up to 50MB each (max 20 files)
            </p>
          <Button 
            type="button"
            className="bg-primary hover:bg-blue-700 text-white"
            data-testid="button-choose-files"
          >
            Choose Files
          </Button>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="mt-6 space-y-3">
            {uploadedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                data-testid={`uploaded-file-${index}`}
              >
                <div className="flex items-center">
                  <FileSpreadsheet className="text-secondary mr-3" />
                  <div>
                    <p className="font-medium text-slate-900">{file.name}</p>
                    <p className="text-sm text-slate-500">
                      {Math.round(file.size / 1024)} KB
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(file.status)}
                  {getStatusBadge(file.status)}
                  <button
                    onClick={() => removeFile(file.name)}
                    className="text-slate-400 hover:text-slate-600"
                    data-testid={`button-remove-file-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
