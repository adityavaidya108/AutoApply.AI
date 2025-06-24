from pydantic import BaseModel, Field
from typing import List, Optional

class Experience(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    start_date: str
    end_date: Optional[str] = "Present"
    responsibilities: List[str] = Field(description="List of key responsibilities and achievements, using action verbs.")

class Education(BaseModel):
    degree: str
    major: Optional[str] = None
    institution: str
    location: Optional[str] = None
    graduation_date: Optional[str] = None

class Skill(BaseModel):
    category: str
    keywords: List[str]

class ATSFriendlyResume(BaseModel):
    """
    Schema for an ATS-friendly resume tailored to a job description.
    """
    full_name: str
    contact_info: str = Field(description="Email, Phone, LinkedIn URL (if applicable).")
    summary: str = Field(description="A concise professional summary tailored to the job description, highlighting key qualifications and career goals.")
    experience: List[Experience]
    education: List[Education]
    skills: List[Skill]
    # Add other sections as needed, e.g., projects, certifications, awards
    projects: Optional[List[dict]] = None # You can define a detailed Project schema later
    certifications: Optional[List[str]] = None
    
    # This field will contain suggestions for further improvement if the LLM identifies gaps
    improvement_suggestions: Optional[List[str]] = Field(
        None, description="Suggestions for the user to further improve the resume based on ATS best practices and job description matching."
    )