# ILGC Tracker

AI-powered campus housekeeping and hygiene compliance platform with role-aware workflows, complaint intelligence, and mobile access.

## Why This Project Stands Out

ILGC Tracker turns hygiene operations into a measurable, auditable system:
- Multi-role operations across Admin, Supervisor, Cleaning Staff, and Student/Faculty
- Building-floor-direction washroom tracking with supply visibility
- AI-assisted complaint analysis with category, priority, sentiment, and urgency signals
- Supervisor-led verification pipeline and assignment controls
- Web platform plus Android app shell for on-the-go access

## Product Snapshot

### Core Modules
- Authentication and role-based dashboards
- Complaints lifecycle with AI metadata and media evidence
- Washroom status and consumables monitoring (soap, tissue, sanitizer)
- Supervisor reminders and staff coordination
- Reporting-ready documentation (HTML + PDF)

### Role Experience
- Admin: governance, building-to-supervisor mapping, oversight dashboards
- Supervisor: building-scoped operations, complaint assignment, approvals
- Cleaning Staff: assigned task execution and updates
- Student/Faculty: complaint submission and tracking

## Architecture

### Frontend
- Single-page web app in [index.html](index.html)
- Deployment mirror in [frontend-dist/index.html](frontend-dist/index.html)

### Backend
- Node.js/Express API in [backend/server.js](backend/server.js)
- Routes in [backend/routes](backend/routes)
- Database access in [backend/database](backend/database)
- Middleware stack in [backend/middleware](backend/middleware)

### AI Service
- Python microservice in [ai-service/main.py](ai-service/main.py)
- ML and NLP logic in [ai-service/services](ai-service/services)

### Mobile
- React Native app shell in [HostelCareApp/App.js](HostelCareApp/App.js)
- Alternate mobile workspace in [mobile-src/App.js](mobile-src/App.js)
- Android artifacts for manual install under [apk-download](apk-download)

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- AI: Python, NLP/ML services
- Data: SQLite/PostgreSQL support paths
- Mobile: React Native + WebView
- DevOps: Docker Compose, Nginx

## Quick Start

### 1) Run Backend

```bash
cd backend
npm install
cp .env.example .env
npm run init-db
npm run dev
```

### 2) Run AI Service

```bash
cd ai-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### 3) Open Web App

```bash
open index.html
```

### 4) Run Mobile (Android)

```bash
cd HostelCareApp
npm install
npx react-native run-android
```

## Demo Credentials

- Admin: admin@hostel.com / password123
- Supervisor: meera@hostel.com / password123
- Cleaning Staff: rajesh@hostel.com / password123
- Student: student1@hostel.com / password123

## API Surface

Representative endpoint groups:
- /api/auth
- /api/complaints
- /api/dashboard
- /api/staff
- /api/rooms
- /api/washrooms
- /api/work-submissions
- /api/reminders
- /api/ai

## Repository Contents

- [ILGC_Tracker_Documentation.html](ILGC_Tracker_Documentation.html)
- [ILGC_Tracker_Documentation.pdf](ILGC_Tracker_Documentation.pdf)
- [docker-compose.yml](docker-compose.yml)
- [deploy.sh](deploy.sh)

## Production Notes

- Replace debug/mobile signing setup with production keystore before store release.
- Keep all .env files private.
- Do not commit local database or upload runtime files.

## License

Private project. All rights reserved.
