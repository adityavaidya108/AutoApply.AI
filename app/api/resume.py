import io
from fastapi import APIRouter, Form, UploadFile, File, HTTPException, Depends
from pydantic import Field
from app.schemas import ATSFriendlyResume
from modules.implementations.langchain_resume_optimizer import LangChainResumeOptimizer
from modules.implementations.pypdf_processor import PyPDFProcessor
from modules.interfaces.pdf_processor import IPDFProcessor
from modules.interfaces.resume_optimizer import IResumeOptimizer

router = APIRouter()

def get_pdf_processor() -> IPDFProcessor:
    return PyPDFProcessor()

def get_resume_optimizer() -> IResumeOptimizer:
    return LangChainResumeOptimizer()

@router.post("/optimize-resume", response_model= ATSFriendlyResume)
async def optimize_resume_endpoint(
    resume_file: UploadFile = File(...),
    job_description: str = Form(..., description="The job description text to tailor the resume for."),
    pdf_processor: IPDFProcessor = Depends(get_pdf_processor),
    resume_optimizer: IResumeOptimizer = Depends(get_resume_optimizer)
):
    """Receives a PDF resume and a job description, then returns an ATS-friendly and tailored resume."""
    if resume_file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    try:
        pdf_content = await resume_file.read()
        pdf_stream = io.BytesIO(pdf_content)

        resume_text = pdf_processor.extract_text(pdf_stream)
        if not resume_text:
            raise HTTPException(status_code=500, detail="Could not extract text from PDF.")

        optimized_resume = resume_optimizer.optimize_resume(resume_text, job_description)

        return optimized_resume
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred during resume optimization: {str(e)}")