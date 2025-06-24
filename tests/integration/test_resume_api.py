from fastapi.testclient import TestClient
from app.main import app
import io
import pytest

client = TestClient(app)

# Helper to create a dummy PDF for testing
def create_dummy_pdf_bytes(text_content="Dummy resume content for integration test."):
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    p.drawString(100, 750, text_content)
    p.save()
    buffer.seek(0)
    return buffer.getvalue()

def test_optimize_resume_success():
    dummy_pdf_bytes = create_dummy_pdf_bytes("My skills include Python, FastAPI, and AI.")
    job_desc = "We need a Python developer with FastAPI and AI experience."

    files = {"resume_file": ("resume.pdf", dummy_pdf_bytes, "application/pdf")}
    data = {"job_description": job_desc}

    # Make a POST request to your API endpoint
    response = client.post("/api/optimize-resume/", files=files, data=data)

    assert response.status_code == 200
    data = response.json()

    # Basic assertions that the response structure matches ATSFriendlyResume
    assert "full_name" in data
    assert "summary" in data
    assert "experience" in data
    assert isinstance(data["experience"], list)
    assert "skills" in data
    assert isinstance(data["skills"], list)

    # More specific assertions based on expected LLM behavior (might be less precise)
    assert "python" in data["summary"].lower() or any("python" in s.lower() for s in data["skills"])
    assert "fastapi" in data["summary"].lower() or any("fastapi" in s.lower() for s in data["skills"])


def test_optimize_resume_invalid_file_type():
    dummy_txt_bytes = b"This is not a PDF."
    job_desc = "Some job."

    files = {"resume_file": ("resume.txt", dummy_txt_bytes, "text/plain")}
    data = {"job_description": job_desc}

    response = client.post("/api/optimize-resume/", files=files, data=data)
    assert response.status_code == 400
    assert "Only PDF files are supported." in response.json()["detail"]

def test_optimize_resume_no_job_description():
    dummy_pdf_bytes = create_dummy_pdf_bytes()
    files = {"resume_file": ("resume.pdf", dummy_pdf_bytes, "application/pdf")}
    # Missing data={"job_description": job_desc}

    response = client.post("/api/optimize-resume/", files=files)
    assert response.status_code == 422 # Unprocessable Entity for validation error