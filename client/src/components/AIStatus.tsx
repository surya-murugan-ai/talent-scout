import { Bot, Database, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AIStatus() {
  const services = [
    {
      name: "OpenAI GPT-4",
      description: "Profile analysis & scoring",
      status: "Active",
      statusColor: "text-secondary",
      bgColor: "bg-green-50 border-green-200",
      icon: Bot,
    },
    {
      name: "LinkedIn API",
      description: "Smart profile enrichment",
      status: "Active",
      statusColor: "text-secondary",
      bgColor: "bg-green-50 border-green-200",
      icon: Activity,
    },
    {
      name: "Vector Database",
      description: "Semantic candidate search",
      status: "Ready",
      statusColor: "text-secondary",
      bgColor: "bg-slate-50 border-slate-200",
      icon: Database,
    },
  ];

  // Mock API usage - in a real app, this would come from the backend
  const apiUsage = {
    requests: 2847,
    total: 10000,
  };

  const usagePercentage = (apiUsage.requests / apiUsage.total) * 100;

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="text-lg font-semibold text-slate-900">
          AI Integration Status
        </CardTitle>
        <p className="text-slate-600 mt-1 text-sm">OpenAI API & External Services</p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {services.map((service, index) => {
          const Icon = service.icon;
          
          return (
            <div
              key={index}
              className={`flex items-center justify-between p-3 ${service.bgColor} border rounded-lg`}
              data-testid={`service-${index}`}
            >
              <div className="flex items-center">
                <Icon className={`w-5 h-5 mr-3 ${
                  service.name.includes('OpenAI') ? 'text-secondary' : 
                  service.name.includes('LinkedIn') ? 'text-primary' : 
                  'text-slate-500'
                }`} />
                <div>
                  <p className="text-sm font-medium text-slate-900">{service.name}</p>
                  <p className="text-xs text-slate-600">{service.description}</p>
                </div>
              </div>
              <div className={`flex items-center ${service.statusColor}`}>
                <div className={`w-2 h-2 rounded-full mr-1 ${
                  service.status === 'Active' || service.status === 'Ready' ? 'bg-secondary' : 'bg-accent'
                }`} />
                <span className="text-xs font-medium">{service.status}</span>
              </div>
            </div>
          );
        })}

        <div className="pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-600 mb-2">API Usage Today</div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-slate-900" data-testid="api-usage-count">
              {apiUsage.requests.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">
              of {apiUsage.total.toLocaleString()} requests
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${usagePercentage}%` }}
              data-testid="api-usage-bar"
            />
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-slate-500">{usagePercentage.toFixed(1)}% used</span>
            <span className="text-xs text-slate-500">
              {apiUsage.total - apiUsage.requests} remaining
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
