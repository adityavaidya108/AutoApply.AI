import pytest
import io
from modules.implementations.pypdf_processor import PyPDFProcessor

# Create a dummy PDF content for testing
def create_dummy_pdf_stream(text_content="Hello, this is a test PDF."):
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    p.drawString(100, 750, text_content)
    p.save()
    buffer.seek(0)
    return buffer

def test_pypdf_processor_extract_text():
    processor = PyPDFProcessor()
    dummy_pdf = create_dummy_pdf_stream("This is a sample resume text.")
    extracted_text = processor.extract_text(dummy_pdf)
    assert "This is a sample resume text." in extracted_text
    assert "Hello, this is a test PDF." not in extracted_text # Ensure it uses the specific dummy content

def test_pypdf_processor_empty_pdf():
    processor = PyPDFProcessor()
    dummy_pdf = create_dummy_pdf_stream("") # Empty content
    extracted_text = processor.extract_text(dummy_pdf)
    assert extracted_text == "" # Or handle expected error/empty result

def test_pypdf_processor_invalid_file():
    processor = PyPDFProcessor()
    # Pass a non-PDF stream
    with pytest.raises(Exception): # Expect PyPDFLoader to raise an error
        processor.extract_text(io.BytesIO(b"Not a PDF content"))