import { useQuery } from "@tanstack/react-query";
import { Users, Star, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatsSkeleton } from "@/components/LoadingStates";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { Stats } from "@/types";

export default function StatsCards() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  if (isLoading) {
    return <StatsSkeleton />;
  }

  const cards = [
    {
      title: "Total Candidates",
      value: stats?.total || 0,
      change: "+12%",
      changeText: "from last month",
      icon: Users,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      title: "High Priority",
      value: stats?.highPriority || 0,
      change: "+8%",
      changeText: "from last week",
      icon: Star,
      iconBg: "bg-secondary/10",
      iconColor: "text-secondary",
    },
    {
      title: "Processing",
      value: stats?.processing || 0,
      change: "Currently enriching profiles",
      changeText: "",
      icon: Clock,
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
    },
    {
      title: "Avg Score",
      value: stats?.avgScore || 0,
      change: "+0.3",
      changeText: "improvement",
      icon: TrendingUp,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        
        return (
          <Card key={index} className="bg-white border-slate-200" data-testid={`stat-card-${index}`}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 ${card.iconBg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${card.iconColor}`} />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-slate-900" data-testid={`stat-value-${index}`}>
                    {card.value}
                  </p>
                  <p className="text-sm text-slate-600">{card.title}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center text-sm">
                  <span className="text-secondary font-medium">{card.change}</span>
                  {card.changeText && (
                    <span className="text-slate-500 ml-2">{card.changeText}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
