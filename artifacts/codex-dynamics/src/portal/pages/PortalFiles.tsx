import React, { useState } from 'react';
import { FolderOpen, Download, FileText, FileArchive, Image, FileCode, Check, Shield, UploadCloud } from 'lucide-react';
import { portalDb, type PortalClient } from '../../services/portalDatabase';

interface PortalFilesProps {
  client: PortalClient;
  onNavigate: (path: string) => void;
}

export function PortalFiles({ client, onNavigate }: PortalFilesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const files = portalDb.getFiles(client.id);

  const categories = ['all', 'Deliverables', 'Designs & Branding', 'Contracts & Legal', 'Invoices & Receipts'];

  const filteredFiles = files.filter((f) => {
    if (selectedCategory === 'all') return true;
    return f.category === selectedCategory;
  });

  const handleDownload = (fileId: string, fileName: string) => {
    setDownloadingId(fileId);
    setTimeout(() => {
      setDownloadingId(null);
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(`Codex Dynamics Deliverable: ${fileName} for ${client.company}`));
      element.setAttribute('download', fileName);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }, 600);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'zip':
        return <FileArchive className="text-[#FF9F0A]" size={20} />;
      case 'png':
      case 'fig':
        return <Image className="text-[#30D158]" size={20} />;
      case 'pdf':
        return <FileText className="text-[#FF453A]" size={20} />;
      default:
        return <FileCode className="text-[#0071E3]" size={20} />;
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#0071E3] mb-1">
            Secure Assets
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            Files &amp; Deliverables
          </h1>
          <p className="text-sm text-[#86868B] mt-1">
            Production builds, brand asset guidelines, contracts, and export bundles for <strong className="text-[#1D1D1F] dark:text-white font-medium">{client.company}</strong>.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/portal/support')}
          className="px-4 py-2 rounded-2xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold border border-black/[0.04] dark:border-white/[0.06] transition-all self-start sm:self-auto"
        >
          Request File Upload
        </button>
      </div>

      {/* Category Tabs - Apple Segmented Design */}
      <div className="flex flex-wrap gap-1.5 pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              selectedCategory === cat
                ? 'bg-[#0071E3] text-white shadow-xs'
                : 'bg-black/[0.04] dark:bg-white/[0.08] text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white'
            }`}
          >
            {cat === 'all' ? 'All Files' : cat}
          </button>
        ))}
      </div>

      {/* Files List */}
      {filteredFiles.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-[#1C1C1E] border border-dashed border-black/[0.08] dark:border-white/[0.1] rounded-3xl">
          <FolderOpen size={40} className="text-[#86868B] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-white">No files in this category</h3>
          <p className="text-xs text-[#86868B] mt-1 max-w-md mx-auto">
            Deliverable archives, brand files, and signed agreements will be uploaded here by the engineering team.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFiles.map((f) => (
            <div
              key={f.id}
              className="p-5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition-all flex items-center justify-between gap-4 group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="size-11 rounded-2xl bg-black/[0.03] dark:bg-white/[0.06] flex items-center justify-center shrink-0 border border-black/[0.04] dark:border-white/[0.06]">
                  {getFileIcon(f.fileType)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1D1D1F] dark:text-white truncate group-hover:text-[#0071E3] transition-colors">
                    {f.name}
                  </div>
                  <div className="text-xs text-[#86868B] mt-0.5 flex items-center gap-2">
                    <span className="font-mono text-[11px]">{f.size || f.fileSize}</span>
                    <span className="text-black/20 dark:text-white/20">·</span>
                    <span>{f.uploadedAt || f.uploadedDate}</span>
                    <span className="text-black/20 dark:text-white/20">·</span>
                    <span className="text-[#0071E3] font-medium">{f.category}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDownload(f.id, f.name)}
                disabled={downloadingId === f.id}
                className="px-3.5 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all active:scale-[0.98]"
              >
                {downloadingId === f.id ? (
                  <span className="inline-block size-3.5 border-2 border-black/20 dark:border-white/20 border-t-current rounded-full animate-spin" />
                ) : (
                  <>
                    <Download size={13} />
                    <span>Download</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
