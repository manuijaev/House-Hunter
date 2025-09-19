import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Send,
  X,
  Bot,
  User,
  Home,
  MapPin,
  DollarSign,
  Sparkles,
  CheckCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { OPENAI_API_KEY } from '../config/openai';
import './Chatbot.css';

function Chatbot({ houses, onClose, isDarkMode, onViewRecommendations }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationState, setConversationState] = useState('welcome');
  const [userPreferences, setUserPreferences] = useState({
    location: null,
    budget: null
  });
  const [recommendations, setRecommendations] = useState([]);
  const [showViewButton, setShowViewButton] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize conversation
  useEffect(() => {
    const welcomeMessage = {
      id: Date.now(),
      type: 'bot',
      content: `Hi! I'm your AI House Finder Assistant!

I can help you find the perfect home in Nairobi. To get started, I need to know:

1. **Where** would you like to live? (e.g., "Westlands", "Kilimani", "Karen")
2. **What's your budget**? (monthly rent in KES)

Just tell me your preferences and I'll find the best matches for you!`,
      timestamp: new Date().toISOString()
    };
    setMessages([welcomeMessage]);
    setConversationState('waiting_for_input');
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Parse location from user input
  const parseLocation = (message) => {
    const lowerMessage = message.toLowerCase();

    // Common Nairobi locations
    const locations = [
      'westlands', 'kilimani', 'karen', 'parklands', 'cbd', 'central business district',
      'langata', 'lavington', 'koinange street', 'river road', 'umoja', 'south c',
      'pipeline', 'kangemi', 'hurligham', 'ngong', 'thika road', 'mombasa road',
      'nairobi west', 'nairobi east', 'westland'
    ];

    for (const location of locations) {
      if (lowerMessage.includes(location)) {
        return location.charAt(0).toUpperCase() + location.slice(1);
      }
    }

    return null;
  };

  // Parse budget from user input
  const parseBudget = (message) => {
    const budgetPatterns = [
      /(\d{1,3}(?:,\d{3})*)\s*(?:kes|ksh|shillings?|per month|pm|rent)?/gi,
      /(?:budget|under|below|max|maximum|up to)\s*(\d{1,3}(?:,\d{3})*)/gi,
      /(\d{1,3}(?:,\d{3})*)\s*(?:k|thousand)/gi
    ];

    for (const pattern of budgetPatterns) {
      const match = message.match(pattern);
      if (match) {
        const extracted = match[0].replace(/[^\d]/g, '');
        if (extracted) {
          let budget = parseInt(extracted);
          if (message.toLowerCase().includes('k') || message.toLowerCase().includes('thousand')) {
            budget *= 1000;
          }
          return budget;
        }
      }
    }
    return null;
  };

  // Get AI recommendations using OpenAI
  const getAIRecommendations = async (location, budget) => {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your_openai_api_key_here') {
      // Fallback to basic filtering if no API key
      return getBasicRecommendations(location, budget);
    }

    try {
      const houseData = houses
        .filter(house => house.isVacant !== false)
        .map(house => ({
          id: house.id,
          title: house.title || 'No title',
          location: house.location || 'Unknown',
          monthlyRent: house.monthlyRent || 0,
          description: house.description || 'No description available',
          amenities: house.amenities || []
        }));

      const prompt = `You are an expert real estate AI assistant specializing in Nairobi, Kenya. A tenant wants houses in "${location}" with a budget of ${budget.toLocaleString()} KES per month.

Available houses data:
${JSON.stringify(houseData, null, 2)}

Please analyze these houses and recommend the top 5 best matches based on:
1. Location match (houses in or very close to "${location}")
2. Price fit (houses at or below ${budget} KES)
3. Property quality and appeal

Return your response as a JSON array of house IDs in order of recommendation (best first). Only include houses that are truly suitable. If no houses match well, return an empty array.

Example response: ["house_id_1", "house_id_2", "house_id_3"]

Be strict: only recommend houses that are actually in "${location}" or immediately adjacent areas, and within the ${budget} KES budget.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful real estate assistant. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('No response from OpenAI');
      }

      const recommendedIds = JSON.parse(aiResponse);
      const recommendedHouses = recommendedIds
        .map(id => houses.find(h => h.id === id))
        .filter(Boolean)
        .slice(0, 5);

      return recommendedHouses;

    } catch (error) {
      console.error('AI recommendation error:', error);
      return getBasicRecommendations(location, budget);
    }
  };

  // Basic recommendation fallback
  const getBasicRecommendations = (location, budget) => {
    return houses
      .filter(house => {
        const locationMatch = !location ||
          house.location?.toLowerCase().includes(location.toLowerCase()) ||
          location.toLowerCase().includes(house.location?.toLowerCase() || '');
        const budgetMatch = !budget || (house.monthlyRent && house.monthlyRent <= budget);
        const vacancyMatch = house.isVacant !== false;
        return locationMatch && budgetMatch && vacancyMatch;
      })
      .sort((a, b) => (a.monthlyRent || 0) - (b.monthlyRent || 0))
      .slice(0, 5);
  };

  // Handle conversation flow
  const handleConversationFlow = async (userMessage) => {
    const lowerMessage = userMessage.toLowerCase();

    // Handle commands
    if (lowerMessage.includes('change location') || lowerMessage.includes('new location')) {
      setUserPreferences(prev => ({ ...prev, location: null }));
      setConversationState('waiting_for_location');
      setShowViewButton(false);
      return `Got it! What location are you interested in? (e.g., "Westlands", "Kilimani", "Karen")`;
    }

    if (lowerMessage.includes('change budget') || lowerMessage.includes('new budget')) {
      setUserPreferences(prev => ({ ...prev, budget: null }));
      setConversationState('waiting_for_budget');
      setShowViewButton(false);
      return `No problem! What's your monthly budget in KES? (e.g., "25000" or "25k")`;
    }

    if (lowerMessage.includes('start over') || lowerMessage.includes('reset')) {
      setUserPreferences({ location: null, budget: null });
      setConversationState('waiting_for_input');
      setRecommendations([]);
      setShowViewButton(false);
      return `Let's start fresh! Where would you like to live and what's your budget?`;
    }

    // Parse location and budget from message
    const location = parseLocation(userMessage);
    const budget = parseBudget(userMessage);

    // Handle based on current state and parsed input
    if (!userPreferences.location && location) {
      setUserPreferences(prev => ({ ...prev, location }));

      if (!userPreferences.budget && budget) {
        // Both location and budget provided
        setUserPreferences(prev => ({ ...prev, budget }));
        setConversationState('processing');
        const recs = await getAIRecommendations(location, budget);
        setRecommendations(recs);
        setShowViewButton(true);

        if (recs.length > 0) {
          return `Perfect! I found ${recs.length} great houses in ${location} within your budget of ${budget.toLocaleString()} KES. Click "View Recommendations" below to see them highlighted on your dashboard!`;
        } else {
          return `I couldn't find any houses in ${location} within ${budget.toLocaleString()} KES. Try adjusting your location or increasing your budget.`;
        }
      } else if (!userPreferences.budget) {
        // Only location provided, ask for budget
        setConversationState('waiting_for_budget');
        return `Great choice! ${location} is a wonderful area. Now, what's your monthly budget in KES? (e.g., "25000" or "25k")`;
      }
    }

    if (!userPreferences.budget && budget) {
      setUserPreferences(prev => ({ ...prev, budget }));

      if (!userPreferences.location) {
        // Only budget provided, ask for location
        setConversationState('waiting_for_location');
        return `Thanks! I can work with a budget of ${budget.toLocaleString()} KES. Which location are you interested in? (e.g., "Westlands", "Kilimani", "Karen")`;
      } else {
        // Location already set, process recommendations
        setConversationState('processing');
        const recs = await getAIRecommendations(userPreferences.location, budget);
        setRecommendations(recs);
        setShowViewButton(true);

        if (recs.length > 0) {
          return `Excellent! I found ${recs.length} perfect matches in ${userPreferences.location} for ${budget.toLocaleString()} KES per month. Click "View Recommendations" to see them!`;
        } else {
          return `I couldn't find houses in ${userPreferences.location} within ${budget.toLocaleString()} KES. Would you like to try a different location or adjust your budget?`;
        }
      }
    }

    // If we have both preferences, user might want to search again
    if (userPreferences.location && userPreferences.budget) {
      const newRecs = await getAIRecommendations(userPreferences.location, userPreferences.budget);
      setRecommendations(newRecs);
      setShowViewButton(true);

      if (newRecs.length > 0) {
        return `I refreshed your recommendations! Found ${newRecs.length} great options in ${userPreferences.location} for ${userPreferences.budget.toLocaleString()} KES. Click "View Recommendations" to see them.`;
      } else {
        return `Still no matches found. Try changing your location or budget preferences.`;
      }
    }

    // Default responses based on missing information
    if (!userPreferences.location) {
      return `I'd love to help you find a home! Which area of Nairobi are you interested in? (e.g., "Westlands", "Kilimani", "Karen", "Parklands")`;
    }

    if (!userPreferences.budget) {
      return `What's your monthly budget for rent in KES? (e.g., "25000" or "25k")`;
    }

    return `How can I help you find your perfect home? You can say "change location", "change budget", or "start over".`;
  };

  // Handle sending message
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate typing delay
    setTimeout(async () => {
      const botResponse = await handleConversationFlow(inputMessage.trim());
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: botResponse,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, botMessage]);
      setIsTyping(false);

      // Focus input after bot responds
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }, 1000 + Math.random() * 1000);
  };

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle view recommendations
  const handleViewRecommendations = () => {
    if (recommendations.length > 0 && onViewRecommendations) {
      onViewRecommendations(recommendations, userPreferences);
      onClose();
      toast.success(`Found ${recommendations.length} AI recommendations for you!`, {
        duration: 4000
      });
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
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="chatbot-messages">
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

          {isTyping && (
            <div className="message bot">
              <div className="message-avatar">
                <Bot size={20} />
              </div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
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
              <span>Found {recommendations.length} Perfect Matches!</span>
            </div>
            <div className="recommendations-actions">
              <p>{userPreferences.location} • Up to {userPreferences.budget?.toLocaleString()} KES/month</p>
              <button
                onClick={handleViewRecommendations}
                className="view-recommendations-btn"
              >
                <CheckCircle size={16} />
                View AI Recommendations
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
            placeholder="Tell me your location and budget..."
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