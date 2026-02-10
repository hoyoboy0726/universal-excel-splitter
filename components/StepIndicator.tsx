import React from 'react';
import { Check } from 'lucide-react';
import { AppStep } from '../types';

interface StepIndicatorProps {
  currentStep: AppStep;
}

const steps = [
  { id: AppStep.UPLOAD, label: '1. 上傳檔案' },
  { id: AppStep.MAPPING, label: '2. 欄位對應' },
  { id: AppStep.PREVIEW, label: '3. 預覽與拆分' },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const getCurrentIndex = () => steps.findIndex(s => s.id === currentStep);
  const currentIndex = getCurrentIndex();

  return (
    <div className="w-full py-6 px-4 bg-white border-b border-slate-200 shadow-sm mb-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between relative">
          {/* Progress Bar Background */}
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-slate-200 -z-10" />
          
          {/* Progress Bar Fill */}
          <div 
            className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-blue-600 -z-10 transition-all duration-300 ease-in-out"
            style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
          />

          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div key={step.id} className="flex flex-col items-center gap-2 bg-white px-2">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                    ${isCompleted ? 'bg-blue-600 border-blue-600 text-white' : ''}
                    ${isCurrent ? 'bg-white border-blue-600 text-blue-600 scale-110 shadow-md' : ''}
                    ${!isCompleted && !isCurrent ? 'bg-white border-slate-300 text-slate-400' : ''}
                  `}
                >
                  {isCompleted ? <Check size={20} /> : <span className="font-semibold">{index + 1}</span>}
                </div>
                <span 
                  className={`text-sm font-medium ${isCurrent ? 'text-blue-700' : 'text-slate-500'}`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
