// src/components/ChatModal.jsx
import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { djangoAPI } from "../services/djangoAPI";
import { X, Send } from "lucide-react";
import { toast } from 'react-hot-toast';
import "./ChatModal.css";

function ChatModal({ house, onClose, isDarkMode }) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const websocketRef = useRef(null);

  // Load initial messages from Django API
  useEffect(() => {
    if (!house || !currentUser) return;

    const loadMessages = async () => {
      try {
        setLoading(true);
        const response = await djangoAPI.getHouseMessages(house.id);
        setMessages(response.messages || []);

        // Mark messages as read
        await djangoAPI.markMessagesRead(house.id);
      } catch (error) {
        console.error('Error loading messages:', error);
        toast.error('Failed to load messages');
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [house, currentUser]);

  // WebSocket connection for real-time messaging
  useEffect(() => {
    if (!house || !currentUser) return;

    const connectWebSocket = () => {
      const token = localStorage.getItem('access_token');
      const wsUrl = `ws://localhost:8000/ws/chat/${house.id}/?token=${token}`;
      websocketRef.current = new WebSocket(wsUrl);

      websocketRef.current.onopen = () => {
        console.log('WebSocket connected for house:', house.id);
      };

      websocketRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setMessages(prevMessages => {
          // Check if message already exists (avoid duplicates)
          const exists = prevMessages.some(msg => msg.id === data.message_id);
          if (exists) {
            // If it exists but was optimistic, update it with real data
            return prevMessages.map(msg =>
              msg.id === data.message_id
                ? {
                    id: data.message_id,
                    text: data.message,
                    sender: data.sender_id,
                    sender_name: data.sender_id === currentUser.id ? 'You' : 'Landlord',
                    receiver: data.receiver_id,
                    timestamp: new Date(data.timestamp),
                    is_read: false
                  }
                : msg
            );
          }

          // Remove any optimistic messages with similar content from same sender
          const filteredMessages = prevMessages.filter(msg =>
            !(msg.isSending && msg.sender === data.sender_id && msg.text === data.message)
          );

          const newMessage = {
            id: data.message_id,
            text: data.message,
            sender: data.sender_id,
            sender_name: data.sender_id === currentUser.id ? 'You' : 'Landlord',
            receiver: data.receiver_id,
            timestamp: new Date(data.timestamp),
            is_read: false
          };

          return [...filteredMessages, newMessage].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        });
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
  }, [house, currentUser]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) return;

    const messageText = newMessage.trim();
    const tempMessageId = `temp_${Date.now()}`; // Temporary ID for optimistic update

    // Optimistically add message to UI immediately
    const optimisticMessage = {
      id: tempMessageId,
      text: messageText,
      sender: currentUser.id,
      sender_name: 'You',
      receiver: house.landlordId,
      timestamp: new Date(),
      is_read: false,
      isSending: true // Flag to show sending state
    };

    setMessages(prevMessages => [...prevMessages, optimisticMessage]);

    // Send message via WebSocket
    const messageData = {
      message: messageText,
      sender_id: currentUser.id,
      receiver_id: house.landlordId, // Django user ID of landlord
    };

    try {
      websocketRef.current.send(JSON.stringify(messageData));
      setNewMessage("");

      // Remove sending flag after a short delay (will be replaced by real message from WebSocket)
      setTimeout(() => {
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === tempMessageId ? { ...msg, isSending: false } : msg
          )
        );
      }, 1000);

    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempMessageId));
      toast.error('Failed to send message: ' + (error.message || 'Unknown error'));
    }
  };

  const handleClearConversation = () => {
    if (!house || !currentUser) return;

    if (window.confirm('Are you sure you want to clear this conversation? Messages will be cleared from your view only.')) {
      setMessages([]);
      toast.success('Conversation cleared from your view');
    }
  };

  if (!house) return null;

  return (
    <div className="chat-modal-overlay">
      <div className={`chat-modal-container ${isDarkMode ? "dark" : ""}`}>
        <div className="chat-modal-header">
          <div className="chat-modal-title">
            <h3>Chat with {house.landlordName}</h3>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleClearConversation}
              style={{
                padding: "6px 10px",
                background: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "11px"
              }}
              title="Clear this conversation"
            >
              Clear
            </button>
            <button onClick={onClose} className="close-btn">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="chat-messages">
          {loading ? (
            <div className="no-messages">
              <h4>Loading messages...</h4>
            </div>
          ) : messages.length === 0 ? (
            <div className="no-messages">
              <h4>No messages yet</h4>
              <p>Start a conversation with the landlord</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`message ${
                  msg.sender === currentUser.id ? "sent" : "received"
                } ${msg.isSending ? "sending" : ""}`}
              >
                <div className="message-avatar">
                  {msg.sender_name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="message-content">
                  <p className="message-text">{msg.text}</p>
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {msg.isSending && <span className="sending-indicator"> • Sending...</span>}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSend} className="chat-input">
          <input
            type="text"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button type="submit" className="send-btn">
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatModal;
