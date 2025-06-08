from fastapi import APIRouter, HTTPException, UploadFile, File, Form

# We no longer need ResumeRequest, but we do need ResumeResponse
from app.schemas import ResumeResponse
# The function import remains the same
from modules.resume_improver import get_improved_resume

router = APIRouter()

# V-- We modify this endpoint significantly --V
@router.post("/improve-resume", response_model=ResumeResponse)
async def improve_resume_endpoint(
    resume_file: UploadFile = File(..., description="The user's resume in PDF format."),
    job_description: str = Form(..., description="The job description text.")
):
    """
    API endpoint to receive a resume PDF and job description, then return an improved version.
    """
    # FastAPI's UploadFile has a .read() method which returns bytes
    resume_pdf_bytes = await resume_file.read()

    # Check if the uploaded file is actually a PDF
    if resume_file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF.")

    try:
        improved_text = get_improved_resume(
            resume_pdf_bytes=resume_pdf_bytes,
            job_description=job_description
        )

        if "Error:" in improved_text:
            raise HTTPException(status_code=500, detail=improved_text)

        return ResumeResponse(improved_resume=improved_text)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")