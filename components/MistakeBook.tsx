import React from 'react';
import { MistakeRecord } from '../types';

interface MistakeBookProps {
  mistakes: MistakeRecord[];
  onBack: () => void;
  onDelete: (id: string) => void;
}

const MistakeBook: React.FC<MistakeBookProps> = ({ mistakes, onBack, onDelete }) => {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10 flex items-center shadow-sm">
        <button onClick={onBack} className="text-gray-500 p-1 mr-2 hover:bg-gray-100 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-800">错题本 ({mistakes.length})</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {mistakes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <span className="text-4xl mb-4">🌟</span>
            <p>太棒了！目前还没有错题哦。</p>
          </div>
        ) : (
          mistakes.map((record) => (
            <div key={record.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
               <div className="p-4">
                 <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400">
                          {new Date(record.timestamp).toLocaleDateString()}
                      </span>
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                          {record.problem.subject}
                      </span>
                    </div>
                    <button 
                        onClick={() => onDelete(record.id)}
                        className="text-gray-300 hover:text-red-500"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                    </button>
                 </div>
                 
                 <div className="mb-3">
                     <p className="text-lg font-bold text-gray-800">{record.problem.questionText}</p>
                     <p className="text-red-500 text-sm mt-1">你的答案: {record.problem.studentAnswer}</p>
                     <p className="text-green-600 text-sm">正确答案: {record.problem.correctAnswer}</p>
                 </div>
                 
                 <div className="bg-brand-50 p-3 rounded-lg text-sm text-brand-800">
                    <span className="font-bold mr-1">💡 提示:</span>
                    {record.problem.hint}
                 </div>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MistakeBook;