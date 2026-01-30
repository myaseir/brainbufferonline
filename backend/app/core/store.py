# backend/app/core/store.py

# ✅ This file holds the "Real" memory that is shared across all files.
connected_matchmaking_users = set()
active_matches = {}
user_locks = set()