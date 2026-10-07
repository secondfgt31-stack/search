"""
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
        f"👋 <b>Halo, {user_name}!</b>\n\n"
        "Selamat datang di <b>TelePrice</b> — Bot Perbandingan Harga Produk Digital.\n\n"
        "🔍 <b>Cara Penggunaan:</b>\n"
        "Cukup ketik dan kirimkan nama produk digital yang ingin Anda cari.\n\n"
        "<b>Contoh kata kunci:</b>\n"
        "• <code>chatgpt</code> atau <code>chatgpt plus</code>\n"
        "• <code>canva</code> atau <code>canva pro</code>\n"
        "• <code>netflix</code>\n"
        "• <code>spotify</code>\n"
        "• <code>youtube</code>\n"
        "• <code>capcut</code>\n\n"
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


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles the /help command."""
    help_text = (
        "📖 <b>Panduan TelePrice Bot</b>\n\n"
        "1. <b>Pencarian Produk:</b>\n"
        "   Ketik nama produk secara langsung tanpa tanda garis miring (contoh: <code>netflix</code>).\n\n"
        "2. <b>Peringkat Harga:</b>\n"
        "   Sistem mencari seluruh listing seller dan menyajikan 5 penawaran termurah.\n\n"
        "3. <b>Link Postingan Asli:</b>\n"
        "   Klik tautan pada nama channel atau tombol untuk langsung menuju ke pesan seller di Telegram.\n\n"
        "📌 <i>Tips: Jika tidak menemukan varian spesifik (misal 'ChatGPT 4o 1 Bulan'), coba cari kata kunci utama 'ChatGPT'.</i>"
    )
    await update.message.reply_text(
        text=help_text,
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles the /stats command."""
    stats = database.get_stats(config.DB_PATH)
    total_prod = stats.get("total_products", 0)
    total_ch = stats.get("total_channels", 0)
    top_items = stats.get("top_products", [])

    lines = [
        "📊 <b>Statistik TelePrice Database</b>\n",
        f"• Total Produk Terindeks: <b>{total_prod:,} item</b>",
        f"• Channel Seller Aktif: <b>{total_ch} channel</b>\n",
    ]

    if top_items:
        lines.append("🔥 <b>Produk Paling Banyak Tersedia:</b>")
        for item in top_items:
            name = html.escape(item["product_name"])
            min_p = format_idr(item["min_price"])
            cnt = item["count"]
            lines.append(f"  - <b>{name}</b> ({cnt} listing) • Mulai {min_p}")

    await update.message.reply_text(
        text="\n".join(lines),
        parse_mode=ParseMode.HTML,
    )


def format_search_results(query: str, results: List[Dict[str, Any]]) -> str:
    """Formats product comparison records into a high-converting, clean HTML Telegram message."""
    escaped_query = html.escape(query)

    if not results:
        return (
            f"❌ <b>Produk Tidak Ditemukan</b>\n\n"
            f"Tidak ada penawaran untuk kata kunci: <code>{escaped_query}</code>\n\n"
            "💡 <b>Saran:</b>\n"
            "• Gunakan nama yang lebih umum (contoh: <code>canva</code>, bukan <code>canva edu 1 tahun lifetime full garansi</code>)\n"
            "• Pastikan ejaan benar (misal: <code>spotify</code>, bukan <code>spotipi</code>)\n"
            "• Ketik /stats untuk melihat daftar produk yang tersedia di database."
        )

    medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]
    msg_lines = [
        f"🔎 <b>Hasil Perbandingan Harga:</b> <code>{escaped_query}</code>",
        f"<i>Ditemukan {len(results)} penawaran termurah:</i>\n",
    ]

    for idx, item in enumerate(results):
        medal = medals[idx] if idx < len(medals) else f"#{idx+1}"
        prod_name = html.escape(item["product_name"])
        price_formatted = format_idr(item["price"])
        channel_name = html.escape(item["channel_username"])
        msg_link = item["message_link"]
        updated_at = item.get("updated_at", "")[:10]

        # Channel handle format
        ch_display = f"@{channel_name}" if not channel_name.startswith("@") else channel_name

        entry = (
            f"{medal} <b>{prod_name}</b>\n"
            f"   💰 <b>{price_formatted}</b>\n"
            f"   📢 Seller: <b>{ch_display}</b>\n"
            f"   🔗 <a href=\"{msg_link}\">Buka Pesan di Telegram</a>\n"
            f"   🕒 <i>Update: {updated_at}</i>"
        )
        msg_lines.append(entry)

    msg_lines.append("\n⚠️ <i>Catatan: Selalu verifikasi reputasi seller sebelum bertransaksi.</i>")
    return "\n".join(msg_lines)


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

    # Generate inline keyboard buttons for the top deals
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
    """Builds and configures the python-telegram-bot application."""
    if not config.validate_bot_config():
        raise ValueError("Missing BOT_TOKEN! Please specify BOT_TOKEN in your .env file.")

    app = ApplicationBuilder().token(config.BOT_TOKEN).build()

    # Register handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("stats", stats_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_search_message))

    return app


async def run_bot(db_path: str = config.DB_PATH) -> None:
    """Main entrypoint for standalone bot execution."""
    database.init_db(db_path)
    app = await build_bot_app()

    logger.info("Starting python-telegram-bot polling...")
    await app.initialize()
    await app.start()
    await app.updater.start_polling(drop_pending_updates=True)
    logger.info("Search bot is now active and polling for updates!")

    try:
        # Keep running
        import asyncio
        stop_event = asyncio.Event()
        await stop_event.wait()
    finally:
        logger.info("Shutting down bot...")
        await app.updater.stop()
        await app.stop()
        await app.shutdown()
        logger.info("Bot stopped successfully.")


if __name__ == "__main__":
    try:
        import asyncio
        asyncio.run(run_bot())
    except KeyboardInterrupt:
        logger.info("Search bot stopped by user.")
    except Exception as exc:
        logger.fatal("Fatal error in bot: %s", exc)
        sys.exit(1)
