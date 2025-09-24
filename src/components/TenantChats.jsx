import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import { toast } from 'react-hot-toast';

function TenantChats() {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  // Fetch tenant’s conversations
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "messages"),
      where("senderId", "==", currentUser.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Group by landlord + houseId
      const grouped = {};
      msgs.forEach((msg) => {
        const key = `${msg.receiverId}_${msg.houseId}`;
        if (!grouped[key]) {
          grouped[key] = {
            houseId: msg.houseId,
            landlordId: msg.receiverId,
            landlordName: msg.receiverName || "Landlord",
            lastMessage: msg.text,
            lastTime: msg.timestamp,
          };
        }
      });

      setConversations(Object.values(grouped));
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch messages for selected chat
  useEffect(() => {
    if (!selectedChat) return;

    const q = query(
      collection(db, "messages"),
      where("houseId", "==", selectedChat.houseId),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Only messages between this tenant and landlord
      const filtered = msgs.filter(
        (m) =>
          (m.senderId === currentUser.uid &&
            m.receiverId === selectedChat.landlordId) ||
          (m.senderId === selectedChat.landlordId &&
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
  }, [selectedChat, currentUser]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    const messageText = newMessage.trim();

    // Optimistically add message to local state
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      text: messageText,
      houseId: selectedChat.houseId,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || "Tenant",
      senderEmail: currentUser.email,
      receiverId: selectedChat.landlordId,
      receiverName: selectedChat.landlordName,
      timestamp: { toDate: () => new Date() }, // Temporary timestamp
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage("");

    try {
      await addDoc(collection(db, "messages"), {
        text: messageText,
        houseId: selectedChat.houseId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || "Tenant",
        senderEmail: currentUser.email,
        receiverId: selectedChat.landlordId,
        receiverName: selectedChat.landlordName,
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
    if (!selectedChat) return;

    if (window.confirm('Are you sure you want to clear this conversation? Messages will be cleared from your view only.')) {
      setMessages([]);
      toast.success('Conversation cleared from your view');
    }
  };

  return (
    <div style={{ display: "flex", gap: "1rem" }}>
      {/* Sidebar conversations */}
      <div style={{ width: "250px", borderRight: "1px solid #ccc" }}>
        <h3>Chats</h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {conversations.map((c, idx) => (
            <li
              key={idx}
              style={{
                cursor: "pointer",
                padding: "6px",
                borderBottom: "1px solid #eee",
                background:
                  selectedChat &&
                  selectedChat.landlordId === c.landlordId &&
                  selectedChat.houseId === c.houseId
                    ? "#f0f0f0"
                    : "transparent",
              }}
              onClick={() => setSelectedChat(c)}
            >
              <div>
                <strong>{c.landlordName}</strong>
              </div>
              <div style={{ fontSize: "12px", color: "#555" }}>
                House {c.houseId}
              </div>
              <div style={{ fontSize: "12px", color: "#888" }}>
                {c.lastMessage}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Chat window */}
      <div style={{ flex: 1 }}>
        {selectedChat ? (
          <div
            style={{ display: "flex", flexDirection: "column", height: "400px" }}
          >
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                border: "1px solid #ccc",
                padding: "10px",
                marginBottom: "10px",
              }}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    textAlign:
                      msg.senderId === currentUser.uid ? "right" : "left",
                    marginBottom: "8px",
                  }}
                >
                  <strong>{msg.senderName}: </strong>
                  <span style={{ color: 'blue' }}>{msg.text}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <form onSubmit={handleSend} style={{ display: "flex", gap: "6px", flex: 1 }}>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  style={{ flex: 1, padding: "8px" }}
                />
                <button type="submit">Send</button>
              </form>
              <button
                onClick={handleClearConversation}
                style={{
                  padding: "8px 12px",
                  background: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px"
                }}
                title="Clear this conversation"
              >
                Clear Chat
              </button>
            </div>
          </div>
        ) : (
          <p>Select a conversation to start chatting</p>
        )}
      </div>
    </div>
  );
}

export default TenantChats;

