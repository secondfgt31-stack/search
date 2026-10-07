import { ExtractedItem } from '../types';

export const COMMON_PRODUCTS = [
  'chatgpt plus', 'chatgpt 4o', 'chatgpt', 'openai',
  'canva pro', 'canva edu', 'canva',
  'netflix premium', 'netflix 1p1u', 'netflix 1p2u', 'netflix private', 'netflix',
  'spotify premium', 'spotify individual', 'spotify family', 'spotify',
  'youtube premium', 'yt premium', 'youtube',
  'disney+ hotstar', 'disney plus', 'disney+',
  'capcut pro', 'capcut',
  'github copilot', 'copilot',
  'midjourney',
  'claude pro', 'claude',
  'apple music', 'apple tv',
  'prime video', 'amazon prime',
  'grammarly premium', 'grammarly',
  'duolingo super', 'duolingo plus', 'duolingo',
  'nordvpn', 'expressvpn',
  'vidio platinum', 'vidio',
  'wetv vip', 'wetv',
];

export const STOP_TITLES = new Set([
  'harga', 'price', 'pricelist', 'list', 'promo', 'hanya', 'cuma',
  'mulai', 'start', 'net', 'nett', 'diskon', 'sale', 'order', 'minat',
  'info', 'ready', 'stock', 'garansi', 'rules', 'format', 'payment'
]);

export function formatIdr(price: number): string {
  return `Rp ${price.toLocaleString('id-ID')}`;
}

export function parsePrice(priceStr: string): { price: number | null; patternMatched: string } {
  if (!priceStr || !priceStr.trim()) {
    return { price: null, patternMatched: 'None' };
  }

  const cleaned = priceStr.trim().toLowerCase();

  // 1. Explicit Rp / IDR marker
  const rpMatch = cleaned.match(/(?:rp\.?|idr)\s*([\d\.,]+)/i);
  if (rpMatch) {
    const rawDigits = rpMatch[1].replace(/[^\d]/g, '');
    if (rawDigits) {
      const val = parseInt(rawDigits, 10);
      if (val >= 1000 && val <= 50000000) {
        return { price: val, patternMatched: `Explicit Rupiah (${rpMatch[0]})` };
      }
    }
  }

  // 2. Ribu / rb suffix
  const rbMatch = cleaned.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|ribu)\b/i);
  if (rbMatch) {
    const valStr = rbMatch[1].replace(',', '.');
    const parsedFloat = parseFloat(valStr);
    if (!isNaN(parsedFloat)) {
      return { price: Math.round(parsedFloat * 1000), patternMatched: `Ribu/rb suffix (${rbMatch[0]})` };
    }
  }

  // 3. 'k' suffix (e.g. 25k, 25.5k), ignore 4k/8k resolution when video resolution context
  const kMatches = Array.from(cleaned.matchAll(/(\d+(?:[.,]\d+)?)\s*k\b/gi));
  for (const kMatch of kMatches) {
    const valStr = kMatch[1].replace(',', '.');
    const parsedFloat = parseFloat(valStr);
    if (!isNaN(parsedFloat)) {
      if ((parsedFloat === 4 || parsedFloat === 8) && /\b(4k|8k)\s*(uhd|hd|res|video)?\b/i.test(cleaned)) {
        continue;
      }
      return { price: Math.round(parsedFloat * 1000), patternMatched: `k suffix (${kMatch[0]})` };
    }
  }

  // 4. Standalone dotted thousands separator e.g. 25.000 or 150.000
  const plainDotMatch = cleaned.match(/\b(\d{1,3}(?:\.\d{3})+)\b/);
  if (plainDotMatch) {
    const cleanNum = plainDotMatch[1].replace(/\./g, '');
    const val = parseInt(cleanNum, 10);
    if (!isNaN(val)) {
      return { price: val, patternMatched: `Dotted thousands (${plainDotMatch[0]})` };
    }
  }

  return { price: null, patternMatched: 'No match' };
}

export function cleanProductName(rawName: string): string {
  let name = rawName.replace(/^[\s•\-*#~🔥⚡✨✅🎉👉📌▶️🔴⚪⭐🌟\d\.\)]+/g, '');
  name = name.replace(/[\s:\-=]+$/g, '');
  name = name.replace(/\b(promo terbatas|flash sale|ready stock|ready|promo)\b/gi, '');
  return name.replace(/\s+/g, ' ').trim();
}

export function extractProductsFromMessage(text: string): ExtractedItem[] {
  if (!text || !text.trim()) return [];

  const results: ExtractedItem[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const separatorRegex = /^([^:\-=\n]+?)[\s:\-=]+(?:(?:rp\.?|idr)\s*[\d\.,]+|\d+(?:[.,]\d+)?\s*(?:k|rb|ribu)\b|\d{1,3}(?:\.\d{3})+)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check separator regex
    const sepMatch = line.match(separatorRegex);
    if (sepMatch) {
      const rawTitle = sepMatch[1];
      const prodTitle = cleanProductName(rawTitle);
      const priceSub = line.slice(rawTitle.length);
      const { price, patternMatched } = parsePrice(priceSub);

      if (prodTitle && price && prodTitle.length >= 3) {
        if (!STOP_TITLES.has(prodTitle.toLowerCase())) {
          results.push({
            product_name: prodTitle,
            price,
            priceFormatted: formatIdr(price),
            matchedPattern: patternMatched,
            rawLine: line,
          });
          continue;
        } else {
          // Look backwards for product title
          for (let prevIdx = i - 1; prevIdx >= 0; prevIdx--) {
            const prevLine = lines[prevIdx];
            for (const known of COMMON_PRODUCTS) {
              if (new RegExp(`\\b${known}\\b`, 'i').test(prevLine)) {
                const cleanPrev = cleanProductName(prevLine);
                if (!STOP_TITLES.has(cleanPrev.toLowerCase()) && cleanPrev.length >= 3) {
                  results.push({
                    product_name: cleanPrev,
                    price,
                    priceFormatted: formatIdr(price),
                    matchedPattern: `${patternMatched} (Context line)`,
                    rawLine: `${prevLine} -> ${line}`,
                  });
                  break;
                }
              }
            }
            if (results.length > 0) break;
          }
        }
      }
    }

    // Check known product keyword on line
    for (const known of COMMON_PRODUCTS) {
      const pattern = new RegExp(`\\b(${known}[^\\n:\\-,]*?)[\\s:\\-=]+([^\\n]+)`, 'i');
      const match = line.match(pattern);
      if (match) {
        const rawProd = match[1];
        const tail = match[2];
        const { price, patternMatched } = parsePrice(tail);
        if (price) {
          const cleanProd = cleanProductName(rawProd);
          if (!STOP_TITLES.has(cleanProd.toLowerCase())) {
            results.push({
              product_name: cleanProd,
              price,
              priceFormatted: formatIdr(price),
              matchedPattern: patternMatched,
              rawLine: line,
            });
            break;
          }
        }
      }
    }
  }

  // Fallback: single entry
  if (results.length === 0) {
    const { price, patternMatched } = parsePrice(text);
    if (price) {
      for (const known of COMMON_PRODUCTS) {
        if (new RegExp(`\\b${known}\\b`, 'i').test(text)) {
          let foundTitle = known;
          for (const line of lines) {
            if (new RegExp(`\\b${known}\\b`, 'i').test(line)) {
              const cleanedL = cleanProductName(line);
              if (!STOP_TITLES.has(cleanedL.toLowerCase()) && cleanedL.length >= 3) {
                foundTitle = cleanedL;
                break;
              }
            }
          }
          results.push({
            product_name: foundTitle,
            price,
            priceFormatted: formatIdr(price),
            matchedPattern: `${patternMatched} (Single post)`,
            rawLine: text.slice(0, 60) + '...',
          });
          break;
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return results.filter(item => {
    const key = `${item.product_name.toLowerCase()}#${item.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
