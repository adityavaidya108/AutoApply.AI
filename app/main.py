from fastapi import FastAPI
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware  # 👈 1. IMPORT THIS

# Import the router from our API module
from app.api import resume

# Load environment variables from the .env file
load_dotenv()

# Create the main FastAPI application instance
app = FastAPI(
    title="AutoApply.AI API",
    description="An AI agent that rewrites your resume, finds jobs, and applies for them.",
    version="0.1.0"
)

# 👇 2. ADD THIS MIDDLEWARE BLOCK
# CORS (Cross-Origin Resource Sharing) Middleware
origins = [
    "*", # In a production app, you would restrict this to your frontend's domain
    "null" # Allow requests from `file://` origins
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the resume router. All endpoints from resume.py will now be under the main app.
app.include_router(resume.router, tags=["Resume"])

@app.get("/", tags=["Root"])
def read_root():
    """A simple root endpoint to confirm the API is running."""
    return {"message": "Welcome to the AutoApply.AI API!"}