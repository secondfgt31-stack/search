"""
Unit tests for the TelePrice regex parser module.
Verifies parsing of Indonesian price formats and seller broadcast text.
"""

import unittest
from parser import parse_price, extract_products_from_message, format_idr


class TestPriceParser(unittest.TestCase):

    def test_indonesian_price_formats(self):
        # Specific formats required in prompt:
        self.assertEqual(parse_price("Rp 25.000"), 25000)
        self.assertEqual(parse_price("25k"), 25000)
        self.assertEqual(parse_price("25rb"), 25000)
        self.assertEqual(parse_price("Rp.25000"), 25000)

        # Additional common variations:
        self.assertEqual(parse_price("Rp. 25.000"), 25000)
        self.assertEqual(parse_price("25.5k"), 25500)
        self.assertEqual(parse_price("25,5k"), 25500)
        self.assertEqual(parse_price("25 rb"), 25000)
        self.assertEqual(parse_price("25ribu"), 25000)
        self.assertEqual(parse_price("25 ribu"), 25000)
        self.assertEqual(parse_price("IDR 50.000"), 50000)
        self.assertEqual(parse_price("Harga: 45.000"), 45000)

    def test_format_idr(self):
        self.assertEqual(format_idr(25000), "Rp 25.000")
        self.assertEqual(format_idr(120000), "Rp 120.000")
        self.assertEqual(format_idr(5000), "Rp 5.000")

    def test_multiline_pricelist_extraction(self):
        sample_post = """
🔥 READY STOCK AKUN PREMIUM BERGARANSI 🔥
• ChatGPT Plus Shared: Rp 45.000
• Canva Pro 1 Tahun: 15k
• Netflix 1P1U 4K: 28rb
• Spotify Family Plan: Rp. 20000
• YouTube Premium 3 Bln: 35.000

Order hubungi @admin_store
        """
        extracted = extract_products_from_message(sample_post)
        self.assertGreaterEqual(len(extracted), 4)

        names = [item[0].lower() for item in extracted]
        prices = [item[1] for item in extracted]

        self.assertTrue(any("chatgpt" in n for n in names))
        self.assertTrue(any("canva" in n for n in names))
        self.assertTrue(any("netflix" in n for n in names))
        self.assertTrue(any("spotify" in n for n in names))

        self.assertIn(45000, prices)
        self.assertIn(15000, prices)
        self.assertIn(28000, prices)

    def test_single_product_message(self):
        single_post = """
✨ PROMO TERBATAS ✨
Canva Pro Lifetime Edu
Hanya Rp 12.000 saja!
Langsung kirim email via @cs_digital
        """
        extracted = extract_products_from_message(single_post)
        self.assertTrue(len(extracted) >= 1)
        prod, price = extracted[0]
        self.assertTrue("canva" in prod.lower())
        self.assertEqual(price, 12000)


if __name__ == "__main__":
    unittest.main()
