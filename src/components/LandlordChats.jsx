import React, { useEffect, useState, useRef } from "react";
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

function LandlordChats({ isDarkMode }) {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [messageCounts, setMessageCounts] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyMessage, setReplyMessage] = useState("");
  const messagesEndRef = useRef(null);

  // Fetch landlord’s conversations
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "messages"),
      where("receiverId", "==", currentUser.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Group by tenant + houseId and count messages
      const grouped = {};
      msgs.forEach((msg) => {
        const key = `${msg.senderId}_${msg.houseId}`;
        if (!grouped[key]) {
          grouped[key] = {
            houseId: msg.houseId,
            tenantId: msg.senderId,
            tenantName: msg.senderName || "Tenant",
            tenantEmail: msg.senderEmail,
            lastMessage: msg.text,
            lastTime: msg.timestamp,
            messageCount: 0,
          };
        }
        grouped[key].messageCount += 1;
      });

      setConversations(Object.values(grouped));
      setMessageCounts(grouped);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch messages for selected conversation
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

      // Only msgs between this landlord and this tenant
      const filtered = msgs.filter(
        (m) =>
          (m.senderId === currentUser.uid &&
            m.receiverId === selectedChat.tenantId) ||
          (m.senderId === selectedChat.tenantId &&
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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
      senderName: currentUser.displayName || "Landlord",
      senderEmail: currentUser.email,
      receiverId: selectedChat.tenantId,
      receiverName: selectedChat.tenantName,
      timestamp: { toDate: () => new Date() }, // Temporary timestamp
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage("");

    try {
      await addDoc(collection(db, "messages"), {
        text: messageText,
        houseId: selectedChat.houseId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || "Landlord",
        senderEmail: currentUser.email,
        receiverId: selectedChat.tenantId,
        receiverName: selectedChat.tenantName,
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

  const handleReply = async (originalMessage, replyText) => {
    if (!replyText.trim() || !selectedChat) return;

    const replyMessageText = replyText.trim();

    // Optimistically add reply message to local state
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      text: replyMessageText,
      houseId: selectedChat.houseId,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || "Landlord",
      senderEmail: currentUser.email,
      receiverId: selectedChat.tenantId,
      receiverName: selectedChat.tenantName,
      timestamp: { toDate: () => new Date() }, // Temporary timestamp
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setReplyingTo(null);
    setReplyMessage("");

    try {
      await addDoc(collection(db, "messages"), {
        text: replyMessageText,
        houseId: selectedChat.houseId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || "Landlord",
        senderEmail: currentUser.email,
        receiverId: selectedChat.tenantId,
        receiverName: selectedChat.tenantName,
        timestamp: serverTimestamp(),
      });
      toast.success('Reply sent successfully');
    } catch (error) {
      console.error('Error sending reply:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      setReplyingTo(originalMessage);
      setReplyMessage(replyMessageText);
      toast.error('Failed to send reply');
    }
  };

  const handleClearConversation = () => {
    if (!selectedChat) return;

    if (window.confirm('Are you sure you want to clear this conversation? Messages will be cleared from your view only.')) {
      setMessages([]);
      setReplyingTo(null);
      setReplyMessage("");
      toast.success('Conversation cleared from your view');
    }
  };

  const handleDeleteAllConversations = async () => {
    if (!window.confirm('Are you sure you want to delete all conversations? This action cannot be undone.')) return;

    try {
      // Delete messages where landlord is receiver
      const q1 = query(collection(db, "messages"), where("receiverId", "==", currentUser.uid));
      const snapshot1 = await getDocs(q1);
      // Delete messages where landlord is sender
      const q2 = query(collection(db, "messages"), where("senderId", "==", currentUser.uid));
      const snapshot2 = await getDocs(q2);

      const deletePromises = [
        ...snapshot1.docs.map(doc => deleteDoc(doc.ref)),
        ...snapshot2.docs.map(doc => deleteDoc(doc.ref))
      ];
      await Promise.all(deletePromises);
      setConversations([]);
      setMessageCounts({});
      setMessages([]);
      setSelectedChat(null);
      toast.success('All conversations deleted successfully');
    } catch (error) {
      console.error('Error deleting conversations:', error);
      toast.error('Failed to delete conversations');
    }
  };

  // Tenant Chat Container Component
  const TenantChatContainer = ({ conversation, currentUser, isDarkMode }) => {
    const [messages, setMessages] = useState([]);
    const [localReplyingTo, setLocalReplyingTo] = useState(null);
    const [localReplyMessage, setLocalReplyMessage] = useState("");
    const [newMessageText, setNewMessageText] = useState("");

    // Fetch messages for this specific conversation
    useEffect(() => {
      const q = query(
        collection(db, "messages"),
        where("houseId", "==", conversation.houseId),
        orderBy("timestamp", "asc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Only msgs between this landlord and this tenant
        const filtered = msgs.filter(
          (m) =>
            (m.senderId === currentUser.uid &&
              m.receiverId === conversation.tenantId) ||
            (m.senderId === conversation.tenantId &&
              m.receiverId === currentUser.uid)
        );

        setMessages(filtered.sort((a, b) => {
          const aTime = a.timestamp?.toDate?.() || a.timestamp || 0;
          const bTime = b.timestamp?.toDate?.() || b.timestamp || 0;
          return aTime - bTime;
        }));
      });

      return () => unsubscribe();
    }, [conversation, currentUser]);

    const handleSendNewMessage = async (e) => {
      e.preventDefault();
      console.log('handleSendNewMessage called');
      console.log('newMessageText:', newMessageText);
      console.log('conversation:', conversation);
      console.log('currentUser:', currentUser);

      if (!newMessageText.trim()) {
        console.log('Message is empty, returning');
        return;
      }

      const messageToSend = newMessageText.trim();
      console.log('Message to send:', messageToSend);

      // Optimistically add message to local state
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        text: messageToSend,
        houseId: conversation.houseId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || "Landlord",
        senderEmail: currentUser.email,
        receiverId: conversation.tenantId,
        receiverName: conversation.tenantName,
        timestamp: { toDate: () => new Date() },
      };

      console.log('Optimistic message:', optimisticMessage);
      setMessages(prev => [...prev, optimisticMessage]);
      setNewMessageText("");

      try {
        console.log('Attempting to add document to Firestore...');
        const docRef = await addDoc(collection(db, "messages"), {
          text: messageToSend,
          houseId: conversation.houseId,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || "Landlord",
          senderEmail: currentUser.email,
          receiverId: conversation.tenantId,
          receiverName: conversation.tenantName,
          timestamp: serverTimestamp(),
        });
        console.log('Document added successfully with ID:', docRef.id);
        toast.success('Message sent successfully');
      } catch (error) {
        console.error('Error sending message:', error);
        console.error('Error details:', error.message);
        console.error('Error code:', error.code);
        // Remove optimistic message on error
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        setNewMessageText(messageToSend);
        toast.error('Failed to send message: ' + error.message);
      }
    };

    const handleLocalReply = async (originalMessage, replyText) => {
      if (!replyText.trim()) return;

      const replyMessageText = replyText.trim();

      // Optimistically add reply message to local state
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        text: replyMessageText,
        houseId: conversation.houseId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || "Landlord",
        senderEmail: currentUser.email,
        receiverId: conversation.tenantId,
        receiverName: conversation.tenantName,
        timestamp: { toDate: () => new Date() },
      };

      setMessages(prev => [...prev, optimisticMessage]);
      setLocalReplyingTo(null);
      setLocalReplyMessage("");

      try {
        await addDoc(collection(db, "messages"), {
          text: replyMessageText,
          houseId: conversation.houseId,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || "Landlord",
          senderEmail: currentUser.email,
          receiverId: conversation.tenantId,
          receiverName: conversation.tenantName,
          timestamp: serverTimestamp(),
        });
        toast.success('Reply sent successfully');
      } catch (error) {
        console.error('Error sending reply:', error);
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        setLocalReplyingTo(originalMessage);
        setLocalReplyMessage(replyMessageText);
        toast.error('Failed to send reply');
      }
    };

    const renderMessages = () => {
      if (messages.length === 0) {
        return (
          <div className="no-messages">
            <h4>No messages yet</h4>
            <p>Click on a message to reply</p>
          </div>
        );
      }

      // Group messages by date and user
      const groupedMessages = messages.reduce((groups, msg) => {
        const date = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
        const dateKey = date.toDateString();

        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(msg);
        return groups;
      }, {});

      return Object.entries(groupedMessages).map(([dateKey, msgs]) => (
        <div key={dateKey} className="message-group">
          <div className="date-separator">
            <span>{new Date(dateKey).toLocaleDateString()}</span>
          </div>

          {(() => {
            const messageGroups = [];
            let currentGroup = null;

            msgs.forEach((msg, index) => {
              const isSent = msg.senderId === currentUser.uid;
              const timestamp = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
              const timeString = timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              });

              if (!currentGroup || currentGroup.senderId !== msg.senderId) {
                currentGroup = {
                  senderId: msg.senderId,
                  senderName: msg.senderName,
                  senderEmail: msg.senderEmail,
                  isSent,
                  messages: []
                };
                messageGroups.push(currentGroup);
              }

              currentGroup.messages.push({
                ...msg,
                timeString,
                isLastInGroup: index === msgs.length - 1 || msgs[index + 1].senderId !== msg.senderId
              });
            });

            return messageGroups.map((group, groupIndex) => (
              <div
                key={`group-${groupIndex}`}
                className={`message-group-wrapper ${group.isSent ? 'sent' : 'received'}`}
              >
                <div className="message-avatar">
                  {group.senderName?.charAt(0).toUpperCase() || 'U'}
                </div>

                <div className="message-cluster">
                  <div className="message-header">
                    <span className="message-sender-name">
                      {group.isSent ? 'You' : group.senderName}
                    </span>
                    {group.senderEmail && !group.isSent && (
                      <span className="message-sender-email">({group.senderEmail})</span>
                    )}
                  </div>

                  {group.messages.map((msg, msgIndex) => (
                    <div
                      key={msg.id}
                      className={`message-bubble ${group.isSent ? 'sent' : 'received'} ${msg.isLastInGroup ? 'last' : ''}`}
                      onClick={() => !group.isSent && setLocalReplyingTo(msg)}
                    >
                      <div className="message-content">
                        <p className="message-text">{msg.text}</p>
                        <span className="message-time">{msg.timeString}</span>
                      </div>

                      {/* Inline reply input */}
                      {localReplyingTo?.id === msg.id && (
                        <div className="inline-reply">
                          <div className="reply-indicator">
                            <span>Replying to: {msg.text.substring(0, 50)}{msg.text.length > 50 ? '...' : ''}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocalReplyingTo(null);
                                setLocalReplyMessage("");
                              }}
                              className="cancel-reply"
                            >
                              ✕
                            </button>
                          </div>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleLocalReply(msg, localReplyMessage);
                            }}
                            className="reply-form"
                          >
                            <input
                              type="text"
                              value={localReplyMessage}
                              onChange={(e) => setLocalReplyMessage(e.target.value)}
                              placeholder="Type your reply..."
                              className="reply-input"
                              autoFocus
                            />
                            <button type="submit" className="reply-send-btn">
                              Reply
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      ));
    };

    return (
      <div className="tenant-chat-container">
        <div className="tenant-chat-header">
          <div className="tenant-info">
            <div className="tenant-avatar">
              {conversation.tenantName?.charAt(0).toUpperCase() || 'T'}
            </div>
            <div className="tenant-details">
              <h4>{conversation.tenantName}</h4>
              <p>House {conversation.houseId}</p>
              {conversation.tenantEmail && (
                <span className="tenant-email">{conversation.tenantEmail}</span>
              )}
            </div>
          </div>
          <div className="chat-stats">
            <span className="message-count">{conversation.messageCount} messages</span>
          </div>
        </div>

        <div className="tenant-messages-container">
          {renderMessages()}
        </div>

        {/* Message input for sending new messages */}
        <div className="tenant-message-input">
          <form onSubmit={handleSendNewMessage} className="message-form">
            <input
              type="text"
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              placeholder={`Message ${conversation.tenantName}...`}
              className="message-input"
            />
            <button type="submit" className="send-btn" disabled={!newMessageText.trim()}>
              Send
            </button>
          </form>
        </div>
      </div>
    );
  };


  return (
    <div className={`landlord-chats ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="chats-header">
        <h2>Tenant Conversations</h2>
        <p>{conversations.length} active chats</p>
        <button onClick={handleDeleteAllConversations} className="delete-all-btn">Delete All Conversations</button>
      </div>

      {conversations.length === 0 ? (
        <div className="no-conversations">
          <h3>No conversations yet</h3>
          <p>Messages from tenants will appear here</p>
        </div>
      ) : (
        <div className="tenant-chats-grid">
          {conversations.map((conversation, idx) => (
            <TenantChatContainer
              key={idx}
              conversation={conversation}
              currentUser={currentUser}
              isDarkMode={isDarkMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default LandlordChats;



