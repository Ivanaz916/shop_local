#!/usr/bin/env python3
"""
Facebook Marketplace Screenshot Script

Takes screenshots of Facebook Marketplace listings in Arlington, MA
and saves them to a designated folder. Designed to run once per day.

Usage:
    python screenshot_marketplace.py              # Take screenshots now
    python screenshot_marketplace.py --schedule   # Run daily at 9:00 AM
"""

import os
import sys
import argparse
import logging
from datetime import datetime, date
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

# Configuration
MARKETPLACE_URL = (
    "https://www.facebook.com/marketplace/arlington-ma/"
)
SCREENSHOTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
LOCK_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".last_run")
SCROLL_PAUSE_MS = 2000
NUM_SCROLLS = 3  # Number of times to scroll down to load more listings

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def already_ran_today() -> bool:
    """Check if the script has already run today."""
    if not os.path.exists(LOCK_FILE):
        return False
    with open(LOCK_FILE, "r") as f:
        last_run_date = f.read().strip()
    return last_run_date == str(date.today())


def mark_as_ran_today():
    """Record that the script ran today."""
    with open(LOCK_FILE, "w") as f:
        f.write(str(date.today()))


def take_marketplace_screenshots(output_dir: str | None = None) -> list[str]:
    """
    Navigate to Facebook Marketplace for Arlington, MA and take screenshots.

    Returns a list of saved screenshot file paths.
    """
    if output_dir is None:
        output_dir = SCREENSHOTS_DIR
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    saved_files = []

    logger.info("Launching browser...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()

        try:
            logger.info("Navigating to Facebook Marketplace (Arlington, MA)...")
            page.goto(MARKETPLACE_URL, wait_until="networkidle", timeout=60000)

            # Wait for page content to load
            page.wait_for_timeout(3000)

            # Take initial viewport screenshot
            filename = f"marketplace_arlington_ma_{timestamp}_page1.png"
            filepath = os.path.join(output_dir, filename)
            page.screenshot(path=filepath, full_page=False)
            saved_files.append(filepath)
            logger.info(f"Saved screenshot: {filepath}")

            # Scroll down and capture more listings
            for i in range(NUM_SCROLLS):
                page.evaluate("window.scrollBy(0, window.innerHeight)")
                page.wait_for_timeout(SCROLL_PAUSE_MS)

                filename = f"marketplace_arlington_ma_{timestamp}_page{i + 2}.png"
                filepath = os.path.join(output_dir, filename)
                page.screenshot(path=filepath, full_page=False)
                saved_files.append(filepath)
                logger.info(f"Saved screenshot: {filepath}")

            # Also take a full-page screenshot
            filename = f"marketplace_arlington_ma_{timestamp}_full.png"
            filepath = os.path.join(output_dir, filename)
            page.screenshot(path=filepath, full_page=True)
            saved_files.append(filepath)
            logger.info(f"Saved full-page screenshot: {filepath}")

        except PlaywrightTimeout:
            logger.error("Timed out loading the marketplace page.")
            # Take a screenshot of whatever loaded
            filename = f"marketplace_arlington_ma_{timestamp}_timeout.png"
            filepath = os.path.join(output_dir, filename)
            page.screenshot(path=filepath)
            saved_files.append(filepath)
            logger.warning(f"Saved partial screenshot: {filepath}")

        except Exception as e:
            logger.error(f"Error taking screenshots: {e}")

        finally:
            browser.close()

    return saved_files


def run_once(force: bool = False, output_dir: str | None = None):
    """Run the screenshot capture once, respecting the once-per-day limit."""
    if not force and already_ran_today():
        logger.info("Already ran today. Use --force to override.")
        return

    logger.info("Starting Facebook Marketplace screenshot capture...")
    files = take_marketplace_screenshots(output_dir=output_dir)

    if files:
        mark_as_ran_today()
        logger.info(f"Done! Captured {len(files)} screenshot(s).")
        for f in files:
            logger.info(f"  - {f}")
    else:
        logger.warning("No screenshots were captured.")


def run_scheduled(run_time: str = "09:00", output_dir: str | None = None):
    """Run the screenshot task on a daily schedule."""
    import schedule
    import time

    logger.info(f"Scheduling daily screenshots at {run_time}...")

    schedule.every().day.at(run_time).do(run_once, output_dir=output_dir)

    # Also run immediately if not already run today
    run_once(output_dir=output_dir)

    while True:
        schedule.run_pending()
        time.sleep(60)


def main():
    parser = argparse.ArgumentParser(
        description="Take daily screenshots of Facebook Marketplace listings in Arlington, MA"
    )
    parser.add_argument(
        "--schedule",
        action="store_true",
        help="Run on a daily schedule (default: 9:00 AM)",
    )
    parser.add_argument(
        "--time",
        type=str,
        default="09:00",
        help="Time to run daily (HH:MM format, default: 09:00)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force run even if already ran today",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=SCREENSHOTS_DIR,
        help=f"Directory to save screenshots (default: {SCREENSHOTS_DIR})",
    )

    args = parser.parse_args()

    output_dir = args.output_dir

    if args.schedule:
        run_scheduled(args.time, output_dir=output_dir)
    else:
        run_once(force=args.force, output_dir=output_dir)


if __name__ == "__main__":
    main()
