from abc import ABC, abstractmethod
from app.schemas import ATSFriendlyResume

class IResumeOptimizer(ABC):
    @abstractmethod
    def optimize_resume(self, resume: str, job_description: str) -> ATSFriendlyResume:
        """
        Abstract method to optimize a resume based on a job description.
        Returns an ATSFriendlyResume object.
        """
        pass