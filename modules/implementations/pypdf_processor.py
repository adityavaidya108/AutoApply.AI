import io
import os
import re
import fitz
from langchain_community.document_loaders import PyPDFLoader
from modules.interfaces.pdf_processor import IPDFProcessor

class PyPDFProcessor(IPDFProcessor):
    def extract_text(self, pdf_file_stream: io.BytesIO) -> str:
        try:
            pdf_file_stream.seek(0)
            doc = fitz.open(stream=pdf_file_stream.read(), filetype="pdf")
            text = []
            urls = []

            for i in range(doc.page_count):
                page = doc.load_page(i)  # type: ignore
                text.append(page.get_text("text"))  # type: ignore[attr-defined]

                # Extract real hyperlinks
                for link in page.get_links():  # type: ignore[attr-defined]
                    if link.get("uri"):
                        urls.append(link["uri"])

            combined_text = "\n".join(text)

            # Optionally append URLs that may not be in visible text
            if urls:
                combined_text += "\n\nExtracted URLs:\n" + "\n".join(set(urls))

            return combined_text

        except Exception as e:
            print(f"Error extracting text and links with PyMuPDFProcessor: {e}")
            raise