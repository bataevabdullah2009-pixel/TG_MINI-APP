#!/bin/bash

# Quick setup script for development

echo "🚀 TelebiznezHub Setup"
echo "====================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo ""
echo "🔧 Generating Prisma client..."
npm run db:generate

# Run migrations
echo ""
echo "🗄️  Running database migrations..."
npm run db:push

# Seed database
echo ""
echo "🌱 Seeding database with demo data..."
npm run db:seed

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Update .env with your database URL if needed"
echo "2. Run: npm run dev"
echo "3. Open http://localhost:3000"
echo ""
echo "📝 Admin Panel: http://localhost:3000/admin"
echo "   Email: admin@example.com"
echo "   Password: admin123"
