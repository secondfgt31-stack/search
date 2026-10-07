"""
Telethon Userbot Scraper for Telegram Price Comparison System.
Listens to targeted Indonesian digital product seller channels and upserts parsed deals.
"""

import sys
import asyncio
import logging
from telethon import TelegramClient, events
from telethon.tl.types import Channel, Chat

import config
import database
from parser import extract_products_from_message, format_idr

logger = logging.getLogger("TelePrice.Scraper")


def build_message_link(chat_entity, message_id: int) -> str:
    """Constructs a clickable t.me link for the scraped message."""
    username = getattr(chat_entity, "username", None)
    if username:
        return f"https://t.me/{username}/{message_id}"
    
    # Fallback for private supergroups / channels using channel ID
    chat_id = getattr(chat_entity, "id", None)
    if chat_id:
        return f"https://t.me/c/{chat_id}/{message_id}"
    
    return f"https://t.me/c/unknown/{message_id}"


def get_channel_display_name(chat_entity) -> str:
    """Extracts a clean channel handle or title."""
    username = getattr(chat_entity, "username", None)
    if username:
        return f"@{username}"
    title = getattr(chat_entity, "title", None)
    if title:
        return title
    return "UnknownChannel"


async def setup_scraper_client() -> TelegramClient:
    """Initializes and returns the Telethon client."""
    if not config.validate_scraper_config():
        raise ValueError(
            "Missing Telegram API credentials! Set API_ID and API_HASH in your .env file."
        )

    client = TelegramClient(
        config.SESSION_NAME,
        config.API_ID,
        config.API_HASH,
    )
    return client


async def register_handlers(client: TelegramClient, db_path: str = config.DB_PATH) -> None:
    """Registers event handlers for incoming channel broadcast messages."""
    target_chats = config.TARGET_CHANNELS
    logger.info("Registering scraper listener for channels: %s", target_chats)

    @client.on(events.NewMessage(chats=target_chats if target_chats else None))
    async def handle_new_message(event):
        try:
            message = event.message
            raw_text = message.message or ""
            if not raw_text.strip():
                return

            chat = await event.get_chat()
            channel_name = get_channel_display_name(chat)
            message_link = build_message_link(chat, message.id)

            logger.info("Received new message #%s from %s", message.id, channel_name)

            # Parse products and prices from message body
            extracted = extract_products_from_message(raw_text)
            if not extracted:
                logger.debug("No digital products identified in message #%s", message.id)
                return

            # UPSERT extracted items into SQLite
            upserted_count = 0
            for prod_name, price in extracted:
                database.upsert_product(
                    channel_username=channel_name,
                    product_name=prod_name,
                    price=price,
                    message_link=message_link,
                    db_path=db_path,
                )
                upserted_count += 1
                logger.info(
                    "Scraped [%s]: %s -> %s (Link: %s)",
                    channel_name,
                    prod_name,
                    format_idr(price),
                    message_link,
                )

            logger.info("Successfully indexed %d products from message #%s", upserted_count, message.id)

        except Exception as exc:
            logger.exception("Error processing incoming message #%s: %s", getattr(event, "id", "?"), exc)


async def run_scraper(db_path: str = config.DB_PATH) -> None:
    """Main entrypoint for standalone scraper execution."""
    database.init_db(db_path)
    client = await setup_scraper_client()

    logger.info("Starting Telethon userbot client...")
    await client.start()
    logger.info("Telethon userbot logged in successfully!")

    await register_handlers(client, db_path)

    me = await client.get_me()
    logger.info(
        "Userbot is now active as '%s' (ID: %s). Listening for posts...",
        getattr(me, "first_name", "Userbot"),
        me.id,
    )

    try:
        await client.run_until_disconnected()
    finally:
        await client.disconnect()
        logger.info("Telethon scraper disconnected.")


if __name__ == "__main__":
    try:
        asyncio.run(run_scraper())
    except KeyboardInterrupt:
        logger.info("Scraper process terminated by user.")
    except Exception as err:
        logger.fatal("Fatal error in scraper: %s", err)
        sys.exit(1)
