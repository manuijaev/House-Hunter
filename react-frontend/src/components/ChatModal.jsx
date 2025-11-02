// src/components/ChatModal.jsx
import React, { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  getDocs,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import { X, Send } from "lucide-react";
import { toast } from 'react-hot-toast';
import "./ChatModal.css";

function ChatModal({ house, onClose, isDarkMode }) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    if (!house || !currentUser) return;

    const q = query(
      collection(db, "messages"),
      where("houseId", "==", house.id),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Only messages between this tenant and this landlord
      const filtered = msgs.filter(
        (m) =>
          (m.senderId === currentUser.uid &&
            m.receiverId === house.landlordId) ||
          (m.senderId === house.landlordId &&
            m.receiverId === currentUser.uid)
      );

      setMessages(prevMessages => {
        const optimisticMessages = prevMessages.filter(msg => msg.id.startsWith('temp-'));
        const allMessages = [...filtered];

        // Keep optimistic messages that don't have real counterparts yet
        optimisticMessages.forEach(optMsg => {
          const exists = filtered.some(realMsg =>
            realMsg.text === optMsg.text &&
            realMsg.senderId === optMsg.senderId &&
            Math.abs((realMsg.timestamp?.toDate?.() || realMsg.timestamp) - (optMsg.timestamp?.toDate?.() || optMsg.timestamp)) < 5000 // Within 5 seconds
          );
          if (!exists) {
            allMessages.push(optMsg);
          }
        });


        return allMessages.sort((a, b) => {
          const aTime = a.timestamp?.toDate?.() || a.timestamp || 0;
          const bTime = b.timestamp?.toDate?.() || b.timestamp || 0;
          return aTime - bTime;
        });
      });
    });

    return () => unsubscribe();
  }, [house, currentUser]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();

    // Optimistically add message to local state
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      text: messageText,
      houseId: house.id,
      houseTitle: house.title,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || "Tenant",
      senderEmail: currentUser.email,
      receiverId: house.landlordId,
      receiverName: house.landlordName,
      timestamp: { toDate: () => new Date() }, // Temporary timestamp
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage("");

    try {
      await addDoc(collection(db, "messages"), {
        text: messageText,
        houseId: house.id,
        houseTitle: house.title,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || "Tenant",
        senderEmail: currentUser.email,
        receiverId: house.landlordId,
        receiverName: house.landlordName,
        timestamp: serverTimestamp(),
      });
      toast.success('Message sent successfully');
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      setNewMessage(messageText);
      toast.error('Failed to send message');
    }
  };

  const handleClearConversation = () => {
    if (!house || !currentUser) return;

    if (window.confirm('Are you sure you want to clear this conversation? Messages will be cleared from your view only.')) {
      setMessages([]);
      alert('Conversation cleared from your view');
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
          {messages.length === 0 ? (
            <div className="no-messages">
              <h4>No messages yet</h4>
              <p>Start a conversation with the landlord</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`message ${
                  msg.senderId === currentUser.uid ? "sent" : "received"
                }`}
              >
                <div className="message-avatar">
                  {msg.senderName?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="message-content">
                  <p className="message-text">{msg.text}</p>
                  <span className="message-time">
                    {msg.timestamp?.toDate().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
