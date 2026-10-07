import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, ExternalLink, RefreshCw, Zap, Tag } from 'lucide-react';
import { Product, ChatMessage } from '../types';
import { formatIdr } from '../lib/parser';

interface TelegramBotSimulatorProps {
  products: Product[];
  onSelectProductInDb?: (productName: string) => void;
}

export const TelegramBotSimulator: React.FC<TelegramBotSimulatorProps> = ({
  products,
  onSelectProductInDb,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      timestamp: '10:00',
      html: `👋 <b>Halo, User!</b><br/><br/>
Selamat datang di <b>TelePrice</b> — Bot Perbandingan Harga Produk Digital.<br/><br/>
🔍 <b>Cara Penggunaan:</b><br/>
Cukup ketik dan kirimkan nama produk digital yang ingin Anda cari.<br/><br/>
<b>Contoh kata kunci:</b><br/>
• <code>chatgpt</code> atau <code>chatgpt plus</code><br/>
• <code>canva</code> atau <code>canva pro</code><br/>
• <code>netflix</code><br/>
• <code>spotify</code><br/>
• <code>youtube</code><br/>
• <code>capcut</code><br/><br/>
⚡ <i>Hasil akan diurutkan dari yang <b>paling murah</b> (TOP 5) dari berbagai channel seller Telegram terpercaya!</i>`,
      buttons: [
        { text: '🔍 Cari ChatGPT', action: 'chatgpt' },
        { text: '🔍 Cari Canva', action: 'canva' },
        { text: '🔍 Cari Netflix', action: 'netflix' },
        { text: '📊 Statistik Bot', action: '/stats' },
      ],
    },
  ]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Add user message
    const userMsg: ChatMessage = {
      id: 'u_' + Date.now(),
      sender: 'user',
      timestamp: currentTime,
      text: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    // Simulate async network response from python-telegram-bot
    setTimeout(() => {
      setIsTyping(false);
      const botResponse = generateBotResponse(query, products);
      setMessages((prev) => [...prev, botResponse]);
    }, 280);
  };

  const generateBotResponse = (rawQuery: string, currentProducts: Product[]): ChatMessage => {
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const query = rawQuery.trim();

    if (query === '/start') {
      return {
        id: 'b_' + Date.now(),
        sender: 'bot',
        timestamp: currentTime,
        html: `👋 <b>Halo!</b><br/><br/>
Selamat datang kembali di <b>TelePrice</b>!<br/>
Silakan ketik nama produk digital untuk mencari penawaran termurah.`,
        buttons: [
          { text: '🔍 Cari ChatGPT', action: 'chatgpt' },
          { text: '🔍 Cari Canva', action: 'canva' },
          { text: '🔍 Cari Spotify', action: 'spotify' },
        ],
      };
    }

    if (query === '/help') {
      return {
        id: 'b_' + Date.now(),
        sender: 'bot',
        timestamp: currentTime,
        html: `📖 <b>Panduan TelePrice Bot</b><br/><br/>
1. <b>Pencarian Produk:</b><br/>
   Ketik nama produk secara langsung tanpa tanda garis miring (contoh: <code>netflix</code>).<br/><br/>
2. <b>Peringkat Harga:</b><br/>
   Sistem mencari seluruh listing seller dan menyajikan 5 penawaran termurah.<br/><br/>
3. <b>Link Postingan Asli:</b><br/>
   Klik tautan pada nama channel atau tombol untuk langsung menuju ke pesan seller di Telegram.`,
      };
    }

    if (query === '/stats') {
      const channelCount = new Set(currentProducts.map((p) => p.channel_username)).size;
      return {
        id: 'b_' + Date.now(),
        sender: 'bot',
        timestamp: currentTime,
        html: `📊 <b>Statistik TelePrice Database</b><br/><br/>
• Total Produk Terindeks: <b>${currentProducts.length} item</b><br/>
• Channel Seller Aktif: <b>${channelCount} channel</b><br/><br/>
🔥 <b>Contoh produk populer:</b> ChatGPT Plus, Canva Pro, Netflix 4K, Spotify Family, YouTube Premium.`,
        buttons: [
          { text: '🔍 Coba Cari "ChatGPT"', action: 'chatgpt' },
          { text: '🔍 Coba Cari "Canva"', action: 'canva' },
        ],
      };
    }

    // Perform database search matching SQLite `LIKE %query%` ordered by `price ASC` limit 5
    const normalizedQuery = query.toLowerCase();
    const matches = currentProducts
      .filter((p) => p.product_name.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => a.price - b.price)
      .slice(0, 5);

    if (matches.length === 0) {
      return {
        id: 'b_' + Date.now(),
        sender: 'bot',
        timestamp: currentTime,
        html: `❌ <b>Produk Tidak Ditemukan</b><br/><br/>
Tidak ada penawaran untuk kata kunci: <code>${escapeHtml(query)}</code><br/><br/>
💡 <b>Saran:</b><br/>
• Gunakan nama yang lebih umum (contoh: <code>canva</code> atau <code>chatgpt</code>)<br/>
• Cek kembali ejaan Anda<br/>
• Ketik <code>/stats</code> untuk melihat statistik database saat ini.`,
        buttons: [
          { text: 'Cari Canva', action: 'canva' },
          { text: 'Cari Netflix', action: 'netflix' },
          { text: 'Cari Spotify', action: 'spotify' },
        ],
      };
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    const lines = [
      `🔎 <b>Hasil Perbandingan Harga:</b> <code>${escapeHtml(query)}</code>`,
      `<i>Ditemukan ${matches.length} penawaran termurah (diurutkan dari yang paling hemat):</i><br/>`,
    ];

    matches.forEach((item, index) => {
      const medal = medals[index] || `#${index + 1}`;
      const chName = item.channel_username.startsWith('@')
        ? item.channel_username
        : `@${item.channel_username}`;
      const formattedPrice = formatIdr(item.price);
      const updatedDate = item.updated_at.slice(0, 10);

      lines.push(
        `${medal} <b>${escapeHtml(item.product_name)}</b><br/>` +
          `   💰 <b>${formattedPrice}</b><br/>` +
          `   📢 Seller: <b>${escapeHtml(chName)}</b><br/>` +
          `   🔗 <a href="${item.message_link}" target="_blank" rel="noreferrer" class="text-sky-400 underline">Buka Pesan di Telegram</a><br/>` +
          `   🕒 <i>Update: ${updatedDate}</i>`
      );
    });

    lines.push(
      `<br/>⚠️ <i>Catatan: Selalu verifikasi reputasi seller sebelum bertransaksi. Data di-scrape otomatis via Telethon.</i>`
    );

    const buttons = matches.slice(0, 3).map((item, idx) => ({
      text: `${medals[idx]} ${item.product_name.slice(0, 16)} (${formatIdr(item.price)})`,
      url: item.message_link,
    }));

    return {
      id: 'b_' + Date.now(),
      sender: 'bot',
      timestamp: currentTime,
      html: lines.join('<br/>'),
      buttons,
    };
  };

  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  const quickChips = [
    { label: 'ChatGPT', query: 'chatgpt' },
    { label: 'Canva', query: 'canva' },
    { label: 'Netflix', query: 'netflix' },
    { label: 'Spotify', query: 'spotify' },
    { label: 'YouTube', query: 'youtube' },
    { label: 'CapCut', query: 'capcut' },
    { label: 'Copilot', query: 'copilot' },
    { label: '/stats', query: '/stats' },
    { label: '/help', query: '/help' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
      {/* Header Styled like Telegram Web / Desktop */}
      <div className="bg-slate-900/90 backdrop-blur px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center text-white font-bold shadow-md">
              <Bot className="w-5 h-5" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-100 text-sm tracking-tight">TelePrice Bot</h2>
              <span className="text-[10px] font-medium px-1.5 py-0.5 bg-sky-950/80 text-sky-400 border border-sky-800/60 rounded">
                bot
              </span>
            </div>
            <p className="text-xs text-slate-400">@teleprice_search_bot · online</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMessages([messages[0]])}
            title="Bersihkan chat"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat Messages Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-radial from-slate-900/40 to-slate-950">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-3.5 shadow-sm text-sm ${
                msg.sender === 'user'
                  ? 'bg-sky-600 text-white rounded-br-xs'
                  : 'bg-slate-800/95 text-slate-200 border border-slate-700/60 rounded-bl-xs'
              }`}
            >
              {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
              {msg.html && (
                <div
                  className="prose-invert text-sm leading-relaxed space-y-1 [&_code]:bg-slate-900/80 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-cyan-300 [&_code]:font-mono [&_code]:text-xs [&_b]:font-semibold [&_b]:text-white"
                  dangerouslySetInnerHTML={{ __html: msg.html }}
                />
              )}

              {/* Inline Telegram Keyboard Buttons */}
              {msg.buttons && msg.buttons.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-700/50 flex flex-col gap-1.5">
                  {msg.buttons.map((btn, bIdx) => (
                    <button
                      key={bIdx}
                      onClick={() => {
                        if (btn.url) {
                          window.open(btn.url, '_blank');
                        } else if (btn.action) {
                          handleSend(btn.action);
                        }
                      }}
                      className="w-full flex items-center justify-between text-left text-xs font-medium px-3 py-2 bg-slate-900/70 hover:bg-slate-900 text-sky-300 hover:text-sky-200 rounded-lg border border-slate-700/40 transition-all active:scale-[0.99]"
                    >
                      <span className="truncate">{btn.text}</span>
                      {btn.url ? (
                        <ExternalLink className="w-3.5 h-3.5 ml-2 text-slate-400 shrink-0" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 ml-2 text-sky-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div
                className={`text-[10px] mt-1 text-right ${
                  msg.sender === 'user' ? 'text-sky-200/80' : 'text-slate-400'
                }`}
              >
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-1.5 text-xs text-sky-400 pl-2">
            <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce"></span>
            <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce [animation-delay:0.15s]"></span>
            <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce [animation-delay:0.3s]"></span>
            <span className="ml-1 text-[11px] text-slate-400 font-mono">TelePrice is searching SQLite...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested Quick Search Chips */}
      <div className="px-3 py-2 bg-slate-900/60 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mr-1 shrink-0">
          <Tag className="w-3 h-3" /> Cepat:
        </span>
        {quickChips.map((chip) => (
          <button
            key={chip.label}
            onClick={() => handleSend(chip.query)}
            className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-3 bg-slate-900 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ketik nama produk digital (contoh: chatgpt, canva, netflix)..."
            className="flex-1 bg-slate-950 border border-slate-700/80 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white rounded-xl transition-all shadow-md active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
