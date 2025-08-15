import { Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Header() {
  const { toast } = useToast();

  const handleNewProject = () => {
    toast({
      title: "New Project",
      description: "Project creation feature coming soon!",
    });
  };

  const handleNotifications = () => {
    toast({
      title: "Notifications",
      description: "3 new notifications available",
    });
  };

  return (
    <header className="bg-white border-b border-slate-200 px-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Candidate Intelligence Dashboard
          </h2>
          <p className="text-slate-600 mt-1">
            AI-powered talent acquisition and candidate scoring
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={handleNotifications}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
            data-testid="button-notifications"
          >
            <Bell className="w-4 h-4 mr-2" />
            Notifications
            <span className="ml-2 px-2 py-1 bg-accent text-white text-xs rounded-full">
              3
            </span>
          </Button>
          <Button
            onClick={handleNewProject}
            className="bg-primary hover:bg-blue-700 text-white"
            data-testid="button-new-project"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>
    </header>
  );
}
