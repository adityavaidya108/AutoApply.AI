import io
import os
from langchain_community.document_loaders import PyPDFLoader
from modules.interfaces.pdf_processor import IPDFProcessor

class PyPDFProcessor(IPDFProcessor):
    def extract_text(self, pdf_file_stream: io.BytesIO) -> str:
        """ Concrete implementation using PyPDFLoader to extract text from PDF"""
        try:
            temp_pdf_path = "temp_resume_for_extraction.pdf"
            with open(temp_pdf_path, "wb") as f:
                f.write(pdf_file_stream.read())

            loader = PyPDFLoader(temp_pdf_path)
            pages = loader.load()
            full_text = "\n".join([page.page_content for page in pages])
            os.remove(temp_pdf_path) # Clean up
            return full_text
        except Exception as e:
            print(f"Error extracting text with PyPDFProcessor: {e}")
            raise # Re-raise to be handled by the caller (FastAPI endpoint)