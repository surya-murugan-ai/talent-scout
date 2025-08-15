import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8"
  };

  return (
    <div 
      className={cn(
        "animate-spin rounded-full border-2 border-gray-300 border-t-blue-600",
        sizeClasses[size],
        className
      )}
      data-testid="loading-spinner"
    />
  );
}

export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex space-x-1", className)} data-testid="loading-dots">
      <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce"></div>
    </div>
  );
}

export function SkeletonLoader({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        "animate-pulse bg-gray-200 rounded",
        className
      )}
      data-testid="skeleton-loader"
    />
  );
}