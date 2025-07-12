from abc import ABC, abstractmethod
from app.schemas import ATSFriendlyResume, ResumeSuggestions

class IResumeOptimizer(ABC):
    @abstractmethod
    def optimize_resume(self, resume_text: str, job_description: str) -> ATSFriendlyResume:
        """
        Abstract method to optimize a resume based on a job description.
        Returns an ATSFriendlyResume object (the content of the resume).
        """
        pass

    @abstractmethod
    def get_suggestions(self, resume_text: str, job_description: str) -> ResumeSuggestions:
        """
        Abstract method to generate improvement suggestions for a resume.
        Returns a ResumeSuggestions object.
        """
        pass