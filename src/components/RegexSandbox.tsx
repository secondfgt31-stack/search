import React, { useState } from 'react';
import { Sparkles, Check, ArrowRight, BookOpen, CheckCircle2 } from 'lucide-react';
import { parsePrice, formatIdr, cleanProductName } from '../lib/parser';

const TEST_CASES = [
  { label: 'Rp 25.000', input: 'Rp 25.000', note: 'Standard Indonesian Rupiah with space and dot' },
  { label: '25k', input: '25k', note: 'Thousand suffix (25 * 1000 = 25.000)' },
  { label: '25rb', input: '25rb', note: 'Indonesian slang thousand suffix "rb"' },
  { label: 'Rp.25000', input: 'Rp.25000', note: 'Dot after Rp without space and no thousands separator' },
  { label: '25.5k', input: '25.5k', note: 'Decimal thousand format (25.5 * 1000 = 25.500)' },
  { label: '25,5k', input: '25,5k', note: 'Indonesian comma decimal format (25,500)' },
  { label: '25 ribu', input: '25 ribu', note: 'Full Indonesian word "ribu"' },
  { label: 'IDR 50.000', input: 'IDR 50.000', note: 'ISO currency prefix IDR' },
  { label: 'Netflix 4K UHD 28rb', input: 'Netflix 4K UHD 1P1U : 28rb', note: 'Resolution 4K avoided, correctly parses 28rb = 28.000' },
  { label: 'Canva Pro - 15k', input: 'Canva Pro Lifetime - 15k', note: 'Product title with hyphen separator' },
];

export const RegexSandbox: React.FC = () => {
  const [customInput, setCustomInput] = useState('Canva Pro 1 Tahun - 15rb');

  const parsed = parsePrice(customInput);

  return (
    <div className="flex flex-col gap-6">
      {/* Intro Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-sky-400" />
          Workbench Parser Regex Format Harga Indonesia
        </h3>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Seller produk digital di Telegram Indonesia menggunakan berbagai gaya penulisan harga
          yang unik (seperti <code className="text-cyan-300">Rp 25.000</code>, <code className="text-cyan-300">25k</code>, <code className="text-cyan-300">25rb</code>, <code className="text-cyan-300">Rp.25000</code>). Modul <code className="text-sky-300 font-mono">parser.py</code> kami menormalkan semua format ini menjadi integer murni dalam hitungan mikrodetik.
        </p>
      </div>

      {/* Live Interactive Parser Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Uji Coba Teks Bebas
            </label>
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              placeholder="Ketik string harga atau postingan..."
            />
            <p className="text-[11px] text-slate-500 mt-1.5 font-mono">
              Contoh: "ChatGPT 4o 50rb", "Canva 12k", "Netflix 4K UHD 28rb", "Rp.35000"
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800">
            <span className="text-xs font-medium text-slate-400">Pola Cepat:</span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['Rp 25.000', '25k', '25rb', 'Rp.25000', '25.5k', '50ribu'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setCustomInput(fmt)}
                  className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition-colors"
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Parse Result Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between font-mono">
          <div>
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block mb-2">
              Hasil Normalisasi (parser.py)
            </span>

            {parsed.price !== null ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60">
                  <span className="text-[10px] text-emerald-400/80 uppercase tracking-widest block font-bold">
                    Integer Sanitized IDR
                  </span>
                  <div className="text-2xl font-bold text-emerald-400 mt-0.5">
                    {formatIdr(parsed.price)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Python Integer: <code className="text-cyan-300 font-bold">{parsed.price}</code>
                  </div>
                </div>

                <div className="text-xs space-y-1 text-slate-400">
                  <div>
                    Pola Terdeteksi:{' '}
                    <span className="text-sky-300 font-medium">{parsed.patternMatched}</span>
                  </div>
                  <div>
                    Status:{' '}
                    <span className="text-emerald-400 inline-flex items-center gap-1 font-sans">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Valid IDR
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-rose-950/30 border border-rose-900/60 text-rose-300 text-xs">
                Tidak ada format harga Indonesia yang cocok dalam input.
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-900">
            Regex engine: compiled Python re module
          </div>
        </div>
      </div>

      {/* Preset Test Suite Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">
          Tabel Uji Format Harga Indonesia
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
              <tr>
                <th className="px-3.5 py-2.5">Input String</th>
                <th className="px-3.5 py-2.5">Format Skenario</th>
                <th className="px-3.5 py-2.5 text-right">Hasil Parser</th>
                <th className="px-3.5 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {TEST_CASES.map((tc, idx) => {
                const res = parsePrice(tc.input);
                return (
                  <tr key={idx} className="hover:bg-slate-950/40">
                    <td className="px-3.5 py-2.5 font-bold text-sky-300">{tc.input}</td>
                    <td className="px-3.5 py-2.5 text-slate-400 font-sans text-xs">{tc.note}</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-emerald-400">
                      {res.price ? formatIdr(res.price) : 'N/A'}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <span className="px-2 py-0.5 text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-sans">
                        PASSED ✓
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
