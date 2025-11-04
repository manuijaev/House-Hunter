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
  getDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import { toast } from 'react-hot-toast';

function LandlordChats({ isDarkMode }) {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messageCounts, setMessageCounts] = useState({});

  // Fetch landlord's conversations (by email or UID)
  useEffect(() => {
    if (!currentUser) return;

    // Query messages where landlord is receiver (by UID or email)
    const q1 = query(
      collection(db, "messages"),
      where("receiverId", "==", currentUser.uid)
    );
    
    const q2 = query(
      collection(db, "messages"),
      where("receiverEmail", "==", currentUser.email)
    );

    let unsubscribe1, unsubscribe2;
    let allMessages = [];

    const processMessages = () => {
      // Group by tenant email + houseId and count messages
      const grouped = {};
      allMessages.forEach((msg) => {
        // Only process messages from tenants (not landlord's own messages)
        if (msg.senderId === currentUser.uid || msg.senderEmail === currentUser.email) {
          return; // Skip landlord's own sent messages
        }
        
        // Use tenant email as primary key, fallback to senderId
        const tenantKey = msg.senderEmail || msg.senderId;
        const key = `${tenantKey}_${msg.houseId}`;
        
        if (!grouped[key]) {
          grouped[key] = {
            houseId: msg.houseId,
            houseTitle: msg.houseTitle || 'Unknown House',
            tenantId: msg.senderId,
            tenantName: msg.senderName || "Tenant",
            tenantEmail: msg.senderEmail || "Unknown",
            lastMessage: msg.text,
            lastTime: msg.timestamp,
            messageCount: 0,
          };
        }
        // Keep most recent message and time
        const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
        const existingTime = grouped[key].lastTime?.toDate?.() || new Date(grouped[key].lastTime);
        if (msgTime > existingTime) {
          grouped[key].lastMessage = msg.text;
          grouped[key].lastTime = msg.timestamp;
        }
        grouped[key].messageCount += 1;
      });

      // Sort conversations by most recent message time
      const sortedConversations = Object.values(grouped).sort((a, b) => {
        const aTime = a.lastTime?.toDate?.() || new Date(a.lastTime);
        const bTime = b.lastTime?.toDate?.() || new Date(b.lastTime);
        return bTime - aTime; // Most recent first
      });

      setConversations(sortedConversations);
      setMessageCounts(grouped);
    };

    unsubscribe1 = onSnapshot(q1, (snapshot) => {
      const msgs1 = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      allMessages = [...msgs1];
      processMessages();
    });

    unsubscribe2 = onSnapshot(q2, (snapshot) => {
      const msgs2 = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      // Merge with existing messages, avoiding duplicates
      const existingIds = new Set(allMessages.map(m => m.id));
      msgs2.forEach(msg => {
        if (!existingIds.has(msg.id)) {
          allMessages.push(msg);
        }
      });
      processMessages();
    });

    return () => {
      if (unsubscribe1) unsubscribe1();
      if (unsubscribe2) unsubscribe2();
    };
  }, [currentUser]);

  // Note: TenantChatContainer handles all messaging functionality

  const handleDeleteAllConversations = async () => {
    if (!window.confirm('Are you sure you want to delete all conversations? This action cannot be undone.')) return;

    try {
      // Delete messages where landlord is receiver (by UID or email)
      const q1 = query(collection(db, "messages"), where("receiverId", "==", currentUser.uid));
      const q2 = query(collection(db, "messages"), where("receiverEmail", "==", currentUser.email));
      // Delete messages where landlord is sender (by UID or email)
      const q3 = query(collection(db, "messages"), where("senderId", "==", currentUser.uid));
      const q4 = query(collection(db, "messages"), where("senderEmail", "==", currentUser.email));

      const [snapshot1, snapshot2, snapshot3, snapshot4] = await Promise.all([
        getDocs(q1),
        getDocs(q2),
        getDocs(q3),
        getDocs(q4)
      ]);

      // Collect all unique document refs to avoid duplicate deletions
      const docRefs = new Set();
      [snapshot1, snapshot2, snapshot3, snapshot4].forEach(snapshot => {
        snapshot.docs.forEach(doc => docRefs.add(doc.ref));
      });

      const deletePromises = Array.from(docRefs).map(ref => deleteDoc(ref));
      await Promise.all(deletePromises);
      setConversations([]);
      setMessageCounts({});
      toast.success('All conversations deleted successfully');
    } catch (error) {
      console.error('Error deleting conversations:', error);
      toast.error('Failed to delete conversations: ' + (error.message || 'Unknown error'));
    }
  };

  // Tenant Chat Container Component
  const TenantChatContainer = ({ conversation, currentUser, isDarkMode }) => {
    const [messages, setMessages] = useState([]);
    const [localReplyingTo, setLocalReplyingTo] = useState(null);
    const [localReplyMessage, setLocalReplyMessage] = useState("");
    const [newMessageText, setNewMessageText] = useState("");
    const [houseTitle, setHouseTitle] = useState(conversation.houseTitle);

    // Fetch house title if unknown
    useEffect(() => {
      if (houseTitle !== 'Unknown House') return;

      const fetchHouseTitle = async () => {
        try {
          const houseDoc = await getDoc(doc(db, 'houses', conversation.houseId));
          if (houseDoc.exists()) {
            setHouseTitle(houseDoc.data().title);
          }
        } catch (error) {
          console.error('Error fetching house:', error);
        }
      };
      fetchHouseTitle();
    }, [houseTitle, conversation.houseId]);

    // Fetch messages for this specific conversation
    useEffect(() => {
      // Mark messages as read when viewing this conversation
      const lastReadKey = `landlord_last_read_${currentUser.uid}`;
      localStorage.setItem(lastReadKey, new Date().toISOString());

      // Query without orderBy to avoid index requirement, sort manually
      const q = query(
        collection(db, "messages"),
        where("houseId", "==", conversation.houseId)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Only msgs between this landlord and this tenant (by email or UID)
        const tenantEmail = conversation.tenantEmail;
        const tenantId = conversation.tenantId;
        const filtered = msgs.filter(
          (m) =>
            (m.senderId === currentUser.uid &&
              (m.receiverEmail === tenantEmail || m.receiverId === tenantId || m.receiverId === tenantEmail)) ||
            ((m.senderId === tenantId || m.senderEmail === tenantEmail) &&
              (m.receiverId === currentUser.uid || m.receiverEmail === currentUser.email))
        );

        // Update last read time when messages are loaded/viewed
        if (filtered.length > 0) {
          const latestMessage = filtered[filtered.length - 1];
          const latestTime = latestMessage.timestamp?.toDate?.() || new Date(latestMessage.timestamp);
          localStorage.setItem(lastReadKey, latestTime.toISOString());
          
          // Mark all current messages in this conversation as processed to prevent toasts on refresh
          const processedKey = `landlord_processed_messages_${currentUser.uid}`;
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
      if (!newMessageText.trim()) return;

      const messageToSend = newMessageText.trim();

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

      setMessages(prev => [...prev, optimisticMessage]);
      setNewMessageText("");

      try {
        await addDoc(collection(db, "messages"), {
          text: messageToSend,
          houseId: conversation.houseId,
          houseTitle: conversation.houseTitle,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || "Landlord",
          senderEmail: currentUser.email,
          receiverId: conversation.tenantId || conversation.tenantEmail,
          receiverEmail: conversation.tenantEmail,
          receiverName: conversation.tenantName,
          timestamp: serverTimestamp(),
        });
        toast.success('Message sent successfully');
      } catch (error) {
        console.error('Error sending message:', error);
        // Remove optimistic message on error
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        setNewMessageText(messageToSend);
        toast.error('Failed to send message: ' + (error.message || 'Unknown error'));
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
        receiverId: conversation.tenantId || conversation.tenantEmail,
        receiverEmail: conversation.tenantEmail,
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
          houseTitle: conversation.houseTitle,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || "Landlord",
          senderEmail: currentUser.email,
          receiverId: conversation.tenantId || conversation.tenantEmail,
          receiverEmail: conversation.tenantEmail,
          receiverName: conversation.tenantName,
          timestamp: serverTimestamp(),
        });
        toast.success('Reply sent successfully');
      } catch (error) {
        console.error('Error sending reply:', error);
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        setLocalReplyingTo(originalMessage);
        setLocalReplyMessage(replyMessageText);
        toast.error('Failed to send reply: ' + (error.message || 'Unknown error'));
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
                    <span className={`message-sender-name ${!group.isSent ? 'tenant-badge' : ''}`}>
                      {group.isSent ? 'You' : 'Tenant'}
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
            <div className="tenant-details">
              <h4 style={{ background: '#5a6fd8', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '14px', display: 'inline-block' }}>{conversation.tenantName}</h4>
              <p>House needed: {houseTitle}</p>
              {conversation.tenantEmail && (
                <span className="tenant-email">Tenant's email:{conversation.tenantEmail}</span>
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
      <div className="chats-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Tenant Conversations</h2>
          <p>{conversations.length} active chats</p>
        </div>
        <button onClick={handleDeleteAllConversations} style={{ background: 'crimson', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s ease', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Delete All Conversations</button>
      </div>

      {conversations.length === 0 ? (
        <div className="no-conversations">
          <h3>No conversations yet</h3>
          <p>Messages from tenants will appear here</p>
        </div>
      ) : (
        <div className="tenant-chats-grid">
          {conversations.map((conversation) => {
            const uniqueKey = `${conversation.tenantEmail || conversation.tenantId}_${conversation.houseId}`;
            return (
              <TenantChatContainer
                key={uniqueKey}
                conversation={conversation}
                currentUser={currentUser}
                isDarkMode={isDarkMode}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LandlordChats;



