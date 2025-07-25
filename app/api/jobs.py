from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.schemas import JobListing, JobSearchCriteria
from modules.interfaces.job_scraper import IJobScraper
from modules.implementations.playwright_job_scraper import PlaywrightJobScraper

router = APIRouter()

# Dependency provider for the job scraper
def get_job_scraper() -> IJobScraper:
    return PlaywrightJobScraper()

@router.post("/search-jobs", response_model=List[JobListing])
async def search_jobs_endpoint(
    criteria: JobSearchCriteria,
    limit: int = 10, # Allow user to specify limit
    job_scraper: IJobScraper = Depends(get_job_scraper)
):
    """
    Searches for job listings based on provided criteria using the job scraper.
    """
    if not criteria.keywords:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Keywords are required for job search.")

    try:
        jobs = await job_scraper.search_jobs(criteria, limit)
        if not jobs:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No jobs found matching your criteria.")
        return jobs
    except Exception as e:
        print(f"Error in job search endpoint: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An error occurred during job search: {str(e)}")