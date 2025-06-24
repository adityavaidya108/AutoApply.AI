from abc import ABC, abstractmethod
import io

class IPDFProcessor(ABC):
    @abstractmethod
    def extract_text(self, pdf_file_stream: io.BytesIO) -> str:
        """Abstract method to extract text from a PDF file stream"""
        pass
