// pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/Layout/DashboardLayout";
import { useDashboard } from "../context/DashboardContext";
import WelcomeBanner from "../components/Home/WelcomeBanner";
import QuickStats from "../components/Home/QuickStats";
import RecentActivity from "../components/Home/RecentActivity";
import UserProfileService from "../services/userProfile.service";
import { fetchUserInfo } from "../services/auth.service";
import ProfileCard from "../components/PublicProfile/ProfileCard";

const Dashboard = () => {
  const { user } = useDashboard();

  const [stats, setStats] = useState({
    connections: 0,
    profileViews: 0,
    messages: 0,
  });
  const [activities, setActivities] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // 1) Analytics (stats + activity)
        const analytics = await UserProfileService.getAnalytics();
        setStats(analytics.stats || stats);
        setActivities(analytics.activities || []);

        // 2) Simple recommended profiles: first few public profiles
        // (Dashboard shows a small curated strip, full list lives on Public Profiles page)
        const currentUser = await fetchUserInfo().catch(() => null);
        const currentUserId = currentUser?._id || currentUser?.id;

        const publicRes = await UserProfileService.getPublicProfiles(1, 6, "");
        const list = Array.isArray(publicRes.data) ? publicRes.data : [];
        const filtered = currentUserId
          ? list.filter((p) => {
              const uid = p.userId?._id || p.userId || p._id;
              return uid !== currentUserId;
            })
          : list;

        setRecommended(filtered.slice(0, 3));
      } catch (err) {
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DashboardLayout>
      <WelcomeBanner user={user} />

      {loading ? (
        <div className="mt-8 text-center text-gray-600">Loading your dashboard...</div>
      ) : error ? (
        <div className="mt-8 text-red-600">{error}</div>
      ) : (
        <>
          {/* Top row: snapshot of your activity */}
          <QuickStats stats={stats} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recommended connections preview */}
            <section className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Recommended Connections
                </h2>
                <a
                  href="/public-profiles"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  View all
                </a>
              </div>

              {recommended.length === 0 ? (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <p className="text-sm text-gray-600">
                    No recommended profiles yet. Try updating your skills and interests to get better matches.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {recommended.map((profile) => (
                    <ProfileCard
                      key={profile._id}
                      profile={profile}
                      onViewProfile={() => {}}
                      onSendRequest={() => {}}
                      hasAlreadySent={false}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Recent activity snapshot */}
            <section>
              <RecentActivity activities={activities.slice(0, 5)} />
            </section>
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

export default Dashboard;
