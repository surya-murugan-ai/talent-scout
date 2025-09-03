import { Bot, Gauge, Upload, Settings, TrendingUp, History, Folder, LogOut, FileText } from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Gauge },
    { id: "upload", label: "Upload Candidates", icon: Upload },
    { id: "resume-data", label: "Resume Data", icon: FileText },
    { id: "scoring", label: "Scoring Configuration", icon: Settings },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
    { id: "history", label: "Processing History", icon: History },
  ];

  const recentProjects = [
    "Software Engineers Q4",
    "Sales Leadership",
    "Marketing Team Expansion"
  ];

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex-shrink-0">
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Bot className="text-white h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">TalentAI</h1>
            <p className="text-xs text-slate-500">v2.1.0</p>
          </div>
        </div>
      </div>
      
      <nav className="px-4 pb-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? "text-primary bg-primary/5 border border-primary/20"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
                data-testid={`nav-${item.id}`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </button>
            );
          })}
        </div>
        
        <div className="mt-8">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            RECENT PROJECTS
          </h3>
          <div className="space-y-2">
            {recentProjects.map((project, index) => (
              <div
                key={index}
                className="flex items-center px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                data-testid={`project-${index}`}
              >
                <Folder className="w-4 h-4 mr-3" />
                <span>{project}</span>
              </div>
            ))}
          </div>
        </div>
      </nav>
      
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-slate-600">JD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900">John Doe</p>
            <p className="text-xs text-slate-500">TA Manager</p>
          </div>
          <LogOut className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-pointer" />
        </div>
      </div>
    </div>
  );
}
