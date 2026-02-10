import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Trash2, GitMerge, Layers, Key, GripVertical, Info, FileSpreadsheet, MoveRight, MousePointer2, Star, RotateCcw } from 'lucide-react';
import { SheetData, FieldDefinition, MergeConfig, JoinType } from '../types';
import { ToastType } from './Toast';

interface ColumnMapperProps {
  sheets: SheetData[];
  initialFields?: FieldDefinition[];
  initialMapping?: Record<string, string[]>;
  initialMergeConfig?: MergeConfig;
  onConfirmMapping: (mapping: Record<string, string[]>, fields: FieldDefinition[], mergeConfig: MergeConfig, orderedSheets: SheetData[]) => void;
  onBack: () => void;
  onNotify: (msg: string, type: ToastType) => void;
}

export const ColumnMapper: React.FC<ColumnMapperProps> = ({ 
  sheets: initialSheets, 
  initialFields = [], 
  initialMapping = {}, 
  initialMergeConfig,
  onConfirmMapping, 
  onBack,
  onNotify
}) => {
  const [orderedSheets, setOrderedSheets] = useState<SheetData[]>(initialSheets);
  const [fields, setFields] = useState<FieldDefinition[]>(initialFields);
  
  // Mapping will now store unique strings: "fileName::sheetName::headerName"
  const [mapping, setMapping] = useState<Record<string, string[]>>({});
  
  const [mergeMethod, setMergeMethod] = useState<'vertical' | 'join'>(initialMergeConfig?.method || 'join');
  const [joinKey, setJoinKey] = useState<string>(initialMergeConfig?.joinKey || '');
  const [joinType, setJoinType] = useState<JoinType>(initialMergeConfig?.joinType || 'outer');
  const [removeDuplicates, setRemoveDuplicates] = useState<boolean>(initialMergeConfig?.removeDuplicates ?? true);

  const [newFieldName, setNewFieldName] = useState('');
  const [draggedTag, setDraggedTag] = useState<{headerId: string, fromKey: string} | null>(null);
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);
  const [draggedSheetIndex, setDraggedSheetIndex] = useState<number | null>(null);

  // Helper to generate a unique ID for a header in a specific sheet
  const getHeaderId = (sheet: SheetData, header: string) => `${sheet.fileName}::${sheet.sheetName}::${header}`;

  // Helper to parse unique header ID
  const parseHeaderId = (id: string) => {
    const parts = id.split('::');
    if (parts.length < 3) return { fileName: '', sheetName: '', name: id };
    return { fileName: parts[0], sheetName: parts[1], name: parts.slice(2).join('::') };
  };

  // Helper: Find which sheet a header ID belongs to
  const getSheetPriorityById = useCallback((headerId: string) => {
    const { fileName, sheetName } = parseHeaderId(headerId);
    return orderedSheets.findIndex(s => s.fileName === fileName && s.sheetName === sheetName);
  }, [orderedSheets]);

  // 1. Initial Auto-detection Logic
  const performAutoDetection = useCallback(() => {
    const headersMap = new Map<string, string[]>(); // label -> list of unique IDs
    orderedSheets.forEach(sheet => {
      sheet.headers.forEach(h => {
        if (!headersMap.has(h)) headersMap.set(h, []);
        headersMap.get(h)!.push(getHeaderId(sheet, h));
      });
    });

    const allLabels = Array.from(headersMap.keys());
    const suggestedFields: FieldDefinition[] = allLabels.map(h => ({
      key: h, label: h, type: 'string'
    }));
    
    setFields(suggestedFields);
    
    const initialMap: Record<string, string[]> = {};
    allLabels.forEach(label => {
      initialMap[label] = headersMap.get(label) || [];
    });
    setMapping(initialMap);
    if (suggestedFields.length > 0) setJoinKey(suggestedFields[0].key);
  }, [orderedSheets]);

  useEffect(() => {
    if (fields.length === 0) {
      performAutoDetection();
    }
  }, [fields.length, performAutoDetection]);

  // 2. Real-time Synchronization: Re-sort mapping tags whenever sheet order changes
  useEffect(() => {
    setMapping(prev => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach(key => {
        const original = next[key];
        const sorted = [...original].sort((a, b) => {
          const pA = getSheetPriorityById(a);
          const pB = getSheetPriorityById(b);
          return (pA === -1 ? 999 : pA) - (pB === -1 ? 999 : pB);
        });
        if (JSON.stringify(original) !== JSON.stringify(sorted)) {
          next[key] = sorted;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [orderedSheets, getSheetPriorityById]);

  // --- Sheet Reordering ---
  const handleSheetDragStart = (e: React.DragEvent, index: number) => {
    setDraggedSheetIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSheetDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedSheetIndex === null || draggedSheetIndex === targetIndex) return;
    const newOrdered = [...orderedSheets];
    const item = newOrdered.splice(draggedSheetIndex, 1)[0];
    newOrdered.splice(targetIndex, 0, item);
    setOrderedSheets(newOrdered);
    setDraggedSheetIndex(null);
    onNotify('文件優先順序已調整，欄位對應即時更新', 'info');
  };

  // --- Field Handlers ---
  const handleResetMapping = () => {
    // Clear all manual mappings and trigger detection again
    setFields([]);
    setMapping({});
    onNotify('對應關係已根據目前文件順序重置', 'success');
  };

  const handleAddField = () => {
    if (!newFieldName.trim()) return;
    const key = newFieldName.trim();
    if (fields.some(f => f.key === key)) {
      onNotify('該欄位名稱已存在', 'error');
      return;
    }
    setFields(prev => [...prev, { key, label: key, type: 'string' }]);
    setMapping(prev => ({ ...prev, [key]: [] }));
    setNewFieldName('');
  };

  const handleRemoveField = (key: string) => {
    setFields(prev => prev.filter(f => f.key !== key));
    setMapping(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleRenameField = (oldKey: string, newLabel: string) => {
    if (!newLabel.trim() || newLabel === oldKey) return;
    setFields(prev => prev.map(f => f.key === oldKey ? { ...f, label: newLabel, key: newLabel } : f));
    setMapping(prev => {
      const next = { ...prev };
      const data = next[oldKey];
      delete next[oldKey];
      next[newLabel] = data;
      return next;
    });
    if (joinKey === oldKey) setJoinKey(newLabel);
  };

  // --- Tag Logic ---
  const onDragStartTag = (e: React.DragEvent, headerId: string, fromKey: string) => {
    setDraggedTag({ headerId, fromKey });
    e.dataTransfer.setData('headerId', headerId);
    e.dataTransfer.setData('fromKey', fromKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDropOnField = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    const hId = e.dataTransfer.getData('headerId');
    const fK = e.dataTransfer.getData('fromKey');
    if (!hId || !fK || fK === targetKey) {
        setDraggedTag(null);
        return;
    }
    setMapping(prev => {
      const next = { ...prev };
      next[fK] = (next[fK] || []).filter(id => id !== hId);
      const currentTarget = next[targetKey] || [];
      if (!currentTarget.includes(hId)) {
        next[targetKey] = [...currentTarget, hId];
      }
      return next;
    });
    setDraggedTag(null);
  };

  const handleConfirm = () => {
    if (mergeMethod === 'join' && !joinKey) {
      onNotify('請選擇一個合併鍵 (Key)', 'error');
      return;
    }
    onConfirmMapping(mapping, fields, {
      method: mergeMethod, joinKey, joinType, removeDuplicates
    }, orderedSheets);
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-[calc(100vh-140px)] overflow-hidden">
      <div className="max-w-6xl w-full mx-auto p-6 space-y-6 overflow-y-auto custom-scrollbar pb-32">
        
        {/* Step 1: Sheet Reordering (Priority Context) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
           <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                   <FileSpreadsheet size={20} className="text-green-600" />
                   1. 調整文件優先順序 (即時影響資料取用權重)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                   排序越前面的文件 (F1 &gt; F2 &gt; ...)，其欄位標籤在下方會<strong>自動置前</strong>，合併時系統會依序取用。
                </p>
              </div>
           </div>
           <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 custom-scrollbar">
              {orderedSheets.map((sheet, idx) => (
                 <div
                    key={`${sheet.fileName}-${sheet.sheetName}`}
                    draggable
                    onDragStart={(e) => handleSheetDragStart(e, idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleSheetDrop(e, idx)}
                    className={`flex flex-col gap-2 p-4 bg-slate-50 border-2 rounded-xl cursor-grab active:cursor-grabbing transition-all min-w-[220px] shadow-sm relative group
                      ${draggedSheetIndex === idx ? 'opacity-20 border-dashed border-blue-400 scale-95' : 'border-slate-100 hover:border-blue-400 hover:bg-white'}
                    `}
                 >
                    <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold shadow-md z-10 border-2 border-white">
                        {idx + 1}
                    </div>
                    <div className="flex items-start gap-3">
                       <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-800 truncate" title={sheet.fileName}>{sheet.fileName}</div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">{sheet.sheetName}</div>
                       </div>
                       <GripVertical size={16} className="text-slate-300 group-hover:text-slate-400 shrink-0 mt-1" />
                    </div>
                 </div>
              ))}
           </div>
        </div>

        {/* Step 2: Columns Mapping */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-2xl font-bold text-slate-800">2. 欄位對應與權重設定</h2>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button 
                            onClick={handleResetMapping}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl hover:text-indigo-600 hover:border-indigo-200 transition-all text-sm font-medium shadow-sm active:scale-95"
                            title="重新自動掃描欄位並建立對應"
                        >
                            <RotateCcw size={16} />
                            重置
                        </button>
                        <input 
                            type="text" 
                            value={newFieldName} 
                            onChange={e => setNewFieldName(e.target.value)} 
                            placeholder="新增目標欄位..." 
                            className="flex-1 sm:w-48 px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" 
                            onKeyDown={e => e.key === 'Enter' && handleAddField()}
                        />
                        <button 
                            onClick={handleAddField} 
                            className="flex items-center gap-1 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-all text-sm font-bold shadow-md active:scale-95"
                        >
                            <Plus size={18} /> 新增
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    {fields.map((field, idx) => {
                        const selectedIds = mapping[field.key] || [];
                        const isKey = field.key === joinKey && mergeMethod === 'join';
                        return (
                        <div key={field.key} className={`grid grid-cols-12 gap-4 items-stretch bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group ${isKey ? 'ring-2 ring-purple-500/20 border-purple-200' : ''}`}>
                            <div className="col-span-4 flex gap-4 items-start border-r border-slate-100 pr-4">
                                <div className="flex flex-col gap-1 items-center shrink-0 pt-1.5 text-slate-300 group-hover:text-slate-400">
                                    <GripVertical size={20} className="cursor-grab" />
                                    <span className="text-[10px] font-bold">{idx + 1}</span>
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input type="text" defaultValue={field.label} onBlur={e => handleRenameField(field.key, e.target.value)} className="flex-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none font-bold text-slate-800 py-0.5" />
                                        {isKey && <Key size={14} className="text-purple-600 shrink-0" />}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${field.type === 'number' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{field.type === 'number' ? '數值' : '文字'}</span>
                                        <button onClick={() => handleRemoveField(field.key)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                            <div onDragOver={e => e.preventDefault()} onDrop={e => onDropOnField(e, field.key)} className={`col-span-8 min-h-[70px] rounded-xl transition-all p-2 flex flex-wrap gap-2 items-start ${draggedTag ? 'bg-blue-50/80 border-2 border-dashed border-blue-300' : 'bg-slate-50/50'}`}>
                            {selectedIds.length === 0 ? (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs italic">尚未對應任何來源</div>
                            ) : (
                                selectedIds.map((hId, hIdx) => {
                                    const { name } = parseHeaderId(hId);
                                    const priority = getSheetPriorityById(hId);
                                    const isTop = hIdx === 0;
                                    return (
                                        <div key={hId} draggable onDragStart={e => onDragStartTag(e, hId, field.key)} className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg shadow-sm cursor-grab active:cursor-grabbing transition-all animate-in zoom-in-95 group/tag ${isTop ? 'bg-blue-600 text-white ring-2 ring-blue-200 shadow-blue-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'} ${draggedTag?.headerId === hId ? 'opacity-30' : ''}`}>
                                            {isTop ? <Star size={12} fill="currentColor" /> : <MousePointer2 size={12} />}
                                            <span className="max-w-[120px] truncate">{name}</span>
                                            {priority !== -1 && (
                                                <span className={`text-[9px] px-1.5 rounded-full border ${isTop ? 'border-white/30 bg-white/10' : 'border-slate-300 bg-slate-100'}`}>F{priority + 1}</span>
                                            )}
                                            <button onClick={() => setMapping(prev => ({ ...prev, [field.key]: prev[field.key].filter(id => id !== hId) }))} className="hover:opacity-70"><X size={12}/></button>
                                        </div>
                                    );
                                })
                            )}
                            </div>
                        </div>
                        );
                    })}
                </div>
            </div>

            <div className="lg:col-span-4 sticky top-0">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl space-y-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><GitMerge size={20} className="text-indigo-600" /> 合併方式設定</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setMergeMethod('join')} className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${mergeMethod === 'join' ? 'bg-purple-50 border-purple-600 text-purple-900 shadow-md' : 'bg-white border-slate-100 text-slate-500'}`}><GitMerge size={20} /><span className="text-xs font-bold">依 Key 合併</span></button>
                            <button onClick={() => setMergeMethod('vertical')} className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${mergeMethod === 'vertical' ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-md' : 'bg-white border-slate-100 text-slate-500'}`}><Layers size={20} /><span className="text-xs font-bold">垂直堆疊</span></button>
                        </div>
                        {mergeMethod === 'join' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Key size={14}/> 合併關鍵字 (Join Key)</label>
                                    <select value={joinKey} onChange={e => setJoinKey(e.target.value)} className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50">
                                        {fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Join 類型</label>
                                    <select value={joinType} onChange={e => setJoinType(e.target.value as JoinType)} className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50">
                                        <option value="outer">外部合併 (保留全部)</option>
                                        <option value="inner">內部合併 (只保留交集)</option>
                                        <option value="left">左側合併 (以首檔為主)</option>
                                    </select>
                                </div>
                                <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={removeDuplicates} onChange={e => setRemoveDuplicates(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-purple-600"/><span className="text-sm font-medium text-slate-700">移除 Key 重複列</span></label>
                            </div>
                        )}
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl text-blue-700 text-xs leading-relaxed">
                            <Info size={18} className="shrink-0 mt-0.5" />
                            <p><strong>自動調整邏輯：</strong> 標籤順序與上方文件順序連動。當您調整文件順序時，對應標籤會自動重新洗牌，排在最前面的標籤（藍色星號）即為該欄位的首選資料源。</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 flex justify-center z-[100]">
            <div className="max-w-6xl w-full flex justify-between items-center px-6">
                <button onClick={onBack} className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold transition-all">重新上傳</button>
                <button onClick={handleConfirm} className="px-12 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/30 transition-all">完成設定並預覽資料</button>
            </div>
        </div>
      </div>
    </div>
  );
};