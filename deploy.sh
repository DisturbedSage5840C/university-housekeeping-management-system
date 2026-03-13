#!/bin/bash
set -euo pipefail

# ──────────────────────────────────────────────
# ILGC Tracker - Production Deployment Script
# ──────────────────────────────────────────────

echo "🏨 ILGC Tracker - Production Deployment"
echo "═══════════════════════════════════════════"

# 1. Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required. Install it from https://docker.com"; exit 1; }
command -v docker compose >/dev/null 2>&1 || { echo "❌ Docker Compose V2 is required."; exit 1; }

# 2. Ensure .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
    
    # Generate random secrets
    JWT_SECRET=$(openssl rand -base64 48)
    JWT_REFRESH_SECRET=$(openssl rand -base64 48)
    DB_PASSWORD=$(openssl rand -base64 24)
    REDIS_PASSWORD=$(openssl rand -base64 24)
    AI_API_KEY=$(openssl rand -hex 32)
    
    # Use @ as sed delimiter to avoid conflicts with base64 characters
    sed -i.bak \
        -e "s@JWT_SECRET=.*@JWT_SECRET=$JWT_SECRET@" \
        -e "s@JWT_REFRESH_SECRET=.*@JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET@" \
        -e "s@DB_PASSWORD=.*@DB_PASSWORD=$DB_PASSWORD@" \
        -e "s@REDIS_PASSWORD=.*@REDIS_PASSWORD=$REDIS_PASSWORD@" \
        -e "s@AI_SERVICE_API_KEY=.*@AI_SERVICE_API_KEY=$AI_API_KEY@" \
        .env
    rm -f .env.bak
    
    echo "✓ .env created with random secrets"
    echo "⚠  Review .env and set CORS_ORIGIN to your domain"
fi

# 3. Create SSL cert directory (self-signed for initial setup)
if [ ! -d "certbot" ]; then
    echo "📜 Generating self-signed SSL certificates for initial setup..."
    mkdir -p certbot/conf/live/yourdomain.com
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout certbot/conf/live/yourdomain.com/privkey.pem \
        -out certbot/conf/live/yourdomain.com/fullchain.pem \
        -subj "/CN=localhost" 2>/dev/null
    echo "✓ Self-signed certificates created"
    echo "⚠  Replace with real certificates using certbot for production"
fi

# 4. Copy frontend to dist directory
echo "📦 Preparing frontend..."
mkdir -p frontend-dist
cp index.html frontend-dist/
echo "✓ Frontend prepared"

# 5. Build and start services
echo ""
echo "🐳 Building Docker containers..."
docker compose build --no-cache

echo ""
echo "🚀 Starting services..."
docker compose up -d

# 6. Wait for database
echo "⏳ Waiting for database to be ready..."
for i in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

# 7. Run migrations
echo "📊 Running database migrations..."
docker compose exec -T api node scripts/initDb.js

echo ""
echo "═══════════════════════════════════════════"
echo "✅ Deployment complete!"
echo ""
echo "Services:"
echo "  🌐 Web App:     http://localhost (or https://yourdomain.com)"
echo "  🔌 API:         http://localhost:5000"
echo "  🤖 AI Service:  http://localhost:8000"
echo "  🐘 PostgreSQL:  localhost:5432"
echo "  🔴 Redis:       localhost:6379"
echo ""
echo "Demo Credentials:"
echo "  Admin:    admin@hostel.com / password123"
echo "  Staff:    rajesh@hostel.com / password123"
echo "  Resident: student1@hostel.com / password123"
echo "═══════════════════════════════════════════"
