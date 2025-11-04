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

  // Fetch tenant's conversations (both sent and received)
  useEffect(() => {
    if (!currentUser) return;

    // Query for messages where tenant is sender
    const sentQuery = query(
      collection(db, "messages"),
      where("senderId", "==", currentUser.uid),
      orderBy("timestamp", "desc")
    );

    // Query for messages where tenant is receiver
    const receivedQuery = query(
      collection(db, "messages"),
      where("receiverId", "==", currentUser.uid),
      orderBy("timestamp", "desc")
    );

    let sentMessages = [];
    let receivedMessages = [];

    const updateConversations = () => {
      // Combine both sent and received messages
      const allMsgs = [...sentMessages, ...receivedMessages];

      // Group by landlord email + houseId
      const grouped = {};
      allMsgs.forEach((msg) => {
        // Determine the landlord (the other party) - use email if available
        const landlordId = msg.senderId === currentUser.uid ? msg.receiverId : msg.senderId;
        const landlordEmail = msg.senderId === currentUser.uid ? msg.receiverEmail : msg.senderEmail;
        const landlordName = msg.senderId === currentUser.uid ? msg.receiverName : msg.senderName;
        const key = `${landlordEmail || landlordId}_${msg.houseId}`;
        
        // Keep the most recent message for each conversation
        const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
        const existingTime = grouped[key]?.lastTime 
          ? (grouped[key].lastTime.toDate?.() || new Date(grouped[key].lastTime))
          : null;
        
        if (!grouped[key] || (existingTime && msgTime > existingTime)) {
          grouped[key] = {
            houseId: msg.houseId,
            landlordId: landlordId,
            landlordEmail: landlordEmail,
            landlordName: landlordName || "Landlord",
            lastMessage: msg.text,
            lastTime: msg.timestamp,
          };
        }
      });

      setConversations(Object.values(grouped));
    };

    const unsubscribeSent = onSnapshot(sentQuery, (snapshot) => {
      sentMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      updateConversations();
    });

    const unsubscribeReceived = onSnapshot(receivedQuery, (snapshot) => {
      receivedMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      updateConversations();
    });

    return () => {
      unsubscribeSent();
      unsubscribeReceived();
    };
  }, [currentUser]);

  // Fetch messages for selected chat
  useEffect(() => {
    if (!selectedChat) return;

    // Mark messages as read when viewing this chat
    const lastReadKey = `tenant_last_read_${currentUser.uid}_${selectedChat.houseId}`;
    localStorage.setItem(lastReadKey, new Date().toISOString());

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

      // Only messages between this tenant and landlord (by email or ID)
      const landlordEmail = selectedChat.landlordEmail;
      const landlordId = selectedChat.landlordId;
      const filtered = msgs.filter(
        (m) =>
          (m.senderId === currentUser.uid &&
            (m.receiverEmail === landlordEmail || m.receiverId === landlordId || m.receiverId === landlordEmail)) ||
          ((m.senderId === landlordId || m.senderEmail === landlordEmail) &&
            m.receiverId === currentUser.uid)
      );

      // Update last read time when messages are loaded/viewed
      if (filtered.length > 0) {
        const latestMessage = filtered[filtered.length - 1];
        const latestTime = latestMessage.timestamp?.toDate?.() || new Date(latestMessage.timestamp);
        localStorage.setItem(lastReadKey, latestTime.toISOString());
        
        // Mark all current messages in this conversation as processed to prevent toasts on refresh
        const processedKey = `tenant_processed_messages_${currentUser.uid}`;
        try {
          const stored = localStorage.getItem(processedKey);
          const processedIds = stored ? new Set(JSON.parse(stored)) : new Set();
          filtered.forEach(msg => {
            if (msg.senderId !== currentUser.uid) {
              processedIds.add(msg.id);
            }
          });
          const idsArray = Array.from(processedIds).slice(-1000);
          localStorage.setItem(processedKey, JSON.stringify(idsArray));
        } catch (error) {
          console.warn('Failed to update processed message IDs:', error);
        }
      }

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
      receiverId: selectedChat.landlordId || selectedChat.landlordEmail,
      receiverEmail: selectedChat.landlordEmail,
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
        receiverId: selectedChat.landlordId || selectedChat.landlordEmail,
        receiverEmail: selectedChat.landlordEmail,
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

