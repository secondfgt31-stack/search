import React, { useState } from 'react';
import { Code2, Copy, Check, Download, FileText, FolderGit2, Terminal, Shield } from 'lucide-react';
import JSZip from 'jszip';
import { PYTHON_FILES, PythonFile } from '../lib/pythonCode';

export const CodeExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<PythonFile>(PYTHON_FILES[0]);
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();

      // Add all files
      PYTHON_FILES.forEach((f) => {
        zip.file(f.path, f.code);
      });

      // Also add seed_data.py
      zip.file(
        'seed_data.py',
        `import database\nfrom parser import format_idr\n# Sample seeder\nif __name__ == '__main__':\n    database.init_db()\n    print('Initialized!')\n`
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'teleprice-telegram-bot.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create zip:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Top Banner with Download as ZIP */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-sky-400" />
            Repositori Source Code Python Lengkap
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Semua modul siap pakai untuk Telethon Userbot Scraper, python-telegram-bot, dan SQLite database.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-2 shadow-sm transition-all active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            {isZipping ? 'Mengompres ZIP...' : 'Download Project (.ZIP)'}
          </button>
        </div>
      </div>

      {/* Main Grid: File List Sidebar + Code Viewer */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
        {/* File Navigator */}
        <div className="md:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-1 overflow-y-auto">
          <p className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-500 px-3 py-1">
            Daftar File (.py, .env, .txt)
          </p>
          {PYTHON_FILES.map((file) => {
            const isSelected = selectedFile.name === file.name;
            return (
              <button
                key={file.name}
                onClick={() => setSelectedFile(file)}
                className={`text-left px-3 py-2.5 rounded-lg text-xs font-mono flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-sky-950/80 text-sky-300 border border-sky-800/80'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className={`w-3.5 h-3.5 ${isSelected ? 'text-sky-400' : 'text-slate-500'}`} />
                  <span className="truncate">{file.path}</span>
                </div>
                <span className="text-[10px] text-slate-500 ml-2 shrink-0">{file.category}</span>
              </button>
            );
          })}
        </div>

        {/* Code Content Canvas */}
        <div className="md:col-span-8 bg-slate-950 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-xl">
          {/* File Header */}
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-sky-300">
                {selectedFile.path}
              </span>
              <span className="text-slate-500 text-xs">·</span>
              <span className="text-[11px] text-slate-400 truncate max-w-sm">
                {selectedFile.description}
              </span>
            </div>

            <button
              onClick={handleCopy}
              className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-[11px]">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Salin Kode</span>
                </>
              )}
            </button>
          </div>

          {/* Code Viewer with Line Numbers */}
          <div className="p-4 overflow-x-auto overflow-y-auto max-h-[580px] font-mono text-xs leading-relaxed text-slate-200 bg-slate-950/90">
            <pre className="flex">
              <code className="text-slate-600 select-none pr-4 text-right border-r border-slate-800">
                {selectedFile.code
                  .split('\n')
                  .map((_, i) => `${i + 1}\n`)
                  .join('')}
              </code>
              <code className="pl-4 text-slate-200 flex-1 whitespace-pre">
                {selectedFile.code}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
