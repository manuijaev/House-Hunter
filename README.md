# House Hunter 

A modern, full-stack web application that connects tenants with landlords in Nairobi, Kenya. Built with React, Firebase, and AI-powered recommendations to make house hunting seamless and efficient.

## Features

### For Tenants
- **Browse Available Properties**: View all vacant houses with detailed information
- **AI-Powered Recommendations**: Get personalized house suggestions based on location and budget
- **Intelligent Chatbot**: Interactive AI assistant to help find perfect matches
- **Advanced Search**: Filter properties by location with real-time results
- **Property Details**: View multiple images, pricing, contact information, and amenities
- **Direct Communication**: Chat with landlords and initiate payments
- **Dark/Light Theme**: Toggle between themes for better user experience

### For Landlords
- **Property Management**: Add, edit, and delete property listings
- **Image Upload**: Upload multiple high-quality images for each property
- **Vacancy Management**: Mark properties as vacant or occupied
- **Analytics Dashboard**: View property statistics and performance metrics
- **Real-time Chat**: Communicate with tenants through integrated chat system
- **Message Management**: Clear individual messages or delete entire conversations
- **Conversation Overview**: View all active chats with unread indicators
- **Data Management**: Reset all data or delete account with confirmation

### Universal Features
- **Secure Authentication**: Firebase-powered login/registration system
- **Role-Based Access**: Separate dashboards for tenants and landlords
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Real-time Updates**: Live data synchronization across all users
- **Toast Notifications**: User-friendly feedback for all actions

##  Technology Stack

### Frontend
- **React 19.1.1**: Modern UI library with hooks and context
- **React Router DOM 7.8.2**: Client-side routing and navigation
- **Vite 7.1.2**: Fast build tool and development server
- **Lucide React 0.543.0**: Beautiful, customizable icons
- **React Hot Toast 2.6.0**: Elegant toast notifications

### Backend & Database
- **Firebase 12.2.1**: Complete backend solution
  - **Authentication**: User registration and login
  - **Firestore**: NoSQL database for real-time data
  - **Storage**: Image and file storage
  - **Security Rules**: Data protection and access control

### AI Integration
- **OpenAI API 5.21.0**: GPT-powered chatbot and recommendations
- **Custom AI Logic**: Fallback recommendation system
- **Natural Language Processing**: Parse user preferences from chat

### Development Tools
- **ESLint**: Code linting and quality assurance
- **Vite Plugin React**: React support for Vite
- **CSS3**: Modern styling with custom properties
- **Local Storage**: Client-side image caching and preferences

##  Project Structure

```
house-hunter/
├── public/
│   └── vite.svg                    # Vite logo
├── src/
│   ├── components/                 # Reusable UI components
│   │   ├── AddHouseModal.jsx      # Property creation/editing modal
│   │   ├── AddHouseModal.css      # Modal styling
│   │   ├── Chatbot.jsx            # AI assistant component
│   │   ├── Chatbot.css            # Chatbot styling
│   │   ├── ChatModal.jsx          # Chat modal component
│   │   ├── ChatModal.css          # Chat modal styling
│   │   ├── HouseCard.jsx          # Property display card
│   │   ├── HouseCard.css          # Card styling
│   │   ├── LandlordChats.jsx      # Landlord chat interface
│   │   ├── LandlordChats.css      # Landlord chat styling
│   │   └── TenantChats.jsx        # Tenant chat interface
│   ├── config/
│   │   └── openai.js              # OpenAI API configuration
│   ├── contexts/
│   │   └── AuthContext.jsx        # Authentication state management
│   ├── firebase/
│   │   └── config.js              # Firebase configuration
│   ├── pages/                     # Main application pages
│   │   ├── LandlordPage.jsx       # Landlord dashboard
│   │   ├── LandlordDashboard.css  # Dashboard styling
│   │   ├── LoginPage.jsx          # Authentication page
│   │   ├── LoginPage.css          # Login page styling
│   │   └── TenantPage.jsx         # Tenant dashboard
│   ├── utils/                     # Utility functions
│   │   ├── FirebaseStorage.js     # Firebase storage helpers
│   │   └── LocalStorage.js        # Local storage management
│   ├── App.jsx                    # Main application component
│   ├── App.css                    # Global application styles
│   ├── index.css                  # Base CSS styles
│   └── main.jsx                   # Application entry point
├── .env                           # Environment variables
├── .gitignore                     # Git ignore rules
├── eslint.config.js               # ESLint configuration
├── firebase.json                  # Firebase project settings
├── firestore.rules                # Firestore security rules
├── index.html                     # HTML template
├── package.json                   # Dependencies and scripts
├── storage.rules                  # Firebase storage rules
└── vite.config.js                 # Vite configuration
```

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager
- Firebase account
- OpenAI API key (optional, for enhanced AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd house-hunter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```env
   VITE_OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Firebase Setup**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication (Email/Password)
   - Create a Firestore database
   - Enable Storage
   - Update [`src/firebase/config.js`](src/firebase/config.js) with your Firebase configuration

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5173`

## Configuration

### Firebase Configuration
Update the Firebase configuration in [`src/firebase/config.js`](src/firebase/config.js):

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

### OpenAI Configuration
Set your OpenAI API key in [`src/config/openai.js`](src/config/openai.js):

```javascript
export const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY || 'your_api_key_here';
```

### Firestore Security Rules
The application uses the following Firestore rules (in [`firestore.rules`](firestore.rules)):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Houses can be read by anyone, written by authenticated users
    match /houses/{houseId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Messages can be read/written by authenticated users involved in the conversation
    match /messages/{messageId} {
      allow read, write: if request.auth != null &&
        (request.auth.uid == resource.data.senderId ||
         request.auth.uid == resource.data.receiverId);
    }
  }
}
```

## User Guide

### For Tenants

1. **Registration/Login**
   - Visit the application and select "Future Tenant"
   - Register with email, password, and personal details
   - Login to access the tenant dashboard

2. **Browse Properties**
   - View all available properties on the main dashboard
   - Use the search bar to filter by location
   - Click through property images using navigation arrows

3. **AI Recommendations**
   - Click "AI Assistant" to open the chatbot
   - Tell the AI your preferred location and budget
   - Get personalized recommendations based on your criteria
   - View highlighted recommendations on the main dashboard

4. **Property Actions**
   - View detailed property information including contact details

### For Landlords

1. **Registration/Login**
   - Select "Landlord" during registration
   - Complete the registration process
   - Access the landlord dashboard

2. **Add Properties**
   - Click "Add House" to create a new listing
   - Fill in property details (title, location, description)
   - Set pricing (monthly rent and deposit)
   - Upload multiple property images
   - Add contact information

3. **Manage Properties**
   - View all your properties in the dashboard
   - Edit property details by clicking "Edit"
   - Mark properties as vacant or occupied
   - Delete properties when no longer available

4. **Analytics**
   - Switch to the "Analytics" tab
   - View total properties, vacant, and occupied counts
   - Monitor property performance

##  Security Features

- **Firebase Authentication**: Secure user registration and login
- **Role-based Access Control**: Separate permissions for tenants and landlords
- **Data Validation**: Client and server-side input validation
- **Secure API Keys**: Environment variable protection
- **Firestore Security Rules**: Database-level access control
- **Image Storage Security**: Secure file upload and storage

##  UI/UX Features

- **Responsive Design**: Works on all device sizes
- **Dark/Light Theme**: User preference-based theming
- **Loading States**: Visual feedback during operations
- **Error Handling**: User-friendly error messages
- **Toast Notifications**: Non-intrusive success/error feedback
- **Smooth Animations**: Enhanced user experience
- **Accessibility**: Keyboard navigation and screen reader support

## 🤖 AI Features

### Chatbot Capabilities
- **Natural Language Processing**: Understands location and budget preferences
- **Contextual Conversations**: Maintains conversation state
- **Smart Recommendations**: Uses OpenAI GPT for intelligent matching
- **Fallback System**: Basic recommendation logic when AI is unavailable

### Recommendation Algorithm
- **Location Matching**: Finds properties in preferred areas
- **Budget Filtering**: Respects user's financial constraints
- **Quality Scoring**: Ranks properties based on multiple factors
- **Real-time Updates**: Recommendations update with new properties

## 📊 Database Schema

### Users Collection
```javascript
{
  id: "user_id",
  email: "user@example.com",
  userType: "tenant" | "landlord",
  firstName: "John",
  lastName: "Doe",
  phone: "+254700000000",
  location: "Nairobi",
  createdAt: "2024-01-01T00:00:00.000Z"
}
```

### Houses Collection
```javascript
{
  id: "house_id",
  title: "3 Bedroom Apartment",
  description: "Spacious apartment with modern amenities",
  location: "Westlands, Nairobi",
  monthlyRent: 50000,
  deposit: 100000,
  availableDate: "2024-02-01",
  contactPhone: "+254700000000",
  contactEmail: "landlord@example.com",
  images: [
    {
      id: "image_id",
      url: "data:image/jpeg;base64,..."
    }
  ],
  landlordId: "landlord_user_id",
  landlordName: "Jane Smith",
  isVacant: true,
  createdAt: "2024-01-01T00:00:00.000Z"
}
```

### Messages Collection
```javascript
{
  id: "message_id",
  text: "Hello, I'm interested in your property",
  houseId: "house_id",
  senderId: "tenant_user_id",
  senderName: "John Doe",
  senderEmail: "tenant@example.com",
  receiverId: "landlord_user_id",
  receiverName: "Jane Smith",
  timestamp: "2024-01-01T12:00:00.000Z"
}
```

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

### Environment Variables for Production
Set the following environment variables in your hosting platform:
- `VITE_OPENAI_API_KEY`: Your OpenAI API key

## 🧪 Testing

### Run Linting
```bash
npm run lint
```

### Preview Production Build
```bash
npm run preview
```

## 🔧 Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run lint`: Run ESLint
- `npm run preview`: Preview production build

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

##  License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email kenyaniemmanuel44@gmail.com or create an issue in the repository.

## Acknowledgments

- Firebase for backend infrastructure
- OpenAI for AI capabilities
- Lucide React for beautiful icons
- React community for excellent documentation
- Vite for fast development experience

---

**House Hunter** - Making house hunting in Nairobi simple, smart, and secure!
