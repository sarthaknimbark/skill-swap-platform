import {
  Search,
  ChevronRight,
  MessageSquare,
  BarChart2,
  GitPullRequest
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// Quick Actions Component
const QuickActions = () => {
  const navigate = useNavigate();

  const actions = [
    {
      icon: Search,
      title: "Find People",
      description: "Discover and connect with professionals",
      color: "blue",
      href: "/public-profiles"
    },
    {
      icon: GitPullRequest,
      title: "Swap Requests",
      description: "Manage your skill connection requests",
      color: "green",
      href: "/requests"
    },
    {
      icon: MessageSquare,
      title: "Messages",
      description: "Chat with your connections",
      color: "purple",
      href: "/chat"
    },
    {
      icon: BarChart2,
      title: "Platform Stats",
      description: "View community insights and statistics",
      color: "yellow",
      href: "/stats"
    }
  ];

  const getColorClasses = (color) => {
    const colorMap = {
      blue: "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200",
      green: "bg-green-50 hover:bg-green-100 text-green-700 border-green-200",
      purple: "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200",
      yellow: "bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200"
    };
    return colorMap[color] || colorMap.blue;
  };

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action, index) => (
          <button
            key={index}
            className={`p-4 rounded-lg border transition-colors text-left group cursor-pointer ${getColorClasses(action.color)}`}
            onClick={() => {
              navigate(action.href);
            }}
          >
            <action.icon className="h-6 w-6 mb-3" />
            <h3 className="font-medium mb-1">{action.title}</h3>
            <p className="text-sm opacity-80">{action.description}</p>
            <ChevronRight className="h-4 w-4 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;