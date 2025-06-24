from fastapi import FastAPI
from app.api import resume
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="AutoApply.AI Backend",
    description="API for personalized AI Job Hunter & Applier",
    version="0.0.1",
)

app.include_router(resume.router, prefix="/api", tags=["Resume Optimization"])

@app.get("/")
async def root():
    return {"message": "Welcome to AutoApply.AI API. Visit /docs for API documentation."}