"""
Pydantic DTOs for the communication REST API.
"""

from datetime import datetime

from pydantic import BaseModel


class ChatMessageResponse(BaseModel):
    id: int
    user_id: str
    username: str
    content: str
    created_at: datetime
