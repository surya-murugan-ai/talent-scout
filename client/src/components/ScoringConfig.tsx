import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ScoringWeights } from "@/types";

export default function ScoringConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [weights, setWeights] = useState<ScoringWeights>({
    openToWork: 40,
    skillMatch: 30,
    jobStability: 15,
    engagement: 15,
  });

  const { data: currentWeights } = useQuery<ScoringWeights>({
    queryKey: ["/api/scoring"],
  });

  const updateScoringMutation = useMutation({
    mutationFn: async (newWeights: ScoringWeights) => {
      const response = await apiRequest("POST", "/api/scoring", newWeights);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Scoring updated",
        description: "AI scoring model has been reconfigured",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Update local state when current weights are loaded
  useEffect(() => {
    if (currentWeights) {
      setWeights(currentWeights);
    }
  }, [currentWeights]);

  const handleWeightChange = (key: keyof ScoringWeights, value: number[]) => {
    setWeights(prev => ({
      ...prev,
      [key]: value[0],
    }));
  };

  const handleUpdate = () => {
    // Validate that weights sum to 100
    const total = weights.openToWork + weights.skillMatch + weights.jobStability + weights.engagement;
    if (Math.abs(total - 100) > 0.1) {
      toast({
        title: "Invalid weights",
        description: "Scoring weights must sum to 100%",
        variant: "destructive",
      });
      return;
    }

    updateScoringMutation.mutate(weights);
  };

  const resetToDefaults = () => {
    setWeights({
      openToWork: 40,
      skillMatch: 30,
      jobStability: 15,
      engagement: 15,
    });
  };

  const totalWeight = weights.openToWork + weights.skillMatch + weights.jobStability + weights.engagement;

  const sliderConfigs = [
    {
      key: "openToWork" as const,
      label: "Open to Work Signal",
      value: weights.openToWork,
      description: "LinkedIn profile indicators",
    },
    {
      key: "skillMatch" as const,
      label: "Skill Match Score",
      value: weights.skillMatch,
      description: "Job description alignment",
    },
    {
      key: "jobStability" as const,
      label: "Job Stability",
      value: weights.jobStability,
      description: "Employment history analysis",
    },
    {
      key: "engagement" as const,
      label: "Platform Engagement",
      value: weights.engagement,
      description: "Professional activity level",
    },
  ];

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="text-lg font-semibold text-slate-900">
          Scoring Configuration
        </CardTitle>
        <p className="text-slate-600 mt-1 text-sm">Adjust AI scoring weights</p>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {sliderConfigs.map((config) => (
          <div key={config.key} data-testid={`slider-${config.key}`}>
            <Label className="block text-sm font-medium text-slate-700 mb-2">
              {config.label}
            </Label>
            <div className="flex items-center space-x-3">
              <Slider
                value={[config.value]}
                onValueChange={(value) => handleWeightChange(config.key, value)}
                max={100}
                min={0}
                step={1}
                className="flex-1"
                data-testid={`slider-input-${config.key}`}
              />
              <span className="text-sm font-medium text-slate-900 w-12" data-testid={`slider-value-${config.key}`}>
                {config.value}%
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{config.description}</p>
          </div>
        ))}

        <div className="pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700">Total Weight:</span>
            <span className={`text-sm font-bold ${
              Math.abs(totalWeight - 100) < 0.1 ? "text-secondary" : "text-red-500"
            }`} data-testid="total-weight">
              {totalWeight}%
            </span>
          </div>
          
          {Math.abs(totalWeight - 100) > 0.1 && (
            <p className="text-xs text-red-500 mb-3">
              Weights must sum to 100% before updating
            </p>
          )}

          <div className="flex space-x-2">
            <Button
              onClick={handleUpdate}
              disabled={updateScoringMutation.isPending || Math.abs(totalWeight - 100) > 0.1}
              className="flex-1 bg-primary hover:bg-blue-700 text-white"
              data-testid="button-update-scoring"
            >
              {updateScoringMutation.isPending ? "Updating..." : "Update Scoring Model"}
            </Button>
            <Button
              onClick={resetToDefaults}
              variant="outline"
              size="sm"
              className="border-slate-300"
              data-testid="button-reset-defaults"
            >
              Reset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
