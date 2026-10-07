import React, { useState } from 'react';
import { Database, Search, Plus, Trash2, Download, RefreshCw, ExternalLink, Filter, ArrowUpDown } from 'lucide-react';
import { Product } from '../types';
import { formatIdr } from '../lib/parser';

interface DatabaseInspectorProps {
  products: Product[];
  onDeleteProduct: (id: number) => void;
  onAddProduct: (prod: Omit<Product, 'id' | 'updated_at'>) => void;
  onResetSeed: () => void;
}

export const DatabaseInspector: React.FC<DatabaseInspectorProps> = ({
  products,
  onDeleteProduct,
  onAddProduct,
  onResetSeed,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'name' | 'recent'>('price_asc');
  const [showAddModal, setShowAddModal] = useState(false);

  // New product form
  const [newChannel, setNewChannel] = useState('@seller_contoh');
  const [newName, setNewName] = useState('ChatGPT Plus Shared 1 Bulan');
  const [newPrice, setNewPrice] = useState(42000);
  const [newLink, setNewLink] = useState('https://t.me/seller_contoh/101');

  // Filter & sort
  const filtered = products.filter((p) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      p.product_name.toLowerCase().includes(q) ||
      p.channel_username.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'price_asc') return a.price - b.price;
    if (sortBy === 'price_desc') return b.price - a.price;
    if (sortBy === 'name') return a.product_name.localeCompare(b.product_name);
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const uniqueChannels = new Set(products.map((p) => p.channel_username)).size;

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(products, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'teleprice_products.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportSql = () => {
    let sql = `-- TelePrice SQLite Dump\n`;
    sql += `CREATE TABLE IF NOT EXISTS products (\n`;
    sql += `    id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
    sql += `    channel_username TEXT NOT NULL,\n`;
    sql += `    product_name TEXT NOT NULL,\n`;
    sql += `    price INTEGER NOT NULL,\n`;
    sql += `    message_link TEXT NOT NULL,\n`;
    sql += `    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n`;
    sql += `    UNIQUE (channel_username, product_name)\n);\n\n`;

    products.forEach((p) => {
      const cleanCh = p.channel_username.replace(/'/g, "''");
      const cleanName = p.product_name.replace(/'/g, "''");
      const cleanLink = p.message_link.replace(/'/g, "''");
      sql += `INSERT INTO products (channel_username, product_name, price, message_link, updated_at) VALUES ('${cleanCh}', '${cleanName}', ${p.price}, '${cleanLink}', '${p.updated_at}');\n`;
    });

    const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(sql);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'database_dump.sql');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPrice) return;
    onAddProduct({
      channel_username: newChannel.trim().replace(/^@/, ''),
      product_name: newName.trim(),
      price: Number(newPrice),
      message_link: newLink.trim(),
    });
    setShowAddModal(false);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400">Total Produk</p>
          <p className="text-xl font-bold text-slate-100 mt-1">{products.length} listing</p>
          <p className="text-[11px] text-slate-500 mt-1">Tersimpan di SQLite</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400">Channel Seller</p>
          <p className="text-xl font-bold text-sky-400 mt-1">{uniqueChannels} channel</p>
          <p className="text-[11px] text-slate-500 mt-1">Sumber broadcast aktif</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400">Harga Termurah</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            {products.length > 0
              ? formatIdr(Math.min(...products.map((p) => p.price)))
              : 'Rp 0'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Best deal di database</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400">Pencarian Bot</p>
          <p className="text-xl font-bold text-cyan-400 mt-1">LIKE %q%</p>
          <p className="text-[11px] text-slate-500 mt-1">Index ORDER BY price ASC</p>
        </div>
      </div>

      {/* Database Controls Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        <div className="flex-1 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari produk atau channel (LIKE %query%)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="price_asc">Harga: Termurah (ASC)</option>
              <option value="price_desc">Harga: Tertinggi (DESC)</option>
              <option value="name">Nama Produk (A-Z)</option>
              <option value="recent">Terakhir Diupdate</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Listing
          </button>

          <button
            onClick={onResetSeed}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
            title="Reset ulang ke data seed bawaan"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Data
          </button>

          <button
            onClick={handleExportSql}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
            title="Export skrip SQL"
          >
            <Download className="w-3.5 h-3.5" />
            SQL Dump
          </button>
        </div>
      </div>

      {/* SQL Table View */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-mono font-medium text-slate-300">
              TABLE products ({sorted.length} baris)
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            SELECT * FROM products ORDER BY price ASC;
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">id</th>
                <th className="px-4 py-3">product_name</th>
                <th className="px-4 py-3 text-right">price (idr)</th>
                <th className="px-4 py-3">channel_username</th>
                <th className="px-4 py-3">message_link</th>
                <th className="px-4 py-3">updated_at</th>
                <th className="px-4 py-3 text-center">aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 text-slate-300">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 text-xs">
                    Tidak ada produk yang cocok dengan pencarian "{searchTerm}".
                  </td>
                </tr>
              ) : (
                sorted.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">{item.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-200">
                      {item.product_name}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                      {formatIdr(item.price)}
                    </td>
                    <td className="px-4 py-3 font-mono text-sky-400">
                      @{item.channel_username.replace(/^@/, '')}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      <a
                        href={item.message_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-sky-300 underline inline-flex items-center gap-1 truncate max-w-[180px]"
                      >
                        {item.message_link}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {item.updated_at}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onDeleteProduct(item.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                        title="Hapus record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-100 mb-3">
              Tambah / Update Produk Manual (UPSERT)
            </h3>
            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Channel Username
                </label>
                <input
                  type="text"
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                  placeholder="@nama_channel"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Nama Produk Digital
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  placeholder="ChatGPT Plus 1 Bulan Shared"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Harga (Integer Rupiah)
                </label>
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                  placeholder="45000"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Link Pesan (t.me/channel/id)
                </label>
                <input
                  type="text"
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                  placeholder="https://t.me/channel/123"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 transition-colors shadow-sm"
                >
                  Simpan Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
