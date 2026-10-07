export interface Product {
  id: number;
  channel_username: string;
  product_name: string;
  price: number;
  message_link: string;
  updated_at: string;
}

export interface ScraperLog {
  id: string;
  timestamp: string;
  channel: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'DEBUG';
  message: string;
  matchedCount?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  timestamp: string;
  text?: string;
  html?: string;
  buttons?: Array<{ text: string; url?: string; action?: string }>;
  isError?: boolean;
}

export interface ExtractedItem {
  product_name: string;
  price: number;
  priceFormatted: string;
  matchedPattern: string;
  rawLine: string;
}
