from pydantic import BaseModel

class ResumeResponse(BaseModel):
    """
    Defines the shape of the successful outgoing response.
    This is what our API endpoint promises to send back.
    """
    improved_resume: str