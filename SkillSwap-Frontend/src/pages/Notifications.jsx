// pages/Notifications.jsx
import React, { useState } from "react";
import DashboardLayout from "../components/Layout/DashboardLayout";
import NotificationCenter from "../components/Home/NotificationCenter";

const Notifications = () => {
  const [notifications] = useState([
    { message: "Complete your profile to get more visibility", time: "1 hour ago" },
    { message: "3 new job opportunities match your skills", time: "3 hours ago" },
    { message: "Weekly network update is available", time: "1 day ago" },
    { message: "New feature: Enhanced profile customization", time: "2 days ago" },
    { message: "Security alert: New login detected", time: "3 days ago" }
  ]);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-600">Stay updated with your latest notifications</p>
      </div>
      
      <NotificationCenter notifications={notifications} />
    </DashboardLayout>
  );
};

export default Notifications;
