import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { SheetData, EmployeeRow, MergeConfig } from '../types';

// Helper to convert Excel Serial Date to YYYY-MM-DD string
const excelDateToJSDate = (serial: number): string => {
  if (serial < 1 || serial > 100000) return String(serial);
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0];
};

const isPotentialExcelDate = (val: any): boolean => {
  if (typeof val !== 'number') return false;
  return val > 20000 && val < 60000;
};

const makeHeadersUnique = (rawHeaders: string[]): string[] => {
  const counts: Record<string, number> = {};
  return rawHeaders.map(h => {
    const original = String(h || 'Column').trim();
    const cleanHeader = original || 'Column';
    if (counts[cleanHeader] === undefined) {
      counts[cleanHeader] = 0;
      return cleanHeader;
    } else {
      counts[cleanHeader]++;
      return `${cleanHeader}_${counts[cleanHeader]}`;
    }
  });
};

export const readExcelFiles = async (files: File[]): Promise<SheetData[]> => {
  const results: SheetData[] = [];
  for (const file of files) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', cellDates: false });
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
      if (jsonData.length > 0) {
        const rawHeaders = jsonData[0] as string[];
        const uniqueHeaders = makeHeadersUnique(rawHeaders);
        const rows = jsonData.slice(1).map((rowArray) => {
          const rowObject: any = {};
          uniqueHeaders.forEach((header, index) => {
            const val = rowArray[index];
            if (val !== undefined && val !== null) {
               rowObject[header] = val;
            }
          });
          return rowObject;
        });
        results.push({
          fileName: file.name,
          sheetName: sheetName,
          headers: uniqueHeaders,
          rows: rows,
        });
      }
    });
  }
  return results;
};

const cleanAndFormatValue = (val: any): any => {
    if (val === undefined || val === null || val === '') return '';
    if (typeof val === 'number' && isPotentialExcelDate(val)) {
        return excelDateToJSDate(val);
    }
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (/^[$€£¥]?\s*-?[\d,]+(\.\d+)?%?$/.test(trimmed)) {
            const cleanNum = parseFloat(trimmed.replace(/[^0-9.-]/g, ''));
            if (!isNaN(cleanNum)) return cleanNum;
        }
        return trimmed;
    }
    return val;
};

// Internal helper to check if a mapping unique ID matches the current sheet and header
const parseMappingId = (mappingId: string) => {
    const parts = mappingId.split('::');
    if (parts.length < 3) return { fileName: '', sheetName: '', header: mappingId };
    return {
        fileName: parts[0],
        sheetName: parts[1],
        header: parts.slice(2).join('::')
    };
};

const stackData = (sheets: SheetData[], mappings: Record<string, string[]>): EmployeeRow[] => {
    let merged: EmployeeRow[] = [];
    sheets.forEach((sheet) => {
      const sheetRows = sheet.rows.map((row, index) => {
        const newRow: EmployeeRow = { id: `${sheet.fileName}-${sheet.sheetName}-${index}` };
        Object.entries(mappings).forEach(([targetField, sourceMappingIds]) => {
          let val: any = '';
          for (const mId of sourceMappingIds) {
            const { fileName, sheetName, header } = parseMappingId(mId);
            // In stack mode, we only care if the current sheet matches the source sheet in mapping
            // or if the mapping ID is just a raw header (backward compatibility)
            if ((fileName === sheet.fileName && sheetName === sheet.sheetName) || !mId.includes('::')) {
                const targetHeader = mId.includes('::') ? header : mId;
                if (Object.prototype.hasOwnProperty.call(row, targetHeader)) {
                  const rawVal = row[targetHeader];
                  if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
                    val = rawVal;
                    break; 
                  }
                }
            }
          }
          newRow[targetField] = cleanAndFormatValue(val);
        });
        newRow['_sourceFile'] = sheet.fileName;
        newRow['_sourceSheet'] = sheet.sheetName;
        return newRow;
      });
      merged = [...merged, ...sheetRows];
    });
    return merged;
};

const joinData = (sheets: SheetData[], mappings: Record<string, string[]>, config: MergeConfig): EmployeeRow[] => {
    const { joinKey, joinType } = config;
    const keyMappingIds = mappings[joinKey] || [];
    const keyMap = new Map<string, Record<number, any>>();
    const allKeySet = new Set<string>();

    sheets.forEach((sheet, sheetIndex) => {
        sheet.rows.forEach(row => {
            let keyValue: string | null = null;
            for (const mId of keyMappingIds) {
                const { fileName, sheetName, header } = parseMappingId(mId);
                if (fileName === sheet.fileName && sheetName === sheet.sheetName) {
                    if (row[header] !== undefined && row[header] !== null && String(row[header]).trim() !== '') {
                        keyValue = String(row[header]).trim();
                        break;
                    }
                }
            }
            if (keyValue) {
                if (!keyMap.has(keyValue)) {
                    keyMap.set(keyValue, {});
                    allKeySet.add(keyValue);
                }
                const existing = keyMap.get(keyValue)!;
                if (!existing[sheetIndex]) {
                    existing[sheetIndex] = { ...row, _srcFile: sheet.fileName, _srcSheet: sheet.sheetName };
                }
            }
        });
    });

    let finalKeys: string[] = [];
    if (joinType === 'outer') {
        finalKeys = Array.from(allKeySet);
    } else if (joinType === 'left') {
        sheets[0]?.rows.forEach(row => {
             for (const mId of keyMappingIds) {
                const { fileName, sheetName, header } = parseMappingId(mId);
                if (fileName === sheets[0].fileName && sheetName === sheets[0].sheetName && row[header]) {
                    finalKeys.push(String(row[header]).trim());
                    break;
                }
             }
        });
        finalKeys = Array.from(new Set(finalKeys));
    } else if (joinType === 'inner') {
        finalKeys = Array.from(allKeySet).filter(key => {
            const entry = keyMap.get(key);
            return entry && Object.keys(entry).length === sheets.length;
        });
    }

    const result: EmployeeRow[] = finalKeys.map((k, idx) => {
        const newRow: EmployeeRow = { id: `joined-${k}-${idx}` };
        const entry = keyMap.get(k) || {};
        Object.entries(mappings).forEach(([targetField, sourceMappingIds]) => {
            let val: any = '';
            for (let i = 0; i < sheets.length; i++) {
                const sheetRow = entry[i];
                if (sheetRow) {
                    const currentSheet = sheets[i];
                    for (const mId of sourceMappingIds) {
                        const { fileName, sheetName, header } = parseMappingId(mId);
                        if (fileName === currentSheet.fileName && sheetName === currentSheet.sheetName) {
                            if (sheetRow[header] !== undefined && sheetRow[header] !== null && sheetRow[header] !== '') {
                                 val = sheetRow[header];
                                 break;
                            }
                        }
                    }
                }
                if (val !== '') break;
            }
            newRow[targetField] = cleanAndFormatValue(val);
        });
        const firstSource = Object.values(entry)[0];
        newRow['_sourceFile'] = firstSource ? (firstSource as any)._srcFile : 'Joined';
        newRow['_sourceSheet'] = firstSource ? (firstSource as any)._srcSheet : 'Joined';
        return newRow;
    });
    return result;
};

export const mergeData = (sheets: SheetData[], mappings: Record<string, string[]>, config?: MergeConfig): EmployeeRow[] => {
    if (config?.method === 'join') return joinData(sheets, mappings, config);
    return stackData(sheets, mappings);
};

export const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

const getCleanSheetData = (sheet: SheetData) => {
  return sheet.rows.map(row => {
    const cleanRow: any = {};
    sheet.headers.forEach(header => {
      cleanRow[header] = row[header];
    });
    return cleanRow;
  });
};

export const exportWorkbook = (sheets: SheetData[], fileName: string) => {
  const workbook = XLSX.utils.book_new();
  sheets.forEach(sheet => {
    const cleanData = getCleanSheetData(sheet);
    const worksheet = XLSX.utils.json_to_sheet(cleanData, { header: sheet.headers });
    let safeName = sheet.sheetName.substring(0, 31).replace(/[:\\/?*[\]]/g, "");
    if (workbook.SheetNames.includes(safeName)) {
        safeName = `${safeName.substring(0, 28)}_${Math.floor(Math.random() * 99)}`;
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  });
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportMultipleFilesAsZip = async (sheets: SheetData[], baseFileName: string) => {
  const zip = new JSZip();
  sheets.forEach(sheet => {
    const workbook = XLSX.utils.book_new();
    const cleanData = getCleanSheetData(sheet);
    const worksheet = XLSX.utils.json_to_sheet(cleanData, { header: sheet.headers });
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const safeName = sheet.sheetName.replace(/[:\\/?*[\]]/g, "_");
    zip.file(`${safeName}.xlsx`, excelBuffer);
  });
  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, `${baseFileName}.zip`);
};