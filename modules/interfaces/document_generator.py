from abc import ABC, abstractmethod
from io import BytesIO
from app.schemas import ATSFriendlyResume

class IDocumentGenerator(ABC):
    @abstractmethod
    def generate_pdf(self, resume_data: ATSFriendlyResume) -> BytesIO:
        """
        Abstract method to generate a PDF byte stream from ATSFriendlyResume data.
        """
        pass

    @abstractmethod
    def generate_docx(self, resume_data: ATSFriendlyResume) -> BytesIO:
        """
        Abstract method to generate a DOCX byte stream from ATSFriendlyResume data.
        """
        pass