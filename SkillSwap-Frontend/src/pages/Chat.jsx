import React from 'react';
import DashboardLayout from '../components/Layout/DashboardLayout';
import Chat from '../components/Chat/Chat';

const ChatPage = () => {
    return (
        <DashboardLayout>
            <div className="h-screen">
                <Chat />
            </div>
        </DashboardLayout>
    );
};

export default ChatPage;
