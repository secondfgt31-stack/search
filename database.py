"""
Database module for Telegram Digital Products Price Comparison System.
Manages SQLite connection, table schemas, and queries.
"""

import sqlite3
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger("TelePrice.Database")


def get_connection(db_path: str = "database.sqlite3") -> sqlite3.Connection:
    """Returns a SQLite connection with Row factory enabled."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: str = "database.sqlite3") -> None:
    """
    Initializes the SQLite database schema.
    Creates the 'products' table with an index on product_name and a unique
    constraint on (channel_username, product_name) to support robust UPSERTs.
    """
    logger.info("Initializing SQLite database at: %s", db_path)
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        
        # Create products table
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

        # Create indexing for fast search and price sorting
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_products_name 
            ON products(product_name COLLATE NOCASE)
            """
        )
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_products_price 
            ON products(price ASC)
            """
        )
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_products_channel 
            ON products(channel_username)
            """
        )
        conn.commit()
    logger.info("Database initialized successfully.")


def upsert_product(
    channel_username: str,
    product_name: str,
    price: int,
    message_link: str,
    db_path: str = "database.sqlite3",
) -> Dict[str, Any]:
    """
    Upserts a product into the database.
    If the product already exists for the given channel, updates the price,
    message_link, and updated_at timestamp.
    """
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

        result = dict(row) if row else {}
        logger.info(
            "UPSERT product: [%s] '%s' @ Rp %s from @%s",
            result.get("id"),
            product_clean,
            f"{price:,}".replace(",", "."),
            channel_clean,
        )
        return result


def search_products(
    query: str,
    limit: int = 5,
    db_path: str = "database.sqlite3",
) -> List[Dict[str, Any]]:
    """
    Searches products by keyword (LIKE %query%), ordered by price ASC (cheapest first).
    Limits result to specified count (default: 5).
    """
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
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_all_products(
    limit: int = 100,
    db_path: str = "database.sqlite3",
) -> List[Dict[str, Any]]:
    """Retrieves all indexed products ordered by latest update."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, channel_username, product_name, price, message_link, updated_at
            FROM products
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def delete_product(product_id: int, db_path: str = "database.sqlite3") -> bool:
    """Deletes a product by ID."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM products WHERE id = ?", (product_id,))
        conn.commit()
        return cursor.rowcount > 0


def get_stats(db_path: str = "database.sqlite3") -> Dict[str, Any]:
    """Returns overview statistics of the database."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*), COUNT(DISTINCT channel_username) FROM products")
        total_products, total_channels = cursor.fetchone()

        cursor.execute(
            """
            SELECT product_name, MIN(price) as min_price, MAX(price) as max_price, COUNT(*) as count
            FROM products
            GROUP BY product_name
            ORDER BY count DESC
            LIMIT 5
            """
        )
        top_products = [dict(r) for r in cursor.fetchall()]

        return {
            "total_products": total_products or 0,
            "total_channels": total_channels or 0,
            "top_products": top_products,
        }
