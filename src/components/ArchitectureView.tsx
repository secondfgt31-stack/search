import React from 'react';
import { Layers, ShieldCheck, Key, Database, Bot, Terminal, Cpu, ArrowRight } from 'lucide-react';

export const ArchitectureView: React.FC = () => {
  return (
    <div className="flex flex-col gap-6">
      {/* Visual System Architecture Diagram */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-sky-400" />
          Diagram Alur Sistem Perbandingan Harga Telegram
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Scraper */}
          <div className="bg-slate-950 border border-sky-900/40 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-sky-400 font-mono text-xs font-semibold uppercase mb-2">
                <Terminal className="w-4 h-4" />
                1. Scraper Service (Telethon)
              </div>
              <p className="text-xs text-slate-300 font-medium">Userbot Event Listener</p>
              <ul className="text-[11px] text-slate-400 mt-2 space-y-1 list-disc list-inside">
                <li>Koneksi MTProto via API_ID & API_HASH</li>
                <li>Listen ke channel seller target (<code className="text-sky-300">@channel</code>)</li>
                <li>Regex parser format Rupiah (Rp, k, rb)</li>
                <li>UPSERT ke SQLite saat ada pesan baru</li>
              </ul>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-900 text-[10px] text-slate-500 font-mono">
              File: scraper.py
            </div>
          </div>

          {/* Card 2: Database */}
          <div className="bg-slate-950 border border-emerald-900/40 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-semibold uppercase mb-2">
                <Database className="w-4 h-4" />
                2. Storage (SQLite Engine)
              </div>
              <p className="text-xs text-slate-300 font-medium">Tabel 'products'</p>
              <ul className="text-[11px] text-slate-400 mt-2 space-y-1 list-disc list-inside">
                <li>Primary key ID integer autoincrement</li>
                <li>UNIQUE (channel_username, product_name)</li>
                <li>Indexed column: product_name & price</li>
                <li>ON CONFLICT DO UPDATE SET price, updated_at</li>
              </ul>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-900 text-[10px] text-slate-500 font-mono">
              File: database.py
            </div>
          </div>

          {/* Card 3: Search Bot */}
          <div className="bg-slate-950 border border-cyan-900/40 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-semibold uppercase mb-2">
                <Bot className="w-4 h-4" />
                3. Search Bot (PTB v20+)
              </div>
              <p className="text-xs text-slate-300 font-medium">Interface Pengguna</p>
              <ul className="text-[11px] text-slate-400 mt-2 space-y-1 list-disc list-inside">
                <li>Bot token dari @BotFather</li>
                <li>Command /start, /help, /stats</li>
                <li>Query LIKE %query% ORDER BY price ASC LIMIT 5</li>
                <li>Format HTML Telegram + Inline link post</li>
              </ul>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-900 text-[10px] text-slate-500 font-mono">
              File: bot.py
            </div>
          </div>
        </div>
      </div>

      {/* Setup Step by Step Credentials Guide */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-amber-400" />
          Panduan Langkah Mendapatkan Kredensial Telegram
        </h3>

        <div className="space-y-4 text-xs text-slate-300">
          {/* Step 1 */}
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex gap-3">
            <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold shrink-0">
              1
            </span>
            <div>
              <p className="font-semibold text-slate-100">
                Mendapatkan API_ID & API_HASH untuk Telethon Userbot
              </p>
              <p className="text-slate-400 mt-1 leading-relaxed">
                Buka website resmi Telegram di <a href="https://my.telegram.org" target="_blank" rel="noreferrer" className="text-sky-400 underline">https://my.telegram.org</a>. Masuk dengan nomor telepon akun Telegram Anda. Masuk ke menu <b>API development tools</b>, buat aplikasi baru (App title & Short name bebas), lalu salin <code>api_id</code> dan <code>api_hash</code> ke dalam file <code>.env</code>.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex gap-3">
            <span className="w-6 h-6 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold shrink-0">
              2
            </span>
            <div>
              <p className="font-semibold text-slate-100">
                Membuat Bot Token di @BotFather
              </p>
              <p className="text-slate-400 mt-1 leading-relaxed">
                Buka aplikasi Telegram dan cari <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-400 underline">@BotFather</a>. Kirim perintah <code>/newbot</code>, tentukan nama bot dan username berakhiran <i>bot</i>. Salin token API yang diberikan (contoh: <code>1234567890:ABCdefGHI...</code>) ke variabel <code>BOT_TOKEN</code> di file <code>.env</code>.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold shrink-0">
              3
            </span>
            <div>
              <p className="font-semibold text-slate-100">
                Menentukan Channel Seller Target
              </p>
              <p className="text-slate-400 mt-1 leading-relaxed">
                Tentukan channel Telegram penjual produk digital yang ingin Anda pantau. Daftarkan username channel di <code>TARGET_CHANNELS</code> (dipisahkan tanda koma):
                <br />
                <code className="text-emerald-400 block bg-slate-900 p-2 rounded mt-1.5 font-mono">
                  TARGET_CHANNELS=@digitalpremium_id,@sellerapp_indo,@tokomurahdigital
                </code>
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex gap-3">
            <span className="w-6 h-6 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold shrink-0">
              4
            </span>
            <div>
              <p className="font-semibold text-slate-100">
                Menjalankan Sistem
              </p>
              <p className="text-slate-400 mt-1 leading-relaxed">
                Jalankan kedua layanan secara bersamaan dalam satu loop asyncio menggunakan runner terpadu:
                <br />
                <code className="text-cyan-300 block bg-slate-900 p-2 rounded mt-1.5 font-mono">
                  python main.py
                </code>
                <span className="text-slate-400 mt-1 block">
                  Atau jalankan terpisah di dua terminal: <code>python scraper.py</code> dan <code>python bot.py</code>.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
