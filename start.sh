#!/bin/bash

echo "🚀 Starting Tell app..."
echo ""

# Start Redis
echo "📦 Starting Redis..."
make redis > /dev/null 2>&1
sleep 1

# Start API in background
echo "🔌 Starting FastAPI backend..."
(cd backend && ../.venv/bin/uvicorn app.main:app --reload --port 8000) &
sleep 2

# Start Web in background
echo "🌐 Starting Next.js frontend..."
(cd frontend && npm run dev) &
sleep 2

echo ""
echo "✅ All services running!"
echo ""
echo "Open in browser:"
echo "  http://localhost:3000"
echo ""
echo "URLs:"
echo "  Frontend:    http://localhost:3000"
echo "  Backend:     http://localhost:8000/docs"
echo "  RedisInsight: http://localhost:8001"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait indefinitely
wait
