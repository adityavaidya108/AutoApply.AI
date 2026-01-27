from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api import resume, jobs, user_data
from dotenv import load_dotenv


load_dotenv()

app = FastAPI(
    title="AutoApply.AI Backend",
    description="API for personalized AI Job Hunter & Applier",
    version="0.0.1",
)

# Allow requests from the Chrome extension and local dev origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^chrome-extension://[a-z0-9]+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(resume.router, prefix="/api", tags=["Resume Optimization"])
app.include_router(jobs.router, prefix="/api", tags=["Job Search"])
app.include_router(user_data.router, prefix="/api", tags=["User Data"])

@app.get("/")
async def root():
    return {"message": "Welcome to AutoApply.AI API. Visit /docs for API documentation."}