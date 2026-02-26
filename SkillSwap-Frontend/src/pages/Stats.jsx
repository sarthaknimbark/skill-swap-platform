// pages/Stats.jsx
import React, { useState, useEffect } from "react";
import DashboardLayout from "../components/Layout/DashboardLayout";
import QuickStats from "../components/Home/QuickStats";
import RecentActivity from "../components/Home/RecentActivity";
import UserProfileService from "../services/userProfile.service";

// utility to convert ISO date to relative time string
function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + " year" + (interval === 1 ? "" : "s") + " ago";
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + " month" + (interval === 1 ? "" : "s") + " ago";
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + " day" + (interval === 1 ? "" : "s") + " ago";
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + " hour" + (interval === 1 ? "" : "s") + " ago";
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + " minute" + (interval === 1 ? "" : "s") + " ago";
  return seconds + " seconds ago";
}

const Stats = () => {
  const [dashboardData, setDashboardData] = useState({
    stats: { connections: 0, profileViews: 0, messages: 0 },
    activities: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await UserProfileService.getAnalytics();
        // convert activity times to relative strings
        const activities = res.activities.map((a) => ({
          message: a.message,
          time: timeAgo(a.time),
        }));
        setDashboardData({ stats: res.stats, activities });
      } catch (err) {
        setError(err.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">Loading analytics...</div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6 text-red-600">{error}</div>
      </DashboardLayout>
    );
  }

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
