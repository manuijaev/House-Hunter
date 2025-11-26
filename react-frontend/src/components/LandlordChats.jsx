import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { djangoAPI } from "../services/djangoAPI";
import { ArrowLeft, Send, MessageCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import './LandlordChats.css';

function LandlordChats({ isDarkMode }) {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const websocketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      if (!currentUser?.id) return;

      try {
        setLoading(true);
        // Get all houses for this landlord
        const houses = await djangoAPI.getLandlordHouses(currentUser.id.toString());

        // For each house, get messages and group by tenant
        const conversationsMap = new Map();

        for (const house of houses) {
          try {
            const response = await djangoAPI.getHouseMessages(house.id);
            const houseMessages = response.messages || [];

            // Group messages by the other user (not the landlord)
            houseMessages.forEach(message => {
              // Determine the other user (the one who is not the landlord)
              const otherUserId = message.sender === currentUser.id ? message.receiver : message.sender;
              const key = `${otherUserId}_${house.id}`;

              if (!conversationsMap.has(key)) {
                conversationsMap.set(key, {
                  id: key,
                  houseId: house.id,
                  houseTitle: house.title || 'Unknown House',
                  tenantId: otherUserId,
                  tenantName: `Tenant ${otherUserId}`, // Could be enhanced to get user name
                  lastMessage: message.text,
                  lastTime: message.timestamp,
                  messageCount: 0,
                  unreadCount: 0,
                  messages: []
                });
              }

              const conversation = conversationsMap.get(key);
              conversation.messages.push(message);
              conversation.messageCount += 1;

              // Update last message if this is more recent
              const msgTime = new Date(message.timestamp);
              const lastTime = new Date(conversation.lastTime);
              if (msgTime > lastTime) {
                conversation.lastMessage = message.text;
                conversation.lastTime = message.timestamp;
              }

              // Check if message is unread (only if receiver is landlord)
              if (message.receiver === currentUser.id && !message.is_read) {
                conversation.unreadCount += 1;
              }
            });
          } catch (error) {
            console.warn(`Failed to fetch messages for house ${house.id}:`, error);
          }
        }

        // Convert to array and sort by most recent
        const conversationsArray = Array.from(conversationsMap.values()).sort((a, b) => {
          return new Date(b.lastTime) - new Date(a.lastTime);
        });

        // Show toast notifications for unread messages on dashboard load
        const totalUnreadCount = conversationsArray.reduce((total, conv) => total + conv.unreadCount, 0);
        if (totalUnreadCount > 0) {
          setTimeout(() => {
            toast.success(`You have ${totalUnreadCount} unread message${totalUnreadCount > 1 ? 's' : ''}`, {
              duration: 5000,
              style: {
                background: isDarkMode ? '#1a1a1a' : '#ffffff',
                color: isDarkMode ? '#ffffff' : '#1a1a1a',
                border: `1px solid ${isDarkMode ? '#333333' : '#e5e7eb'}`,
                borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
              fontSize: '14px',
              fontWeight: '500',
              padding: '12px 16px',
            },
            iconTheme: {
              primary: '#f59e0b',
              secondary: '#ffffff',
            },
          });
        }, 1000); // Small delay to ensure component is fully loaded
      }

        setConversations(conversationsArray);
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();

    // Refresh conversations every 30 seconds
    const interval = setInterval(fetchConversations, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // WebSocket connection for selected conversation
  useEffect(() => {
    if (!selectedConversation || !currentUser) return;

    const connectWebSocket = () => {
      const token = localStorage.getItem('access_token');
      const wsUrl = `ws://localhost:8000/ws/chat/${selectedConversation.houseId}/?token=${token}`;

      websocketRef.current = new WebSocket(wsUrl);

      websocketRef.current.onopen = () => {
        console.log('WebSocket connected for house:', selectedConversation.houseId);
      };

      websocketRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Only process messages for this user
        if (data.receiver_id === currentUser.id) {
          // Prevent duplicate toasts using localStorage
          const toastKey = `toast_${data.message_id}`;
          if (localStorage.getItem(toastKey)) return;
          localStorage.setItem(toastKey, 'shown');

          // Clean up old toast keys after 30 seconds
          setTimeout(() => {
            localStorage.removeItem(toastKey);
          }, 30000);

          // Find the conversation to get the tenant name
          const conversation = conversations.find(conv =>
            conv.tenantId === data.sender_id && conv.houseId === parseInt(data.house_id || selectedConversation?.houseId)
          );
          const senderName = conversation ? conversation.tenantName : 'Tenant';

          // Show toast notification for new messages from tenants
          toast.success(`New message from ${senderName}`, {
            duration: 4000,
            style: {
              background: isDarkMode ? '#1a1a1a' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#1a1a1a',
              border: `1px solid ${isDarkMode ? '#333333' : '#e5e7eb'}`,
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
              fontSize: '14px',
              fontWeight: '500',
              padding: '12px 16px',
            },
            iconTheme: {
              primary: '#8b5cf6',
              secondary: '#ffffff',
            },
          });
        }

        // Only add message to UI if it's for the current conversation and involves the current user
        if ((data.sender_id === currentUser.id || data.receiver_id === currentUser.id) &&
            selectedConversation &&
            (data.sender_id === selectedConversation.tenantId || data.receiver_id === selectedConversation.tenantId)) {
          setMessages(prev => {
            // Avoid duplicates
            const exists = prev.some(msg => msg.id === data.message_id);
            if (exists) return prev;

            const newMessage = {
              id: data.message_id,
              text: data.message,
              sender: data.sender_id,
              receiver: data.receiver_id,
              timestamp: data.timestamp,
              is_read: false
            };
            return [...prev, newMessage].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          });
        }
      };

      websocketRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        // Attempt to reconnect after a delay
        setTimeout(connectWebSocket, 3000);
      };

      websocketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    connectWebSocket();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [selectedConversation, currentUser]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      setMessages(selectedConversation.messages || []);
      // Mark messages as read
      djangoAPI.markMessagesRead(selectedConversation.houseId).catch(console.warn);
    }
  }, [selectedConversation]);

  // Poll for new messages in selected conversation
  useEffect(() => {
    if (!selectedConversation) return;

    const pollMessages = async () => {
      try {
        const response = await djangoAPI.getHouseMessages(selectedConversation.houseId);
        const newMessages = response.messages || [];

        // Check for new messages
        const existingIds = new Set(messages.map(m => m.id));
        const newIncomingMessages = newMessages.filter(m => !existingIds.has(m.id) && m.sender !== currentUser.id);

        if (newIncomingMessages.length > 0) {
          // Add new messages to state
          setMessages(prev => {
            const combined = [...prev, ...newIncomingMessages];
            return combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          });

          // Show toast for new messages
          newIncomingMessages.forEach(message => {
            const toastKey = `toast_${message.id}`;
            if (!localStorage.getItem(toastKey)) {
              localStorage.setItem(toastKey, 'shown');
              setTimeout(() => localStorage.removeItem(toastKey), 30000);

              toast.success(`New message from ${selectedConversation.tenantName}`, {
                duration: 4000,
                style: {
                  background: isDarkMode ? '#1a1a1a' : '#ffffff',
                  color: isDarkMode ? '#ffffff' : '#1a1a1a',
                  border: `1px solid ${isDarkMode ? '#333333' : '#e5e7eb'}`,
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                  fontSize: '14px',
                  fontWeight: '500',
                  padding: '12px 16px',
                },
                iconTheme: {
                  primary: '#8b5cf6',
                  secondary: '#ffffff',
                },
              });
            }
          });
        }
      } catch (error) {
        console.warn('Error polling messages:', error);
      }
    };

    // Poll every 5 seconds
    const interval = setInterval(pollMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedConversation, messages, currentUser, isDarkMode]);

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setShowMobileChat(true);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    const messageText = newMessage.trim();
    const messageData = {
      message: messageText,
      sender_id: currentUser.id,
      receiver_id: selectedConversation.tenantId,
    };

    try {
      // Create the message object for local state
      const newMessageObj = {
        id: Date.now(), // Temporary ID until WebSocket echoes back
        text: messageText,
        sender: currentUser.id,
        receiver: selectedConversation.tenantId,
        timestamp: new Date().toISOString(),
        is_read: false
      };

      // Add message to local state immediately
      setMessages(prev => [...prev, newMessageObj].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));

      // Try WebSocket first if available
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify(messageData));
      } else {
        // Fallback to HTTP
        const response = await djangoAPI.sendChatMessage(messageText, selectedConversation.tenantId, selectedConversation.houseId);
        // Update the temporary ID with the real one from server
        if (response.message_id) {
          setMessages(prev => prev.map(msg =>
            msg.id === newMessageObj.id ? { ...msg, id: response.message_id } : msg
          ));
        }
      }

      setNewMessage("");

      // Show success toast for sent message
      toast.success('Message sent successfully', {
        duration: 2000,
        style: {
          background: isDarkMode ? '#1a1a1a' : '#ffffff',
          color: isDarkMode ? '#ffffff' : '#1a1a1a',
          border: `1px solid ${isDarkMode ? '#333333' : '#e5e7eb'}`,
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          fontSize: '14px',
          fontWeight: '500',
          padding: '12px 16px',
        },
        iconTheme: {
          primary: '#10b981',
          secondary: '#ffffff',
        },
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message', {
        duration: 3000,
        style: {
          background: isDarkMode ? '#1a1a1a' : '#ffffff',
          color: isDarkMode ? '#ffffff' : '#1a1a1a',
          border: `1px solid ${isDarkMode ? '#333333' : '#e5e7eb'}`,
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          fontSize: '14px',
          fontWeight: '500',
          padding: '12px 16px',
        },
      });
    }
  };

  const handleDeleteConversation = async (conversation) => {
    if (!window.confirm(`Are you sure you want to delete the conversation with ${conversation.tenantName}? This action cannot be undone.`)) {
      return;
    }

    try {
      // Call API to delete conversation
      await djangoAPI.deleteConversation(conversation.houseId, conversation.tenantId);

      // Remove from local state
      setConversations(prev => prev.filter(conv => conv.id !== conversation.id));

      // If this conversation was selected, close it
      if (selectedConversation?.id === conversation.id) {
        setSelectedConversation(null);
        setShowMobileChat(false);
      }

      toast.success('Conversation deleted successfully', {
        duration: 3000,
        style: {
          background: isDarkMode ? '#1a1a1a' : '#ffffff',
          color: isDarkMode ? '#ffffff' : '#1a1a1a',
          border: `1px solid ${isDarkMode ? '#333333' : '#e5e7eb'}`,
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          fontSize: '14px',
          fontWeight: '500',
          padding: '12px 16px',
        },
        iconTheme: {
          primary: '#10b981',
          secondary: '#ffffff',
        },
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation', {
        duration: 3000,
        style: {
          background: isDarkMode ? '#1a1a1a' : '#ffffff',
          color: isDarkMode ? '#ffffff' : '#1a1a1a',
          border: `1px solid ${isDarkMode ? '#333333' : '#e5e7eb'}`,
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          fontSize: '14px',
          fontWeight: '500',
          padding: '12px 16px',
        },
      });
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'now'; // Less than 1 minute
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`; // Minutes
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Today
    if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' }); // This week
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }); // Older
  };

  const truncateMessage = (text, maxLength = 50) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (loading) {
    return (
      <div className={`landlord-chats ${isDarkMode ? 'dark' : 'light'}`}>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`landlord-chats ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="chats-header">
        <h2>Messages</h2>
        <p>Chat with tenants about your properties</p>
      </div>

      <div className="chat-container">
        {/* Conversations List - Left Panel */}
        <div className={`conversations-panel ${showMobileChat ? 'mobile-hidden' : ''}`}>
          <div className="conversations-header">
            <MessageCircle size={20} />
            <span>Conversations ({conversations.length})</span>
          </div>

          <div className="conversations-list">
            {conversations.length === 0 ? (
              <div className="no-conversations">
                <MessageCircle size={48} />
                <h4>No conversations yet</h4>
                <p>Tenants will appear here when they message you about your properties.</p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`conversation-item ${selectedConversation?.id === conversation.id ? 'active' : ''}`}
                  onClick={() => handleSelectConversation(conversation)}
                >
                  <div className="conversation-avatar">
                    {conversation.tenantName.charAt(0).toUpperCase()}
                  </div>

                  <div className="conversation-content">
                    <div className="conversation-header">
                      <span className="tenant-name">{conversation.tenantName}</span>
                      <span className="timestamp">{formatTime(conversation.lastTime)}</span>
                    </div>

                    <div className="house-title">{conversation.houseTitle}</div>

                    <div className="last-message">
                      {truncateMessage(conversation.lastMessage)}
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    className="conversation-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conversation);
                    }}
                    title="Delete conversation"
                  >
                    <Trash2 size={16} />
                  </button>

                  {conversation.unreadCount > 0 && (
                    <div className="unread-badge">
                      {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Panel - Right Panel */}
        <div className={`chat-panel ${showMobileChat ? 'mobile-visible' : ''}`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                <button
                  className="back-button mobile-only"
                  onClick={() => setShowMobileChat(false)}
                >
                  <ArrowLeft size={20} />
                </button>

                <div className="chat-avatar">
                  {selectedConversation.tenantName.charAt(0).toUpperCase()}
                </div>

                <div className="chat-info">
                  <h4>{selectedConversation.tenantName}</h4>
                  <p>{selectedConversation.houseTitle}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="messages-container">
                {messages.length === 0 ? (
                  <div className="no-messages">
                    <MessageCircle size={48} />
                    <h4>No messages yet</h4>
                    <p>Start a conversation with this tenant.</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    console.log("MESSAGE:", message.text);
                    const cleanText = message.text.replace(/[\n\r\t\f\v\u00AD\u200B\u200C\u200D\uFEFF]/g, ' ').trim();
                    return (
                      <div
                        key={message.id}
                        className={`message ${message.sender === currentUser.id ? 'sent' : 'received'}`}
                      >
                        <div className="message-content">
                          <p>{cleanText}</p>
                          <span className="message-time">
                            {new Date(message.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form className="message-input" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="message-field"
                />
                <button
                  type="submit"
                  className="send-button"
                  disabled={!newMessage.trim()}
                >
                  <Send size={20} />
                </button>
              </form>
            </>
          ) : (
            <div className="no-chat-selected">
              <MessageCircle size={64} />
              <h3>Select a conversation</h3>
              <p>Choose a tenant from the list to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LandlordChats;
