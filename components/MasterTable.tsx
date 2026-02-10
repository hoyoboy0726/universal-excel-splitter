import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Download, Search, AlertTriangle, Layers, Split, RefreshCw, ArrowLeft, 
  Columns, CheckSquare, Square, Type, Hash, Eraser, Trash, Scissors, 
  CaseSensitive, ArrowRightFromLine, Calendar, PaintBucket, MousePointerClick, 
  ChevronUp, ChevronDown, RotateCcw, RotateCw, Edit, X, Home, Power, Calculator, TableProperties, Play, Undo2, Redo2, FileDown
} from 'lucide-react';
import { EmployeeRow, FieldDefinition } from '../types';
import { exportToExcel } from '../utils/excelUtils';
import { ToastType } from './Toast';

interface MasterTableProps {
  data: EmployeeRow[];
  fields: FieldDefinition[];
  onDataUpdate: (newData: EmployeeRow[]) => void;
  onBack: () => void;
  onReset: () => void;
  onNotify: (msg: string, type: ToastType) => void;
}

// Expanded operators to support specific string operations
type FilterOperator = 
  | 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' // Numeric & Basic
  | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'; // String specific

type ColumnType = 'string' | 'number';

// Ported Types from DataCleaner
type TextOperation = 'trim' | 'removeAllSpaces' | 'upper' | 'lower' | 'titleCase' | 'removeSymbols' | 'findReplace' | 'regexReplace' | 'prepend' | 'append';
type FormatOperation = 'toNumber' | 'toCurrency' | 'round' | 'floor' | 'ceil' | 'toFixed2' | 'toDate' | 'padLeft' | 'mathAdd' | 'mathSub' | 'mathMul' | 'mathDiv';
type RowOperation = 'fillEmpty' | 'removeDuplicates' | 'removeEmptyRows'; 
// Note: 'deleteSelectedCols' & 'keepSelectedCols' are excluded here as column management is handled by Mapping step.

const INDEX_WIDTH = 60; // Fixed width for the index column

export const MasterTable: React.FC<MasterTableProps> = ({ data, fields, onDataUpdate, onBack, onReset, onNotify }) => {
  // --- HISTORY & STATE MANAGEMENT ---
  const [history, setHistory] = useState<EmployeeRow[][]>([data]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Safety check: ensure currentData is never undefined
  const currentData = history[historyIndex] || [];
  const totalRows = currentData.length;

  const pushToHistory = useCallback((newData: EmployeeRow[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, newData];
    });
    setHistoryIndex(prev => prev + 1);
    onDataUpdate(newData);
  }, [historyIndex, onDataUpdate]);

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      onDataUpdate(history[historyIndex - 1]);
      onNotify('已還原上一步', 'info');
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      onDataUpdate(history[historyIndex + 1]);
      onNotify('已重做', 'info');
    }
  };

  const [filterText, setFilterText] = useState('');

  // Column Visibility State
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [isColMenuOpen, setIsColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  // Splitter State
  const [splitField, setSplitField] = useState<string>(fields[0]?.key || '');
  const [splitType, setSplitType] = useState<ColumnType>('string');
  const [splitOperator, setSplitOperator] = useState<FilterOperator>('eq');
  const [splitValue, setSplitValue] = useState<string>('');

  // --- CLEANING TOOL STATE (Ported from DataCleaner) ---
  const [showCleaningTools, setShowCleaningTools] = useState(false);
  const [targetCol, setTargetCol] = useState<string>(''); // Empty string means "All Columns"

  // Tool Selection State
  const [selectedTextOp, setSelectedTextOp] = useState<TextOperation>('trim');
  const [selectedFormatOp, setSelectedFormatOp] = useState<FormatOperation>('toNumber');
  const [selectedRowOp, setSelectedRowOp] = useState<RowOperation>('fillEmpty');

  // Tool Inputs
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [textInput, setTextInput] = useState('');
  const [numInput, setNumInput] = useState<number>(0);
  const [padLength, setPadLength] = useState<number>(3);
  const [fillValue, setFillValue] = useState('');


  // --- RESIZING STATE ---
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const resizingRef = useRef<{
    type: 'col' | 'row' | null;
    id: string; // field key or row id
    startPos: number;
    startSize: number;
  }>({ type: null, id: '', startPos: 0, startSize: 0 });

  // Initialize default widths for fields
  useEffect(() => {
    setColWidths(prev => {
      const newWidths = { ...prev };
      // Default width 150px for all fields if not set
      fields.forEach(f => {
        if (!newWidths[f.key]) newWidths[f.key] = 150;
      });
      // System fields specific widths
      if (!newWidths['_sourceFile']) newWidths['_sourceFile'] = 180;
      if (!newWidths['_sourceSheet']) newWidths['_sourceSheet'] = 120;
      return newWidths;
    });
  }, [fields]);

  // Handle Resize Events
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
      const newWidth = Math.max(50, startSize + delta); // Min width 50px
      setColWidths(prev => ({ ...prev, [id]: newWidth }));
    } else {
      const delta = e.clientY - startPos;
      const newHeight = Math.max(30, startSize + delta); // Min height 30px
      setRowHeights(prev => ({ ...prev, [id]: newHeight }));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    resizingRef.current = { type: null, id: '', startPos: 0, startSize: 0 };
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
  }, [handleMouseMove]);


  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(event.target as Node)) {
        setIsColMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Combine user defined fields with system metadata fields
  const allAvailableFields = useMemo(() => {
    const systemFields: FieldDefinition[] = [
      { key: '_sourceFile', label: '來源檔案', type: 'string' },
      { key: '_sourceSheet', label: '來源工作表', type: 'string' }
    ];
    return [...fields, ...systemFields];
  }, [fields]);

  const visibleFields = useMemo(() => {
    return allAvailableFields.filter(f => !hiddenKeys.has(f.key));
  }, [allAvailableFields, hiddenKeys]);

  // Calculate Total Table Width to support horizontal scrolling without squishing columns
  const totalTableWidth = useMemo(() => {
    const fieldsWidth = visibleFields.reduce((sum, field) => {
      return sum + (colWidths[field.key] || 150);
    }, 0);
    return fieldsWidth + INDEX_WIDTH;
  }, [visibleFields, colWidths]);

  // Detect Column Type
  useEffect(() => {
    if (!splitField || currentData.length === 0) return;
    const sampleSize = Math.min(currentData.length, 100);
    let numCount = 0;
    let validCount = 0;

    for (let i = 0; i < sampleSize; i++) {
      const val = currentData[i][splitField];
      if (val !== undefined && val !== null && val !== '') {
        validCount++;
        if (!isNaN(parseFloat(String(val))) && isFinite(Number(val))) {
          numCount++;
        }
      }
    }
    const isNumber = validCount > 0 && (numCount / validCount) > 0.8;
    const newType = isNumber ? 'number' : 'string';
    setSplitType(newType);
    setSplitOperator(prev => {
        if (newType === 'number') {
            return ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'].includes(prev) ? prev : 'lte';
        } else {
            return ['contains', 'not_contains', 'starts_with', 'ends_with', 'eq', 'neq'].includes(prev) ? prev : 'contains';
        }
    });
  }, [splitField, currentData]);

  const handleCellChange = (id: string, field: string, value: string) => {
    const newData = currentData.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    });
    
    setHistory(prev => {
       const newHistory = [...prev];
       newHistory[historyIndex] = newData;
       return newHistory;
    });
    onDataUpdate(newData);
  };

  const toggleColumn = (key: string) => {
    setHiddenKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAllColumns = () => {
    if (hiddenKeys.size > 0) {
      setHiddenKeys(new Set()); 
    } else {
      const allKeys = new Set(allAvailableFields.map(f => f.key));
      if (allAvailableFields.length > 0) allKeys.delete(allAvailableFields[0].key);
      setHiddenKeys(allKeys);
    }
  };

  // --- CORE CLEANING LOGIC (Ported & Enhanced) ---
  const applyCleaning = (label: string, transform: (val: any) => any) => {
    const targetFieldDefs = targetCol 
        ? allAvailableFields.filter(f => f.key === targetCol) 
        : fields;

    let changedCount = 0;
    const newData = currentData.map(row => {
        const newRow = { ...row };
        let rowChanged = false;
        
        targetFieldDefs.forEach(field => {
            const oldVal = newRow[field.key];
            const newVal = transform(oldVal);
            
            if (oldVal !== newVal) {
                newRow[field.key] = newVal;
                rowChanged = true;
            }
        });
        
        if (rowChanged) changedCount++;
        return newRow;
    });

    if (changedCount > 0) {
        pushToHistory(newData);
        onNotify(`已套用: ${label} (影響 ${changedCount} 列)`, 'success');
    } else {
        onNotify('沒有資料需要變更。', 'info');
    }
  };

  // --- CLEANING OPERATIONS (Ported) ---
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
      
      if (selectedRowOp === 'fillEmpty') {
          applyCleaning('填充空值', val => (val === undefined || val === null || String(val).trim() === '') ? fillValue : val);
          return;
      }
      
      // Global operations (create new rows array)
      let newData = [...currentData];
      let initialCount = newData.length;

      // Determine headers to check: All mapped fields or just the target column
      const checkFields = targetCol ? [targetCol] : fields.map(f => f.key);

      if (selectedRowOp === 'removeDuplicates') {
          const seen = new Set();
          newData = newData.filter(row => {
              const key = checkFields.map(k => row[k]).join('|');
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
          });
      } else if (selectedRowOp === 'removeEmptyRows') {
          newData = newData.filter(row => {
              return checkFields.some(k => {
                  const val = row[k];
                  return val !== undefined && val !== null && String(val).trim() !== '';
              });
          });
      }

      if (newData.length !== initialCount) {
          pushToHistory(newData);
          onNotify(`已移除 ${initialCount - newData.length} 列資料`, 'success');
      } else {
          onNotify('沒有發現需要變更的資料', 'info');
      }
  };

  // --- DOWNLOAD ALL (No Split) ---
  const handleExportAll = () => {
     if (currentData.length === 0) return onNotify('沒有資料可以匯出', 'error');

     // Map data using labels instead of internal keys
     const exportData = currentData.map(row => {
       const cleanRow: any = {};
       visibleFields.forEach(f => {
         cleanRow[f.label] = row[f.key];
       });
       return cleanRow;
     });

     exportToExcel(exportData, 'Merged_Master_Data');
     onNotify('完整資料匯出成功！', 'success');
  };

  // --- SPLIT & EXPORT ---
  const executeSplit = () => {
    if (!splitField || !splitValue) return onNotify('請選擇欄位並輸入篩選值', 'error');
    const filtered = currentData.filter(row => {
      const cellValue = row[splitField];
      const compareValue = splitValue; 
      const strCell = String(cellValue ?? '').toLowerCase();
      const strCompare = String(compareValue).toLowerCase();

      if (splitType === 'number') {
          const numCell = parseFloat(String(cellValue));
          const numCompare = parseFloat(compareValue);
          if (isNaN(numCell) || isNaN(numCompare)) return false;
          switch (splitOperator) {
            case 'eq': return numCell === numCompare;
            case 'neq': return numCell !== numCompare;
            case 'gt': return numCell > numCompare;
            case 'lt': return numCell < numCompare;
            case 'gte': return numCell >= numCompare;
            case 'lte': return numCell <= numCompare;
            default: return false;
          }
      } else {
          switch (splitOperator) {
            case 'eq': return strCell === strCompare;
            case 'neq': return strCell !== strCompare;
            case 'contains': return strCell.includes(strCompare);
            case 'not_contains': return !strCell.includes(strCompare);
            case 'starts_with': return strCell.startsWith(strCompare);
            case 'ends_with': return strCell.endsWith(strCompare);
            default: return false;
          }
      }
    });

    if (filtered.length === 0) {
      onNotify('條件篩選後無任何資料。', 'error');
      return;
    }
    const exportData = filtered.map(row => {
      const cleanRow: any = {};
      visibleFields.forEach(f => {
        cleanRow[f.label] = row[f.key];
      });
      return cleanRow;
    });
    const opLabel = {
      eq: 'Equals', neq: 'NotEq', gt: 'Gt', lt: 'Lt', gte: 'Gte', lte: 'Lte', 
      contains: 'Has', not_contains: 'NotHas', starts_with: 'Start', ends_with: 'End'
    }[splitOperator];
    exportToExcel(exportData, `Split_${splitField}_${opLabel}_${splitValue}`);
    onNotify('拆分並匯出成功！', 'success');
  };

  const displayedData = useMemo(() => {
    if (!filterText) return currentData;
    const lower = filterText.toLowerCase();
    return currentData.filter(row => {
      return allAvailableFields.some(f => String(row[f.key]).toLowerCase().includes(lower));
    });
  }, [currentData, filterText, allAvailableFields]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Top Control Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm z-[60] relative">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          
          <div className="flex items-center gap-4">
            {/* Back Button */}
            <button 
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg shadow-sm border border-slate-300 transition-all active:scale-95"
              title="回到上一步驟 (欄位對應)"
            >
              <ArrowLeft size={18} />
              <span className="font-bold">上一步</span>
            </button>
            <div className="w-px h-8 bg-slate-200 mx-2 hidden sm:block"></div>
            <div className="bg-blue-100 p-2 rounded-lg text-blue-700 hidden sm:block">
              <Layers size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">大表預覽 & 清洗</h2>
              <div className="flex gap-4 items-center mt-1">
                 <div className="text-sm text-slate-500">
                    總筆數: <strong className="text-slate-700">{totalRows}</strong>
                 </div>
                 <button onClick={onBack} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline">
                    <Edit size={12}/> 修改欄位對應
                 </button>
              </div>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto">
            {/* Splitter Action Area */}
            <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-lg border border-slate-200 flex-wrap w-full sm:w-auto shadow-inner">
              <div className="flex items-center gap-2 px-2">
                <Split size={18} className="text-purple-600" />
                <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">拆分下載:</span>
              </div>
              
              <select 
                value={splitField} 
                onChange={(e) => setSplitField(e.target.value)}
                className="px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none max-w-[120px]"
              >
                {allAvailableFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>

              <div 
                className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1
                  ${splitType === 'number' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}
                `}
                title={splitType === 'number' ? '偵測為數值' : '偵測為文字'}
              >
                {splitType === 'number' ? <Hash size={12}/> : <Type size={12}/>}
              </div>

              <select 
                value={splitOperator} 
                onChange={(e) => setSplitOperator(e.target.value as FilterOperator)}
                className="px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none bg-white min-w-[100px]"
              >
                {splitType === 'number' ? (
                  <>
                    <option value="lte">小於等於 (&le;)</option>
                    <option value="gte">大於等於 (&ge;)</option>
                    <option value="eq">等於 (=)</option>
                    <option value="neq">不等於 (&ne;)</option>
                    <option value="gt">大於 (&gt;)</option>
                    <option value="lt">小於 (&lt;)</option>
                  </>
                ) : (
                  <>
                    <option value="contains">包含</option>
                    <option value="not_contains">不包含</option>
                    <option value="eq">完全符合</option>
                    <option value="neq">不符合</option>
                    <option value="starts_with">開頭為</option>
                    <option value="ends_with">結尾為</option>
                  </>
                )}
              </select>

              <input 
                type="text" 
                placeholder={splitType === 'number' ? "輸入數值" : "輸入關鍵字"}
                className="w-24 px-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                value={splitValue}
                onChange={(e) => setSplitValue(e.target.value)}
              />

              <button 
                onClick={executeSplit}
                disabled={!splitValue}
                className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-colors ml-auto sm:ml-0
                  ${splitValue 
                    ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                `}
                title="下載符合條件的資料"
              >
                <Download size={16} />
              </button>
            </div>
            
            <div className="w-px h-8 bg-slate-200 mx-1 hidden xl:block"></div>

            {/* NEW: Download All Button */}
            <button 
              onClick={handleExportAll}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm border border-green-700 text-sm font-bold transition-all"
              title="下載目前表格中所有的資料"
            >
              <FileDown size={18} />
              下載完整報表
            </button>

            <button 
              onClick={() => setShowCleaningTools(!showCleaningTools)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all shadow-sm relative
                ${showCleaningTools 
                   ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200' 
                   : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'}
              `}
            >
              <Eraser size={16} />
              資料清洗 & 操作
              {showCleaningTools ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Cleaning Toolbar (Ported from DataCleaner) */}
      {showCleaningTools && (
        <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200 shadow-inner z-30 relative">
           
           <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-200 pb-3">
              <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-indigo-900 flex items-center gap-1">
                     <MousePointerClick size={16} />
                     應用範圍:
                  </span>
                  <select 
                     value={targetCol}
                     onChange={(e) => setTargetCol(e.target.value)}
                     className="px-3 py-1.5 rounded-md border border-indigo-300 text-sm font-medium bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none min-w-[200px]"
                  >
                     <option value="">✨ 全部欄位 (All Columns)</option>
                     <optgroup label="指定欄位">
                        {fields.map(f => (
                           <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                     </optgroup>
                  </select>
              </div>

              <div className="flex items-center gap-2">
                 <button 
                    onClick={undo}
                    disabled={historyIndex === 0}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                       ${historyIndex === 0 
                          ? 'text-slate-400 cursor-not-allowed bg-slate-100' 
                          : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:text-blue-600 shadow-sm'}
                    `}
                 >
                    <Undo2 size={14} /> 上一步 (Undo)
                 </button>
                 <button 
                    onClick={redo}
                    disabled={historyIndex === history.length - 1}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                       ${historyIndex === history.length - 1
                          ? 'text-slate-400 cursor-not-allowed bg-slate-100' 
                          : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:text-blue-600 shadow-sm'}
                    `}
                 >
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

      {/* Toolbar */}
      <div className="px-6 py-3 flex flex-wrap justify-between items-center bg-white/50 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="搜尋表格內容..." 
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm w-64"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 px-3 py-1 rounded border border-amber-100">
            <AlertTriangle size={16} />
            可以直接點擊表格內容進行修改
          </div>
        </div>

        {/* Column Visibility Toggle */}
        <div className="relative" ref={colMenuRef}>
          <button 
            onClick={() => setIsColMenuOpen(!isColMenuOpen)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors
              ${isColMenuOpen ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}
            `}
          >
            <Columns size={16} />
            選擇顯示/匯出欄位
          </button>
          
          {isColMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-lg">
                <span className="text-xs font-semibold text-slate-500">
                  取消勾選的欄位將不會被匯出
                </span>
                <button 
                  onClick={toggleAllColumns} 
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  切換全選
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
                {allAvailableFields.map(field => {
                  const isHidden = hiddenKeys.has(field.key);
                  return (
                    <label 
                      key={field.key} 
                      className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer select-none"
                      onClick={(e) => {
                         e.preventDefault(); 
                         toggleColumn(field.key);
                      }}
                    >
                      <div className={`text-slate-500 ${!isHidden ? 'text-blue-600' : ''}`}>
                         {!isHidden ? <CheckSquare size={16} /> : <Square size={16} />}
                      </div>
                      <span className={`text-sm ${isHidden ? 'text-slate-400' : 'text-slate-700'}`}>
                        {field.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto px-6 pb-6 custom-scrollbar relative">
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm inline-block min-w-full">
          <table 
             className="text-sm text-left table-fixed border-collapse"
             style={{ width: `${totalTableWidth}px`, minWidth: '100%' }}
          >
            <thead className="bg-slate-50 text-slate-600 font-medium sticky top-0 z-20 shadow-sm">
              <tr>
                {/* Index Column Header (Top Left Corner) */}
                <th 
                   className="px-2 py-3 text-center border-b border-r border-slate-200 bg-slate-100 sticky left-0 z-30 select-none"
                   style={{ width: INDEX_WIDTH }}
                >
                  #
                </th>
                {visibleFields.map(field => (
                  <th 
                    key={field.key} 
                    className="px-4 py-3 border-b border-r border-slate-200 bg-slate-50 relative group"
                    style={{ width: colWidths[field.key] || 150 }}
                  >
                    <div className="truncate">{field.label}</div>
                    {/* Column Resizer Handle */}
                    <div 
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-blue-300 transition-colors z-40"
                      onMouseDown={(e) => startResize(e, 'col', field.key, colWidths[field.key] || 150)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {displayedData.map((row, index) => (
                <tr 
                    key={row.id} 
                    className="hover:bg-blue-50/50 transition-colors group"
                    style={{ height: rowHeights[row.id] || 'auto' }}
                >
                  {/* Sticky Index Column */}
                  <td className="px-2 py-1 text-center text-xs text-slate-400 bg-slate-50 border-r border-slate-200 sticky left-0 z-10 select-none relative group-index">
                     {index + 1}
                     {/* Row Resizer Handle */}
                     <div 
                        className="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize hover:bg-blue-400 opacity-0 group-index-hover:opacity-100 z-40"
                        onMouseDown={(e) => startResize(e, 'row', row.id, rowHeights[row.id] || 40)} 
                     />
                  </td>

                  {visibleFields.map(field => (
                    <td key={field.key} className="px-1 py-1 border-r border-slate-100 relative overflow-hidden bg-inherit">
                       {!field.key.startsWith('_') ? (
                          <input 
                            type="text" 
                            value={String(row[field.key] !== undefined ? row[field.key] : '')}
                            onChange={(e) => handleCellChange(row.id, field.key, e.target.value)}
                            className="w-full h-full px-3 py-2 bg-transparent rounded focus:bg-white focus:ring-2 focus:ring-blue-500 focus:shadow-md outline-none transition-all truncate border border-transparent hover:border-slate-100"
                          />
                       ) : (
                          <div className="px-3 py-2 text-slate-500 text-xs truncate">
                             {String(row[field.key])}
                          </div>
                       )}
                    </td>
                  ))}
                </tr>
              ))}
              {displayedData.length === 0 && (
                <tr>
                  <td colSpan={visibleFields.length + 1} className="text-center py-12 text-slate-400">
                    沒有符合的資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};