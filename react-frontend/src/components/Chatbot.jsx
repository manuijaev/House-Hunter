// src/components/Chatbot.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Send,
  X,
  Bot,
  User,
  Sparkles,
  CheckCircle,
  Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { OPENAI_API_KEY } from '../config/openai';
import { useAuth } from '../contexts/AuthContext';
import './Chatbot.css';

function Chatbot({ houses = [], onClose, isDarkMode, onViewRecommendations }) {
  const {
    currentUser,
    userPreferences: globalPreferences,
    updateUserPreferences,
    updateUserRecommendations,
    userRecommendations
  } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userPreferences, setUserPreferences] = useState({ location: null, budget: null });
  const [recommendations, setRecommendations] = useState([]);
  const [showViewButton, setShowViewButton] = useState(false);
  const [conversationStep, setConversationStep] = useState('location');
  const [isRecommendationsActive, setIsRecommendationsActive] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Create user-specific localStorage keys
  const getUserKey = (baseKey) => {
    const userId = currentUser?.id || 'guest';
    return `${baseKey}_${userId}`;
  };

  // Initialize chatbot with welcome messages
  useEffect(() => {
    console.log('Chatbot initializing for user:', currentUser?.id || 'guest');

    const savedConversation = localStorage.getItem(getUserKey('ai_chatbot_conversation'));
    const savedPreferences = localStorage.getItem(getUserKey('ai_chatbot_preferences'));
    const savedStep = localStorage.getItem(getUserKey('ai_chatbot_step'));
    const savedRecommendations = localStorage.getItem(getUserKey('ai_chatbot_recommendations'));

    console.log('Saved conversation:', savedConversation);
    console.log('Saved preferences:', savedPreferences);
    console.log('Saved step:', savedStep);
    console.log('Saved recommendations:', savedRecommendations);

    if (savedConversation && JSON.parse(savedConversation).length > 0) {
      // Use saved conversation
      setMessages(JSON.parse(savedConversation));
    } else {
      // Initialize with welcome messages
      console.log('Initializing with welcome messages');
      const welcomeMessages = [
        {
          id: Date.now(),
          type: 'bot',
          content: `Hello! I'm your AI House Finder Assistant.`,
          timestamp: new Date().toISOString()
        },
        {
          id: Date.now() + 1,
          type: 'bot',
          content: `I can help you find the perfect rental property. Just tell me:
• Your preferred location (e.g., "Westlands", "Kilimani", "Karen")
• Your monthly budget (e.g., "25000" or "25k")

Let's start by telling me which area you're interested in!`,
          timestamp: new Date().toISOString()
        }
      ];
      setMessages(welcomeMessages);
      // Save initial messages to localStorage
      localStorage.setItem(getUserKey('ai_chatbot_conversation'), JSON.stringify(welcomeMessages));
    }

    if (savedPreferences) {
      setUserPreferences(JSON.parse(savedPreferences));
    }

    if (savedStep) {
      setConversationStep(savedStep);
    } else {
      setConversationStep('location');
    }

    if (savedRecommendations) {
      const recs = JSON.parse(savedRecommendations);
      setRecommendations(recs);
      setShowViewButton(recs.length > 0);
      setIsRecommendationsActive(recs.length > 0);
      // Update context to sync
      updateUserRecommendations(recs).catch(() => {});
    }
  }, [currentUser?.id]); // Re-run when user changes

  // Save conversation to localStorage whenever it changes
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(getUserKey('ai_chatbot_conversation'), JSON.stringify(messages));
    }
  }, [messages, currentUser?.id]);

  useEffect(() => {
    localStorage.setItem(getUserKey('ai_chatbot_preferences'), JSON.stringify(userPreferences));
  }, [userPreferences, currentUser?.id]);

  useEffect(() => {
    localStorage.setItem(getUserKey('ai_chatbot_step'), conversationStep);
  }, [conversationStep, currentUser?.id]);

  useEffect(() => {
    localStorage.setItem(getUserKey('ai_chatbot_recommendations'), JSON.stringify(recommendations));
  }, [recommendations, currentUser?.id]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Dynamic updates for recommendations
  useEffect(() => {
    if (userRecommendations.length > 0 && !showViewButton) {
      setIsRecommendationsActive(true);
      setShowViewButton(true);
      
      // Add a dynamic update message
      const updateMessage = {
        id: Date.now(),
        type: 'bot',
        content: ` I've updated your recommendations! I now have ${userRecommendations.length} AI-suggested properties based on your preferences.`,
        timestamp: new Date().toISOString(),
        isAIResponse: true
      };
      
      setMessages(prev => [...prev, updateMessage]);
    }
  }, [userRecommendations, showViewButton]);


  // Monitor house changes for dynamic updates
  useEffect(() => {
    if (recommendations.length > 0 && houses.length > 0) {
      // Check for new matching houses
      const location = userPreferences.location;
      const budget = userPreferences.budget;
      
      if (location && budget) {
        const updatedRecs = getRecommendations(location, budget);
        
        if (updatedRecs.length !== recommendations.length) {
          setRecommendations(updatedRecs);
          setIsRecommendationsActive(true);

          // Update context
          updateUserRecommendations(updatedRecs).catch(() => {});

          // Notify user of changes
          const changeMessage = {
            id: Date.now(),
            type: 'bot',
            content: `📈 Dynamic update: I found ${updatedRecs.length} matching properties for you in ${location} around ${budget.toLocaleString('en-KE')} KES!`,
            timestamp: new Date().toISOString(),
            isAIResponse: true
          };

          setMessages(prev => [...prev, changeMessage]);
        }
      }
    }
  }, [houses, userPreferences, recommendations]);

  // Delete conversation function
  const handleDeleteConversation = () => {
    if (window.confirm('Are you sure you want to delete this entire conversation? This will also clear AI recommendations.')) {
      const welcomeMessages = [
        {
          id: Date.now(),
          type: 'bot',
          content: `👋 Hello! I'm your AI House Finder Assistant.`,
          timestamp: new Date().toISOString()
        },
        {
          id: Date.now() + 1,
          type: 'bot',
          content: `I can help you find the perfect rental property. Just tell me:
• Your preferred location (e.g., "Westlands", "Kilimani", "Karen")
• Your monthly budget (e.g., "25000" or "25k")

Let's start by telling me which area you're interested in!`,
          timestamp: new Date().toISOString()
        }
      ];
      
      setMessages(welcomeMessages);
      setUserPreferences({ location: null, budget: null });
      setRecommendations([]);
      setShowViewButton(false);
      setIsRecommendationsActive(false);
      setConversationStep('location');
      setInputMessage('');
      
      localStorage.setItem(getUserKey('ai_chatbot_conversation'), JSON.stringify(welcomeMessages));
      localStorage.setItem(getUserKey('ai_chatbot_preferences'), JSON.stringify({ location: null, budget: null }));
      localStorage.setItem(getUserKey('ai_chatbot_step'), 'location');
      localStorage.removeItem(getUserKey('ai_chatbot_recommendations'));

      updateUserRecommendations([]).catch(() => {});
      
      toast.success('Conversation and AI recommendations cleared');
    }
  };

  // Simple location parsing
  const parseLocation = (message) => {
    if (!message) return null;
    return message.trim();
  };

  // Budget parsing
  const parseBudget = (message) => {
    if (!message) return null;
    const lower = message.toLowerCase();

    const kMatch = lower.match(/(\d+(?:\.\d+)?)\s*k/);
    if (kMatch) {
      const val = parseFloat(kMatch[1]);
      return Math.round(val * 1000);
    }

    const digitsMatch = lower.match(/(\d{1,3}(?:[,\d{3}]*)?)/);
    if (digitsMatch) {
      const cleaned = digitsMatch[0].replace(/[, ]/g, '');
      const n = parseInt(cleaned, 10);
      if (!isNaN(n)) return n;
    }

    const anyDigits = lower.match(/(\d{3,})/);
    if (anyDigits) return parseInt(anyDigits[0].replace(/[, ]/g, ''), 10);

    return null;
  };

  // Enhanced recommendation logic with 24-hour new house consideration
  const getRecommendations = (location, budget) => {
    console.log('🔍 AI SEARCH DEBUG:');
    console.log('Location:', location);
    console.log('Budget:', budget);
    console.log('Total houses available:', houses.length);

    const isHouseNew = (house) => {
      if (!house.created_at && !house.createdAt) return false;
      try {
        const createdAt = new Date(house.created_at || house.createdAt);
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        return createdAt > twentyFourHoursAgo;
      } catch (error) {
        console.error('Error parsing house creation date:', error);
        return false;
      }
    };

    // Improved location matching - check if search terms are in location or vice versa
    const matchesLocation = (houseLocation, searchLocation) => {
      if (!houseLocation || !searchLocation) return false;

      const house = houseLocation.toLowerCase();
      const search = searchLocation.toLowerCase();

      // Check if search term is in house location
      if (house.includes(search)) return true;

      // Check if house location contains any word from search
      const searchWords = search.split(/\s+/);
      return searchWords.some(word => word.length > 2 && house.includes(word));
    };

    // Start with all houses
    let filteredHouses = houses;
    console.log('Initial houses:', filteredHouses.length);

    // Filter by approval status only (remove vacancy check)
    filteredHouses = filteredHouses.filter(h => {
      const approved = h.approval_status === 'approved';
      console.log(`House ${h.id}: approved=${approved}, location="${h.location}", rent=${h.monthlyRent || h.monthly_rent || h.rent}`);
      return approved;
    });
    console.log('After approval/vacancy filter:', filteredHouses.length);

    // Filter by location
    filteredHouses = filteredHouses.filter(h => {
      const matches = matchesLocation(h.location, location);
      if (!matches) {
        console.log(`House ${h.id} location "${h.location}" doesn't match search "${location}"`);
      }
      return matches;
    });
    console.log('After location filter:', filteredHouses.length);

    // Filter by budget
    filteredHouses = filteredHouses.filter(h => {
      const rent = Number(h.monthlyRent || h.monthly_rent || h.rent || 0);
      const inRange = rent >= budget * 0.5 && rent <= budget * 2.0;
      if (!inRange) {
        console.log(`House ${h.id} rent ${rent} not in range ${budget * 0.5} - ${budget * 2.0}`);
      }
      return rent > 0 && inRange;
    });
    console.log('After budget filter:', filteredHouses.length);

    return filteredHouses
      .sort((a, b) => {
        // Prioritize new houses (within 24 hours)
        const aIsNew = isHouseNew(a);
        const bIsNew = isHouseNew(b);

        if (aIsNew && !bIsNew) return -1;
        if (!aIsNew && bIsNew) return 1;

        // Then sort by how well the rent matches the budget (closer is better)
        const aRent = Number(a.monthlyRent || a.monthly_rent || a.rent || 0);
        const bRent = Number(b.monthlyRent || b.monthly_rent || b.rent || 0);
        const aDiff = Math.abs(aRent - budget);
        const bDiff = Math.abs(bRent - budget);

        if (aDiff !== bDiff) return aDiff - bDiff;

        // Then sort by creation date (newest first)
        const aDate = new Date(a.created_at || a.createdAt || 0);
        const bDate = new Date(b.created_at || b.createdAt || 0);
        return bDate - aDate;
      })
      .slice(0, 8); // Show more recommendations for better AI experience
  };

  // Handle conversation flow
  const handleConversationFlow = async (userMessage) => {
    const lower = userMessage.toLowerCase();

    if (lower.includes('start over') || lower.includes('reset')) {
      handleDeleteConversation();
      return '';
    }

    // Check for budget first
    const budget = parseBudget(userMessage);
    if (budget && userPreferences.location) {
      const newPrefs = { ...userPreferences, budget };
      setUserPreferences(newPrefs);
      setConversationStep('complete');
      
      const recs = getRecommendations(userPreferences.location, budget);
      setRecommendations(recs);
      setShowViewButton(recs.length > 0);
      setIsRecommendationsActive(recs.length > 0);

      // Update context
      updateUserRecommendations(recs).catch(() => {});

      if (recs.length > 0) {
        return `Perfect! I found ${recs.length} houses in ${userPreferences.location} around ${budget.toLocaleString('en-KE')} KES. Click "View AI Recommendations" to see them!`;
      } else {
        return `No houses found in ${userPreferences.location} around ${budget.toLocaleString('en-KE')} KES. Try a different location or budget.`;
      }
    }

    // Check for location
    const location = parseLocation(userMessage);
    if (location && !budget) {
      const newPrefs = { location, budget: null };
      setUserPreferences(newPrefs);
      setConversationStep('budget');
      setRecommendations([]);
      setShowViewButton(false);
      
      return `Great! You want to live in ${location}. Now, what's your monthly budget in KES? (e.g., 25000 or 25k)`;
    }

    // Handle based on current step
    if (conversationStep === 'location') {
      return `Which area are you interested in? (e.g., Westlands, Kilimani, Karen)`;
    }

    if (conversationStep === 'budget') {
      return `What's your monthly budget for ${userPreferences.location} in KES? (e.g., 25000 or 25k)`;
    }

    return `I can help you find houses! Tell me a location or budget, or say "start over" to begin fresh.`;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Add user message immediately
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Get AI response
    setTimeout(async () => {
      const botResponse = await handleConversationFlow(inputMessage.trim());
      
      if (botResponse) {
        const botMessage = {
          id: Date.now() + 1,
          type: 'bot',
          content: botResponse,
          timestamp: new Date().toISOString(),
          isAIResponse: true
        };
        setMessages(prev => [...prev, botMessage]);
      }
      
      setIsTyping(false);
      inputRef.current?.focus();
    }, 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleViewRecommendations = () => {
    if (recommendations.length > 0 && onViewRecommendations) {
      onViewRecommendations(recommendations, userPreferences);
      onClose();
      toast.success(`Showing ${recommendations.length} AI recommended houses!`);
    }
  };

  return (
    <div className={`chatbot-overlay dynamic-theme ${isDarkMode ? 'dark' : ''}`}>
      <div className={`chatbot-container dynamic-card glass-effect ${isRecommendationsActive ? 'has-recommendations' : ''} ${isDarkMode ? 'dark' : ''}`}>
        <div className="chatbot-header">
          <div className="chatbot-title">
            <div className="chatbot-avatar">
              <Bot size={24} />
              <div className={`status-indicator ${isRecommendationsActive ? 'active' : ''}`}></div>
              {isRecommendationsActive && (
                <div className="pulse-ring"></div>
              )}
            </div>
            <div className="chatbot-title-text">
              <span className="chatbot-name">AI House Finder</span>
              <span className="chatbot-subtitle">
                {isRecommendationsActive
                  ? `Found ${recommendations.length} matches`
                  : conversationStep === 'complete'
                    ? 'Ready to find your perfect home'
                    : 'Let\'s find your perfect home'}
              </span>
            </div>
          </div>
          <div className="chatbot-header-actions">
            <div className={`recommendation-pulse ${isRecommendationsActive ? 'pulsing' : ''}`}>
              <Sparkles size={16} />
            </div>
            <button
              onClick={handleDeleteConversation}
              className="delete-conversation-btn dynamic-btn icon-btn"
              title="Delete conversation"
            >
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="close-btn dynamic-btn icon-btn"
              title="Close chatbot">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="chatbot-messages">
          {messages.length === 0 ? (
            <div className="loading-messages">Loading conversation...</div>
          ) : (
            <>
              {messages.map(message => (
                <div key={message.id} className={`message ${message.type} ${message.isAIResponse ? 'ai-response' : ''}`}>
                  <div className="message-avatar">
                    {message.type === 'bot' ? <Bot size={20} /> : <User size={20} />}
                  </div>
                  <div className="message-content">
                    <div className="message-text">{message.content}</div>
                    <div className="message-time">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {isTyping && (
            <div className="message bot">
              <div className="message-avatar"><Bot size={20} /></div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {showViewButton && recommendations.length > 0 && (
          <div className="chatbot-recommendations glass-effect">
            <div className="recommendations-header">
              <Sparkles size={16} className="sparkle-animation" />
              <span className="recommendations-title">Found {recommendations.length} AI Matches!</span>
              <div className={`recommendation-status ${isRecommendationsActive ? 'active' : 'inactive'}`}>
                {isRecommendationsActive ? 'Live Results' : 'Processing...'}
              </div>
            </div>
            <div className="recommendations-content">
              <div className="preferences-summary">
                <div className="preference-item">
                  <span className="preference-label">Location:</span>
                  <span className="preference-value">{userPreferences.location}</span>
                </div>
                <div className="preference-item">
                  <span className="preference-label">Budget:</span>
                  <span className="preference-value">Up to {userPreferences.budget?.toLocaleString('en-KE')} KES/month</span>
                </div>
              </div>
              <div className="recommendations-actions">
                <button
                  onClick={handleViewRecommendations}
                  className="view-recommendations-btn dynamic-btn accent-btn"
                >
                  <CheckCircle size={16} />
                  <span>View AI Recommended Houses</span>
                  <Sparkles size={14} className="btn-sparkle" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="chatbot-input">
          <div className="input-container">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="chatbot-input-field dynamic-input"
              placeholder={
                conversationStep === 'location' ? "Enter your preferred location..." :
                conversationStep === 'budget' ? "Enter your monthly budget..." :
                "Ask about locations or budgets..."
              }
              disabled={isTyping}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className="send-btn dynamic-btn accent-btn"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chatbot;