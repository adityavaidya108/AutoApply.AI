from abc import ABC, abstractmethod
from typing import List, Optional
from app.schemas import JobListing, JobSearchCriteria

class IJobScraper(ABC):
    @abstractmethod
    async def search_jobs(self, criteria: JobSearchCriteria, limit: int = 10) -> List[JobListing]:
        """
        Abstract method to search for job listings based on criteria.
        Args:
            criteria: JobSearchCriteria object containing keywords, location, etc.
            limit: Maximum number of job listings to return.
        Returns:
            A list of JobListing objects.
        """
        pass

# You might add other methods later, e.g., for getting full job descriptions
    # @abstractmethod
    # async def get_full_job_description(self, job_url: str) -> str:
    #     pass