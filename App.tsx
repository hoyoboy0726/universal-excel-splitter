import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { ColumnMapper } from './components/ColumnMapper';
import { MasterTable } from './components/MasterTable';
import { StepIndicator } from './components/StepIndicator';
import { DataCleaner } from './components/DataCleaner';
import { AppStep, SheetData, EmployeeRow, FieldDefinition, AppMode, MergeConfig } from './types';
import { readExcelFiles, mergeData } from './utils/excelUtils';
import { SAMPLE_SHEETS } from './utils/mockData';
import { Layers, Sparkles, Home, AlertCircle, X } from 'lucide-react';
import { Toast, ToastType } from './components/Toast';

// Internal Modal Component to replace window.confirm
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel}></div>
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 relative z-[2001] animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onCancel} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
            <AlertCircle size={28} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
          <p className="text-slate-500 mb-6 text-sm leading-relaxed">{message}</p>
          <div className="flex gap-3 w-full">
            <button 
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button 
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 shadow-sm transition-colors"
            >
              確定重置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.SPLITTER);
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  
  // State for dynamic fields & mapping defined in Step 2
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [mapping, setMapping] = useState<Record<string, string[]>>({});
  
  // New State for Merge Configuration - Default changed to 'join'
  const [mergeConfig, setMergeConfig] = useState<MergeConfig>({
      method: 'join',
      joinKey: '',
      joinType: 'outer',
      removeDuplicates: true
  });
  
  const [mergedData, setMergedData] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Notification State
  const [toast, setToast] = useState<{msg: string, type: ToastType} | null>(null);

  // Confirmation Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({ isOpen: false, title: '', message: '', action: () => {} });

  const notify = (msg: string, type: ToastType = 'info') => {
    setToast({ msg, type });
  };

  const handleFilesSelected = async (files: File[]) => {
    setLoading(true);
    try {
      const extractedSheets = await readExcelFiles(files);
      if (extractedSheets.length === 0) {
        notify('無法讀取檔案或檔案為空。', 'error');
        setLoading(false);
        return;
      }
      setSheets(extractedSheets);
      // Reset mapping/fields when new files are uploaded to trigger auto-detection
      setFields([]);
      setMapping({});
      setStep(AppStep.MAPPING);
      notify('檔案讀取成功！', 'success');
    } catch (error) {
      console.error(error);
      notify('讀取 Excel 失敗，請確認格式。', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSample = () => {
    setLoading(true);
    setTimeout(() => {
      setSheets(SAMPLE_SHEETS);
      setFields([]);
      setMapping({});
      setStep(AppStep.MAPPING);
      setLoading(false);
      notify('範例資料載入成功', 'success');
    }, 600);
  };

  const handleConfirmMapping = (newMapping: Record<string, string[]>, definedFields: FieldDefinition[], newMergeConfig: MergeConfig, orderedSheets: SheetData[]) => {
    setLoading(true);
    setFields(definedFields);
    setMapping(newMapping); 
    setMergeConfig(newMergeConfig);
    setSheets(orderedSheets); // Update sheets with the new order
    
    setTimeout(() => {
      try {
        const data = mergeData(orderedSheets, newMapping, newMergeConfig);
        setMergedData(data);
        setStep(AppStep.PREVIEW);
        notify('資料合併成功！', 'success');
      } catch (e) {
        console.error(e);
        notify('合併資料時發生錯誤', 'error');
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  const handleBackToMapping = () => {
    setStep(AppStep.MAPPING);
  };

  // --- Soft Reset Logic ---
  const performSoftReset = (targetMode?: AppMode) => {
    setLoading(false);
    setStep(AppStep.UPLOAD);
    setSheets([]);
    setMergedData([]);
    setFields([]);
    setMapping({});
    setMergeConfig({ method: 'join', joinKey: '', joinType: 'outer', removeDuplicates: true }); // Reset to 'join'
    if (targetMode) {
      setMode(targetMode);
    }
    setModalConfig(prev => ({ ...prev, isOpen: false }));
    notify('已回到首頁並清除資料', 'success');
  };

  const triggerResetConfirmation = (targetMode?: AppMode) => {
    const hasData = sheets.length > 0 || step !== AppStep.UPLOAD;
    
    // If no data, just do it immediately
    if (!hasData) {
      performSoftReset(targetMode);
      return;
    }

    // If has data, show custom modal
    setModalConfig({
      isOpen: true,
      title: targetMode && targetMode !== mode ? '切換模式確認' : '回到首頁確認',
      message: '此動作將會清除目前所有已上傳的資料與設定，且無法復原。您確定要繼續嗎？',
      action: () => performSoftReset(targetMode)
    });
  };

  const handleFullReset = () => {
    triggerResetConfirmation(); 
  };

  const switchMode = (newMode: AppMode) => {
    if (mode === newMode) return;
    triggerResetConfirmation(newMode);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-16">
      {toast && (
        <Toast 
          message={toast.msg} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      <ConfirmModal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.action}
        onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
      />

      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-[1000] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between h-full items-center">
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={handleFullReset}>
              <div className="bg-blue-600 text-white p-1.5 rounded font-bold text-lg">US</div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight hidden sm:block">
                Universal Excel <span className="text-blue-600">Splitter</span>
              </h1>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
               {/* Home / Reset Button */}
               <button 
                 onClick={handleFullReset}
                 className="flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-md transition-colors text-sm font-medium mr-2"
                 title="回到首頁"
               >
                 <Home size={18} />
                 首頁
               </button>

               {/* Mode Switcher */}
               <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200">
                  <button 
                    onClick={() => switchMode(AppMode.CLEANER)}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all
                      ${mode === AppMode.CLEANER 
                         ? 'bg-white text-indigo-600 shadow-sm' 
                         : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}
                    `}
                  >
                    <Sparkles size={16} />
                    資料前處理 (清洗)
                  </button>
                  <button 
                    onClick={() => switchMode(AppMode.SPLITTER)}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all
                      ${mode === AppMode.SPLITTER 
                         ? 'bg-white text-blue-600 shadow-sm' 
                         : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}
                    `}
                  >
                    <Layers size={16} />
                    通用合併與拆分
                  </button>
               </div>
            </div>
          </div>
        </div>
      </header>

      {/* Only show step indicator in Splitter mode */}
      {mode === AppMode.SPLITTER && <StepIndicator currentStep={step} />}

      <main className="flex-1 w-full relative">
        {mode === AppMode.SPLITTER ? (
          <>
            {step === AppStep.UPLOAD && (
              <div className="max-w-4xl mx-auto mt-8 px-4">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-slate-800 mb-4">開始匯入資料</h2>
                  <p className="text-slate-600 max-w-xl mx-auto">
                    請上傳您的 Excel 檔案。支援將多個檔案或工作表合併，
                    自訂欄位後，進行靈活的條件拆分匯出。
                  </p>
                </div>
                <FileUpload 
                  onFilesSelected={handleFilesSelected} 
                  onLoadSample={handleLoadSample}
                  isLoading={loading} 
                />
              </div>
            )}

            {step === AppStep.MAPPING && (
              <ColumnMapper 
                sheets={sheets} 
                initialFields={fields}
                initialMapping={mapping}
                initialMergeConfig={mergeConfig}
                onConfirmMapping={handleConfirmMapping}
                onBack={() => setStep(AppStep.UPLOAD)}
                onNotify={notify}
              />
            )}

            {step === AppStep.PREVIEW && (
              <div className="h-[calc(100vh-220px)] w-full">
                <MasterTable 
                  data={mergedData} 
                  fields={fields}
                  onDataUpdate={setMergedData}
                  onBack={handleBackToMapping}
                  onReset={handleFullReset} 
                  onNotify={notify}
                />
              </div>
            )}
          </>
        ) : (
          <DataCleaner 
            onBack={() => switchMode(AppMode.SPLITTER)} 
            onNotify={notify}
          />
        )}
      </main>
    </div>
  );
}

export default App;