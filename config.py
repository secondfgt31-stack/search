"""
Configuration module for Telegram Price Comparison System.
Loads credentials and runtime settings from environment variables.
"""

import os
import sys
import logging
from typing import List
from dotenv import load_dotenv

# Load variables from .env file
load_dotenv()

# Configure basic logging format
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)-7s | %(name)-18s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("TelePrice.Config")

# Telegram API Client Credentials (from https://my.telegram.org)
API_ID_RAW = os.getenv("API_ID", "")
API_HASH = os.getenv("API_HASH", "")

try:
    API_ID = int(API_ID_RAW) if API_ID_RAW else 0
except ValueError:
    logger.error("API_ID must be a valid integer.")
    API_ID = 0

# Telegram Bot Token (from @BotFather)
BOT_TOKEN = os.getenv("BOT_TOKEN", "")

# Target channels to scrape (e.g., "@channel1,@channel2")
TARGET_CHANNELS_RAW = os.getenv("TARGET_CHANNELS", "@digitalpremium_id,@sellerapp_indo")
TARGET_CHANNELS: List[str] = [
    ch.strip() for ch in TARGET_CHANNELS_RAW.split(",") if ch.strip()
]

# Database Path
DB_PATH = os.getenv("DB_PATH", "database.sqlite3")

# Telethon session file name
SESSION_NAME = os.getenv("SESSION_NAME", "teleprice_userbot")


def validate_scraper_config() -> bool:
    """Validates if required scraper credentials exist."""
    if not API_ID or not API_HASH:
        logger.warning(
            "API_ID or API_HASH is missing. Telethon userbot will not be able to log in. "
            "Please configure them in your .env file."
        )
        return False
    return True


def validate_bot_config() -> bool:
    """Validates if Telegram Bot token exists."""
    if not BOT_TOKEN:
        logger.warning(
            "BOT_TOKEN is missing. Search bot will not be able to start. "
            "Please configure BOT_TOKEN in your .env file."
        )
        return False
    return True
