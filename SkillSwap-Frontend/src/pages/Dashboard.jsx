// pages/Dashboard.jsx
import React from "react";
import DashboardLayout from "../components/Layout/DashboardLayout";
import { useDashboard } from "../context/DashboardContext";
import PublicProfiles from "../components/PublicProfiles";
import WelcomeBanner from "../components/Home/WelcomeBanner";

const Dashboard = () => {
  const { user } = useDashboard();

  return (
    <DashboardLayout>
      <WelcomeBanner user={user} />
      <div className="mt-8">
        <PublicProfiles />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
