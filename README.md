# TelePrice: Telegram Digital Products Price Comparison System

A high-performance asynchronous system for tracking and comparing prices of digital products (e.g., *ChatGPT Plus*, *Canva Pro*, *Netflix*, *Spotify*, *YouTube Premium*) across Telegram seller channels in Indonesia.

---

## 🏗️ Architecture Overview

The system consists of two decoupled components sharing an SQLite database:

```
┌─────────────────────────────────┐           ┌────────────────────────────────┐
│   Telegram Seller Channels      │           │          Telegram Users        │
│  (@channel1, @channel2, etc.)   │           │      (Private Chat with Bot)   │
└────────────────┬────────────────┘           └───────────────▲────────────────┘
                 │ (Broadcasts)                               │ (Queries & Deals)
                 ▼                                            │
┌─────────────────────────────────┐           ┌───────────────┴────────────────┐
│   Telethon Userbot Scraper      │           │      python-telegram-bot       │
│        (scraper.py)             │           │           (bot.py)             │
│                                 │           │                                │
│ • MTProto Event Listener        │           │ • /start, /help, /stats        │
│ • Regex Price Parser (IDR/k/rb) │           │ • Fast SQL Query (LIKE %q%)    │
│ • Upsert Deals & Post Links     │           │ • Cheapest-First (Price ASC)   │
└────────────────┬────────────────┘           └───────────────▲────────────────┘
                 │                                            │
                 └───────────────► ┌───────────────────────┐ ◄┘
                                   │  SQLite Database      │
                                   │  (database.sqlite3)   │
                                   │                       │
                                   │  • Table: products    │
                                   │  • Unique Channel+Item│
                                   └───────────────────────┘
```

---

## 🚀 Quick Start

### 1. Requirements & Prerequisites
- Python 3.10+
- Telegram Account for Telethon Userbot (`API_ID`, `API_HASH` from [my.telegram.org](https://my.telegram.org))
- Telegram Bot from [@BotFather](https://t.me/BotFather) (`BOT_TOKEN`)

### 2. Installation
```bash
git clone <repo_url>
cd teleprice

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` with your real keys:
```ini
API_ID=12345678
API_HASH=your_api_hash_here
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxyz
TARGET_CHANNELS=@digitalpremium_id,@sellerapp_indo,@tokomurahdigital
DB_PATH=database.sqlite3
```

### 4. Optional: Populate Mock Seed Data
Test the database and search bot immediately without waiting for scraper posts:
```bash
python seed_data.py
```

### 5. Run the System

#### Option A: Unified Runner (Runs Scraper & Search Bot Concurrently)
```bash
python main.py
```

#### Option B: Standalone Processes (Recommended for Production / Systemd)
Run in two separate terminals or background workers:

Terminal 1 (Telethon Scraper):
```bash
python scraper.py
```
*(On first run, Telethon will ask for your phone number and login code via Telegram)*

Terminal 2 (Telegram Search Bot):
```bash
python bot.py
```

---

## 🧪 Unit Tests
Run the regex price parser test suite:
```bash
python -m unittest tests/test_parser.py
```

---

## 🔍 Supported Indonesian Price Patterns

The parser accurately recognizes and normalizes:
- Standard Rupiah: `Rp 25.000`, `Rp. 25.000`, `Rp25000`, `Rp.25000`, `IDR 50.000`
- Thousands suffix: `25k`, `25.5k`, `25,5k` (ignores `4K` UHD video resolution)
- Indonesian slang suffix: `25rb`, `25 rb`, `25ribu`, `25 ribu`
- Multi-line channel broadcast pricelists
- Single-deal promotional flyers
