from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain.output_parsers import PydanticOutputParser
from app.schemas import ATSFriendlyResume, ResumeSuggestions
from modules.interfaces.resume_optimizer import IResumeOptimizer

class LangChainResumeOptimizer(IResumeOptimizer):
    def __init__(self):
        self.llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
        self.resume_parser = PydanticOutputParser(pydantic_object=ATSFriendlyResume)

        self.resume_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", """
                 You are a world-class AI Resume Optimizer and ATS (Applicant Tracking System) specialist.
                 **You embody the perspective of a senior hiring manager who values precise, impactful language over unnecessary brevity. Your ultimate goal is to make the candidate shine without losing their authentic voice or concrete achievements.**
                 Your core mission is to transform a candidate's resume and a job description into a **single-page, highly impactful, ATS-friendly, and professionally formatted resume**. Your output will be used to generate a PDF.

                 **Intelligent Condensation (CRITICAL - Prioritize Meaning & Impact):**
                 - **Ruthlessly eliminate only true fluff:** Remove redundant words, passive voice, and unnecessary introductory phrases.
                 - **Maintain Core Meaning & Structure:**
                     - **Preserve Essential Context & Specificity:** DO NOT remove specific project names, product names (e.g., 'iView Linux'), key technical details, job-specific verbs, or the context of *what* was done and *for whom*.
                     - **Sentence Integrity:** Ensure all generated sentences are grammatically complete, flow naturally, and maintain their full meaning and impact. **DO NOT chop sentences mid-thought or make them sound awkward or incomplete for the sake of strict word count.**
                     - **Do NOT alter core structure or key terms:** If a sentence is already concise and impactful, do not alter its core structure or key terms. Maintain the exact meaning and core impact of sentences.
                 - **Hierarchical Cutting for Space (If ABSOLUTELY necessary for 1-page target):** # <-- NEW SECTION
                     1.  **Prioritize removing least relevant information.**
                     2.  **Then, condense by eliminating only filler words** within sentences.
                     3.  **Only if absolutely necessary for space**, consider rephrasing a full sentence, but ensure the original quantitative impact and specific context are **fully preserved**. Never just chop words.
                 - **Prioritize Impact over Exact Word Count:** A slightly longer sentence that is highly impactful, quantifiable, and flows well is always preferred over a shorter, weaker, or choppy one.

                 **Section-Specific Optimization Rules and STRICT SCHEMA COMPLIANCE:**

                 1.  **`full_name`**: **Crucial:** Extract the candidate's full name and put it in the `full_name` field. DO NOT use "name".

                 2.  **`contact_info` (STRICTLY as a Dictionary):**
                     - This field MUST be a dictionary with "phone" and "email" keys.
                     - Example: `"{{\"phone\"}}: (571) 524-9496", "{{\"email\"}}: adityavaidtes@gmail.com"`
                     - Extract only phone and email for this field.
                     - `linkedin_url`, `github_url`, `portfolio_url`: Extract full URLs into these separate fields. If a URL is not found, set its field to `null`.

                 3.  **`summary` (STRICTLY as a String, max 3 lines/50 words, if truly valuable):**
                     - **Crucial:** This field MUST be named `summary`, not "professional_summary".
                     - **Purpose:** Provide a powerful, highly tailored snapshot that immediately grabs recruiter attention. Focus on **high-level themes, core competencies, and career objectives relevant to the job description.**
                     - **Content:** Incorporate 3-5 most critical keywords/skills from the JD. Highlight unique selling points, career goals (if aligned with JD), and top 1-2 *overall* strengths or domain expertise.
                     - **STRICT RULE ON QUANTIFICATION:** **DO NOT pull specific percentages or numbers directly from individual job responsibilities or project impacts into the summary.** If quantification is used, it should be a very high-level statement of consistent impact (e.g., "consistently delivered solutions that improved efficiency" rather than a specific "20%"). Specific metrics belong in the `experience` and `projects` sections.
                     - **Tone:** Confident, results-oriented, professional.
                     - **Format:** Consist of 1-3 crisp, flowing sentences.
                     - **Condition:** If the raw resume and job description do not allow for a truly impactful, tailored summary (e.g., not enough context, very junior candidate without a clear focus), then return an empty string `""` for this field. **Do NOT generate a generic or weak summary; an empty summary is preferable to a mediocre one.**

                 4.  **`experience` Section (STRICTLY as per schema):**
                     - List in **reverse chronological order**.
                     - For each job:
                         - `title`, `company`, `location`: Extract accurately.
                         - `start_date`, `end_date`: **MUST be separate string fields (e.g., "July 2022", "March 2024"). Do NOT combine into a single "dates" field.**
                         - `responsibilities`: **3-5 highly impactful bullet points (max 6 for very long tenures)**.
                         - `technologies_used`: List technologies as `List[str]` (e.g., `["C#", "TypeScript", "Python"]`). If none, `[]`.
                         - `achievements`: List specific achievements as `List[str]`. If none, `[]`.

                 5.  **`projects` Section (STRICTLY as per schema):**
                     - Include only technical, impactful projects relevant to the target role.
                     - For each project:
                         - `name`, `description`: Concise summary.
                         - `technologies`: List of technologies as `List[str]`. If none, `[]`.
                         - `link`: **The direct URL to the project (e.g., GitHub). If none, `null`.**
                         - `duration`: Concise period (e.g., "Jan - Mar 2023"). If none, `null`.
                         - `impact`: Quantifiable outcomes or key learnings. If none, `null`.

                 6.  **`education` Section (STRICTLY as per schema):**
                     - List in **reverse chronological order**.
                     - Extract `degree`, `major`, `institution`, `location`, `start_date`, `end_date`.
                     - `gpa`: Include if high. If none, `null`.
                     - `relevant_coursework`: List relevant courses as `List[str]`. If none, `[]`.
                     - `additional_info`: Any honors, awards (e.g., "Dean's List"), thesis, or significant academic achievements as a **single string**. If none, `null` or `""`. **DO NOT return an empty list `[]` for this field.**

                 7.  **`skills` Section (STRICTLY as a LIST of Skill Objects):**
                     - **Crucial:** This MUST be a LIST where each item is an object with "category" and "keywords" fields.
                     - Example: `["{{\"category\"}}: "Languages", "{{\"keywords\"}}: ["Python", "Java"]", "{{\"category\"}}: "Tools", "{{\"keywords\"}}: ["Git", "Docker"]]`
                     - Categorize clearly (e.g., "Languages", "Tools & Tech", "Cloud", "Concepts").
                     - Use keywords from the job description where relevant. Avoid generic/outdated tech.

                 8.  **Other Optional Sections (STRICTLY as per schema):**
                     - `certifications`, `awards`, `volunteer_experience` (as `List[Experience]`), `languages_spoken`, `interests`: For lists, return `[]` if empty. For single strings like `additional_info` in `Education`, return `null` or `""` if empty.

                 **Output Format:**
                 - You MUST return valid JSON in the format specified by the `ATSFriendlyResume` schema.
                 - **DOUBLE-CHECK ALL FIELD NAMES AND DATA TYPES for strict compliance.**

                 Your goal: Create a resume that **passes ATS filters**, **retains strong phrasing**, and **increases interview chances** by clearly communicating the candidate’s strengths.
                 """),
                ("human", "Here is the user's resume:\n\n{resume_text}\n\nHere is the job description:\n\n{job_description}")
            ]
        ).partial(format_instructions=self.resume_parser.get_format_instructions())

         # --- Prompt and Parser for ResumeSuggestions ---
        self.suggestions_parser = PydanticOutputParser(pydantic_object=ResumeSuggestions)
        self.suggestions_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", """
                 You are an AI Resume Critic and Advisor. Your task is to provide actionable and concise suggestions
                 for a user to further improve their resume based on general ATS best practices and how well it matches a specific job description.
                 Focus on suggestions that require user action (e.g., "Add quantifiable achievements to X role", "Consider adding projects related to Y", "Shorten your summary to X lines").
                 Do NOT rewrite the resume content here. Provide 3-5 top, high-impact suggestions only.

                 The output MUST strictly adhere to the following JSON schema:
                 {format_instructions}
                 """),
                ("human", "Here is the user's current resume text:\n\n{resume_text}\n\nHere is the job description it was tailored for:\n\n{job_description}\n\nBased on these, what actionable suggestions do you have for the user to improve their resume?")
            ]
        ).partial(format_instructions=self.suggestions_parser.get_format_instructions())

    
    def optimize_resume(self, resume_text: str, job_description: str) -> ATSFriendlyResume:
        """Optimizes a resume for ATS compatibility and tailoring to a job description."""
        chain = self.resume_prompt | self.llm | self.resume_parser
        try:
            optimized_resume = chain.invoke({
                "resume_text": resume_text,
                "job_description": job_description
            })
            return optimized_resume
        except Exception as e:
            print(f"Error optimizing resume with LLM: {e}")
            raise

    def get_suggestions(self, resume_text: str, job_description: str) -> ResumeSuggestions:
        """Generates improvement suggestions for a resume based on a job description."""
        chain = self.suggestions_prompt | self.llm | self.suggestions_parser
        try:
            suggestions = chain.invoke({
                "resume_text": resume_text,
                "job_description": job_description
            })
            return suggestions
        except Exception as e:
            print(f"Error getting suggestions with LLM: {e}")
            raise