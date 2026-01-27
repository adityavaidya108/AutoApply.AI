import io
from fastapi import APIRouter, Form, UploadFile, File, HTTPException, Depends, status
from typing import Optional, Dict, List
from pydantic import BaseModel

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

def extract_text_from_word(file_content: bytes, filename: str) -> str:
    """
    Extract text from Word document (.doc or .docx).
    Requires python-docx library for .docx files.
    For .doc files (older format), may need additional library.
    """
    try:
        # Check if it's .docx (newer format)
        if filename.lower().endswith('.docx'):
            try:
                from docx import Document
                doc = Document(io.BytesIO(file_content))
                text_parts = []
                for paragraph in doc.paragraphs:
                    text_parts.append(paragraph.text)
                return "\n".join(text_parts)
            except ImportError:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="python-docx library is required for Word document processing. Please install it: pip install python-docx"
                )
        elif filename.lower().endswith('.doc'):
            # Older .doc format - would need python-docx2txt or similar
            # For now, raise an error suggesting conversion to .docx
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Legacy .doc format is not supported. Please convert to .docx or PDF format."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format: {filename}"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error extracting text from Word document: {str(e)}"
        )

def validate_file_type(filename: str, allowed_types: list, file_type_name: str):
    """Validate that file extension matches allowed types."""
    file_ext = filename.lower().split('.')[-1] if '.' in filename else ''
    if file_ext not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{file_type_name} must be one of: {', '.join(allowed_types)}. Got: {file_ext}"
        )

@router.post("/parse-user-documents")
async def parse_user_documents_endpoint(
    resume_file: Optional[UploadFile] = File(None),
    cover_letter_file: Optional[UploadFile] = File(None),
    qa_sheet_file: Optional[UploadFile] = File(None),
    pdf_processor: IPDFProcessor = Depends(get_pdf_processor),
    resume_optimizer: IResumeOptimizer = Depends(get_resume_optimizer)
):
    """
    Parse user documents (resume, cover letter, QA sheet) into structured JSON.
    All files are optional, but at least one must be provided.
    Supports incremental uploads - user can upload documents separately.
    """
    # Validate at least one file is provided
    if not resume_file and not cover_letter_file and not qa_sheet_file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one file must be provided (resume_file, cover_letter_file, or qa_sheet_file)"
        )
    
    result = {}
    
    try:
        # Process resume if provided
        if resume_file:
            validate_file_type(resume_file.filename, ['pdf'], "Resume")
            if resume_file.content_type != "application/pdf":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Resume file must be a PDF"
                )
            
            # Extract text from PDF
            pdf_content = await resume_file.read()
            pdf_stream = io.BytesIO(pdf_content)
            resume_text = pdf_processor.extract_text(pdf_stream)
            
            if not resume_text:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Could not extract text from resume PDF. Please ensure it's a readable PDF."
                )
            
            # Parse resume using LLM (without job description)
            parsed_resume = resume_optimizer.parse_resume(resume_text)
            result['resume'] = parsed_resume.dict() if hasattr(parsed_resume, 'dict') else parsed_resume
        
        # Process cover letter if provided
        if cover_letter_file:
            validate_file_type(
                cover_letter_file.filename,
                ['pdf', 'doc', 'docx'],
                "Cover letter"
            )
            
            file_content = await cover_letter_file.read()
            filename = cover_letter_file.filename
            
            # Extract text based on file type
            if filename.lower().endswith('.pdf'):
                pdf_stream = io.BytesIO(file_content)
                cover_letter_text = pdf_processor.extract_text(pdf_stream)
            elif filename.lower().endswith(('.doc', '.docx')):
                cover_letter_text = extract_text_from_word(file_content, filename)
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cover letter must be PDF or Word document"
                )
            
            if not cover_letter_text or not cover_letter_text.strip():
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Could not extract text from cover letter. Please ensure the file is readable."
                )
            
            # Return cover letter text (minimal processing)
            result['coverLetter'] = cover_letter_text.strip()
        
        # Process QA sheet if provided
        if qa_sheet_file:
            validate_file_type(
                qa_sheet_file.filename,
                ['pdf', 'doc', 'docx'],
                "QA sheet"
            )
            
            file_content = await qa_sheet_file.read()
            filename = qa_sheet_file.filename
            
            # Extract text based on file type
            if filename.lower().endswith('.pdf'):
                pdf_stream = io.BytesIO(file_content)
                qa_text = pdf_processor.extract_text(pdf_stream)
            elif filename.lower().endswith(('.doc', '.docx')):
                qa_text = extract_text_from_word(file_content, filename)
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="QA sheet must be PDF or Word document"
                )
            
            if not qa_text or not qa_text.strip():
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Could not extract text from QA sheet. Please ensure the file is readable."
                )
            
            # Parse QA sheet using LLM
            parsed_qa = resume_optimizer.parse_qa_sheet(qa_text)
            result['qa'] = parsed_qa
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"An unexpected error occurred in /parse-user-documents: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An internal error occurred during document parsing. Please try again. ({str(e)})"
        )


# Request/Response models for personalized answers endpoint
class PersonalizedAnswersRequest(BaseModel):
    resume_data: Optional[Dict] = None
    cover_letter_text: Optional[str] = ""
    qa_answers: Optional[Dict[str, str]] = {}
    questions: List[str]
    job_context: Optional[str] = ""


class PersonalizedAnswersResponse(BaseModel):
    answers: Dict[str, str]


@router.post("/generate-personalized-answers", response_model=PersonalizedAnswersResponse)
async def generate_personalized_answers_endpoint(
    request: PersonalizedAnswersRequest,
    resume_optimizer: IResumeOptimizer = Depends(get_resume_optimizer)
):
    """
    Generate personalized answers for job application questions using LLM.
    Takes resume data, cover letter, stored QA answers, and detected questions,
    then generates tailored answers for each question.
    """
    try:
        # Validate that questions are provided
        if not request.questions or len(request.questions) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one question must be provided"
            )
        
        # Validate that at least resume data or cover letter is provided
        if not request.resume_data and not request.cover_letter_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least resume_data or cover_letter_text must be provided"
            )
        
        # Generate personalized answers using LLM
        answers = resume_optimizer.generate_personalized_answers(
            resume_data=request.resume_data or {},
            cover_letter_text=request.cover_letter_text or "",
            qa_answers=request.qa_answers or {},
            questions=request.questions,
            job_context=request.job_context or ""
        )
        
        return PersonalizedAnswersResponse(answers=answers)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"An unexpected error occurred in /generate-personalized-answers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An internal error occurred during answer generation. Please try again. ({str(e)})"
        )
