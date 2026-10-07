export interface PythonFile {
  name: string;
  path: string;
  category: 'core' | 'config' | 'tests' | 'docs';
  description: string;
  code: string;
}

export const PYTHON_FILES: PythonFile[] = [
  {
    name: 'main.py',
    path: 'main.py',
    category: 'core',
    description: 'Unified runner: starts Telethon scraper and python-telegram-bot concurrently via asyncio',
    code: `"""
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
    try:
        asyncio.run(run_concurrent_services())
    except KeyboardInterrupt:
        logger.info("Process interrupted by user. Goodbye.")


if __name__ == "__main__":
    main()
`
  },
  {
    name: 'scraper.py',
    path: 'scraper.py',
    category: 'core',
    description: 'Telethon Userbot Scraper: listens to seller channels, extracts prices, and upserts into SQLite',
    code: `"""
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

            extracted = extract_products_from_message(raw_text)
            if not extracted:
                logger.debug("No digital products identified in message #%s", message.id)
                return

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
    database.init_db(db_path)
    client = await setup_scraper_client()

    logger.info("Starting Telethon userbot client...")
    await client.start()
    logger.info("Telethon userbot logged in successfully!")

    await register_handlers(client, db_path)

    me = await client.get_me()
    logger.info("Userbot is active as '%s'. Listening for posts...", getattr(me, "first_name", "Userbot"))

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
`
  },
  {
    name: 'bot.py',
    path: 'bot.py',
    category: 'core',
    description: 'python-telegram-bot: serves /start, queries SQLite with LIKE %q%, sorts cheapest first, renders HTML',
    code: `"""
Search Bot for Telegram Digital Products Price Comparison System.
Built using python-telegram-bot (v20+ async architecture).
Serves search queries with cheapest-first price comparison and direct post links.
"""

import sys
import logging
import html
from typing import List, Dict, Any
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

import config
import database
from parser import format_idr

logger = logging.getLogger("TelePrice.SearchBot")


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles the /start command."""
    user = update.effective_user
    user_name = html.escape(user.first_name if user else "Pengguna")

    welcome_text = (
        f"👋 <b>Halo, {user_name}!</b>\\n\\n"
        "Selamat datang di <b>TelePrice</b> — Bot Perbandingan Harga Produk Digital.\\n\\n"
        "🔍 <b>Cara Penggunaan:</b>\\n"
        "Cukup ketik dan kirimkan nama produk digital yang ingin Anda cari.\\n\\n"
        "<b>Contoh kata kunci:</b>\\n"
        "• <code>chatgpt</code> atau <code>chatgpt plus</code>\\n"
        "• <code>canva</code> atau <code>canva pro</code>\\n"
        "• <code>netflix</code>\\n"
        "• <code>spotify</code>\\n"
        "• <code>youtube</code>\\n"
        "• <code>capcut</code>\\n\\n"
        "⚡ <i>Hasil akan diurutkan dari yang <b>paling murah</b> (TOP 5) dari berbagai channel seller Telegram terpercaya!</i>"
    )

    keyboard = [
        [
            InlineKeyboardButton("🔍 Cari ChatGPT", switch_inline_query_current_chat="chatgpt"),
            InlineKeyboardButton("🔍 Cari Canva", switch_inline_query_current_chat="canva"),
        ],
        [
            InlineKeyboardButton("📊 Statistik Bot", callback_data="btn_stats"),
        ]
    ]

    await update.message.reply_text(
        text=welcome_text,
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(keyboard),
        disable_web_page_preview=True,
    )


def format_search_results(query: str, results: List[Dict[str, Any]]) -> str:
    """Formats product comparison records into a high-converting, clean HTML Telegram message."""
    escaped_query = html.escape(query)

    if not results:
        return (
            f"❌ <b>Produk Tidak Ditemukan</b>\\n\\n"
            f"Tidak ada penawaran untuk kata kunci: <code>{escaped_query}</code>\\n\\n"
            "💡 <b>Saran:</b>\\n"
            "• Gunakan nama yang lebih umum (contoh: <code>canva</code>)\\n"
            "• Pastikan ejaan benar (misal: <code>spotify</code>, bukan <code>spotipi</code>)\\n"
            "• Ketik /stats untuk melihat daftar produk yang tersedia di database."
        )

    medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]
    msg_lines = [
        f"🔎 <b>Hasil Perbandingan Harga:</b> <code>{escaped_query}</code>",
        f"<i>Ditemukan {len(results)} penawaran termurah:</i>\\n",
    ]

    for idx, item in enumerate(results):
        medal = medals[idx] if idx < len(medals) else f"#{idx+1}"
        prod_name = html.escape(item["product_name"])
        price_formatted = format_idr(item["price"])
        channel_name = html.escape(item["channel_username"])
        msg_link = item["message_link"]
        updated_at = item.get("updated_at", "")[:10]

        ch_display = f"@{channel_name}" if not channel_name.startswith("@") else channel_name

        entry = (
            f"{medal} <b>{prod_name}</b>\\n"
            f"   💰 <b>{price_formatted}</b>\\n"
            f"   📢 Seller: <b>{ch_display}</b>\\n"
            f"   🔗 <a href=\\"{msg_link}\\">Buka Pesan di Telegram</a>\\n"
            f"   🕒 <i>Update: {updated_at}</i>"
        )
        msg_lines.append(entry)

    msg_lines.append("\\n⚠️ <i>Catatan: Selalu verifikasi reputasi seller sebelum bertransaksi.</i>")
    return "\\n".join(msg_lines)


async def handle_search_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Processes user search input and queries the database."""
    if not update.message or not update.message.text:
        return

    query = update.message.text.strip()
    user_id = update.effective_user.id if update.effective_user else "unknown"
    logger.info("Search query received from user [%s]: '%s'", user_id, query)

    # Query SQLite database for matching products, ordered by price ASC, limit 5
    results = database.search_products(
        query=query,
        limit=5,
        db_path=config.DB_PATH,
    )

    formatted_response = format_search_results(query, results)

    keyboard_buttons = []
    if results:
        for idx, item in enumerate(results[:3]):
            prod_short = item["product_name"][:16]
            price_tag = format_idr(item["price"])
            keyboard_buttons.append([
                InlineKeyboardButton(
                    f"#{idx+1} {prod_short} ({price_tag})",
                    url=item["message_link"],
                )
            ])

    reply_markup = InlineKeyboardMarkup(keyboard_buttons) if keyboard_buttons else None

    await update.message.reply_text(
        text=formatted_response,
        parse_mode=ParseMode.HTML,
        reply_markup=reply_markup,
        disable_web_page_preview=True,
    )


async def build_bot_app() -> Application:
    if not config.validate_bot_config():
        raise ValueError("Missing BOT_TOKEN! Please specify BOT_TOKEN in your .env file.")

    app = ApplicationBuilder().token(config.BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_search_message))
    return app


async def run_bot(db_path: str = config.DB_PATH) -> None:
    database.init_db(db_path)
    app = await build_bot_app()

    logger.info("Starting python-telegram-bot polling...")
    await app.initialize()
    await app.start()
    await app.updater.start_polling(drop_pending_updates=True)
    logger.info("Search bot is now active and polling for updates!")

    try:
        import asyncio
        stop_event = asyncio.Event()
        await stop_event.wait()
    finally:
        await app.updater.stop()
        await app.stop()
        await app.shutdown()
        logger.info("Bot stopped successfully.")


if __name__ == "__main__":
    import asyncio
    asyncio.run(run_bot())
`
  },
  {
    name: 'parser.py',
    path: 'parser.py',
    category: 'core',
    description: 'Regex Parser: parses Rp 25.000, 25k, 25rb, Rp.25000, strips broadcast noise, multi-line support',
    code: `"""
Regex-based Parser module for Indonesian Digital Product Seller Broadcasts.
Handles extraction of product names and various Indonesian price formats.
"""

import re
import logging
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger("TelePrice.Parser")

COMMON_PRODUCTS = [
    "chatgpt plus", "chatgpt 4o", "chatgpt", "openai",
    "canva pro", "canva edu", "canva",
    "netflix premium", "netflix 1p1u", "netflix 1p2u", "netflix private", "netflix",
    "spotify premium", "spotify individual", "spotify family", "spotify",
    "youtube premium", "yt premium", "youtube",
    "disney+ hotstar", "disney plus", "disney+",
    "capcut pro", "capcut",
    "github copilot", "copilot",
    "midjourney",
    "claude pro", "claude",
    "apple music", "apple tv",
    "prime video", "amazon prime",
    "grammarly premium", "grammarly",
    "duolingo super", "duolingo plus", "duolingo",
    "nordvpn", "expressvpn",
    "vidio platinum", "vidio",
    "wetv vip", "wetv",
]

STOP_TITLES = {
    "harga", "price", "pricelist", "list", "promo", "hanya", "cuma",
    "mulai", "start", "net", "nett", "diskon", "sale", "order", "minat",
    "info", "ready", "stock", "garansi", "rules", "format", "payment"
}


def parse_price(price_str: str) -> Optional[int]:
    """Converts diverse Indonesian price strings into clean integer IDR."""
    if not price_str:
        return None

    cleaned = price_str.strip().lower()

    # Step 1: Explicit currency markers: 'Rp 25.000', 'Rp. 25.000', 'Rp.25000', 'IDR 25.000'
    rp_match = re.search(r"(?:rp\\.?|idr)\\s*([\\d\\.,]+)", cleaned)
    if rp_match:
        digits_raw = rp_match.group(1)
        digits_clean = re.sub(r"[^\\d]", "", digits_raw)
        if digits_clean:
            try:
                price_val = int(digits_clean)
                if 1000 <= price_val <= 50_000_000:
                    return price_val
            except ValueError:
                pass

    # Step 2: '25rb' or '25 rb' or '25 ribu' or '25ribu'
    rb_match = re.search(r"(\\d+(?:[.,]\\d+)?)\\s*(?:rb|ribu)\\b", cleaned)
    if rb_match:
        val_str = rb_match.group(1).replace(",", ".")
        try:
            return int(float(val_str) * 1000)
        except ValueError:
            pass

    # Step 3: '25k' or '25.5k' (exclude 4k, 8k resolution in video contexts)
    k_matches = re.finditer(r"(\\d+(?:[.,]\\d+)?)\\s*k\\b", cleaned)
    for k_m in k_matches:
        val_str = k_m.group(1).replace(",", ".")
        try:
            num_val = float(val_str)
            if num_val in [4.0, 8.0] and re.search(r"\\b(4k|8k)\\s*(uhd|hd|res|video)?\\b", cleaned):
                continue
            return int(num_val * 1000)
        except ValueError:
            pass

    # Step 4: Standalone Indonesian format like '25.000'
    plain_dot_match = re.search(r"\\b(\\d{1,3}(?:\\.\\d{3})+)\\b", cleaned)
    if plain_dot_match:
        digits_clean = plain_dot_match.group(1).replace(".", "")
        try:
            return int(digits_clean)
        except ValueError:
            pass

    return None


def clean_product_name(raw_name: str) -> str:
    name = re.sub(r"^[\\s•\\-*#~🔥⚡✨✅🎉👉📌▶️🔴⚪⭐🌟\\d\\.\\)]+", "", raw_name)
    name = re.sub(r"[\\s:\\-=]+$", "", name)
    name = re.sub(r"\\b(promo terbatas|flash sale|ready stock|ready|promo)\\b", "", name, flags=re.IGNORECASE)
    return re.sub(r"\\s+", " ", name).strip()


def extract_products_from_message(text: str) -> List[Tuple[str, int]]:
    if not text or not text.strip():
        return []

    results: List[Tuple[str, int]] = []
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    separator_regex = re.compile(
        r"^([^:\\-=\\n]+?)[\\s:\\-=]+(?:"
        r"(?:rp\\.?|idr)\\s*[\\d\\.,]+|"
        r"\\d+(?:[.,]\\d+)?[\\s]*(?:k|rb|ribu)\\b|"
        r"\\d{1,3}(?:\\.\\d{3})+"
        r")",
        re.IGNORECASE,
    )

    for i, line_clean in enumerate(lines):
        sep_match = separator_regex.search(line_clean)
        if sep_match:
            raw_title = sep_match.group(1)
            product_title = clean_product_name(raw_title)
            price_sub = line_clean[len(raw_title):]
            price = parse_price(price_sub)

            if product_title and price and len(product_title) >= 3:
                if product_title.lower() not in STOP_TITLES:
                    results.append((product_title, price))
                    continue
                else:
                    for prev_idx in range(i - 1, -1, -1):
                        prev_line = lines[prev_idx]
                        for known in COMMON_PRODUCTS:
                            if re.search(rf"\\b{re.escape(known)}\\b", prev_line, re.IGNORECASE):
                                clean_prev = clean_product_name(prev_line)
                                if clean_prev.lower() not in STOP_TITLES and len(clean_prev) >= 3:
                                    results.append((clean_prev, price))
                                    break
                        if results:
                            break

        for known in COMMON_PRODUCTS:
            pattern = re.compile(rf"\\b({re.escape(known)}[^\\n:\\-,]*?)[\\s:\\-=]+([^\\n]+)", re.IGNORECASE)
            match = pattern.search(line_clean)
            if match:
                raw_prod = match.group(1)
                tail = match.group(2)
                price = parse_price(tail)
                if price:
                    clean_prod = clean_product_name(raw_prod)
                    if clean_prod.lower() not in STOP_TITLES:
                        results.append((clean_prod, price))
                        break

    if not results:
        overall_price = parse_price(text)
        if overall_price:
            for known in COMMON_PRODUCTS:
                if re.search(rf"\\b{re.escape(known)}\\b", text, re.IGNORECASE):
                    for line in lines:
                        if re.search(rf"\\b{re.escape(known)}\\b", line, re.IGNORECASE):
                            clean_line = clean_product_name(line)
                            if clean_line.lower() not in STOP_TITLES and len(clean_line) >= 3:
                                results.append((clean_line.title(), overall_price))
                                break
                    if results:
                        break
                    results.append((known.title(), overall_price))
                    break

    seen = set()
    deduped: List[Tuple[str, int]] = []
    for prod, price in results:
        key = (prod.lower(), price)
        if key not in seen:
            seen.add(key)
            deduped.append((prod, price))

    return deduped


def format_idr(price: int) -> str:
    return f"Rp {price:,}".replace(",", ".")
`
  },
  {
    name: 'database.py',
    path: 'database.py',
    category: 'core',
    description: 'SQLite database module: creates products table, handles UPSERT with ON CONFLICT, LIKE search',
    code: `"""
Database module for Telegram Digital Products Price Comparison System.
Manages SQLite connection, table schemas, and queries.
"""

import sqlite3
import logging
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger("TelePrice.Database")


def get_connection(db_path: str = "database.sqlite3") -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: str = "database.sqlite3") -> None:
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                channel_username TEXT NOT NULL,
                product_name TEXT NOT NULL,
                price INTEGER NOT NULL,
                message_link TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (channel_username, product_name)
            )
            """
        )
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_products_name ON products(product_name COLLATE NOCASE)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_products_price ON products(price ASC)")
        conn.commit()


def upsert_product(channel_username: str, product_name: str, price: int, message_link: str, db_path: str = "database.sqlite3") -> Dict[str, Any]:
    channel_clean = channel_username.strip().lstrip("@")
    product_clean = product_name.strip()
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO products (channel_username, product_name, price, message_link, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(channel_username, product_name) DO UPDATE SET
                price = excluded.price,
                message_link = excluded.message_link,
                updated_at = excluded.updated_at
            RETURNING id, channel_username, product_name, price, message_link, updated_at
            """,
            (channel_clean, product_clean, price, message_link, now_str),
        )
        row = cursor.fetchone()
        conn.commit()
        return dict(row) if row else {}


def search_products(query: str, limit: int = 5, db_path: str = "database.sqlite3") -> List[Dict[str, Any]]:
    cleaned_query = query.strip()
    if not cleaned_query:
        return []

    like_pattern = f"%{cleaned_query}%"
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, channel_username, product_name, price, message_link, updated_at
            FROM products
            WHERE product_name LIKE ?
            ORDER BY price ASC
            LIMIT ?
            """,
            (like_pattern, limit),
        )
        return [dict(row) for row in cursor.fetchall()]
`
  },
  {
    name: 'config.py',
    path: 'config.py',
    category: 'config',
    description: 'Configuration loader with validation and python-dotenv support',
    code: `import os
import logging
from typing import List
from dotenv import load_dotenv

load_dotenv()

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)-7s | %(name)-18s | %(message)s",
)

API_ID = int(os.getenv("API_ID", 0) or 0)
API_HASH = os.getenv("API_HASH", "")
BOT_TOKEN = os.getenv("BOT_TOKEN", "")

TARGET_CHANNELS_RAW = os.getenv("TARGET_CHANNELS", "@digitalpremium_id,@sellerapp_indo")
TARGET_CHANNELS: List[str] = [ch.strip() for ch in TARGET_CHANNELS_RAW.split(",") if ch.strip()]

DB_PATH = os.getenv("DB_PATH", "database.sqlite3")
SESSION_NAME = os.getenv("SESSION_NAME", "teleprice_userbot")

def validate_scraper_config() -> bool:
    return bool(API_ID and API_HASH)

def validate_bot_config() -> bool:
    return bool(BOT_TOKEN)
`
  },
  {
    name: 'requirements.txt',
    path: 'requirements.txt',
    category: 'config',
    description: 'Python package dependencies',
    code: `telethon>=1.36.0
python-telegram-bot[job-queue]>=21.1.1
python-dotenv>=1.0.1
tabulate>=0.9.0
pytest>=8.2.0
`
  },
  {
    name: '.env.example',
    path: '.env.example',
    category: 'config',
    description: 'Environment variable templates for Telethon and BotFather',
    code: `# Telegram Client Credentials (from https://my.telegram.org)
API_ID=12345678
API_HASH=your_api_hash_here

# Telegram Bot Token (from @BotFather)
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxyz

# Target Channels to Scrape (comma-separated usernames or IDs)
TARGET_CHANNELS=@digitalpremium_id,@sellerapp_indo,@tokomurahdigital,@akunpremium_store

# Storage & Session
DB_PATH=database.sqlite3
SESSION_NAME=teleprice_userbot
LOG_LEVEL=INFO
`
  },
  {
    name: 'test_parser.py',
    path: 'tests/test_parser.py',
    category: 'tests',
    description: 'Unit test suite testing Indonesian price formats (Rp 25.000, 25k, 25rb, Rp.25000, etc.)',
    code: `import unittest
from parser import parse_price, extract_products_from_message, format_idr

class TestPriceParser(unittest.TestCase):
    def test_indonesian_price_formats(self):
        self.assertEqual(parse_price("Rp 25.000"), 25000)
        self.assertEqual(parse_price("25k"), 25000)
        self.assertEqual(parse_price("25rb"), 25000)
        self.assertEqual(parse_price("Rp.25000"), 25000)
        self.assertEqual(parse_price("25.5k"), 25500)
        self.assertEqual(parse_price("IDR 50.000"), 50000)

    def test_format_idr(self):
        self.assertEqual(format_idr(25000), "Rp 25.000")

    def test_multiline_pricelist_extraction(self):
        post = """
🔥 READY STOCK AKUN PREMIUM 🔥
• ChatGPT Plus Shared: Rp 45.000
• Canva Pro 1 Tahun: 15k
• Netflix 1P1U 4K: 28rb
• Spotify Family Plan: Rp. 20000
        """
        extracted = extract_products_from_message(post)
        self.assertGreaterEqual(len(extracted), 4)

if __name__ == "__main__":
    unittest.main()
`
  },
  {
    name: 'README.md',
    path: 'README.md',
    category: 'docs',
    description: 'Complete architecture guide, credentials tutorial, and deployment instructions',
    code: `# TelePrice: Telegram Digital Products Price Comparison System

A high-performance asynchronous system for tracking and comparing prices of digital products (ChatGPT Plus, Canva Pro, Netflix, Spotify, YouTube Premium) across Telegram seller channels in Indonesia.

## 🚀 Quick Start
1. Install dependencies: \`pip install -r requirements.txt\`
2. Configure \`.env\` from \`.env.example\`
3. Seed sample data: \`python seed_data.py\`
4. Run system: \`python main.py\` (or \`python scraper.py\` & \`python bot.py\` separately)
`
  }
];
