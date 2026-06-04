#!/bin/bash
# ============================================================
# WEDS - Supabase Database Setup Script
# ============================================================
# This script creates all required tables in your Supabase project.
# 
# PREREQUISITE: You need your database password from:
# https://supabase.com/dashboard/project/omiexeswwdqffivxlhel/settings/database
#
# USAGE: 
#   chmod +x setup-supabase.sh
#   ./setup-supabase.sh YOUR_DATABASE_PASSWORD
# ============================================================

DB_PASSWORD="${1:?Usage: $0 <database_password>}"
PROJECT_REF="omiexeswwdqffivxlhel"
POOLER_HOST="aws-0-eu-west-3.pooler.supabase.com"
DB_USER="postgres.${PROJECT_REF}"
DB_NAME="postgres"

echo "=== WEDS Supabase Database Setup ==="
echo "Project: ${PROJECT_REF}"
echo "Connecting via pooler: ${POOLER_HOST}:6543"
echo ""

# Check if psql is available
if command -v psql &> /dev/null; then
    echo "Using psql..."
    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${POOLER_HOST}" \
        -p 6543 \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -f "$(dirname "$0")/supabase-schema.sql"
elif command -v bun &> /dev/null; then
    echo "Using bun + postgres package..."
    bun run "$(dirname "$0")/scripts/setup-db.ts" "${DB_PASSWORD}"
else
    echo "ERROR: Neither psql nor bun is available."
    echo "Please run the SQL manually in the Supabase Dashboard:"
    echo "https://supabase.com/dashboard/project/${PROJECT_REF}/sql"
    exit 1
fi

echo ""
echo "=== Setup Complete! ==="
echo "Now seed the database by calling:"
echo "  curl -X POST https://your-vercel-app.vercel.app/api/seed"
