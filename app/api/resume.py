import io
from fastapi import APIRouter, Form, UploadFile, File, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import Field

from app.schemas import ATSFriendlyResume
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
    """Receives a PDF resume and a job description, then returns an ATS-friendly and tailored resume."""
    if resume_file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    try:
        pdf_content = await resume_file.read()
        pdf_stream = io.BytesIO(pdf_content)

        resume_text = pdf_processor.extract_text(pdf_stream)
        if not resume_text:
            raise HTTPException(status_code=500, detail="Could not extract text from PDF.")

        optimized_resume_data = resume_optimizer.optimize_resume(resume_text, job_description)
        output_pdf_buffer = document_generator.generate_pdf(optimized_resume_data)
        headers = {
            "Content-Disposition": "attachment; filename=optimized_resume.pdf"
        }
        return StreamingResponse(
            output_pdf_buffer,
            media_type="application/pdf",
            headers=headers
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred during resume optimization: {str(e)}")