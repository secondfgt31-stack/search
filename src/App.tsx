/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Bot,
  Radio,
  Database,
  Code2,
  BookOpen,
  Layers,
  Sparkles,
  Download,
  Terminal,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Product, ScraperLog } from './types';
import { INITIAL_PRODUCTS } from './lib/seedData';
import { TelegramBotSimulator } from './components/TelegramBotSimulator';
import { TelethonScraperSimulator } from './components/TelethonScraperSimulator';
import { DatabaseInspector } from './components/DatabaseInspector';
import { RegexSandbox } from './components/RegexSandbox';
import { CodeExplorer } from './components/CodeExplorer';
import { ArchitectureView } from './components/ArchitectureView';

type TabType = 'bot' | 'scraper' | 'database' | 'regex' | 'code' | 'architecture';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('bot');
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [logs, setLogs] = useState<ScraperLog[]>([
    {
      id: 'log-1',
      timestamp: '10:00:12',
      channel: '@sellerdigital_indo',
      level: 'INFO',
      message: 'Telethon client logged in as Userbot (Session: teleprice_userbot).',
    },
    {
      id: 'log-2',
      timestamp: '10:00:15',
      channel: '@tokomurah_app',
      level: 'INFO',
      message: 'Listening for NewMessage events on 4 target seller channels.',
    },
    {
      id: 'log-3',
      timestamp: '10:15:22',
      channel: '@sellerdigital_indo',
      level: 'SUCCESS',
      message: 'Scraped [ChatGPT Plus 1 Bulan Shared] @ Rp 45.000 -> SQLite UPSERT ok.',
    },
  ]);

  const handleUpsertProducts = (
    items: Array<{ channel: string; product_name: string; price: number; link: string }>
  ) => {
    setProducts((prev) => {
      const updated = [...prev];
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

      items.forEach((item) => {
        const cleanCh = item.channel.replace(/^@/, '');
        const existingIdx = updated.findIndex(
          (p) =>
            p.channel_username.toLowerCase() === cleanCh.toLowerCase() &&
            p.product_name.toLowerCase() === item.product_name.toLowerCase()
        );

        if (existingIdx >= 0) {
          // Update existing
          updated[existingIdx] = {
            ...updated[existingIdx],
            price: item.price,
            message_link: item.link,
            updated_at: nowStr,
          };
        } else {
          // Insert new
          const nextId = updated.length > 0 ? Math.max(...updated.map((p) => p.id)) + 1 : 1;
          updated.push({
            id: nextId,
            channel_username: cleanCh,
            product_name: item.product_name,
            price: item.price,
            message_link: item.link,
            updated_at: nowStr,
          });
        }
      });

      return updated;
    });
  };

  const handleAddLog = (newLog: Omit<ScraperLog, 'id' | 'timestamp'>) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [
      ...prev,
      {
        ...newLog,
        id: 'log_' + Date.now() + Math.random(),
        timestamp: timeStr,
      },
    ]);
  };

  const handleDeleteProduct = (id: number) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddProduct = (newProd: Omit<Product, 'id' | 'updated_at'>) => {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    setProducts((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((p) => p.id)) + 1 : 1;
      return [
        ...prev,
        {
          ...newProd,
          id: nextId,
          updated_at: nowStr,
        },
      ];
    });
  };

  const handleResetSeed = () => {
    setProducts(INITIAL_PRODUCTS);
  };

  const tabs: Array<{ id: TabType; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'bot', label: 'Search Bot (PTB)', icon: Bot },
    { id: 'scraper', label: 'Userbot Scraper (Telethon)', icon: Radio },
    { id: 'database', label: 'SQLite Store', icon: Database },
    { id: 'regex', label: 'Regex Price Parser', icon: Sparkles },
    { id: 'code', label: 'Python Source Files', icon: Code2 },
    { id: 'architecture', label: 'Architecture & Guide', icon: Layers },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 via-sky-500 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-sky-950">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white">TelePrice</span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  · Telegram Digital Products Price Comparison Bot
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                <span>Telethon Scraper</span>
                <span className="text-slate-600">/</span>
                <span>SQLite Store</span>
                <span className="text-slate-600">/</span>
                <span>python-telegram-bot</span>
              </p>
            </div>
          </div>

          {/* System Status Indicators */}
          <div className="hidden lg:flex items-center gap-4 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>MTProto: <strong className="text-slate-200">Online</strong></span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Bot: <strong className="text-slate-200">Polling</strong></span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>
              <span>DB: <strong className="text-slate-200">{products.length} Items</strong></span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Segmented Bar */}
        <div className="border-t border-slate-800/80 bg-slate-900/60 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto no-scrollbar py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        {activeTab === 'bot' && (
          <div className="h-[720px] max-w-4xl mx-auto w-full">
            <TelegramBotSimulator
              products={products}
              onSelectProductInDb={() => setActiveTab('database')}
            />
          </div>
        )}

        {activeTab === 'scraper' && (
          <div className="flex-1">
            <TelethonScraperSimulator
              onUpsertProducts={handleUpsertProducts}
              logs={logs}
              onAddLog={handleAddLog}
            />
          </div>
        )}

        {activeTab === 'database' && (
          <div className="flex-1">
            <DatabaseInspector
              products={products}
              onDeleteProduct={handleDeleteProduct}
              onAddProduct={handleAddProduct}
              onResetSeed={handleResetSeed}
            />
          </div>
        )}

        {activeTab === 'regex' && (
          <div className="flex-1 max-w-5xl mx-auto w-full">
            <RegexSandbox />
          </div>
        )}

        {activeTab === 'code' && (
          <div className="flex-1">
            <CodeExplorer />
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="flex-1 max-w-5xl mx-auto w-full">
            <ArchitectureView />
          </div>
        )}
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>TelePrice · Telethon MTProto Userbot & python-telegram-bot Architecture</span>
          <span>SQLite MVP · Indonesian Rupiah Regex Engine</span>
        </div>
      </footer>
    </div>
  );
}
