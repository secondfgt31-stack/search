"""
Regex-based Parser module for Indonesian Digital Product Seller Broadcasts.
Handles extraction of product names and various Indonesian price formats:
  - "Rp 25.000", "Rp. 25.000", "Rp.25000", "Rp 25000", "IDR 25.000"
  - "25k", "25 k", "25.5k", "25,5k"
  - "25rb", "25 rb", "25ribu", "25 ribu"
  - "25.000" after separators like ":", "-", "="
"""

import re
import logging
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger("TelePrice.Parser")

# Known digital product anchors/keywords commonly traded in Indonesian Telegram channels
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
    "nordvpn", "expressvpn", "surfshark",
    "vidiomax", "vidio platinum", "vidio",
    "wetv vip", "wetv",
    "iqiyi vip", "iqiyi",
    "bilibili premium", "bstation premium",
    "scribd",
    "quillbot premium", "quillbot",
    "notion plus", "notion ai", "notion",
    "truecaller premium",
]


def parse_price(price_str: str) -> Optional[int]:
    """
    Converts diverse Indonesian price strings into clean integer IDR.
    Examples:
        'Rp 25.000' -> 25000
        'Rp.25000'  -> 25000
        '25k'       -> 25000
        '25.5k'     -> 25500
        '25rb'      -> 25000
        '25 ribu'   -> 25000
        'IDR 50.000'-> 50000
    """
    if not price_str:
        return None

    cleaned = price_str.strip().lower()

    # Step 1: Explicit currency markers: 'Rp 25.000', 'Rp. 25.000', 'Rp.25000', 'Rp 25000', 'IDR 25.000'
    rp_match = re.search(r"(?:rp\.?|idr)\s*([\d\.,]+)", cleaned)
    if rp_match:
        digits_raw = rp_match.group(1)
        digits_clean = re.sub(r"[^\d]", "", digits_raw)
        if digits_clean:
            try:
                price_val = int(digits_clean)
                if 1000 <= price_val <= 50_000_000:
                    return price_val
            except ValueError:
                pass

    # Step 2: '25rb' or '25 rb' or '25 ribu' or '25ribu'
    rb_match = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:rb|ribu)\b", cleaned)
    if rb_match:
        val_str = rb_match.group(1).replace(",", ".")
        try:
            return int(float(val_str) * 1000)
        except ValueError:
            pass

    # Step 3: '25k' or '25.5k' or '25,5k' (exclude 4k, 8k if preceded by resolution terms)
    # Match numbers typically >= 5 for digital goods (or allow 1-4 only if not preceded by uhd/hd/4k)
    k_matches = re.finditer(r"(\d+(?:[.,]\d+)?)\s*k\b", cleaned)
    for k_m in k_matches:
        val_str = k_m.group(1).replace(",", ".")
        try:
            num_val = float(val_str)
            # 4k / 8k is almost always 4K UHD video resolution in Netflix/Disney accounts unless specified as price
            if num_val in [4.0, 8.0] and re.search(r"\b(4k|8k)\s*(uhd|hd|res|video)?\b", cleaned):
                continue
            return int(num_val * 1000)
        except ValueError:
            pass

    # Step 4: Standalone Indonesian format like '25.000' or '150.000'
    plain_dot_match = re.search(r"\b(\d{1,3}(?:\.\d{3})+)\b", cleaned)
    if plain_dot_match:
        digits_clean = plain_dot_match.group(1).replace(".", "")
        try:
            return int(digits_clean)
        except ValueError:
            pass

    return None


STOP_TITLES = {
    "harga", "price", "pricelist", "list", "promo", "hanya", "cuma",
    "mulai", "start", "net", "nett", "diskon", "sale", "order", "minat",
    "info", "ready", "stock", "garansi", "rules", "format", "payment"
}


def clean_product_name(raw_name: str) -> str:
    """Cleans punctuation, bullet points, leading/trailing noise from product title."""
    # Remove leading bullets, emojis, and symbols
    name = re.sub(r"^[\s•\-*#~🔥⚡✨✅🎉👉📌▶️🔴⚪⭐🌟\d\.\)]+", "", raw_name)
    # Remove trailing colons, dashes, equal signs
    name = re.sub(r"[\s:\-=]+$", "", name)
    # Remove common promotional tags
    name = re.sub(r"\b(promo terbatas|flash sale|ready stock|ready|promo)\b", "", name, flags=re.IGNORECASE)
    # Remove redundant inner spacing
    name = re.sub(r"\s+", " ", name).strip()
    return name


def extract_products_from_message(text: str) -> List[Tuple[str, int]]:
    """
    Parses a Telegram message to extract one or more (product_name, price) pairs.
    Handles both multi-line pricelists and single-product promotions.
    """
    if not text or not text.strip():
        return []

    results: List[Tuple[str, int]] = []
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    # Regex patterns for line matching:
    # 1. Product : Price or Product - Price
    separator_regex = re.compile(
        r"^([^:\-=\n]+?)[\s:\-=]+(?:"
        r"(?:rp\.?|idr)\s*[\d\.,]+|"
        r"\d+(?:[.,]\d+)?\s*(?:k|rb|ribu)\b|"
        r"\d{1,3}(?:\.\d{3})+"
        r")",
        re.IGNORECASE,
    )

    for i, line_clean in enumerate(lines):
        # Look for separator pattern in the line
        sep_match = separator_regex.search(line_clean)
        if sep_match:
            raw_title = sep_match.group(1)
            product_title = clean_product_name(raw_title)

            # Try to extract the price from the rest of the line
            price_sub = line_clean[len(raw_title):]
            price = parse_price(price_sub)

            if product_title and price and len(product_title) >= 3:
                # Filter out pure noise lines like 'HARGA:', 'Hanya:'
                if product_title.lower() not in STOP_TITLES:
                    results.append((product_title, price))
                    continue
                else:
                    # The line was like 'Hanya Rp 12.000' or 'Harga: 25k'
                    # Look backwards for a line with a known product
                    for prev_idx in range(i - 1, -1, -1):
                        prev_line = lines[prev_idx]
                        for known in COMMON_PRODUCTS:
                            if re.search(rf"\b{re.escape(known)}\b", prev_line, re.IGNORECASE):
                                clean_prev = clean_product_name(prev_line)
                                if clean_prev.lower() not in STOP_TITLES and len(clean_prev) >= 3:
                                    results.append((clean_prev, price))
                                    break
                        if results:
                            break

        # Check if line contains a known digital product name + price on same line
        for known in COMMON_PRODUCTS:
            pattern = re.compile(rf"\b({re.escape(known)}[^\n:\-,]*?)[\s:\-=]+([^\n]+)", re.IGNORECASE)
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

    # If line-by-line parsing didn't find items, attempt whole message single-entry extraction
    if not results:
        overall_price = parse_price(text)
        if overall_price:
            for known in COMMON_PRODUCTS:
                if re.search(rf"\b{re.escape(known)}\b", text, re.IGNORECASE):
                    # Find the specific line that contains the product name
                    for line in lines:
                        if re.search(rf"\b{re.escape(known)}\b", line, re.IGNORECASE):
                            clean_line = clean_product_name(line)
                            if clean_line.lower() not in STOP_TITLES and len(clean_line) >= 3:
                                results.append((clean_line.title(), overall_price))
                                break
                    if results:
                        break
                    results.append((known.title(), overall_price))
                    break

    # Deduplicate while preserving order
    seen = set()
    deduped: List[Tuple[str, int]] = []
    for prod, price in results:
        key = (prod.lower(), price)
        if key not in seen:
            seen.add(key)
            deduped.append((prod, price))

    return deduped


def format_idr(price: int) -> str:
    """Formats an integer price to standard Indonesian rupiah format 'Rp 25.000'."""
    return f"Rp {price:,}".replace(",", ".")
