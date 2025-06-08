import os
import io
from pypdf import PdfReader
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

os.environ.get("OPENAI_API_KEY");

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

prompt_template = ChatPromptTemplate.from_template(
    """
    You are an expert career coach and resume writer. Your task is to rewrite the following resume to be perfectly tailored for the provided job description.

    Analyze the job description to identify the key skills, experiences, and keywords the hiring manager is looking for. Then, rewrite the resume, ensuring you integrate these keywords and align the experience with the job's requirements.

    Make the changes directly. The output should be only the full, improved resume text. Do not include any introductory phrases like "Here is the improved resume".
    ---
    **JOB DESCRIPTION:**
    {job_description}
    ---
    **ORIGINAL RESUME:**
    {resume_text}
    ---
    **IMPROVED RESUME:**
    """
)
chain = prompt_template | llm | StrOutputParser()
# --- End of unchanged section ---


def _extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Helper function to extract plain text from PDF file bytes."""
    try:
        # Create a file-like object from the bytes
        pdf_file = io.BytesIO(pdf_bytes)
        reader = PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text
    except Exception as e:
        print(f"An error occurred during PDF parsing: {e}")
        return "Error: Could not read the PDF file."


# V-- We modify this function --V
def get_improved_resume(resume_pdf_bytes: bytes, job_description: str) -> str:
    """
    Takes resume PDF bytes and a job description, then returns an AI-improved resume text.
    """
    try:
        # 1. Extract text from the PDF first
        resume_text = _extract_text_from_pdf(resume_pdf_bytes)
        if "Error:" in resume_text:
            return resume_text # Return the parsing error

        # 2. Invoke the chain with the extracted text
        return chain.invoke({
            "resume_text": resume_text,
            "job_description": job_description
        })
    except Exception as e:
        print(f"An error occurred while invoking the LangChain chain: {e}")
        return "Error: Could not process the request."
