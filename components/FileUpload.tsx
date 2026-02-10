import React, { useCallback } from 'react';
import { Upload, FileSpreadsheet, PlayCircle } from 'lucide-react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  onLoadSample: () => void;
  isLoading: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected, onLoadSample, isLoading }) => {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (isLoading) return;
    const files = Array.from(e.dataTransfer.files).filter((f: File) => 
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv')
    );
    if (files.length > 0) onFilesSelected(files);
  }, [isLoading, onFilesSelected]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLoading || !e.target.files) return;
    const files = Array.from(e.target.files);
    onFilesSelected(files);
  };

  return (
    <div className="flex flex-col items-center justify-center h-96 max-w-2xl mx-auto p-6">
      <div 
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`w-full h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all bg-white relative
          ${isLoading ? 'opacity-50 cursor-not-allowed border-slate-300' : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'}
        `}
      >
        <div className="bg-blue-100 p-4 rounded-full mb-4">
          <Upload className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-slate-700 mb-2">
          拖放 Excel 檔案至此
        </h3>
        <p className="text-slate-500 mb-6 text-center max-w-md">
          支援多個 .xlsx, .xls 檔案。我們會自動掃描所有工作表(Sheets)。
        </p>
        
        <label className="relative mb-4">
          <input 
            type="file" 
            multiple 
            accept=".xlsx,.xls,.csv" 
            onChange={handleFileInput}
            disabled={isLoading}
            className="hidden"
          />
          <span className={`px-6 py-3 rounded-lg font-medium text-white transition-colors shadow-md cursor-pointer inline-block
            ${isLoading ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}
          `}>
            {isLoading ? '處理中...' : '選擇檔案'}
          </span>
        </label>

        <div className="flex items-center gap-4 w-full px-12">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-slate-400 text-sm">或</span>
            <div className="h-px bg-slate-200 flex-1"></div>
        </div>

        <button 
          onClick={onLoadSample}
          disabled={isLoading}
          className="mt-4 flex items-center gap-2 text-slate-500 hover:text-blue-600 font-medium px-4 py-2 rounded-lg hover:bg-blue-50/50 transition-colors"
        >
          <PlayCircle size={18} />
          載入範例資料來測試
        </button>
      </div>

      <div className="mt-8 flex gap-4 text-sm text-slate-400">
        <div className="flex items-center gap-1">
          <FileSpreadsheet size={16} /> 薪資表
        </div>
        <div className="flex items-center gap-1">
          <FileSpreadsheet size={16} /> 人員名單
        </div>
        <div className="flex items-center gap-1">
          <FileSpreadsheet size={16} /> 職等對照
        </div>
      </div>
    </div>
  );
};
