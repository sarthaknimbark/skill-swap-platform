// pages/Stats.jsx
import React, { useState } from "react";
import DashboardLayout from "../components/Layout/DashboardLayout";
import QuickStats from "../components/Home/QuickStats";
import RecentActivity from "../components/Home/RecentActivity";

const Stats = () => {
  const [dashboardData] = useState({
    stats: {
      connections: 248,
      profileViews: 1205,
      messages: 12
    },
    activities: [
      { message: "John Smith viewed your profile", time: "2 hours ago" },
      { message: "New connection request from Sarah Johnson", time: "4 hours ago" },
      { message: "You have a message from Mike Wilson", time: "1 day ago" }
    ]
  });

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Analytics & Stats</h1>
        <p className="text-gray-600">Track your profile performance and activities</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <QuickStats stats={dashboardData.stats} />
        </div>
        <div>
          <RecentActivity activities={dashboardData.activities} />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Stats;
