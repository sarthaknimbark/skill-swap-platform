import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PaperAirplaneIcon, ArrowLeftIcon, UserIcon, TrashIcon } from '@heroicons/react/outline';
import { Loader2 } from 'lucide-react';
import ChatService from '../../services/chat.service';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const ChatWindow = ({ chat, onBack, onChatDeleted }) => {
    const { user } = useAuth();
    const { socket, isConnected, isLoading: socketLoading, joinChat, leaveChat } = useSocket();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Helper function to ensure messages are unique
    const ensureUniqueMessages = (messages) => {
        const seen = new Set();
        return messages.filter(msg => {
            const key = `${msg._id}_${msg.content}_${msg.sender?._id}_${msg.createdAt}`;
            if (seen.has(key)) {
                console.log('Removing duplicate message:', msg);
                return false;
            }
            seen.add(key);
            return true;
        });
    };

    const fetchMessages = useCallback(async () => {
        if (!chat) return;

        setIsLoading(true);
        setError(null);
        try {
            const result = await ChatService.getChatMessages(chat._id);
            if (result.success) {
                const uniqueMessages = ensureUniqueMessages(result.data);
                setMessages(uniqueMessages);
            } else {
                setError(result.error || 'Failed to fetch messages');
            }
        } catch (err) {
            setError('Failed to fetch messages');
            console.error('Error fetching messages:', err);
        } finally {
            setIsLoading(false);
        }
    }, [chat]);

    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Socket event listeners for real-time messaging
    useEffect(() => {
        if (socketLoading) {
            console.log('Socket still loading, waiting...');
            return;
        }

        if (!socket || !chat) {
            console.log('Socket or chat not available:', { socket: !!socket, chat: !!chat, isConnected, socketLoading });
            return;
        }

        console.log('Setting up socket listeners for chat:', chat._id);
        console.log('Socket connection status:', { isConnected, socketId: socket.id });

        // Join chat room when component mounts or chat changes
        joinChat(chat._id);

        // Listen for new messages
        const handleMessageReceived = (messageData) => {
            console.log('Real-time message received:', messageData);
            
            setMessages(prev => {
                // Get the current user ID (try both _id and id)
                const currentUserId = user?._id || user?.id;
                
                // Check if this is our own message (from real-time broadcast)
                const isFromCurrentUser = String(messageData.sender?._id) === String(currentUserId);
                
                if (isFromCurrentUser) {
                    // If it's our own message, replace any optimistic message with the real one
                    const hasOptimisticMessage = prev.some(msg => 
                        msg.isOptimistic && 
                        msg.content === messageData.content && 
                        String(msg.sender?._id) === String(messageData.sender?._id)
                    );
                    
                    if (hasOptimisticMessage) {
                        console.log('Replacing optimistic message with real message from server');
                        return prev.map(msg => 
                            msg.isOptimistic && 
                            msg.content === messageData.content && 
                            String(msg.sender?._id) === String(messageData.sender?._id) 
                                ? messageData 
                                : msg
                        );
                    }
                    // If no optimistic message found, check if we already have this message
                    const messageExists = prev.some(msg => msg._id === messageData._id);
                    if (!messageExists) {
                        return [...prev, messageData];
                    }
                } else {
                    // For messages from other users, check for duplicates
                    const messageExists = prev.some(msg => 
                        msg._id === messageData._id || 
                        (msg.content === messageData.content && 
                         String(msg.sender?._id) === String(messageData.sender?._id) && 
                         Math.abs(new Date(msg.createdAt) - new Date(messageData.createdAt)) < 1000)
                    );
                    
                    console.log('Real-time message check for other user:', {
                        messageExists,
                        messageId: messageData._id,
                        content: messageData.content,
                        senderId: messageData.sender?._id
                    });
                    
                if (!messageExists) {
                    const newMessages = [...prev, messageData];
                    return ensureUniqueMessages(newMessages);
                }
            }
            
            return ensureUniqueMessages(prev);
        });
    };

        // Listen for typing indicators
        const handleUserTyping = (data) => {
            const currentUserId = user?._id || user?.id;
            if (String(data.userId) !== String(currentUserId)) {
                setTypingUsers(prev => {
                    if (!prev.find(u => u.userId === data.userId)) {
                        return [...prev, { userId: data.userId, username: data.username }];
                    }
                    return prev;
                });
            }
        };

        const handleUserStoppedTyping = (data) => {
            const currentUserId = user?._id || user?.id;
            if (String(data.userId) !== String(currentUserId)) {
                setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
            }
        };

        socket.on('message_received', handleMessageReceived);
        socket.on('user_typing', handleUserTyping);
        socket.on('user_stopped_typing', handleUserStoppedTyping);

        // Test socket connection
        socket.on('test_response', (data) => {
            console.log('Socket test response received:', data);
        });

        console.log('Socket event listeners set up');
        console.log('Testing socket emit...');
        socket.emit('test_connection', { chatId: chat._id, userId: user._id });

        // Cleanup on unmount or chat change
        return () => {
            leaveChat(chat._id);
            socket.off('message_received', handleMessageReceived);
            socket.off('user_typing', handleUserTyping);
            socket.off('user_stopped_typing', handleUserStoppedTyping);
            setTypingUsers([]);
            
            // Remove any remaining optimistic messages
            setMessages(prev => prev.filter(msg => !msg.isOptimistic));
            
            // Clear typing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [socket, chat, user, joinChat, leaveChat, socketLoading, isConnected]);

    // Cleanup typing timeout on unmount
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || isSending) return;

        const messageContent = newMessage.trim();
        setNewMessage('');
        setIsSending(true);

        // Stop typing indicator
        if (socket && isConnected) {
            socket.emit('typing_stop', { chatId: chat._id });
        }

        // Get the current user ID (try both _id and id)
        const currentUserId = user?._id || user?.id;
        
        // Create optimistic message for immediate display
        const optimisticMessage = {
            _id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.random().toString(36).substr(2, 5)}`,
            chat: chat._id,
            sender: {
                _id: currentUserId,
                username: user?.username
            },
            content: messageContent,
            type: 'text',
            createdAt: new Date().toISOString(),
            isRead: false,
            isOptimistic: true // Flag to identify optimistic messages
        };

        // Add optimistic message immediately
        setMessages(prev => [...prev, optimisticMessage]);

        try {
            const result = await ChatService.sendMessage(chat._id, messageContent);
            if (result.success) {
                // Replace optimistic message with real message from server
                setMessages(prev => prev.map(msg => 
                    msg._id === optimisticMessage._id ? {
                        ...result.data,
                        sender: {
                            _id: result.data.sender._id,
                            username: result.data.sender.username
                        }
                    } : msg
                ));
                console.log('Message sent successfully, replaced optimistic message');
            } else {
                // Remove optimistic message on failure
                setMessages(prev => prev.filter(msg => msg._id !== optimisticMessage._id));
                setError(result.error || 'Failed to send message');
                // Restore the message if sending failed
                setNewMessage(messageContent);
            }
        } catch (err) {
            // Remove optimistic message on failure
            setMessages(prev => prev.filter(msg => msg._id !== optimisticMessage._id));
            setError('Failed to send message');
            setNewMessage(messageContent);
            console.error('Error sending message:', err);
        } finally {
            setIsSending(false);
        }
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        setNewMessage(value);

        if (socket && isConnected && chat) {
            // Clear existing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            if (value.trim()) {
                // Start typing indicator
                socket.emit('typing_start', { chatId: chat._id });
                
                // Stop typing indicator after 2 seconds of inactivity
                typingTimeoutRef.current = setTimeout(() => {
                    socket.emit('typing_stop', { chatId: chat._id });
                }, 2000);
            } else {
                // Stop typing indicator if input is empty
                socket.emit('typing_stop', { chatId: chat._id });
            }
        }
    };

    const getOtherParticipant = () => {
        if (!chat?.participants || !user) return null;
        const currentUserId = user?._id || user?.id;
        return chat.participants.find(p => p._id !== currentUserId);
    };

    const formatMessageTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleDeleteChat = async () => {
        if (!chat) return;
        
        setIsDeleting(true);
        try {
            const result = await ChatService.deleteChat(chat._id);
            if (result.success) {
                // Notify parent component that chat was deleted
                if (onChatDeleted) {
                    onChatDeleted(chat._id);
                }
                // Go back to chat list
                onBack();
            } else {
                setError(result.error || 'Failed to delete chat');
            }
        } catch (err) {
            setError('Failed to delete chat');
            console.error('Error deleting chat:', err);
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const otherParticipant = getOtherParticipant();

    if (!chat) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <UserIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Select a chat to start messaging</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={onBack}
                            className="p-1 hover:bg-gray-100 rounded-lg"
                        >
                            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
                        </button>
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <UserIcon className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                            <div className="flex items-center space-x-2">
                                <h3 className="text-sm font-medium text-gray-900">
                                    {otherParticipant?.username || 'Unknown User'}
                                </h3>
                                {socketLoading ? (
                                    <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" title="Connecting..."></div>
                                ) : (
                                    <div className={`w-2 h-2 rounded-full ${
                                        isConnected ? 'bg-green-500' : 'bg-red-500'
                                    }`} title={isConnected ? 'Connected' : 'Disconnected'}></div>
                                )}
                            </div>
                            <p className="text-xs text-gray-500">Swap Request Chat</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete chat"
                    >
                        <TrashIcon className="w-5 h-5 text-gray-400 hover:text-red-600" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
            >
                {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : error ? (
                    <div className="text-center py-8">
                        <p className="text-red-600 mb-4">{error}</p>
                        <button
                            onClick={fetchMessages}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                            Try again
                        </button>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-600">No messages yet</p>
                        <p className="text-gray-500 text-sm">Start the conversation!</p>
                    </div>
                ) : (
                    <>
                        {messages.map((message, index) => {
                            // Create a unique key that combines message ID with index to prevent duplicates
                            const uniqueKey = `${message._id}_${index}_${message.isOptimistic ? 'opt' : 'real'}`;
                            
                            // Debug logging to check message structure
                            console.log('Rendering message:', {
                                messageId: message._id,
                                uniqueKey: uniqueKey,
                                isOptimistic: message.isOptimistic,
                                senderId: message.sender?._id,
                                currentUserId: user?._id,
                                currentUserString: String(user?._id),
                                senderIdString: String(message.sender?._id),
                                userObject: user,
                                userKeys: user ? Object.keys(user) : 'No user'
                            });
                            
                            // Get the current user ID (try both _id and id)
                            const currentUserId = user?._id || user?.id;
                            
                            // Try multiple ways to compare IDs
                            const isOwnMessage = String(message.sender?._id) === String(currentUserId) || 
                                                message.sender?._id === currentUserId;
                            
                            return (
                                <div
                                    key={uniqueKey}
                                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                            isOwnMessage
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 text-gray-900'
                                        }`}
                                    >
                                        <p className="text-sm">{message.content}</p>
                                        <p className={`text-xs mt-1 ${
                                            isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                                        }`}>
                                            {formatMessageTime(message.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                        
                        {/* Typing indicators */}
                        {typingUsers.length > 0 && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 text-gray-900 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
                                    <p className="text-sm text-gray-600">
                                        {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={handleInputChange}
                        placeholder="Type a message..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isSending}
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || isSending}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <PaperAirplaneIcon className="w-4 h-4" />
                        )}
                    </button>
                </form>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <TrashIcon className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">Delete Chat</h3>
                                <p className="text-sm text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-700 mb-6">
                            Are you sure you want to delete this chat? All messages will be permanently removed.
                        </p>
                        <div className="flex space-x-3">
                            <button
                                onClick={handleDeleteChat}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isDeleting ? (
                                    <div className="flex items-center justify-center space-x-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Deleting...</span>
                                    </div>
                                ) : (
                                    'Delete Chat'
                                )}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatWindow;
