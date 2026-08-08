from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain.output_parsers import PydanticOutputParser
from app.schemas import ATSFriendlyResume, ResumeSuggestions
from modules.interfaces.resume_optimizer import IResumeOptimizer
from typing import Dict

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
                     - `additional_info`: List of honors, awards (e.g., "Dean's List"), thesis, or significant academic achievements as `List[str]`. If none, `[]` or `null`.

                 7.  **`skills` Section (STRICTLY as a LIST of Skill Objects):**
                     - **Crucial:** This MUST be a LIST where each item is an object with "category" and "keywords" fields.
                     - Example: `["{{\"category\"}}: "Languages", "{{\"keywords\"}}: ["Python", "Java"]", "{{\"category\"}}: "Tools", "{{\"keywords\"}}: ["Git", "Docker"]]`
                     - Categorize clearly (e.g., "Languages", "Tools & Tech", "Cloud", "Concepts").
                     - Use keywords from the job description where relevant. Avoid generic/outdated tech.

                 8.  **Other Optional Sections (STRICTLY as per schema):**
                     - `certifications`, `languages_spoken`, `interests`: `List[str]`. Return `[]` if empty.
                     - `awards`: MUST be a list of objects with `name` (required) and optional `description`. Example: `[{{"name": "Spotlight Award", "description": "For impactful engineering"}}]`. Return `[]` if empty.
                     - `volunteer_experience`: `List[Experience]`. Return `[]` if empty.

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

        # --- Prompt for parsing resume without job description ---
        self.parse_resume_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", """
                 You are a world-class AI Resume Parser. Your task is to extract and structure information from a resume into a standardized JSON format.
                 
                 Extract all information accurately from the resume text provided. Do NOT optimize, tailor, or modify the content - just extract it as-is.
                 
                 **Section-Specific Rules and STRICT SCHEMA COMPLIANCE:**
                 
                 1. **`full_name`**: Extract the candidate's full name. DO NOT use "name".
                 
                 2. **`contact_info` (STRICTLY as a Dictionary):**
                    - This field MUST be a dictionary with "phone" and "email" keys.
                    - Example: `{{"phone": "(571) 524-9496", "email": "example@gmail.com"}}`
                    - Extract only phone and email for this field.
                    - `linkedin_url`, `github_url`, `portfolio_url`: Extract full URLs into these separate fields. If a URL is not found, set its field to `null`.
                 
                 3. **`summary`**: Extract the professional summary/objective if present. If not present, return empty string `""`.
                 
                 4. **`experience` Section:**
                    - List in reverse chronological order.
                    - For each job:
                      - `title`, `company`, `location`: Extract accurately.
                      - `start_date`, `end_date`: MUST be separate string fields (e.g., "July 2022", "March 2024").
                      - `responsibilities`: Extract all bullet points as a list.
                      - `technologies_used`: Extract technologies mentioned. If none, `[]`.
                      - `achievements`: Extract specific achievements. If none, `[]`.
                 
                 5. **`projects` Section:**
                    - Extract all projects mentioned.
                    - For each project: `name`, `description`, `technologies`, `link`, `duration`, `impact`.
                    - If a field is not present, set to `null`.
                 
                 6. **`education` Section:**
                    - List in reverse chronological order.
                    - Extract: `degree`, `major`, `institution`, `location`, `start_date`, `end_date`, `gpa`, `relevant_coursework`, `additional_info`.
                    - If a field is not present, set to `null` or `[]` as appropriate.
                 
                 7. **`skills` Section:**
                    - MUST be a LIST where each item is an object with "category" and "keywords" fields.
                    - Example: `[{{"category": "Languages", "keywords": ["Python", "Java"]}}]`
                    - Categorize skills appropriately.
                 
                 8. **Other Optional Sections:**
                    - `certifications`, `languages_spoken`, `interests`: `List[str]`. Extract if present, otherwise `[]`.
                    - `awards`: MUST be a list of objects with `name` (required) and optional `description`. Example: `[{{"name": "Spotlight Award", "description": "For impactful engineering"}}]`. If only a title is available, use `{{"name": "Award Title"}}`. Return `[]` if none.
                    - `volunteer_experience`: `List[Experience]`. Return `[]` if none.
                 
                 **Output Format:**
                 - You MUST return valid JSON in the format specified by the `ATSFriendlyResume` schema.
                 - Extract information accurately without modification.
                 """),
                ("human", "Here is the user's resume:\n\n{resume_text}\n\nExtract and structure all information from this resume into the specified JSON format.")
            ]
        ).partial(format_instructions=self.resume_parser.get_format_instructions())

        # --- Prompt for parsing QA sheet ---
        self.parse_qa_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", """
                 You are an AI assistant that extracts questions and answers from a QA sheet document.
                 
                 Your task is to identify all question-answer pairs in the provided text and return them as a structured JSON object.
                 
                 The text may contain:
                 - Questions followed by answers
                 - Q&A pairs in various formats (numbered, bulleted, paragraph form, etc.)
                 - Questions and answers separated by colons, dashes, or line breaks
                 
                 Extract each question-answer pair and return as a dictionary where:
                 - Keys are the questions (normalized/cleaned)
                 - Values are the corresponding answers
                 
                 Common question patterns to look for:
                 - "Why do you want to work here?" / "Why work here?"
                 - "Why should we hire you?" / "Why you?"
                 - "What is your expected salary?" / "Salary expectations?"
                 - "What are your strengths?" / "Strengths?"
                 - "What are your weaknesses?" / "Weaknesses?"
                 - "Where do you see yourself in 5 years?" / "Career goals?"
                 - And any other questions found in the document
                 
                 Return a JSON object with question-answer pairs. If a question doesn't have an answer, set the value to an empty string.
                 
                 Example output format:
                 {{
                   "whyWorkHere": "I am passionate about...",
                   "whyYou": "I bring extensive experience...",
                   "salary": "$100,000 - $120,000",
                   "strengths": "Strong problem-solving skills...",
                   "weaknesses": "I sometimes take on too much...",
                   "careerGoals": "I see myself growing into a leadership role..."
                 }}
                 
                 Use clear, descriptive keys (camelCase) that represent the question topic.
                 """),
                ("human", "Here is the QA sheet text:\n\n{qa_text}\n\nExtract all question-answer pairs and return them as a JSON object.")
            ]
        )

    
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

    def parse_resume(self, resume_text: str) -> ATSFriendlyResume:
        """Parse a resume into structured JSON format without requiring a job description."""
        chain = self.parse_resume_prompt | self.llm | self.resume_parser
        try:
            parsed_resume = chain.invoke({
                "resume_text": resume_text
            })
            return parsed_resume
        except Exception as e:
            print(f"Error parsing resume with LLM: {e}")
            raise

    def parse_qa_sheet(self, qa_text: str) -> Dict[str, str]:
        """Parse a QA sheet into structured question-answer pairs."""
        import json
        try:
            # Use LLM to extract Q&A pairs
            chain = self.parse_qa_prompt | self.llm
            response = chain.invoke({"qa_text": qa_text})
            
            # Parse the response (should be JSON string)
            content = response.content.strip()
            
            # Remove markdown code blocks if present
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            # Parse JSON
            qa_dict = json.loads(content)
            return qa_dict
        except json.JSONDecodeError as e:
            print(f"Error parsing QA sheet JSON response: {e}")
            print(f"Response content: {response.content if 'response' in locals() else 'N/A'}")
            # Return empty dict or try to extract manually
            return {}
        except Exception as e:
            print(f"Error parsing QA sheet with LLM: {e}")
            raise

    def generate_personalized_answers(
        self, 
        resume_data: Dict, 
        cover_letter_text: str, 
        qa_answers: Dict[str, str], 
        questions: list, 
        job_context: str = ""
    ) -> Dict[str, str]:
        """Generate personalized answers for job application questions using LLM."""
        import json
        
        # Create prompt for generating personalized answers
        personalized_answers_prompt = ChatPromptTemplate.from_messages([
            ("system", """
            You are an AI assistant that generates personalized, professional answers for job application questions.
            
            Your task is to generate concise, authentic answers (2-3 sentences each) that:
            - Reference specific experiences and achievements from the candidate's resume
            - Align with the tone and key points from their cover letter
            - Are tailored to the specific question asked
            - Sound natural and authentic (not generic or templated)
            - Demonstrate genuine interest and fit for the role/company
            
            For each question, generate a personalized answer that:
            1. References concrete examples from their experience
            2. Shows alignment with the job/company (if job context is provided)
            3. Demonstrates their unique value proposition
            4. Maintains a professional yet personable tone
            
            Return your answers as a JSON object where:
            - Keys are the exact question text as provided
            - Values are the generated personalized answers (2-3 sentences each)
            
            Example format:
            {{
              "Why do you want to work here?": "I am drawn to [Company] because of your innovative approach to [specific area]. My experience in [relevant experience] aligns perfectly with your mission to [company goal]. I'm excited about the opportunity to contribute to [specific project/team].",
              "Why are you a good fit for this role?": "With [X years] of experience in [relevant field], I've developed expertise in [key skills]. At [previous company], I [specific achievement] which directly relates to the challenges in this role. My background in [relevant experience] positions me to make an immediate impact."
            }}
            """),
            ("human", """
            Based on the following information, generate personalized answers for these job application questions:
            
            Resume Data:
            {resume_data}
            
            Cover Letter:
            {cover_letter_text}
            
            Stored QA Answers (for context only - use as inspiration, not direct answers):
            {qa_answers}
            
            Job Context (if available):
            {job_context}
            
            Questions to Answer:
            {questions}
            
            Generate personalized answers for each question and return as a JSON object.
            """)
        ])
        
        try:
            # Format resume data as string if it's a dict
            resume_str = json.dumps(resume_data, indent=2) if isinstance(resume_data, dict) else str(resume_data)
            qa_answers_str = json.dumps(qa_answers, indent=2) if isinstance(qa_answers, dict) else str(qa_answers)
            questions_str = "\n".join([f"{i+1}. {q}" for i, q in enumerate(questions)])
            
            # Generate answers using LLM
            chain = personalized_answers_prompt | self.llm
            response = chain.invoke({
                "resume_data": resume_str,
                "cover_letter_text": cover_letter_text or "No cover letter provided.",
                "qa_answers": qa_answers_str or "No stored QA answers.",
                "job_context": job_context or "No job context provided.",
                "questions": questions_str
            })
            
            # Parse the response
            content = response.content.strip()
            
            # Remove markdown code blocks if present
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            # Parse JSON
            answers_dict = json.loads(content)
            return answers_dict
        except json.JSONDecodeError as e:
            print(f"Error parsing personalized answers JSON response: {e}")
            print(f"Response content: {response.content if 'response' in locals() else 'N/A'}")
            # Return empty dict on error
            return {}
        except Exception as e:
            print(f"Error generating personalized answers with LLM: {e}")
            raise