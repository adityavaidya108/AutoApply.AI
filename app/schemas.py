from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class Experience(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    start_date: str
    end_date: Optional[str] = "Present"
    responsibilities: List[str] = Field(description="List of key responsibilities and achievements, using action verbs.")
    technologies_used: Optional[List[str]] = None
    achievements: Optional[List[str]] = None

class Education(BaseModel):
    degree: str
    major: Optional[str] = None
    institution: str
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    gpa: Optional[str] = None 
    relevant_coursework: Optional[List[str]] = None 
    additional_info: Optional[str] = None

class Skill(BaseModel):
    category: str
    keywords: List[str]

class Project(BaseModel):
    name: str
    description: str
    technologies: Optional[List[str]] = None
    link: Optional[str] = None
    duration: Optional[str] = None
    impact: Optional[str] = None

class ATSFriendlyResume(BaseModel):
    """
    Schema for an ATS-friendly resume tailored to a job description.
    This schema represents the *content* of the resume itself.
    """
    full_name: str
    contact_info: Dict[str, Optional[str]] = Field(description="Phone number and email as a dictionary.")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn profile URL.")
    github_url: Optional[str] = Field(None, description="GitHub profile URL.")
    portfolio_url: Optional[str] = Field(None, description="Personal portfolio or website URL.")
    
    summary: str = Field(description="A concise professional summary tailored to the job description, highlighting key qualifications and career goals.")
    experience: List[Experience]
    education: List[Education]
    skills: List[Skill]
    projects: Optional[List[Project]] = None
    certifications: Optional[List[str]] = None
    awards: Optional[List[str]] = None
    volunteer_experience: Optional[List[Experience]] = None
    languages_spoken: Optional[List[str]] = None
    interests: Optional[List[str]] = None


class ResumeSuggestions(BaseModel):
    """
    Schema for improvement suggestions for a resume.
    """
    suggestions: List[str] = Field(
        [], description="Actionable suggestions for the user to further improve their resume based on ATS best practices and job description matching."
    )

class JobListing(BaseModel):
    """
    Schema for a single job listing.
    """
    title: str
    company: str
    location: str
    job_url: str # Direct URL to the job posting
    description_snippet: Optional[str] = Field(None, description="A short snippet of the job description text for quick overview.")
    posted_date: Optional[str] = None # e.g., "24 hours ago", "2 days ago"
    salary_range: Optional[str] = None

class JobSearchCriteria(BaseModel):
    """
    Schema for input criteria for job search.
    """
    keywords: str = Field(..., description="Job titles, skills, or keywords (e.g., 'Software Engineer, Python').")
    location: Optional[str] = Field(None, description="Geographic location (e.g., 'New York, NY', 'Remote').")
    # Add more criteria as needed, e.g., 'salary_min', 'job_type', 'experience_level'