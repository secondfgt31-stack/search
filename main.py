"""
Unified Runner for TelePrice Telegram Price Comparison System.
Runs both the Telethon Userbot Scraper and the python-telegram-bot Search Bot
concurrently within a single asyncio event loop with graceful signal handling.
"""

import sys
import signal
import asyncio
import logging
from typing import Optional

import config
import database
import scraper
import bot

logger = logging.getLogger("TelePrice.Main")


async def run_concurrent_services() -> None:
    """Initializes database and runs scraper and search bot concurrently."""
    logger.info("Initializing TelePrice System...")
    database.init_db(config.DB_PATH)

    # Check configurations
    has_scraper_creds = config.validate_scraper_config()
    has_bot_creds = config.validate_bot_config()

    if not has_scraper_creds and not has_bot_creds:
        logger.fatal(
            "Neither scraper credentials (API_ID, API_HASH) nor bot credentials (BOT_TOKEN) "
            "are configured in .env. Please see .env.example."
        )
        sys.exit(1)

    tasks = []
    stop_event = asyncio.Event()

    # 1. Telethon Userbot Scraper Service
    telethon_client = None
    if has_scraper_creds:
        try:
            telethon_client = await scraper.setup_scraper_client()
            logger.info("Connecting Telethon Userbot...")
            await telethon_client.start()
            await scraper.register_handlers(telethon_client, config.DB_PATH)
            me = await telethon_client.get_me()
            logger.info("Scraper active as @%s (ID: %s)", getattr(me, "username", "Userbot"), me.id)

            async def scraper_worker():
                try:
                    await telethon_client.run_until_disconnected()
                except asyncio.CancelledError:
                    pass

            tasks.append(asyncio.create_task(scraper_worker(), name="telethon_scraper"))
        except Exception as e:
            logger.error("Failed to start Telethon scraper: %s", e)
    else:
        logger.warning("Skipping scraper service (credentials missing).")

    # 2. python-telegram-bot Service
    bot_app = None
    if has_bot_creds:
        try:
            bot_app = await bot.build_bot_app()
            logger.info("Initializing search bot application...")
            await bot_app.initialize()
            await bot_app.start()
            await bot_app.updater.start_polling(drop_pending_updates=True)
            logger.info("Search bot polling started successfully.")

            async def bot_worker():
                try:
                    await stop_event.wait()
                except asyncio.CancelledError:
                    pass

            tasks.append(asyncio.create_task(bot_worker(), name="telegram_bot"))
        except Exception as e:
            logger.error("Failed to start Telegram Search Bot: %s", e)
    else:
        logger.warning("Skipping search bot service (BOT_TOKEN missing).")

    if not tasks:
        logger.fatal("No active services could be started. Exiting.")
        sys.exit(1)

    # Signal handlers for graceful shutdown (SIGINT, SIGTERM)
    loop = asyncio.get_running_loop()

    def handle_signal():
        logger.info("Shutdown signal received! Gracefully stopping all services...")
        stop_event.set()
        for t in tasks:
            t.cancel()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, handle_signal)
        except (NotImplementedError, RuntimeError):
            # Windows or restricted environments
            pass

    logger.info("TelePrice System is fully OPERATIONAL. Press Ctrl+C to stop.")

    try:
        await asyncio.gather(*tasks, return_exceptions=True)
    finally:
        logger.info("Cleaning up background connections...")
        if bot_app and bot_app.updater and bot_app.updater.running:
            await bot_app.updater.stop()
            await bot_app.stop()
            await bot_app.shutdown()
            logger.info("Search bot shutdown complete.")

        if telethon_client and telethon_client.is_connected():
            await telethon_client.disconnect()
            logger.info("Telethon client disconnected.")

        logger.info("TelePrice shutdown cleanly.")


def main():
    """Main process entrypoint."""
    try:
        asyncio.run(run_concurrent_services())
    except KeyboardInterrupt:
        logger.info("Process interrupted by user. Goodbye.")


if __name__ == "__main__":
    main()
