import React, { useState } from 'react';
import { Terminal, Radio, Play, CheckCircle2, ArrowRight, Zap, RefreshCw, Layers } from 'lucide-react';
import { extractProductsFromMessage, formatIdr } from '../lib/parser';
import { Product, ScraperLog, ExtractedItem } from '../types';

interface TelethonScraperSimulatorProps {
  onUpsertProducts: (items: Array<{ channel: string; product_name: string; price: number; link: string }>) => void;
  logs: ScraperLog[];
  onAddLog: (log: Omit<ScraperLog, 'id' | 'timestamp'>) => void;
}

const SAMPLE_BROADCASTS = [
  {
    title: 'Multi-Product Pricelist (Rp & k & rb)',
    channel: 'sellerdigital_indo',
    text: `🔥 UPDATE HARGA AKUN PREMIUM HARI INI 🔥
• ChatGPT Plus Shared: Rp 45.000
• Canva Pro 1 Tahun Edu: 15k
• Netflix 1P1U 4K UHD: 28rb
• Spotify Family Plan: Rp. 20000
• YouTube Premium 3 Bulan: 35.000

Order chat admin @sellerdigital_indo | Garansi full 30 hari!`,
  },
  {
    title: 'Single Promo Post (Canva 12k)',
    channel: 'tokomurah_app',
    text: `✨ PROMO SPESIAL MALAM INI ✨
Canva Pro Lifetime Invite
Hanya Rp 12.000 saja garansi selamanya!
Minat order ketik format via @tokomurah_app`,
  },
  {
    title: 'Slang Pricing (ChatGPT 4o & CapCut)',
    channel: 'zonadigital_jkt',
    text: `Ready Akun Digital:
- ChatGPT 4o Team Workspace: 55rb
- CapCut Pro 1 Bulan: 15k
- GitHub Copilot Individual: 40k
Fast respon @zonadigital_jkt`,
  },
  {
    title: 'Netflix 4K UHD with 28rb (Resolution check)',
    channel: 'rajapremium_hub',
    text: `READY NETFLIX 4K UHD ULTRA HD 1P2U
Cuma 22rb / bulan!
Anti hold, garansi replace. Chat @rajapremium_hub`,
  },
];

export const TelethonScraperSimulator: React.FC<TelethonScraperSimulatorProps> = ({
  onUpsertProducts,
  logs,
  onAddLog,
}) => {
  const [selectedChannel, setSelectedChannel] = useState('sellerdigital_indo');
  const [rawText, setRawText] = useState(SAMPLE_BROADCASTS[0].text);
  const [lastExtracted, setLastExtracted] = useState<ExtractedItem[]>([]);
  const [lastMessageId, setLastMessageId] = useState(128);

  const handleSimulateScrape = () => {
    const nextMsgId = lastMessageId + 1;
    setLastMessageId(nextMsgId);

    const channelUsername = selectedChannel.trim().replace(/^@/, '');
    const messageLink = `https://t.me/${channelUsername}/${nextMsgId}`;

    onAddLog({
      channel: `@${channelUsername}`,
      level: 'INFO',
      message: `[MTProto] NewMessage event captured on channel @${channelUsername} (ID #${nextMsgId})`,
    });

    // Run Regex Parser
    const extracted = extractProductsFromMessage(rawText);
    setLastExtracted(extracted);

    if (extracted.length === 0) {
      onAddLog({
        channel: `@${channelUsername}`,
        level: 'WARN',
        message: `No digital products or recognized Indonesian prices found in post #${nextMsgId}.`,
      });
      return;
    }

    const upsertList = extracted.map((item) => ({
      channel: `@${channelUsername}`,
      product_name: item.product_name,
      price: item.price,
      link: messageLink,
    }));

    onUpsertProducts(upsertList);

    onAddLog({
      channel: `@${channelUsername}`,
      level: 'SUCCESS',
      message: `Extracted & UPSERTED ${extracted.length} items into SQLite: ${extracted
        .map((e) => `'${e.product_name}' (${formatIdr(e.price)})`)
        .join(', ')}`,
      matchedCount: extracted.length,
    });
  };

  const handleLoadSample = (sample: (typeof SAMPLE_BROADCASTS)[0]) => {
    setSelectedChannel(sample.channel);
    setRawText(sample.text);
    setLastExtracted([]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* Left Column: Broadcast Simulator Input & Parser Trace */}
      <div className="lg:col-span-7 flex flex-col gap-5">
        {/* Broadcast Sender Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Simulasi Siaran Channel Telegram Seller
                </h3>
                <p className="text-xs text-slate-400">
                  Telethon Userbot mendengarkan pesan baru secara realtime via MTProto
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Listener Active
            </span>
          </div>

          {/* Template Selectors */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-400">Pilih Contoh Pesan Broadcast:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SAMPLE_BROADCASTS.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => handleLoadSample(tpl)}
                  className="text-left p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-800/50 transition-colors group"
                >
                  <p className="text-xs font-medium text-slate-200 group-hover:text-sky-300 transition-colors">
                    {tpl.title}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">@{tpl.channel}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Target Channel Input */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Channel Username Target
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">@</span>
                <input
                  type="text"
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-3 py-2 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
                  placeholder="nama_channel"
                />
              </div>
            </div>
            <div className="w-full sm:w-44 flex items-end">
              <button
                onClick={handleSimulateScrape}
                className="w-full py-2 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
              >
                <Play className="w-3.5 h-3.5" />
                Scrape & Ingest
              </button>
            </div>
          </div>

          {/* Textarea */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Isi Teks Pesan Broadcast (Raw Telegram Message Text)
            </label>
            <textarea
              rows={6}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono focus:border-sky-500 focus:outline-none resize-none leading-relaxed"
              placeholder="Ketik atau tempel teks postingan Telegram seller di sini..."
            />
          </div>
        </div>

        {/* Live Extracted Results Inspector */}
        {lastExtracted.length > 0 && (
          <div className="bg-slate-900 border border-emerald-900/60 rounded-xl p-5 shadow-lg flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <h4 className="text-xs font-semibold uppercase tracking-wider">
                  Hasil Ekstraksi Parser ({lastExtracted.length} Produk Ditemukan)
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Auto-UPSERT to SQLite ✓
              </span>
            </div>

            <div className="space-y-2">
              {lastExtracted.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold flex items-center justify-center border border-emerald-500/20">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-100">{item.product_name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Pattern: <span className="text-sky-300">{item.matchedPattern}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                      {item.priceFormatted}
                    </span>
                    <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                      Raw Int: {item.price}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Telethon Userbot Terminal Log Stream */}
      <div className="lg:col-span-5 flex flex-col">
        <div className="bg-slate-950 border border-slate-800 rounded-xl h-full flex flex-col overflow-hidden shadow-xl">
          {/* Terminal Title Bar */}
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold text-slate-200">
                Telethon Scraper Terminal (scraper.py)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
            </div>
          </div>

          {/* Terminal Logs Content */}
          <div className="flex-1 p-4 font-mono text-[11px] overflow-y-auto space-y-2.5 bg-slate-950/90 max-h-[560px]">
            <div className="text-slate-500">
              # TelePrice Telethon Userbot Listener active
              <br /># Connected using API_ID and API_HASH via MTProto session
              <br /># Waiting for new incoming channel events...
            </div>

            {logs.map((log) => (
              <div key={log.id} className="leading-relaxed">
                <span className="text-slate-500">[{log.timestamp}]</span>{' '}
                <span
                  className={
                    log.level === 'SUCCESS'
                      ? 'text-emerald-400 font-semibold'
                      : log.level === 'WARN'
                      ? 'text-amber-400 font-semibold'
                      : log.level === 'DEBUG'
                      ? 'text-slate-400 font-semibold'
                      : 'text-sky-400 font-semibold'
                  }
                >
                  {log.level.padEnd(7)}
                </span>{' '}
                <span className="text-cyan-400">{log.channel}</span>{' '}
                <span className="text-slate-300">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
