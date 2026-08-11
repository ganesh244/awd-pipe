import React, { useState } from 'react';
import { CODE_GS, SETUP_GS, GENERATOR_GS, INDEX_HTML_GS, SETUP_GUIDE_MARKDOWN } from '../utils/appsScriptGenerator';
import { Code2, Copy, Check, Download, BookOpen, FileCode, ExternalLink, ShieldCheck } from 'lucide-react';

export const AppsScriptCodeViewer: React.FC = () => {
  const [activeFile, setActiveFile] = useState<'Code.gs' | 'Setup.gs' | 'Generator.gs' | 'Index.html' | 'Guide'>('Code.gs');
  const [copied, setCopied] = useState(false);

  const getFileContent = () => {
    switch (activeFile) {
      case 'Code.gs':
        return CODE_GS;
      case 'Setup.gs':
        return SETUP_GS;
      case 'Generator.gs':
        return GENERATOR_GS;
      case 'Index.html':
        return INDEX_HTML_GS;
      case 'Guide':
        return SETUP_GUIDE_MARKDOWN;
      default:
        return '';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getFileContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = getFileContent();
    const filename = activeFile === 'Guide' ? 'SETUP_GUIDE.md' : activeFile;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const files = [
    { id: 'Code.gs', label: 'Code.gs', desc: 'Backend HTTP & CRUD API' },
    { id: 'Setup.gs', label: 'Setup.gs', desc: 'Sheet Database Initializer' },
    { id: 'Generator.gs', label: 'Generator.gs', desc: 'QR URL & Formula Generator' },
    { id: 'Index.html', label: 'Index.html', desc: 'Mobile App Web Frontend' },
    { id: 'Guide', label: '📖 16-Step Setup Guide', desc: 'Complete Deployment Manual' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Title Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-emerald-500/20 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" /> Production Ready Output
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            Google Apps Script & Sheets Deployment Suite
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Copy or download these complete source files directly into your Google Apps Script editor (Extensions &rarr; Apps Script in Google Sheets).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow flex items-center gap-2"
          >
            {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied to Clipboard!' : `Copy ${activeFile}`}
          </button>
          <button
            onClick={handleDownload}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>

      {/* File Selector Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-1 border-b border-slate-200 no-scrollbar">
        {files.map((file) => {
          const isActive = activeFile === file.id;
          return (
            <button
              key={file.id}
              onClick={() => setActiveFile(file.id as any)}
              className={`flex flex-col text-left px-4 py-2.5 rounded-xl transition shrink-0 border ${
                isActive
                  ? 'bg-emerald-700 text-white border-emerald-600 shadow-md'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="font-mono font-bold text-xs flex items-center gap-1.5">
                <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-emerald-600'}`} />
                {file.label}
              </span>
              <span className={`text-xs mt-0.5 ${isActive ? 'text-emerald-100' : 'text-slate-400'}`}>
                {file.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Code / Documentation Viewer Box */}
      <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-800">
        
        {/* Code Bar Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono text-emerald-400">
            <Code2 className="w-4 h-4" />
            <span>{activeFile === 'Guide' ? 'SETUP_GUIDE.md' : activeFile}</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {getFileContent().length.toLocaleString()} characters
          </span>
        </div>

        {/* Code Content */}
        <div className="p-4 sm:p-6 overflow-x-auto max-h-[600px] overflow-y-auto font-mono text-xs text-slate-200 leading-relaxed whitespace-pre font-normal selection:bg-emerald-500 selection:text-slate-900">
          {getFileContent()}
        </div>

      </div>

    </div>
  );
};
