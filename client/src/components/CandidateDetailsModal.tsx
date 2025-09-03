import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { ComprehensiveCandidateDetails } from './ComprehensiveCandidateDetails';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CandidateDetailsModalProps {
  candidate: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    linkedinUrl?: string;
    location?: string;
    title?: string;
    skills?: string[];
    originalData?: any;
    confidence?: number;
    processingTime?: number;
    source?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CandidateDetailsModal({ candidate, isOpen, onClose }: CandidateDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const enrichLinkedInMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const response = await apiRequest('PATCH', `/api/candidates/${candidateId}/enrich`);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "LinkedIn enrichment successful",
        description: "Candidate data has been enriched with LinkedIn information",
      });
      // Refresh candidates data
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
    },
    onError: (error) => {
      toast({
        title: "LinkedIn enrichment failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleEnrichLinkedIn = (candidateId: string) => {
    enrichLinkedInMutation.mutate(candidateId);
  };

  if (!candidate) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Candidate Details - {candidate.name}</DialogTitle>
        </DialogHeader>
        <ComprehensiveCandidateDetails
          candidate={candidate}
          onEnrichLinkedIn={handleEnrichLinkedIn}
          isEnriching={enrichLinkedInMutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
