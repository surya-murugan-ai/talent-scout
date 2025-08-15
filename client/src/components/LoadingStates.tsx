import { LoadingSpinner, LoadingDots, SkeletonLoader } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function CandidateTableSkeleton() {
  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <SkeletonLoader className="h-6 w-48" />
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center space-x-4">
                <SkeletonLoader className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <SkeletonLoader className="h-4 w-32" />
                  <SkeletonLoader className="h-3 w-24" />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <SkeletonLoader className="h-6 w-16 rounded-full" />
                <SkeletonLoader className="h-4 w-8" />
                <SkeletonLoader className="h-8 w-8 rounded" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ActivityFeedSkeleton() {
  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <SkeletonLoader className="h-6 w-32" />
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start space-x-3">
              <SkeletonLoader className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonLoader className="h-4 w-3/4" />
                <SkeletonLoader className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="bg-white border-slate-200">
          <CardContent className="p-6">
            <div className="space-y-2">
              <SkeletonLoader className="h-8 w-12" />
              <SkeletonLoader className="h-4 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function UploadProcessingSkeleton() {
  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <SkeletonLoader className="h-6 w-40" />
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <SkeletonLoader className="h-4 w-32" />
            <SkeletonLoader className="h-6 w-16 rounded-full" />
          </div>
          <SkeletonLoader className="h-2 w-full rounded-full" />
          <div className="flex items-center space-x-2">
            <LoadingSpinner size="sm" />
            <SkeletonLoader className="h-4 w-48" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProcessingJobSkeleton() {
  return (
    <div className="bg-slate-50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonLoader className="h-4 w-40" />
        <SkeletonLoader className="h-6 w-20 rounded-full" />
      </div>
      <SkeletonLoader className="h-2 w-full rounded-full" />
      <div className="flex items-center justify-between text-sm">
        <SkeletonLoader className="h-3 w-24" />
        <SkeletonLoader className="h-3 w-16" />
      </div>
    </div>
  );
}