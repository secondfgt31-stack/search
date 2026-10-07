"""
Seed script to populate SQLite database with realistic Indonesian digital product posts.
Run with: python seed_data.py
"""

import database
from parser import format_idr

SAMPLE_PRODUCTS = [
    # ChatGPT
    ("@sellerdigital_indo", "ChatGPT Plus 1 Bulan Shared", 45000, "https://t.me/sellerdigital_indo/102"),
    ("@tokomurah_app", "ChatGPT Plus Private 30 Hari", 65000, "https://t.me/tokomurah_app/88"),
    ("@premiumstore_id", "ChatGPT Plus Shared Akun", 40000, "https://t.me/premiumstore_id/341"),
    ("@zonadigital_jkt", "ChatGPT 4o Team Workspace", 55000, "https://t.me/zonadigital_jkt/19"),
    ("@rajapremium_hub", "ChatGPT Plus Anti-Deactive", 49000, "https://t.me/rajapremium_hub/512"),

    # Canva
    ("@tokomurah_app", "Canva Pro Invite 1 Tahun", 12000, "https://t.me/tokomurah_app/92"),
    ("@sellerdigital_indo", "Canva Pro Edu Lifetime", 15000, "https://t.me/sellerdigital_indo/105"),
    ("@canva_indonesia_reseller", "Canva Pro Private 1 Thn", 25000, "https://t.me/canva_indonesia_reseller/401"),
    ("@premiumstore_id", "Canva Pro Garansi Full", 10000, "https://t.me/premiumstore_id/345"),
    ("@zonadigital_jkt", "Canva Pro Brand Kit On", 18000, "https://t.me/zonadigital_jkt/25"),

    # Netflix
    ("@sellerdigital_indo", "Netflix Premium 1P1U 4K UHD", 28000, "https://t.me/sellerdigital_indo/108"),
    ("@rajapremium_hub", "Netflix 1P2U Semi Private", 22000, "https://t.me/rajapremium_hub/520"),
    ("@premiumstore_id", "Netflix Private 1 Bulan Full", 120000, "https://t.me/premiumstore_id/350"),
    ("@tokomurah_app", "Netflix Shared 1 Bulan", 25000, "https://t.me/tokomurah_app/98"),

    # Spotify
    ("@premiumstore_id", "Spotify Individual 1 Bulan", 18000, "https://t.me/premiumstore_id/355"),
    ("@sellerdigital_indo", "Spotify Family Plan Invite", 15000, "https://t.me/sellerdigital_indo/112"),
    ("@zonadigital_jkt", "Spotify Individual 3 Bulan", 45000, "https://t.me/zonadigital_jkt/31"),
    ("@tokomurah_app", "Spotify Premium Anti Begal", 20000, "https://t.me/tokomurah_app/102"),

    # YouTube
    ("@rajapremium_hub", "YouTube Premium 1 Bulan Indiv", 12000, "https://t.me/rajapremium_hub/528"),
    ("@sellerdigital_indo", "YouTube Premium 3 Bulan Fam", 28000, "https://t.me/sellerdigital_indo/115"),
    ("@tokomurah_app", "YouTube Premium No Ads 1 Thn", 95000, "https://t.me/tokomurah_app/106"),

    # CapCut
    ("@canva_indonesia_reseller", "CapCut Pro 1 Bulan Shared", 15000, "https://t.me/canva_indonesia_reseller/420"),
    ("@sellerdigital_indo", "CapCut Pro Private 1 Thn", 65000, "https://t.me/sellerdigital_indo/119"),

    # GitHub Copilot
    ("@developer_store_id", "GitHub Copilot Student 1 Thn", 50000, "https://t.me/developer_store_id/81"),
    ("@zonadigital_jkt", "GitHub Copilot Individual 1 Bln", 40000, "https://t.me/zonadigital_jkt/40"),
]


def seed(db_path: str = "database.sqlite3"):
    """Inserts realistic mock digital product listings into SQLite."""
    database.init_db(db_path)
    print(f"🌱 Seeding {len(SAMPLE_PRODUCTS)} digital product deals...")
    for channel, prod, price, link in SAMPLE_PRODUCTS:
        database.upsert_product(
            channel_username=channel,
            product_name=prod,
            price=price,
            message_link=link,
            db_path=db_path,
        )
        print(f"  ✓ [{channel}] {prod} -> {format_idr(price)}")
    print("✅ Seeding completed! Database is ready for queries.")


if __name__ == "__main__":
    seed()
