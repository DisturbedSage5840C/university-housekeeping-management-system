# HostelCare - AI-Powered Hostel Management System

A comprehensive hostel management solution with AI-powered features for managing housekeeping, resident complaints, and room status tracking.

## Features

### 🔐 Role-Based Access
- **Admin**: Full system control, room management, staff assignments, analytics
- **Staff**: Task management, room status updates, quick actions
- **Resident**: Submit complaints, track status, view notifications

### 🤖 AI-Powered Features
- **Smart Complaint Analysis**: Automatic categorization and priority assessment
- **Task Optimization**: Intelligent scheduling based on location and urgency
- **Predictive Maintenance**: Forecast potential issues before they occur
- **AI Response Suggestions**: Help staff respond effectively to complaints

### 📱 Multi-Platform
- **Web Application**: Responsive design for desktop and mobile browsers
- **Android App**: Native React Native application

---

## Project Structure

```
hostel-management/
├── index.html          # Standalone web frontend
├── backend/            # Node.js API server
│   ├── server.js       # Express app entry point
│   ├── database/       # SQLite database setup
│   ├── routes/         # API route handlers
│   ├── middleware/     # Auth & error handling
│   ├── services/       # AI service integration
│   └── scripts/        # Database initialization
└── mobile/             # React Native Android app
    ├── App.js          # Main navigation & auth
    └── src/
        ├── services/   # API client
        └── screens/    # UI screens
```

---

## Quick Start

### 1. Web Frontend (Standalone)

Simply open `index.html` in a browser:

```bash
open hostel-management/index.html
```

**Demo Credentials:**
- Admin: `admin@hostel.com` / `admin123`
- Staff: `staff@hostel.com` / `staff123`
- Resident: `resident@hostel.com` / `resident123`

---

### 2. Backend Server

#### Prerequisites
- Node.js 18+
- npm

#### Installation

```bash
cd hostel-management/backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env and add your OpenAI API key (optional)
# OPENAI_API_KEY=sk-your-key-here

# Initialize database with sample data
npm run init-db

# Start development server
npm run dev

# Or for production
npm start
```

The server will run at `http://localhost:5000`

#### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | User registration |
| GET | `/api/rooms` | List rooms (by floor) |
| PUT | `/api/rooms/:id` | Update room status |
| GET | `/api/complaints` | List complaints |
| POST | `/api/complaints` | Submit new complaint |
| GET | `/api/staff/tasks` | Get staff tasks |
| POST | `/api/ai/analyze` | AI complaint analysis |
| GET | `/api/dashboard/stats` | Dashboard statistics |

---

### 3. React Native Mobile App

#### Prerequisites
- Node.js 18+
- npm or yarn
- Android Studio (with SDK & emulator)
- JDK 17+

#### Installation

```bash
cd hostel-management/mobile

# Install dependencies
npm install

# Install CocoaPods (iOS only - macOS)
# cd ios && pod install && cd ..

# Start Metro bundler
npm start

# Run on Android (in separate terminal)
npx react-native run-android

# Or run on iOS (macOS only)
# npx react-native run-ios
```

#### Update API URL

For local development, update `src/services/api.js`:

```javascript
// For Android emulator
const API_BASE_URL = 'http://10.0.2.2:5000/api';

// For iOS simulator
const API_BASE_URL = 'http://localhost:5000/api';

// For physical device (replace with your computer's IP)
const API_BASE_URL = 'http://192.168.1.x:5000/api';
```

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=your-super-secret-key-change-in-production

# OpenAI (optional - AI features will use fallback if not set)
OPENAI_API_KEY=sk-your-openai-api-key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Database Schema

The SQLite database includes:

- **users**: User accounts with roles
- **floors**: Building floor definitions
- **rooms**: Room status and assignments
- **complaints**: Resident complaints with AI analysis
- **notifications**: User notifications
- **cleaning_logs**: Cleaning history
- **ai_insights**: Cached AI analysis results

---

## AI Features Detail

### Complaint Analysis
Analyzes complaint text and returns:
- Category (plumbing, electrical, housekeeping, etc.)
- Priority (1-5 scale)
- Suggested response
- Estimated resolution time
- Pattern matching with historical data

### Task Optimization
Optimizes staff schedules based on:
- Geographic proximity of rooms
- Task urgency levels
- Staff workload balance
- Time of day patterns

### Predictive Maintenance
Forecasts issues using:
- Historical complaint patterns
- Seasonal trends
- Room age and condition
- Equipment lifecycle data

---

## Default Users (after init-db)

| Email | Password | Role |
|-------|----------|------|
| admin@hostel.com | admin123 | admin |
| staff@hostel.com | staff123 | staff |
| resident@hostel.com | resident123 | resident |

---

## Development Tips

### Testing API with curl

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hostel.com","password":"admin123"}'

# Get rooms (with token)
curl http://localhost:5000/api/rooms \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Debugging React Native

```bash
# Open React Native debugger
# Shake device or press Cmd+D (iOS) / Cmd+M (Android emulator)

# View logs
npx react-native log-android
```

---

## Troubleshooting

### Backend Issues

**"Cannot find module" errors:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Database errors:**
```bash
rm backend/database/hostel.db
npm run init-db
```

### Mobile App Issues

**Metro bundler stuck:**
```bash
npx react-native start --reset-cache
```

**Android build fails:**
```bash
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

---

## Tech Stack

### Backend
- Node.js + Express
- SQLite (better-sqlite3)
- JWT Authentication
- OpenAI GPT-4 API

### Web Frontend
- Vanilla HTML/CSS/JavaScript
- Responsive CSS Grid/Flexbox
- LocalStorage for demo mode

### Mobile
- React Native 0.73
- React Navigation
- AsyncStorage
- Axios

---

## License

MIT License - feel free to use for educational purposes.

---

## Support

For issues or questions, please create an issue in the repository.
