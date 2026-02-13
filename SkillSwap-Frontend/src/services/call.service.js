import API from '../APIs/api';

class CallService {
    constructor() {
        this.socket = null;
        this.callbacks = {
            onIncomingCall: null,
            onCallAccepted: null,
            onCallRejected: null,
            onCallEnded: null,
            onCallError: null,
            onSignalingMessage: null
        };
    }

    // Initialize WebSocket connection for signaling
    initializeSocket(userId) {
        if (this.socket) {
            this.socket.close();
        }

        // For now, we'll use polling. In production, use WebSocket
        this.socket = {
            connected: true,
            userId: userId
        };

        console.log('Call signaling initialized for user:', userId);
    }

    // Send signaling message
    async sendSignalingMessage(message) {
        if (!this.socket || !this.socket.connected) {
            console.error('Socket not connected');
            return;
        }

        try {
            // Send signaling data to backend
            if (message.callId) {
                await API.post(`/calls/${message.callId}/signaling`, {
                    type: message.type,
                    data: message.offer || message.answer || message.candidate
                });
            }
            
            console.log('Signaling message sent:', message);
        } catch (error) {
            console.error('Error sending signaling message:', error);
        }
    }

    // Start a call
    async startCall(chatId, recipientId, isVideoCall = true) {
        try {
            const response = await API.post('/calls/start', {
                chatId,
                recipientId,
                isVideoCall
            });

            return {
                success: true,
                data: response.data,
                message: 'Call initiated successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Failed to start call',
                status: error.response?.status
            };
        }
    }

    // Answer a call
    async answerCall(callId, accept = true) {
        try {
            const response = await API.post(`/calls/${callId}/answer`, {
                accept
            });

            return {
                success: true,
                data: response.data,
                message: accept ? 'Call accepted' : 'Call rejected'
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Failed to answer call',
                status: error.response?.status
            };
        }
    }

    // End a call
    async endCall(callId) {
        try {
            const response = await API.post(`/calls/${callId}/end`);

            return {
                success: true,
                data: response.data,
                message: 'Call ended'
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Failed to end call',
                status: error.response?.status
            };
        }
    }

    // Get active calls
    async getActiveCalls() {
        try {
            const response = await API.get('/calls/active');

            return {
                success: true,
                data: response.data.calls
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Failed to fetch active calls',
                status: error.response?.status
            };
        }
    }

    // Set callbacks
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    // Cleanup
    cleanup() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}

export default CallService;
