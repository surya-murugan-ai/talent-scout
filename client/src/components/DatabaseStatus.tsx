import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, Activity, RefreshCw, Zap, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface DatabaseHealth {
  status: 'healthy' | 'unhealthy';
  tables: {
    name: string;
    count: number;
    lastUpdated?: string;
  }[];
  connectionTest: boolean;
  totalRecords: number;
  lastActivity?: string;
}

export default function DatabaseStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const healthQuery = useQuery({
    queryKey: ['/api/database/health'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/database/optimize");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Database optimized",
        description: `Completed ${data.operations.length} optimization operations`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/database/health'] });
    },
    onError: (error) => {
      toast({
        title: "Optimization failed",
        description: error instanceof Error ? error.message : "Failed to optimize database",
        variant: "destructive",
      });
    },
  });

  const refreshHealth = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/database/health'] });
    toast({
      title: "Refreshing database status",
      description: "Checking database health...",
    });
  };

  const health = healthQuery.data as DatabaseHealth;

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Database className="h-5 w-5" />
            PostgreSQL Database
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshHealth}
              disabled={healthQuery.isLoading}
              data-testid="refresh-database-health"
            >
              <RefreshCw className={`h-4 w-4 ${healthQuery.isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => optimizeMutation.mutate()}
              disabled={optimizeMutation.isPending || !health?.connectionTest}
              data-testid="optimize-database"
            >
              {optimizeMutation.isPending ? (
                <LoadingSpinner size="sm" className="mr-1" />
              ) : (
                <Zap className="h-4 w-4 mr-1" />
              )}
              Optimize
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {healthQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2 text-slate-600">Checking database health...</span>
          </div>
        ) : healthQuery.error ? (
          <div className="flex items-center justify-center py-8 text-red-600">
            <XCircle className="h-6 w-6 mr-2" />
            <span>Failed to check database status</span>
          </div>
        ) : health ? (
          <div className="space-y-4">
            {/* Overall Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {health.status === 'healthy' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium">
                  Status: {health.status === 'healthy' ? 'Healthy' : 'Unhealthy'}
                </span>
              </div>
              <Badge 
                variant={health.status === 'healthy' ? 'default' : 'destructive'}
                data-testid="database-status-badge"
              >
                {health.connectionTest ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>

            {/* Total Records */}
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Total Records</span>
                <span className="font-semibold text-slate-900" data-testid="total-records">
                  {health.totalRecords.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Table Statistics */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-700">Table Statistics</h4>
              <div className="grid grid-cols-1 gap-2">
                {health.tables.map((table) => (
                  <div 
                    key={table.name}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
                    data-testid={`table-${table.name}`}
                  >
                    <span className="text-sm text-slate-600 capitalize">
                      {table.name.replace('_', ' ')}
                    </span>
                    <span className="font-medium text-slate-900">
                      {table.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Last Activity */}
            {health.lastActivity && (
              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Activity className="h-4 w-4" />
                  <span>Last activity: {new Date(health.lastActivity).toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Optimization Status */}
            {optimizeMutation.isPending && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-blue-700">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Optimizing database...</span>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}