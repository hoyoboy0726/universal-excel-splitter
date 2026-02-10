import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Upload, FileSpreadsheet, Download, RefreshCw, CheckCircle, AlertCircle, Trash2, X, FileArchive, ArrowRightLeft, Undo2, Redo2, Scissors, CaseSensitive, ArrowRightFromLine, Calendar, Hash, PaintBucket, Eraser, ChevronUp, ChevronDown, MousePointerClick, Type, Calculator, TableProperties, Play, ArrowLeft, Plus, Minus, Home, AlertTriangle } from 'lucide-react';
import { SheetData } from '../types';
import { readExcelFiles, exportWorkbook, exportMultipleFilesAsZip } from '../utils/excelUtils';
import { ToastType } from './Toast';

const INDEX_WIDTH = 60;

// --- Operation Types ---
type TextOperation = 'trim' | 'removeAllSpaces' | 'upper' | 'lower' | 'titleCase' | 'removeSymbols' | 'findReplace' | 'regexReplace' | 'prepend' | 'append';
type FormatOperation = 'toNumber' | 'toCurrency' | 'round' | 'floor' | 'ceil' | 'toFixed2' | 'toDate' | 'padLeft' | 'mathAdd' | 'mathSub' | 'mathMul' | 'mathDiv';
type RowOperation = 'fillEmpty' | 'removeDuplicates' | 'removeEmptyRows' | 'deleteSelectedCols' | 'keepSelectedCols';

interface DataCleanerProps {
  onBack: () => void;
  onNotify: (msg: string, type: ToastType) => void;
}

export const DataCleaner: React.FC<DataCleanerProps> = ({ onBack, onNotify }) => {
  // --- History State (Undo/Redo) ---
  const [history, setHistory] = useState<SheetData[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Derived state for current view
  const sheets = useMemo(() => history[historyIndex] || [], [history, historyIndex]);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  
  // --- UI State ---
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSelectedSheets, setExportSelectedSheets] = useState<Set<string>>(new Set());
  const [exportMode, setExportMode] = useState<'single' | 'multiple'>('single');
  const [showCleaningTools, setShowCleaningTools] = useState(false);

  // --- Column Selection State ---
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set());

  // --- Resizing State ---
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const resizingRef = useRef<{
    type: 'col' | 'row' | null;
    id: string; 
    startPos: number;
    startSize: number;
  }>({ type: null, id: '', startPos: 0, startSize: 0 });

  // --- Tool Selection State ---
  const [selectedTextOp, setSelectedTextOp] = useState<TextOperation>('trim');
  const [selectedFormatOp, setSelectedFormatOp] = useState<FormatOperation>('toNumber');
  const [selectedRowOp, setSelectedRowOp] = useState<RowOperation>('fillEmpty');

  // --- Tool Inputs ---
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [textInput, setTextInput] = useState(''); // Generic text input (prepend/append)
  const [numInput, setNumInput] = useState<number>(0); // Generic number input (math)
  const [padLength, setPadLength] = useState<number>(3);
  const [fillValue, setFillValue] = useState('');

  const activeSheet = useMemo(() => 
    sheets.find(s => s.sheetName === activeSheetName), 
  [sheets, activeSheetName]);

  // --- Effects ---
  useEffect(() => {
    if (activeSheet) {
      setColWidths(prev => {
        const newWidths = { ...prev };
        activeSheet.headers.forEach(h => {
          if (!newWidths[h]) newWidths[h] = 150;
        });
        return newWidths;
      });
      setSelectedCols(new Set());
    }
  }, [activeSheetName]);

  useEffect(() => {
    if (sheets.length > 0) {
      setExportSelectedSheets(prev => prev.size === 0 ? new Set(sheets.map(s => s.sheetName)) : prev);
    }
  }, [sheets.length]); 

  // --- File Handling ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setLoading(true);
      setFile(selectedFile);
      setColWidths({});
      setRowHeights({});
      setSelectedCols(new Set());
      setExportSelectedSheets(new Set());
      
      try {
        const data = await readExcelFiles([selectedFile]);
        setHistory([data]);
        setHistoryIndex(0);
        if (data.length > 0) {
          setActiveSheetName(data[0].sheetName);
          onNotify(`成功讀取檔案: ${selectedFile.name}`, 'success');
        }
      } catch (err) {
        console.error(err);
        onNotify('讀取檔案失敗', 'error');
        setFile(null);
      } finally {
        setLoading(false);
      }
    }
  };

  // --- History Operations ---
  const pushToHistory = (newSheets: SheetData[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newSheets);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      onNotify('已還原上一步', 'info');
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      onNotify('已重做', 'info');
    }
  };

  // --- Column Operations Helper ---
  const toggleColumnSelection = (header: string) => {
    setSelectedCols(prev => {
      const next = new Set(prev);
      if (next.has(header)) next.delete(header);
      else next.add(header);
      return next;
    });
  };

  const handleSwapColumns = () => {
    const cols = Array.from(selectedCols);
    if (cols.length !== 2) return;
    const [colA, colB] = cols;
    const newSheets = sheets.map(sheet => {
      if (sheet.sheetName === activeSheetName) {
        const newHeaders = [...sheet.headers];
        const idxA = newHeaders.indexOf(colA);
        const idxB = newHeaders.indexOf(colB);
        if (idxA !== -1 && idxB !== -1) {
          newHeaders[idxA] = colB;
          newHeaders[idxB] = colA;
          return { ...sheet, headers: newHeaders };
        }
      }
      return sheet;
    });
    pushToHistory(newSheets);
    setSelectedCols(new Set());
    onNotify('欄位位置已交換', 'success');
  };

  // --- Inline Editing ---
  const handleCellChange = (rowIndex: number, header: string, value: string) => {
    if (!activeSheet) return;
    
    // Create new rows with updated value
    const newRows = [...activeSheet.rows];
    newRows[rowIndex] = { ...newRows[rowIndex], [header]: value };

    // Update the sheets array within the CURRENT history frame
    // We do NOT push a new history state for every keystroke to avoid clutter
    const newSheets = sheets.map(s => 
      s.sheetName === activeSheetName ? { ...s, rows: newRows } : s
    );

    setHistory(prev => {
        const next = [...prev];
        next[historyIndex] = newSheets; // Update current frame
        return next;
    });
  };

  // --- Core Cleaning Logic ---
  const applyCleaning = (label: string, transform: (val: any) => any) => {
    if (!activeSheet) return;

    // 直接依據是否選取欄位來決定目標，不跳出確認視窗，與 UI 提示一致
    const targetHeaders: string[] = selectedCols.size > 0 
      ? Array.from(selectedCols) 
      : activeSheet.headers;

    let changedCount = 0;
    const newRows = activeSheet.rows.map(row => {
        const newRow = { ...row };
        let rowChanged = false;
        
        targetHeaders.forEach((header: string) => {
            const oldVal = (newRow as any)[header];
            const newVal = transform(oldVal);
            if (oldVal !== newVal) {
                (newRow as any)[header] = newVal;
                rowChanged = true;
            }
        });
        
        if (rowChanged) changedCount++;
        return newRow;
    });

    if (changedCount > 0) {
        const newSheets = sheets.map(s => 
            s.sheetName === activeSheetName ? { ...s, rows: newRows } : s
        );
        pushToHistory(newSheets);
        onNotify(`已套用: ${label} (影響 ${changedCount} 列)`, 'success');
    } else {
        onNotify('沒有資料需要變更。', 'info');
    }
  };

  // --- Operations Implementation ---

  const executeTextOp = () => {
    switch (selectedTextOp) {
      case 'trim':
        applyCleaning('修剪前後空白', val => typeof val === 'string' ? val.trim() : val);
        break;
      case 'removeAllSpaces':
        applyCleaning('去除所有空白', val => typeof val === 'string' ? val.replace(/\s+/g, '') : val);
        break;
      case 'upper':
        applyCleaning('轉大寫', val => typeof val === 'string' ? val.toUpperCase() : val);
        break;
      case 'lower':
        applyCleaning('轉小寫', val => typeof val === 'string' ? val.toLowerCase() : val);
        break;
      case 'titleCase':
        applyCleaning('首字母大寫', val => {
            if (typeof val !== 'string') return val;
            return val.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
        });
        break;
      case 'removeSymbols':
        applyCleaning('移除特殊符號', val => typeof val === 'string' ? val.replace(/[^\w\s\u4e00-\u9fa5]/gi, '') : val);
        break;
      case 'findReplace':
        if (!findText) return onNotify('請輸入尋找內容', 'error');
        applyCleaning('尋找與取代', val => {
            const str = String(val || '');
            return str.split(findText).join(replaceText);
        });
        break;
      case 'regexReplace':
        if (!findText) return onNotify('請輸入正則表達式', 'error');
        try {
            const regex = new RegExp(findText, 'g');
            applyCleaning('正則取代', val => String(val || '').replace(regex, replaceText));
        } catch (e) {
            onNotify('正則表達式錯誤', 'error');
        }
        break;
      case 'prepend':
        if (!textInput) return;
        applyCleaning('開頭添加', val => textInput + (val || ''));
        break;
      case 'append':
        if (!textInput) return;
        applyCleaning('結尾添加', val => (val || '') + textInput);
        break;
    }
  };

  const executeFormatOp = () => {
    switch (selectedFormatOp) {
      case 'toNumber':
        applyCleaning('純數值化', val => {
            if (!val) return val;
            const clean = String(val).replace(/[^0-9.-]/g, '');
            return (clean && !isNaN(parseFloat(clean))) ? parseFloat(clean) : val;
        });
        break;
      case 'toCurrency':
        applyCleaning('轉為金額格式', val => {
            if (val === undefined || val === null || String(val).trim() === '') return val;
            const str = String(val).replace(/,/g, '');
            const num = parseFloat(str);
            return isNaN(num) ? val : num.toLocaleString('en-US');
        });
        break;
      case 'round':
        applyCleaning('四捨五入', val => {
            const num = parseFloat(String(val));
            return isNaN(num) ? val : Math.round(num);
        });
        break;
      case 'floor':
        applyCleaning('無條件捨去', val => {
            const num = parseFloat(String(val));
            return isNaN(num) ? val : Math.floor(num);
        });
        break;
      case 'ceil':
        applyCleaning('無條件進位', val => {
            const num = parseFloat(String(val));
            return isNaN(num) ? val : Math.ceil(num);
        });
        break;
      case 'toFixed2':
        applyCleaning('保留兩位小數', val => {
            const num = parseFloat(String(val));
            return isNaN(num) ? val : Math.round(num * 100) / 100;
        });
        break;
      case 'toDate':
        applyCleaning('日期標準化', val => {
            if (!val) return val;
            let dateObj: Date | null = null;
            if (typeof val === 'number' || (!isNaN(Number(val)) && Number(val) > 20000 && Number(val) < 60000)) {
               const serial = Number(val);
               dateObj = new Date(Math.round((serial - 25569) * 86400 * 1000));
            } else {
               const str = String(val).trim();
               const standardStr = str.replace(/\./g, '-').replace(/\//g, '-');
               const parsed = Date.parse(standardStr);
               if (!isNaN(parsed)) dateObj = new Date(parsed);
            }
            return (dateObj && !isNaN(dateObj.getTime())) ? dateObj.toISOString().split('T')[0] : val;
        });
        break;
      case 'padLeft':
        applyCleaning('向左補零', val => {
            if (val === undefined || val === null) return val;
            let str = String(val);
            if (/^\d+$/.test(str)) {
                str = String(parseInt(str, 10));
            }
            return str.padStart(padLength, '0');
        });
        break;
      case 'mathAdd':
        applyCleaning('數值加法', val => { const n = parseFloat(String(val)); return isNaN(n) ? val : n + numInput; });
        break;
      case 'mathSub':
        applyCleaning('數值減法', val => { const n = parseFloat(String(val)); return isNaN(n) ? val : n - numInput; });
        break;
      case 'mathMul':
        applyCleaning('數值乘法', val => { const n = parseFloat(String(val)); return isNaN(n) ? val : n * numInput; });
        break;
      case 'mathDiv':
        if(numInput === 0) return onNotify('除數不能為0', 'error');
        applyCleaning('數值除法', val => { const n = parseFloat(String(val)); return isNaN(n) ? val : n / numInput; });
        break;
    }
  };

  const executeRowOp = () => {
      if (!activeSheet) return;
      
      if (selectedRowOp === 'fillEmpty') {
          applyCleaning('填充空值', val => (val === undefined || val === null || String(val).trim() === '') ? fillValue : val);
          return;
      }
      
      let newRows = [...activeSheet.rows];
      let initialCount = newRows.length;
      let headersChanged = false;
      let newHeaders = [...activeSheet.headers];

      if (selectedRowOp === 'removeDuplicates') {
          const targetHeaders: string[] = selectedCols.size > 0 ? Array.from(selectedCols) : activeSheet.headers;
          const seen = new Set();
          newRows = newRows.filter(row => {
              const key = targetHeaders.map(h => row[h]).join('|');
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
          });
      } else if (selectedRowOp === 'removeEmptyRows') {
          const targetHeaders: string[] = selectedCols.size > 0 ? Array.from(selectedCols) : activeSheet.headers;
          newRows = newRows.filter(row => {
              return targetHeaders.some(h => {
                  const val = row[h];
                  return val !== undefined && val !== null && String(val).trim() !== '';
              });
          });
      } else if (selectedRowOp === 'deleteSelectedCols') {
          if (selectedCols.size === 0) return onNotify('請先選擇要刪除的欄位', 'error');
          newHeaders = newHeaders.filter(h => !selectedCols.has(h));
          headersChanged = true;
      } else if (selectedRowOp === 'keepSelectedCols') {
          if (selectedCols.size === 0) return onNotify('請先選擇要保留的欄位', 'error');
          newHeaders = newHeaders.filter(h => selectedCols.has(h));
          headersChanged = true;
      }

      if (headersChanged) {
          const newSheets = sheets.map(sheet => {
              if (sheet.sheetName === activeSheetName) {
                  return { ...sheet, headers: newHeaders };
              }
              return sheet;
          });
          pushToHistory(newSheets);
          setSelectedCols(new Set());
          onNotify('欄位結構已變更', 'success');
      } else if (newRows.length !== initialCount) {
          const newSheets = sheets.map(s => 
            s.sheetName === activeSheetName ? { ...s, rows: newRows } : s
          );
          pushToHistory(newSheets);
          onNotify(`已移除 ${initialCount - newRows.length} 列資料`, 'success');
      } else {
          onNotify('沒有發現需要變更的資料', 'info');
      }
  };


  // --- Resize Handlers ---
  const startResize = (e: React.MouseEvent, type: 'col' | 'row', id: string, currentSize: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      type,
      id,
      startPos: type === 'col' ? e.clientX : e.clientY,
      startSize: currentSize
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = type === 'col' ? 'col-resize' : 'row-resize';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const { type, id, startPos, startSize } = resizingRef.current;
    if (!type) return;

    if (type === 'col') {
      const delta = e.clientX - startPos;
      const newWidth = Math.max(50, startSize + delta);
      setColWidths(prev => ({ ...prev, [id as string]: newWidth }));
    } else {
      const delta = e.clientY - startPos;
      const newHeight = Math.max(30, startSize + delta);
      setRowHeights(prev => ({ ...prev, [id as string]: newHeight }));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    resizingRef.current = { type: null, id: '', startPos: 0, startSize: 0 };
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
  }, [handleMouseMove]);

  // --- Exports ---
  const handleOpenExportModal = () => setShowExportModal(true);

  const executeExport = async () => {
    if (!file) return;
    const sheetsToExport = sheets.filter(s => exportSelectedSheets.has(s.sheetName));
    if (sheetsToExport.length === 0) {
      onNotify("請至少選擇一個工作表", 'error');
      return;
    }
    const cleanName = `Cleaned_${file.name.replace('.xlsx', '').replace('.xls', '')}`;
    if (exportMode === 'single') {
      exportWorkbook(sheetsToExport, cleanName);
    } else {
      await exportMultipleFilesAsZip(sheetsToExport, cleanName);
    }
    onNotify("匯出成功！", 'success');
    setShowExportModal(false);
  };
  
  const toggleSelectAllSheets = () => {
    setExportSelectedSheets(prev => prev.size === sheets.length ? new Set() : new Set(sheets.map(s => s.sheetName)));
  };
  const toggleSheetSelection = (name: string) => {
    setExportSelectedSheets(prev => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
    });
  };

  // Calculate Total Table Width
  const totalTableWidth = useMemo(() => {
    if (!activeSheet) return 0;
    const fieldsWidth = activeSheet.headers.reduce((sum, header) => {
      return sum + (colWidths[header] || 150);
    }, 0);
    return fieldsWidth + INDEX_WIDTH;
  }, [activeSheet, colWidths]);


  // --- Render ---

  if (!file) {
    return (
      <div className="max-w-4xl mx-auto mt-12 px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Excel 圖片/格式清理工具</h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-sm">
            此工具專門處理「髒亂」的 Excel 檔案。我們會將每個工作表的內容讀取為純文字與數值，
            <span className="font-bold text-red-500"> 自動移除所有圖片、圖表、浮水印與複雜格式</span>。
            </p>
          </div>
          <div className="flex flex-col items-center justify-center h-80 max-w-2xl mx-auto p-6 bg-white rounded-xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all shadow-sm w-full">
            <div className="bg-indigo-100 p-4 rounded-full mb-4">
                <RefreshCw className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">上傳單一 Excel 檔案</h3>
            <p className="text-slate-500 mb-6 text-center">一次僅限處理一個檔案。支援 .xlsx, .xls</p>
            <label className="relative">
                <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} disabled={loading} className="hidden" value="" />
                <span className={`px-6 py-3 rounded-lg font-medium text-white transition-colors shadow-md cursor-pointer inline-block ${loading ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {loading ? '正在清洗資料...' : '選擇檔案開始清理'}
                </span>
            </label>
          </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 relative">
      
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 p-3 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 z-40">
        <div className="flex items-center gap-3">
             <button 
                onClick={onBack}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
                title="回到首頁"
             >
                <ArrowLeft size={24} />
             </button>

            <div className="p-2 bg-green-100 text-green-700 rounded-lg"><CheckCircle size={20} /></div>
            <div>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">{file.name}</h3>
                <p className="text-xs text-slate-500">
                   共 {sheets.length} 個工作表。
                   <span className="ml-2 text-indigo-600 font-medium">
                     {activeSheet ? `${activeSheet.sheetName} (${activeSheet.rows.length} 筆)` : ''}
                   </span>
                </p>
            </div>
        </div>

        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 px-3 py-1.5 rounded border border-amber-100 hidden md:flex">
               <AlertTriangle size={16} />
               可以點擊表格修改
            </div>
            <button onClick={() => setShowCleaningTools(!showCleaningTools)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all shadow-sm relative ${showCleaningTools ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200' : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'}`}>
                <Eraser size={16} /> 清洗工具 {showCleaningTools ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button onClick={handleOpenExportModal} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-md">
                <Download size={16} /> 匯出
            </button>
        </div>
      </div>

      {/* Cleaning Tools Panel */}
      {showCleaningTools && (
        <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200 shadow-inner z-30 relative">
           
           <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-200 pb-3">
              <div className="flex items-center gap-2 px-3 py-1 bg-white/60 rounded-full border border-indigo-100 text-xs font-bold text-indigo-800">
                 <MousePointerClick size={14} />
                 應用於: {selectedCols.size > 0 ? `已選取的 ${selectedCols.size} 個欄位` : '目前工作表的所有欄位'}
              </div>

              <div className="flex items-center gap-2">
                 <button onClick={undo} disabled={historyIndex <= 0} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${historyIndex <= 0 ? 'text-slate-400 cursor-not-allowed bg-slate-100' : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:text-blue-600 shadow-sm'}`}>
                    <Undo2 size={14} /> 上一步 (Undo)
                 </button>
                 <button onClick={redo} disabled={historyIndex >= history.length - 1} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${historyIndex >= history.length - 1 ? 'text-slate-400 cursor-not-allowed bg-slate-100' : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:text-blue-600 shadow-sm'}`}>
                    <Redo2 size={14} /> 重做 (Redo)
                 </button>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Group 1: Text Operations */}
              <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-2 text-indigo-800 text-sm font-bold">
                    <Type size={16}/> 文字處理 (Text)
                 </div>
                 <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-2">
                    <select 
                      value={selectedTextOp} 
                      onChange={(e) => setSelectedTextOp(e.target.value as TextOperation)}
                      className="w-full text-sm border-slate-300 rounded-md py-1.5 focus:ring-indigo-500 border"
                    >
                        <option value="trim">去除前後空白 (Trim)</option>
                        <option value="removeAllSpaces">去除所有空白 (No Spaces)</option>
                        <option value="upper">轉大寫 (UPPER)</option>
                        <option value="lower">轉小寫 (lower)</option>
                        <option value="titleCase">首字母大寫 (Title Case)</option>
                        <option value="prepend">開頭添加 (Prepend)</option>
                        <option value="append">結尾添加 (Append)</option>
                        <option value="removeSymbols">移除特殊符號 (英數中)</option>
                        <option value="findReplace">尋找與取代 (Find & Replace)</option>
                        <option value="regexReplace">正則表達式取代 (Regex)</option>
                    </select>

                    {(selectedTextOp === 'findReplace' || selectedTextOp === 'regexReplace') && (
                        <div className="flex gap-1">
                            <input type="text" placeholder={selectedTextOp === 'regexReplace' ? "Regex pattern" : "尋找..."} value={findText} onChange={e => setFindText(e.target.value)} className="w-1/2 text-sm border p-1 rounded" />
                            <input type="text" placeholder="取代為..." value={replaceText} onChange={e => setReplaceText(e.target.value)} className="w-1/2 text-sm border p-1 rounded" />
                        </div>
                    )}

                    {(selectedTextOp === 'prepend' || selectedTextOp === 'append') && (
                        <input type="text" placeholder="輸入文字..." value={textInput} onChange={e => setTextInput(e.target.value)} className="w-full text-sm border p-1 rounded" />
                    )}
                    
                    <button onClick={executeTextOp} className="w-full py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded border border-indigo-200 flex items-center justify-center gap-1">
                       <Play size={12}/> 執行
                    </button>
                 </div>
              </div>

              {/* Group 2: Format Operations */}
              <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-2 text-indigo-800 text-sm font-bold">
                    <Calculator size={16}/> 數值與格式 (Format)
                 </div>
                 <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-2">
                    <select 
                      value={selectedFormatOp} 
                      onChange={(e) => setSelectedFormatOp(e.target.value as FormatOperation)}
                      className="w-full text-sm border-slate-300 rounded-md py-1.5 focus:ring-indigo-500 border"
                    >
                        <option value="toNumber">轉為純數值 (Number only)</option>
                        <option value="toCurrency">轉為金額格式 (1,000)</option>
                        <option value="round">四捨五入取整 (Round)</option>
                        <option value="floor">無條件捨去取整 (Floor)</option>
                        <option value="ceil">無條件進位取整 (Ceil)</option>
                        <option value="toFixed2">保留兩位小數 (2 Decimals)</option>
                        <option value="mathAdd">數值加法 (+)</option>
                        <option value="mathSub">數值減法 (-)</option>
                        <option value="mathMul">數值乘法 (x)</option>
                        <option value="mathDiv">數值除法 (/)</option>
                        <option value="toDate">日期標準化 (YYYY-MM-DD)</option>
                        <option value="padLeft">向左補零 (Pad Left)</option>
                    </select>

                    {selectedFormatOp === 'padLeft' && (
                        <div className="flex items-center gap-2">
                             <span className="text-xs text-slate-500">總長度:</span>
                             <input type="number" min="1" max="20" value={padLength} onChange={e => setPadLength(parseInt(e.target.value))} className="w-full text-sm border p-1 rounded" />
                        </div>
                    )}

                    {['mathAdd', 'mathSub', 'mathMul', 'mathDiv'].includes(selectedFormatOp) && (
                        <div className="flex items-center gap-2">
                             <span className="text-xs text-slate-500">數值:</span>
                             <input type="number" value={numInput} onChange={e => setNumInput(parseFloat(e.target.value) || 0)} className="w-full text-sm border p-1 rounded" />
                        </div>
                    )}

                    <button onClick={executeFormatOp} className="w-full py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded border border-indigo-200 flex items-center justify-center gap-1">
                       <Play size={12}/> 執行
                    </button>
                 </div>
              </div>

              {/* Group 3: Row Operations */}
              <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-2 text-indigo-800 text-sm font-bold">
                    <TableProperties size={16}/> 資料列操作 (Table)
                 </div>
                 <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-2">
                    <select 
                      value={selectedRowOp} 
                      onChange={(e) => setSelectedRowOp(e.target.value as RowOperation)}
                      className="w-full text-sm border-slate-300 rounded-md py-1.5 focus:ring-indigo-500 border"
                    >
                        <option value="fillEmpty">填充空值 (Fill Empty)</option>
                        <option value="removeDuplicates">移除重複列 (Unique Rows)</option>
                        <option value="removeEmptyRows">移除空白列 (Remove Empty)</option>
                        <option value="deleteSelectedCols">刪除選取欄位 (Delete Cols)</option>
                        <option value="keepSelectedCols">保留選取欄位 (Keep Selected)</option>
                    </select>

                    {selectedRowOp === 'fillEmpty' && (
                        <input type="text" placeholder="輸入填充值..." value={fillValue} onChange={e => setFillValue(e.target.value)} className="w-full text-sm border p-1 rounded" />
                    )}

                    <button onClick={executeRowOp} className="w-full py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded border border-indigo-200 flex items-center justify-center gap-1">
                       <Play size={12}/> 執行
                    </button>
                 </div>
              </div>

           </div>
        </div>
      )}

      {/* Selected Columns Action Bar */}
      {selectedCols.size > 0 && (
         <div className="bg-blue-50/80 backdrop-blur-sm px-4 py-2 border-b border-blue-100 flex items-center gap-4 animate-in slide-in-from-top-1 z-20">
             <div className="text-sm font-bold text-blue-800 flex items-center gap-2">
                <CheckCircle size={16} /> 已勾選 {selectedCols.size} 欄
             </div>
             <button onClick={() => { setSelectedRowOp('deleteSelectedCols'); executeRowOp(); }} className="flex items-center gap-1.5 px-3 py-1 bg-white text-red-600 border border-red-200 rounded text-sm font-medium hover:bg-red-50 shadow-sm">
                <Trash2 size={14} /> 刪除
             </button>
             <button onClick={handleSwapColumns} disabled={selectedCols.size !== 2} className={`flex items-center gap-1.5 px-3 py-1 rounded text-sm font-medium border shadow-sm transition-colors ${selectedCols.size === 2 ? 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'}`}>
                <ArrowRightLeft size={14} /> 交換位置
             </button>
             <button onClick={() => setSelectedCols(new Set())} className="ml-auto text-xs text-slate-500 hover:text-slate-700 underline">取消選取</button>
         </div>
      )}

       {/* Sheet Tabs */}
       <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-100 px-2 pt-2 custom-scrollbar shrink-0 z-10">
         {sheets.map(sheet => (
           <button
             key={sheet.sheetName}
             onClick={() => setActiveSheetName(sheet.sheetName)}
             className={`px-4 py-2 text-sm font-medium rounded-t-lg border-t border-r border-l border-b-0 min-w-[120px] text-center transition-colors whitespace-nowrap
               ${activeSheetName === sheet.sheetName 
                 ? 'bg-white text-indigo-700 border-slate-200 shadow-sm -mb-px relative z-10' 
                 : 'bg-slate-200/50 text-slate-500 border-transparent hover:bg-slate-200'}
             `}
           >
             {sheet.sheetName}
           </button>
         ))}
       </div>

       {/* Main Table Area */}
       <div className="flex-1 overflow-auto bg-slate-50 relative custom-scrollbar">
          {activeSheet ? (
            <div className="inline-block min-w-full bg-white pb-20">
              <table className="text-sm text-left table-fixed border-collapse" style={{ width: `${totalTableWidth}px`, minWidth: '100%' }}>
                <thead className="bg-slate-50 text-slate-600 font-medium sticky top-0 z-20 shadow-sm h-10">
                  <tr>
                     <th className="px-2 py-2 text-center border-b border-r border-slate-200 bg-slate-100 sticky left-0 z-30 select-none" style={{ width: INDEX_WIDTH }}>#</th>
                    {activeSheet.headers.length > 0 ? (
                       activeSheet.headers.map((header, idx) => {
                         const isSelected = selectedCols.has(header);
                         return (
                           <th key={`${activeSheetName}-${header}-${idx}`} 
                             className={`px-2 py-2 border-b border-r border-slate-200 relative group select-none transition-colors cursor-pointer ${isSelected ? 'bg-indigo-100 text-indigo-900' : 'bg-slate-50 hover:bg-slate-100'}`}
                             style={{ width: colWidths[header] || 150 }}
                             onClick={() => toggleColumnSelection(header)}
                           >
                             <div className="flex items-center gap-2 w-full relative z-30">
                                <input type="checkbox" checked={isSelected} onChange={() => toggleColumnSelection(header)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                                <span className="truncate font-bold flex-1" title={header}>{header}</span>
                             </div>
                             <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 group-hover:bg-indigo-300 transition-colors z-40" onMouseDown={(e) => startResize(e, 'col', header, colWidths[header] || 150)} onClick={(e) => e.stopPropagation()}/>
                           </th>
                         );
                       })
                    ) : (
                       <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 border-b">(無標題)</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {activeSheet.rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-indigo-50/50 transition-colors group" style={{ height: rowHeights[`row-${rowIdx}`] || 'auto' }}>
                       <td className="px-2 py-1 whitespace-nowrap text-xs text-slate-400 border-r border-slate-200 bg-slate-50 sticky left-0 z-10 text-center select-none relative group-index">
                          {rowIdx + 1}
                          <div className="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize hover:bg-indigo-400 opacity-0 group-index-hover:opacity-100 z-40" onMouseDown={(e) => startResize(e, 'row', `row-${rowIdx}`, rowHeights[`row-${rowIdx}`] || 40)} />
                       </td>
                       {activeSheet.headers.map((header, cellIdx) => (
                         <td key={`${rowIdx}-${cellIdx}`} className={`px-1 py-1 border-r border-slate-100 overflow-hidden text-slate-700 bg-inherit ${selectedCols.has(header) ? 'bg-indigo-50/30' : ''}`}>
                           <input 
                              type="text" 
                              value={row[header] !== undefined ? String(row[header]) : ''}
                              onChange={(e) => handleCellChange(rowIdx, header, e.target.value)}
                              className="w-full h-full px-2 py-1 bg-transparent rounded focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:shadow-sm outline-none transition-all truncate border border-transparent hover:border-slate-100"
                           />
                         </td>
                       ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {activeSheet.rows.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                   <AlertCircle size={48} className="mb-2 opacity-20" />
                   <p>此工作表沒有資料</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">請選擇工作表</div>
          )}
       </div>

      {/* Export Options Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowExportModal(false)} />
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative z-[101] animate-in zoom-in-95 duration-200 border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Download className="text-indigo-600" />
                匯出設定
              </h3>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Mode Selection */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-3">1. 選擇匯出格式</label>
              <div className="grid grid-cols-2 gap-4">
                <label className={`cursor-pointer border-2 rounded-lg p-3 flex flex-col items-center gap-2 transition-all ${exportMode === 'single' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="exportMode" value="single" checked={exportMode === 'single'} onChange={() => setExportMode('single')} className="hidden" />
                  <FileSpreadsheet size={24} />
                  <span className="text-sm font-bold">單一 Excel 檔</span>
                  <span className="text-xs text-center opacity-75">所有工作表在同一檔案中</span>
                </label>
                <label className={`cursor-pointer border-2 rounded-lg p-3 flex flex-col items-center gap-2 transition-all ${exportMode === 'multiple' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="exportMode" value="multiple" checked={exportMode === 'multiple'} onChange={() => setExportMode('multiple')} className="hidden" />
                  <FileArchive size={24} />
                  <span className="text-sm font-bold">拆分為多個檔案 (ZIP)</span>
                  <span className="text-xs text-center opacity-75">每個工作表存為獨立檔案</span>
                </label>
              </div>
            </div>

            {/* Sheet Selection */}
            <div className="mb-6">
              <div className="flex justify-between items-end mb-3">
                <label className="block text-sm font-bold text-slate-700">2. 選擇要匯出的工作表</label>
                <button onClick={toggleSelectAllSheets} className="text-xs text-indigo-600 font-medium hover:underline">
                  {exportSelectedSheets.size === sheets.length ? '取消全選' : '全選所有'}
                </button>
              </div>
              
              <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto custom-scrollbar p-2 bg-slate-50">
                {sheets.map(s => (
                  <label key={s.sheetName} className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      checked={exportSelectedSheets.has(s.sheetName)} 
                      onChange={() => toggleSheetSelection(s.sheetName)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                    />
                    <span className="text-sm text-slate-700 flex-1 truncate">{s.sheetName}</span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{s.rows.length} 筆</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 text-xs text-slate-500 text-right">
                已選擇 {exportSelectedSheets.size} / {sheets.length} 個工作表
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowExportModal(false)} className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors">
                取消
              </button>
              <button 
                onClick={executeExport}
                disabled={exportSelectedSheets.size === 0}
                className={`flex-1 px-4 py-2.5 rounded-lg text-white font-bold shadow-md transition-all flex items-center justify-center gap-2
                  ${exportSelectedSheets.size > 0 ? 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg' : 'bg-slate-300 cursor-not-allowed'}
                `}
              >
                <Download size={18} />
                確認匯出
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};