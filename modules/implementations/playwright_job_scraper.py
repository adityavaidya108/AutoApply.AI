import asyncio
from typing import List, Optional
from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError, async_playwright
import os
from modules.interfaces.job_scraper import IJobScraper
from app.schemas import JobListing, JobSearchCriteria

class PlaywrightJobScraper(IJobScraper):
    LINKEDIN_EMAIL = os.getenv("LINKEDIN_EMAIL")
    LINKEDIN_PASSWORD = os.getenv("LINKEDIN_PASSWORD")

    async def _login_linkedin(self, page: Page):
        """
        Handles the LinkedIn login process. This is highly sensitive to UI changes.
        """
        print("Attempting to log in to LinkedIN...")
        login_url = "https://www.linkedin.com/login"
        await page.goto(login_url, wait_until="domcontentloaded")

        try:
            # Wait for email/username input and fill it
            await page.wait_for_selector('#username', timeout=15000)
            await page.fill('#username', self.LINKEDIN_EMAIL)

            # Wait for password input and fill it
            await page.wait_for_selector('#password', timeout=15000)
            await page.fill('#password', self.LINKEDIN_PASSWORD)

            # Short delay to allow DOM updates before clicking Sign in
            await page.wait_for_timeout(500)

            # Uncheck the "Keep me signed in" checkbox if it's selected
            await page.click('label[for="rememberMeOptIn-checkbox"]')

            sign_in_selector = 'button[aria-label="Sign in"]'
            await page.wait_for_selector(sign_in_selector, state='visible', timeout=15000)

             # Ensure the button is the topmost clickable element and not disabled
            await page.wait_for_function(
                """selector => {
                    const btn = document.querySelector(selector);
                    if (!btn) return false;
                    const rect = btn.getBoundingClientRect();
                    const elAtPoint = document.elementFromPoint(
                        rect.left + rect.width / 2,
                        rect.top + rect.height / 2
                    );
                    return elAtPoint === btn && !btn.disabled;
                }""",
                sign_in_selector
            )

            # Click the Sign in button
            await page.click(sign_in_selector)

            # Wait for navigation after login (e.g., to the feed or a redirect)
            # This is tricky; might need to wait for a specific element on the dashboard
            await page.wait_for_url("https://www.linkedin.com/feed*", timeout=30000)
            print("Login successful!")

        except PlaywrightTimeoutError as e:
            print(f"Login timeout: Could not find login elements or navigate after login. {e}")
            # Potentially save a screenshot for debugging
            await page.screenshot(path="login_error.png")
            raise Exception("LinkedIn login failed: Page elements not found or navigation timeout.")
        except Exception as e:
            print(f"An unexpected error occurred during login: {e}")
            await page.screenshot(path="login_error.png")
            raise Exception(f"LinkedIn login failed: {str(e)}")

    async def _extract_job_details(self, page: Page, job_url: str) -> Optional[JobListing]:
        """
        Extracts details for a single job from the job details pane after it has been clicked.
        This uses selectors that are less likely to change frequently.
        """
        try:
            # Wait for the main details container to be available
            details_pane_selector = "div.jobs-search__job-details--wrapper"
            await page.wait_for_selector(details_pane_selector, timeout=10000)
            details_pane = page.locator(details_pane_selector)

            # --- Extract Core Information ---
            title = await details_pane.locator("h1.t-24 a").text_content(timeout=5000)
            company = await details_pane.locator(".job-details-jobs-unified-top-card__company-name a").first.text_content(timeout=5000)
            tertiary_info_container = details_pane.locator(".job-details-jobs-unified-top-card__tertiary-description")
            location = await tertiary_info_container.locator("span").first.text_content(timeout=5000)

            description_container = details_pane.locator("div#job-details")
            description_text = await description_container.text_content(timeout=5000) if await description_container.count() > 0 else "Not available."
            description_snippet = (description_text.strip()[:250] + '...') if description_text else None
            # --- Extract Optional Information with error handling ---
            posted_date = None
            try:
                date_element = tertiary_info_container.locator('span:has-text("ago"), span:has-text("day")')
                if await date_element.count() > 0:
                    posted_date = await date_element.first.text_content()
            except PlaywrightTimeoutError:
                print("Could not find posted date.")

            salary_range = None
            try:
                salary_element = details_pane.locator('button:has-text("K/yr"), button:has-text("/yr"), span:has-text("£"), span:has-text("$")')
                if await salary_element.count() > 0:
                   salary_range = await salary_element.first.text_content()
            except PlaywrightTimeoutError:
                print("Could not find salary information.")

            # Create the JobListing object
            return JobListing(
                title=title.strip() if title else "N/A",
                company=company.strip() if company else "N/A",
                location=location.strip() if location else "N/A",
                job_url=job_url,
                description_snippet=description_snippet,
                posted_date=posted_date.strip() if posted_date else None,
                salary_range=salary_range.strip() if salary_range else None,
            )

        except (PlaywrightTimeoutError, Exception) as e:
            print(f"Error extracting job details for {job_url}: {e}")
            await page.screenshot(path="details_error.png")
            return None


    async def search_jobs(self, criteria: JobSearchCriteria, limit: int = 10) -> List[JobListing]:
        jobs: List[JobListing] = []
        print(f"Using event loop in playwright_job_scraper: {asyncio.get_event_loop().__class__.__name__}")
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False, # Set to False for debugging else True
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled', # Helps avoid detection
                    '--disabled-extensions',
                    '--disabled-gpu' # For some environments
                ]
            )

            # Use a context for better session management (e.g cookies, user agent)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                viewport={'width': 1920, 'height': 1080}, # Set a common viewport size
                accept_downloads=False
            )
            page = await context.new_page()

            try:

                if self.LINKEDIN_EMAIL and self.LINKEDIN_PASSWORD:
                    await self._login_linkedin(page)
                    await asyncio.sleep(2) # Short pause after login
                # Construct LinkedIn Jobs URL.
                # When logged in, LinkedIn often redirects to a URL with `currentJobId`.
                # We target the base search URL and let LinkedIn handle the redirect.
                keywords_encoded = criteria.keywords.replace(' ', '%20')
                location_encoded = criteria.location.replace(' ', '%20') if criteria.location else ""

                search_url = f"https://www.linkedin.com/jobs/search/?keywords={keywords_encoded}"
                if location_encoded:
                    search_url += f"&location={location_encoded}"

                print(f"Navigating to job search: {search_url}")
                await page.goto(search_url, wait_until="domcontentloaded", timeout=60000) # Increased timeout

                # Wait for initial job cards to load.
                job_list_selector = "div[data-job-id]"
                await page.wait_for_selector(job_list_selector, timeout=300000)

                seen_job_urls = set()

                while len(jobs) < limit:
                    previous_job_count = len(jobs)
                    # Use the CORRECT selector to find all visible job cards
                    job_cards = await page.locator(job_list_selector).all()
                    print(f"Found {len(job_cards)} job cards on page. Scraping new ones...")

                    for card in job_cards:
                        if len(jobs) >= limit:
                            break

                        job_link_element = card.locator("a.job-card-container__link")
                        job_url_relative = await job_link_element.get_attribute("href")

                        if not job_url_relative:
                            continue

                        job_url_base = job_url_relative.split('?')[0]
                        full_job_url = f"https://www.linkedin.com{job_url_base}"

                        if full_job_url in seen_job_urls:
                            continue

                        try:
                            await card.click(timeout=5000)
                            await asyncio.sleep(2)

                            job_listing = await self._extract_job_details(page, full_job_url)

                            if job_listing:
                                jobs.append(job_listing)
                                seen_job_urls.add(full_job_url)
                                print(f"[{len(jobs)}/{limit}] Scraped: {job_listing.title}")

                        except PlaywrightTimeoutError:
                            print(f"Timeout while processing job: {full_job_url}")
                            continue
                        except Exception as e:
                            print(f"An unexpected error occurred for {full_job_url}: {e}")
                            continue

                    if len(jobs) < limit:
                        print("\n Scrolling to load more jobs...")
                        scrollable_list_container = page.locator("div.jobs-search__results-list-container")
                        await scrollable_list_container.evaluate("node => node.scrollTop = node.scrollHeight")

                        # Wait for new content to potentially load
                        await asyncio.sleep(3)

                        # If no new jobs were added after scrolling, we've likely reached the end
                        if len(jobs) == previous_job_count:
                            print("No new jobs loaded after scrolling. Ending search.")
                            break

                print(f"\n Scraping complete. Total jobs found: {len(jobs)}")
            except PlaywrightTimeoutError as e:
                print(f"A timeout occurred during the job search process: {e}")
                await page.screenshot(path="search_timeout_error.png")
            except Exception as e:
                print(f"An unexpected error occurred during job search: {e}")
                await page.screenshot(path="search_general_error.png")
            finally:
                print("Closing browser.")
                await context.close()
                await browser.close()

            return jobs