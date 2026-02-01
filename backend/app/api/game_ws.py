from fastapi import APIRouter
from app.api.matchmaking import matchmaking_endpoint
from app.api.gameplay import game_websocket_endpoint

router = APIRouter()

# Register the routes from the split files
router.add_api_websocket_route("/ws/matchmaking", matchmaking_endpoint)
router.add_api_websocket_route("/ws/match/{match_id}", game_websocket_endpoint)