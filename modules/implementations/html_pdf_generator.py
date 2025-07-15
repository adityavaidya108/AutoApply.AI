from io import BytesIO
from app.schemas import ATSFriendlyResume # Import necessary schemas
from modules.interfaces.document_generator import IDocumentGenerator
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML, CSS # pip install weasyprint

class HtmlPdfGenerator(IDocumentGenerator):
    def __init__(self, template_dir: str = "templates"):
        self.env = Environment(loader=FileSystemLoader(template_dir))
        self.template = self.env.get_template("resume_template.html") # Create this HTML template

    def generate_pdf(self, resume_data: ATSFriendlyResume) -> BytesIO: 
        """
        Generates a PDF byte stream from ATSFriendlyResume data using an HTML template.
        """
        # Render the Jinja2 HTML template with the resume data.
        # The 'resume' variable in the template will be populated by resume_data.model_dump()
        html_content = self.template.render(resume=resume_data.model_dump())

        # Convert the rendered HTML content to PDF using WeasyPrint
        pdf_bytes = BytesIO()
        HTML(string=html_content).write_pdf(pdf_bytes)
        pdf_bytes.seek(0) # Reset buffer position to the beginning
        return pdf_bytes

    def generate_docx(self, resume_data: ATSFriendlyResume) -> BytesIO:
        raise NotImplementedError("DOCX generation not supported for HtmlPdfGenerator.")