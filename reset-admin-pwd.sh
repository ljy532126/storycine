#!/bin/bash
# StoryCine - Reset Admin Password Script (Linux/macOS)
# Usage: sh reset-admin-pwd.sh

set -e

echo "========================================"
echo "  StoryCine - Reset Admin Password"
echo "========================================"
echo ""

# Check if Docker is running
if ! docker ps &>/dev/null; then
  echo "[ERROR] Docker is not running. Please start Docker first."
  exit 1
fi

# Get container names
MONGO_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i mongo | head -1)
APP_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i storycine-app | head -1)

if [ -z "$MONGO_CONTAINER" ]; then
  echo "[ERROR] MongoDB container not found. Is StoryCine running?"
  exit 1
fi

# Prompt for new password
read -sp "Enter new admin password: " NEW_PWD
echo ""
if [ -z "$NEW_PWD" ]; then
  echo "[ERROR] Password cannot be empty."
  exit 1
fi

read -sp "Confirm new password: " CONFIRM_PWD
echo ""
if [ "$NEW_PWD" != "$CONFIRM_PWD" ]; then
  echo "[ERROR] Passwords do not match."
  exit 1
fi

# Generate bcrypt hash using Node.js in app container (if available)
if [ -n "$APP_CONTAINER" ]; then
  HASH=$(docker exec "$APP_CONTAINER" node -e "const bcrypt=require('bcryptjs');bcrypt.hash('$NEW_PWD',12).then(h=>console.log(h))" 2>/dev/null)
fi

# Fallback: use local node if available
if [ -z "$HASH" ]; then
  if command -v node &>/dev/null; then
    HASH=$(cd "$(dirname "$0")/backend" && node -e "const bcrypt=require('bcryptjs');bcrypt.hash('$NEW_PWD',12).then(h=>console.log(h))" 2>/dev/null)
  fi
fi

if [ -z "$HASH" ]; then
  echo "[ERROR] Cannot generate password hash. Make sure bcryptjs is installed."
  echo "Alternative: Add RESET_ADMIN_PWD=true to docker-compose.yml and rebuild."
  exit 1
fi

# Update in MongoDB
docker exec "$MONGO_CONTAINER" mongosh storycine --eval "
  db.users.updateOne(
    { username: 'admin' },
    { \$set: { password: '$HASH' } }
  )
" --quiet 2>/dev/null

if [ $? -eq 0 ]; then
  echo ""
  echo "========================================"
  echo "  Password reset successfully!"
  echo "  Username: admin"
  echo "  New password: $NEW_PWD"
  echo "========================================"
else
  echo "[ERROR] Failed to update password in MongoDB."
  exit 1
fi
