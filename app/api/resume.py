import io
from fastapi import APIRouter, Form, UploadFile, File, HTTPException, Depends, status
from fastapi.responses import StreamingResponse

from app.schemas import ResumeSuggestions
from modules.implementations.langchain_resume_optimizer import LangChainResumeOptimizer
from modules.implementations.pypdf_processor import PyPDFProcessor
from modules.implementations.html_pdf_generator import HtmlPdfGenerator
from modules.interfaces.pdf_processor import IPDFProcessor
from modules.interfaces.resume_optimizer import IResumeOptimizer
from modules.interfaces.document_generator import IDocumentGenerator

router = APIRouter()

def get_pdf_processor() -> IPDFProcessor:
    return PyPDFProcessor()

def get_resume_optimizer() -> IResumeOptimizer:
    return LangChainResumeOptimizer()

def get_document_generator() -> IDocumentGenerator:
    """Dependency provider for document generation (HTML to PDF)."""
    return HtmlPdfGenerator(template_dir="templates")

@router.post("/optimize-resume", response_class= StreamingResponse)
async def optimize_resume_endpoint(
    resume_file: UploadFile = File(...),
    job_description: str = Form(..., description="The job description text to tailor the resume for."),
    pdf_processor: IPDFProcessor = Depends(get_pdf_processor),
    resume_optimizer: IResumeOptimizer = Depends(get_resume_optimizer),
    document_generator: IDocumentGenerator = Depends(get_document_generator)
):
    """
    Receives a PDF resume and a job description.
    Optimizes the resume content using AI and returns it as an ATS-friendly PDF file.
    """
    if resume_file.content_type != "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are supported for input.")

    try:
        # 1. Extract text from the uploaded PDF
        pdf_content = await resume_file.read()
        pdf_stream = io.BytesIO(pdf_content)
        resume_text = pdf_processor.extract_text(pdf_stream)
        if not resume_text:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not extract text from PDF. Please ensure it's a readable PDF.")

        # 2. Optimize the resume content using the AI
        optimized_resume_data = resume_optimizer.optimize_resume(resume_text, job_description)

        # 3. Generate the PDF document from the optimized structured data
        output_pdf_buffer = document_generator.generate_pdf(optimized_resume_data)

        # 4. Return the PDF file as a downloadable StreamingResponse
        headers = {
            "Content-Disposition": "attachment; filename=optimized_resume.pdf"
        }
        return StreamingResponse(
            output_pdf_buffer,
            media_type="application/pdf",
            headers=headers
        )

    except HTTPException as e:
        # Re-raise any HTTPExceptions (e.g., 400 Bad Request)
        raise e
    except Exception as e:
        # Catch any other unexpected errors and return a generic 500 Internal Server Error
        print(f"An unexpected error occurred in /optimize-resume: {e}") # Log the detailed error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An internal error occurred during resume optimization. Please try again. ({str(e)})"
        )

@router.post("/get-resume-suggestions", response_model=ResumeSuggestions)
async def get_resume_suggestions_endpoint(
    resume_file: UploadFile = File(...),
    job_description: str = Form(..., description="The job description text to tailor the resume for."),
    # Injected dependencies
    pdf_processor: IPDFProcessor = Depends(get_pdf_processor),
    resume_optimizer: IResumeOptimizer = Depends(get_resume_optimizer)
):
    """
    Receives a PDF resume and a job description.
    Generates and returns improvement suggestions for the resume as JSON.
    """
    if resume_file.content_type != "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are supported for input.")
    try:
        # 1. Extract text from the uploaded PDF
        pdf_content = await resume_file.read()
        pdf_stream = io.BytesIO(pdf_content)
        resume_text = pdf_processor.extract_text(pdf_stream)
        if not resume_text:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not extract text from PDF. Please ensure it's a readable PDF.")
        
        # 2. Get suggestions using the AI
        suggestions_result = resume_optimizer.get_suggestions(resume_text, job_description)
        return suggestions_result

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"An unexpected error occurred in /get-resume-suggestions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An internal error occurred during suggestion generation. Please try again. ({str(e)})"
        )