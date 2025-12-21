
import React, { useState, useEffect } from 'react';
import { AnalysisResult } from '../types';

interface AnalysisOverlayProps {
  imageBase64: string | null;
  result: AnalysisResult;
}

const AnalysisOverlay: React.FC<AnalysisOverlayProps> = ({ imageBase64, result }) => {
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);

  useEffect(() => {
    // For text-only input or single result, automatically select the first problem
    if (result.problems.length > 0) {
      setSelectedProblemId(result.problems[0].id);
    }
  }, [imageBase64, result.problems]);

  const selectedProblem = result.problems.find(p => p.id === selectedProblemId);

  const isSTEM = (subject: string) => {
    const s = subject.toLowerCase();
    return s.includes('math') || s.includes('physics') || s.includes('chem') || s.includes('数') || s.includes('理') || s.includes('化');
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-gray-50 overflow-hidden">
      {/* LEFT PANEL: IMAGE OR PROBLEM LIST */}
      <div className="flex-1 overflow-y-auto bg-gray-900 no-scrollbar relative border-b md:border-b-0 md:border-r border-gray-200">
        {imageBase64 ? (
          <div className="relative w-full">
            <img
              src={`data:image/jpeg;base64,${imageBase64}`}
              alt="Homework"
              className="w-full h-auto block"
            />
            <svg
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
            >
              {result.problems.map((problem) => {
                const { ymin, xmin, ymax, xmax } = problem.boundingBox;
                const height = ymax - ymin;
                const width = xmax - xmin;
                const isSel = selectedProblemId === problem.id;
                
                return (
                  <g key={problem.id} className="pointer-events-auto cursor-pointer" onClick={() => setSelectedProblemId(problem.id)}>
                    <rect
                      x={xmin}
                      y={ymin}
                      width={width}
                      height={height}
                      fill={problem.isCorrect ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}
                      stroke={problem.isCorrect ? '#22c55e' : '#ef4444'}
                      strokeWidth={isSel ? 6 : 3}
                      rx="10"
                    />
                    <circle cx={xmax} cy={ymin} r="20" fill={problem.isCorrect ? '#22c55e' : '#ef4444'} />
                    <text x={xmax} y={ymin + 8} textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">
                      {problem.isCorrect ? '✓' : '✗'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="p-6 bg-gray-50 min-h-full">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">解析列表</h2>
              <p className="text-sm text-gray-500 mt-1">{result.overallSummary}</p>
            </div>
            <div className="space-y-4">
              {result.problems.map((problem) => (
                <button
                  key={problem.id}
                  onClick={() => setSelectedProblemId(problem.id)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all ${
                    selectedProblemId === problem.id 
                    ? 'bg-brand-50 border-brand-500 shadow-md ring-1 ring-brand-500' 
                    : 'bg-white border-gray-200 shadow-sm hover:border-brand-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase rounded tracking-wider">{problem.subject}</span>
                    <span className={`text-xs font-bold ${problem.isCorrect ? "text-green-500" : "text-red-500"}`}>
                      {problem.isCorrect ? '✓ 正确' : '✗ 查看解析'}
                    </span>
                  </div>
                  <p className="text-gray-800 font-semibold line-clamp-3 leading-snug">{problem.questionText}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: ANALYSIS DETAILS */}
      <div className="md:w-[450px] shrink-0 bg-white shadow-2xl z-10 flex flex-col h-1/2 md:h-full overflow-y-auto no-scrollbar">
        {selectedProblem ? (
          <div className="p-6 space-y-6 animate-fade-in pb-12">
             <div className="flex justify-between items-start">
                <div className="flex-1 mr-4">
                   <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-brand-100 text-brand-700 text-xs font-bold rounded">
                        {selectedProblem.subject}
                      </span>
                   </div>
                   <h3 className="text-xl font-bold text-gray-900 leading-tight">{selectedProblem.questionText}</h3>
                   <div className="mt-4 space-y-2">
                       <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-xl">
                           <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">你的回答</span>
                           <span className="font-mono text-gray-800 text-base">{selectedProblem.studentAnswer || '(无内容)'}</span>
                       </p>
                       {!selectedProblem.isCorrect && (
                           <p className="text-sm font-bold text-green-700 bg-green-50 p-3 rounded-xl border border-green-100">
                               <span className="block text-[10px] font-bold text-green-400 uppercase mb-1">正确答案</span>
                               <span className="font-mono text-xl">{selectedProblem.correctAnswer}</span>
                           </p>
                       )}
                   </div>
                </div>
                <div className={`px-4 py-1 rounded-full text-xs font-bold shrink-0 shadow-sm ${selectedProblem.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {selectedProblem.isCorrect ? '正确' : '待纠正'}
                </div>
             </div>
             
             <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 shadow-sm">
                <p className="text-blue-700 font-bold text-sm mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs">💡</span>
                  思路点拨
                </p>
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{selectedProblem.hint}</p>
             </div>

             {selectedProblem.solutionSteps && selectedProblem.solutionSteps.length > 0 && (
                <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                   <p className="text-gray-900 font-bold text-sm mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-xs">📜</span>
                      标准解答过程
                   </p>
                   <div className="space-y-2">
                      {selectedProblem.solutionSteps.map((step, index) => (
                          <div key={index} className="flex gap-3 text-sm text-gray-700 bg-gray-50/50 p-3 rounded-xl border border-gray-50 hover:border-brand-100 transition-colors">
                             <span className="text-brand-300 font-mono font-bold">{index + 1}.</span>
                             <span className={isSTEM(selectedProblem.subject) ? "font-mono font-medium text-gray-900" : "text-gray-800"}>{step}</span>
                          </div>
                      ))}
                   </div>
                </div>
             )}

             {/* Code logic for verification (Optional debug) */}
             {selectedProblem.verificationCode && (
               <div className="mt-4 opacity-50 hover:opacity-100 transition-opacity">
                 <details className="text-[10px]">
                   <summary className="cursor-pointer text-gray-400 list-none flex items-center gap-1">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                       <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 002 4.25v11.5A2.25 2.25 0 004.25 18h11.5A2.25 2.25 0 0018 15.75V4.25A2.25 2.25 0 0015.75 2H4.25zm4.03 6.22a.75.75 0 00-1.06 1.06L8.94 11l-1.72 1.72a.75.75 0 101.06 1.06l2.25-2.25a.75.75 0 000-1.06l-2.25-2.25zM11 13a.75.75 0 01.75-.75h2.5a.75.75 0 010 1.5h-2.5A.75.75 0 0111 13z" clipRule="evenodd" />
                     </svg>
                     Python 验证逻辑详情
                   </summary>
                   <pre className="mt-2 p-2 bg-gray-800 text-green-400 rounded-lg overflow-x-auto font-mono text-[9px]">
                     {selectedProblem.verificationCode}
                   </pre>
                 </details>
               </div>
             )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-bold text-gray-600">请选择题目查看解析</p>
            <p className="text-sm mt-2">{result.overallSummary}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisOverlay;
