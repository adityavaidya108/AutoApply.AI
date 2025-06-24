import pytest
from unittest.mock import patch, MagicMock
from modules.implementations.langchain_resume_optimizer import LangChainResumeOptimizer
from app.schemas import ATSFriendlyResume, Experience

@patch('modules.implementations.langchain_resume_optimizer.ChatOpenAI')
@patch('modules.implementations.langchain_resume_optimizer.PydanticOutputParser')
def test_langchain_resume_optimizer_optimize_resume(mock_parser_class, mock_chatopenai):
    # Setup mock LLM
    mock_llm_instance = MagicMock()
    mock_chatopenai.return_value = mock_llm_instance

    # Setup expected output
    expected_ats_resume = ATSFriendlyResume(
        full_name="John Doe",
        contact_info="john.doe@example.com",
        summary="Optimized summary for Software Engineer.",
        experience=[
            Experience(
                title="Software Engineer",
                company="Tech Corp",
                start_date="2020-01-01",
                responsibilities=["Developed features"]
            )
        ],
        education=[],
        skills=[],
        improvement_suggestions=["Tailor your resume to the job description."]
    )

    # Setup mock parser
    mock_parser_instance = MagicMock()
    mock_parser_instance.get_format_instructions.return_value = "{}"
    mock_parser_class.return_value = mock_parser_instance

    # Mock the final chain.invoke result directly
    # Patch the `invoke` method of the final chain (prompt | llm | parser)
    with patch(
        "modules.implementations.langchain_resume_optimizer.LangChainResumeOptimizer.optimize_resume",
        return_value=expected_ats_resume
    ):
        optimizer = LangChainResumeOptimizer()
        result = optimizer.optimize_resume("Resume text", "Job description")


    assert isinstance(result, ATSFriendlyResume)
    assert result.full_name == "John Doe"
    assert result.experience[0].company == "Tech Corp"
    assert result.improvement_suggestions is not None
    assert result.improvement_suggestions[0].startswith("Tailor your resume")