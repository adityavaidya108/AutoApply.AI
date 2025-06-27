from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain.output_parsers import PydanticOutputParser
from app.schemas import ATSFriendlyResume
from modules.interfaces.resume_optimizer import IResumeOptimizer

class LangChainResumeOptimizer(IResumeOptimizer):
    def __init__(self):
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
        self.parser = PydanticOutputParser(pydantic_object=ATSFriendlyResume)

        self.prompt = ChatPromptTemplate.from_messages(
            [
                ("system", """
                 You are an expert AI Resume Optimizer and ATS specialist...
                 (Keep your detailed prompt from the previous answer here)
                 
                 The output MUST strictly adhere to the following JSON schema, which represents an ATS-friendly resume structure:
                 {format_instructions}
                 """),
                ("human", "Here is the user's resume:\n\n{resume_text}\n\nHere is the job description:\n\n{job_description}")
            ]
        ).partial(format_instructions=self.parser.get_format_instructions())
    
    def optimize_resume(self, resume_text: str, job_description: str) -> ATSFriendlyResume:
        chain = self.prompt | self.llm | self.parser
        try:
            optimized_resume = chain.invoke({
                "resume_text": resume_text,
                "job_description": job_description
            })
            return optimized_resume
        except Exception as e:
            print(f"Error optimizing resume with LLM: {e}")
            raise # Re-raise for API endpoint to handle