import { SheetData } from '../types';

export const SAMPLE_SHEETS: SheetData[] = [
  {
    fileName: "2024_北部人員名單.xlsx",
    sheetName: "業務部_Sales",
    headers: ["EmpID", "Full_Name", "Job_Level", "Base_Salary", "Dept_Name", "Entity"],
    rows: [
      { "EmpID": "N001", "Full_Name": "陳大衛", "Job_Level": "8", "Base_Salary": "85000", "Dept_Name": "業務一處", "Entity": "TW_North" },
      { "EmpID": "N002", "Full_Name": "林雅婷", "Job_Level": "4", "Base_Salary": "42000", "Dept_Name": "業務二處", "Entity": "TW_North" },
      { "EmpID": "N003", "Full_Name": "張志豪", "Job_Level": "10", "Base_Salary": "120000", "Dept_Name": "業務部管理", "Entity": "TW_North" },
      { "EmpID": "N004", "Full_Name": "李美惠", "Job_Level": "3", "Base_Salary": "38000", "Dept_Name": "行政支援", "Entity": "TW_North" },
      { "EmpID": "N005", "Full_Name": "王建國", "Job_Level": "6", "Base_Salary": "55000", "Dept_Name": "業務一處", "Entity": "TW_North" }
    ]
  },
  {
    fileName: "2024_南部薪資表.xlsx",
    sheetName: "研發部_RD",
    headers: ["員工編號", "姓名", "職等", "本薪", "部門", "分公司"],
    rows: [
      { "員工編號": "S001", "姓名": "黃怡君", "職等": "7", "本薪": "72000", "部門": "軟體開發部", "分公司": "TW_South" },
      { "員工編號": "S002", "姓名": "劉冠宇", "職等": "5", "本薪": "48000", "部門": "測試部", "分公司": "TW_South" },
      { "員工編號": "S003", "姓名": "吳淑芬", "職等": "12", "本薪": "150000", "部門": "研發中心", "分公司": "TW_South" },
      { "員工編號": "S004", "姓名": "蔡宗翰", "職等": "9", "本薪": "95000", "部門": "架構組", "分公司": "TW_South" },
      { "員工編號": "S005", "姓名": "楊佳穎", "職等": "4", "本薪": "41000", "部門": "UI設計", "分公司": "TW_South" }
    ]
  }
];
