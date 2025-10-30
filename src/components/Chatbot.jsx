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
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize chatbot with welcome messages
  useEffect(() => {
    console.log('Chatbot mounting...');
    
    const savedConversation = localStorage.getItem('ai_chatbot_conversation');
    const savedPreferences = localStorage.getItem('ai_chatbot_preferences');
    const savedStep = localStorage.getItem('ai_chatbot_step');

    console.log('Saved conversation:', savedConversation);
    console.log('Saved preferences:', savedPreferences);
    console.log('Saved step:', savedStep);

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
          content: `Hi! I'm your AI House Finder Assistant. Let's find your perfect home!`,
          timestamp: new Date().toISOString()
        },
        {
          id: Date.now() + 1,
          type: 'bot',
          content: `First, which location are you looking for? (e.g., "Westlands", "Kilimani", "Karen")`,
          timestamp: new Date().toISOString()
        }
      ];
      setMessages(welcomeMessages);
      // Save initial messages to localStorage
      localStorage.setItem('ai_chatbot_conversation', JSON.stringify(welcomeMessages));
    }

    if (savedPreferences) {
      setUserPreferences(JSON.parse(savedPreferences));
    }

    if (savedStep) {
      setConversationStep(savedStep);
    } else {
      setConversationStep('location');
    }
  }, []);

  // Save conversation to localStorage whenever it changes
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('ai_chatbot_conversation', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('ai_chatbot_preferences', JSON.stringify(userPreferences));
  }, [userPreferences]);

  useEffect(() => {
    localStorage.setItem('ai_chatbot_step', conversationStep);
  }, [conversationStep]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Delete conversation function
  const handleDeleteConversation = () => {
    if (window.confirm('Are you sure you want to delete this entire conversation? This will also clear AI recommendations.')) {
      const welcomeMessages = [
        {
          id: Date.now(),
          type: 'bot',
          content: `Hi! I'm your AI House Finder Assistant. Let's find your perfect home!`,
          timestamp: new Date().toISOString()
        },
        {
          id: Date.now() + 1,
          type: 'bot',
          content: `First, which location are you looking for? (e.g., "Westlands", "Kilimani", "Karen")`,
          timestamp: new Date().toISOString()
        }
      ];
      
      setMessages(welcomeMessages);
      setUserPreferences({ location: null, budget: null });
      setRecommendations([]);
      setShowViewButton(false);
      setConversationStep('location');
      setInputMessage('');
      
      localStorage.setItem('ai_chatbot_conversation', JSON.stringify(welcomeMessages));
      localStorage.setItem('ai_chatbot_preferences', JSON.stringify({ location: null, budget: null }));
      localStorage.setItem('ai_chatbot_step', 'location');
      
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

  // Simple recommendation logic for now
  const getRecommendations = (location, budget) => {
    return houses
      .filter(h => h.isVacant !== false)
      .filter(h => (h.location || '').toLowerCase().includes(location.toLowerCase()))
      .filter(h => {
        const rent = Number(h.monthlyRent || h.rent || 0);
        return rent > 0 && rent >= budget * 0.8 && rent <= budget * 1.2;
      })
      .slice(0, 5);
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

      if (recs.length > 0) {
        return `Perfect! I found ${recs.length} houses in ${userPreferences.location} around ${budget.toLocaleString()} KES. Click "View AI Recommendations" to see them!`;
      } else {
        return `No houses found in ${userPreferences.location} around ${budget.toLocaleString()} KES. Try a different location or budget.`;
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
          timestamp: new Date().toISOString()
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
    <div className={`chatbot-overlay ${isDarkMode ? 'dark' : ''}`}>
      <div className={`chatbot-container ${isDarkMode ? 'dark' : ''}`}>
        <div className="chatbot-header">
          <div className="chatbot-title">
            <Bot size={24} />
            <span>AI House Finder</span>
          </div>
          <div className="chatbot-header-actions">
            <button 
              onClick={handleDeleteConversation} 
              className="delete-conversation-btn"
              title="Delete conversation"
            >
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="close-btn">
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
                <div key={message.id} className={`message ${message.type}`}>
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
          <div className="chatbot-recommendations">
            <div className="recommendations-header">
              <Sparkles size={16} />
              <span>Found {recommendations.length} Matches!</span>
            </div>
            <div className="recommendations-actions">
              <p><strong>{userPreferences.location}</strong> • Around <strong>{userPreferences.budget?.toLocaleString()} KES</strong>/month</p>
              <button onClick={handleViewRecommendations} className="view-recommendations-btn">
                <CheckCircle size={16} />
                View AI Recommended Houses
              </button>
            </div>
          </div>
        )}

        <div className="chatbot-input">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
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
            className="send-btn"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chatbot;