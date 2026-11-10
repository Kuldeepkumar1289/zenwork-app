from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # user_id -> List of active WebSocket connections
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        """Single user ko message push karne ke liye."""
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_json(message)

    async def broadcast_to_users(self, message: dict, user_ids: List[int]):
        """Specific users (e.g., manager ki team ya direct subordinates) ko push karne ke liye."""
        for uid in user_ids:
            if uid in self.active_connections:
                for connection in self.active_connections[uid]:
                    await connection.send_json(message)

    async def broadcast_all(self, message: dict):
        """Organization-wide notice ke liye sabbhi connected users ko push karein."""
        for user_id, connections in self.active_connections.items():
            for connection in connections:
                await connection.send_json(message)

# Global singleton instance
ws_manager = ConnectionManager()