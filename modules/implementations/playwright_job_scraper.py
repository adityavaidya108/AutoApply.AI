from typing import List, Optional
from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeoutError
from app.schemas import JobListing, JobSearchCriteria
from modules.interfaces.job_scraper import IJobScraper
import asyncio
import re # For cleaning text

class PlaywrightJobScraper(IJobScraper):
    async def search_jobs(self, criteria: JobSearchCriteria, limit: int = 10) -> List[JobListing]:
        jobs: List[JobListing] = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                # Construct LinkedIn Jobs URL (simplified for public search)
                # This URL structure might change over time; requires constant monitoring
                search_url = f"https://www.linkedin.com/jobs/search/?keywords={criteria.keywords.replace(' ', '%20')}"
                if criteria.location:
                    search_url += f"&location={criteria.location.replace(' ', '%20')}"

                print(f"Navigating to: {search_url}")
                await page.goto(search_url, wait_until="domcontentloaded")
                await page.wait_for_selector('div.job-card-container', timeout=10000) # Wait for job cards to load

                # Scroll to load more jobs (LinkedIn loads dynamically)
                # For MVP, let's try a few scrolls
                scroll_count = 3 # Number of times to scroll down
                for _ in range(scroll_count):
                    await page.evaluate("window.scrollBy(0, document.body.scrollHeight)")
                    await asyncio.sleep(2) # Give time for content to load

                job_cards = await page.locator('div.job-card-container').all()
                print(f"Found {len(job_cards)} job cards.")

                for i, card in enumerate(job_cards):
                    if len(jobs) >= limit:
                        break
                    
                    try:
                        title_element = card.locator('h3.base-search-card__title').first
                        company_element = card.locator('h4.base-search-card__subtitle').first
                        location_element = card.locator('span.job-search-card__location').first
                        job_url_element = card.locator('a.base-card__full-link').first 

                        title = (await title_element.text_content() or "").strip() if title_element else "N/A"
                        company = (await company_element.text_content() or "").strip() if company_element else "N/A"
                        location = (await location_element.text_content() or "").strip() if location_element else "N/A"
                        job_url = (await job_url_element.get_attribute('href') or "").strip() if job_url_element else "N/A"

                        snippet_element = card.locator('p.job-search-card__snippet').first
                        description_snippet = (await snippet_element.text_content() or "").strip() if snippet_element else None

                        posted_date_element = card.locator('time.job-search-card__listdate').first
                        posted_date = (await posted_date_element.get_attribute('datetime') or "").strip() if posted_date_element else None

                        salary_range = None 

                        jobs.append(JobListing(
                            title=title,
                            company=company,
                            location=location,
                            job_url=job_url,
                            description_snippet=description_snippet,
                            posted_date=posted_date,
                            salary_range=salary_range
                        ))
                        print(f"Extracted: {title} at {company} in {location}")

                    except Exception as e:
                        print(f"Error processing job card {i}: {e}")
                        continue

            except PlaywrightTimeoutError:
                print("Timeout waiting for job cards. Page might not have loaded correctly or selectors changed.")
            except Exception as e:
                print(f"An error occurred during scraping: {e}")
            finally:
                await browser.close()

        return jobs