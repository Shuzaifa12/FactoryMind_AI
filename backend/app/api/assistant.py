from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.ai_agent_service import process_assistant_query

router = APIRouter(prefix="/assistant", tags=["assistant"])


class AssistantQueryRequest(BaseModel):
    prompt: str = Field(..., description="User prompt or investigation request")
    dataset_id: int | None = Field(None, description="Active dataset ID to scope all tool calls")
    language: str = Field("en", description="Response language ('en' or 'ur')")


@router.post("/chat")
def assistant_chat(
    req: AssistantQueryRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Execute tool-grounded AI agent investigation for the active dataset.
    """
    ds_id = req.dataset_id if req.dataset_id is not None else 1
    return process_assistant_query(db, ds_id, req.prompt, req.language)
