import React, { useState, useEffect, useMemo } from 'react';
import hljs from 'highlight.js';
import { AnalysisResult } from '../types';

/**
 * 基础 Math 渲染组件
 */
const MathRenderer: React.FC<{ content: string; displayMode?: boolean }> = ({ content, displayMode }) => {
  const html = useMemo(() => {
    if (!content) return '';
    const katex = (window as any).katex;
    if (!katex) return content;
    
    try {
      return katex.renderToString(content, {
        displayMode: !!displayMode,
        throwOnError: false,
        strict: false,
        trust: true,
      });
    } catch (e) {
      return content;
    }
  }, [content, displayMode]);

  return <span dangerouslySetInnerHTML={{ __html: html }} className={displayMode ? "block w-full text-center my-2 overflow-x-auto no-scrollbar" : "inline-block"} />;
};

/**
 * 高级内容渲染器：支持 Markdown 基础语法与多段 LaTeX
 */
const MathContent: React.FC<{ content: string; className?: string }> = ({ content, className }) => {
  const renderedSegments = useMemo(() => {
    if (!content) return [];
    
    // 如果内容看起来像是纯 LaTeX（以反斜杠开头且没有 $），尝试自动包裹
    let processedContent = content;
    if (content.trim().startsWith('\\') && !content.includes('$')) {
      processedContent = `$${content}$`;
    }

    const segments = processedContent.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g);
    
    return segments.map((part, index) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        return <MathRenderer key={index} content={part.slice(2, -2)} displayMode={true} />;
      }
      if (part.startsWith('$') && part.endsWith('$')) {
        return <MathRenderer key={index} content={part.slice(1, -1)} displayMode={false} />;
      }
      if (part.startsWith('\\[') && part.endsWith('\\]')) {
        return <MathRenderer key={index} content={part.slice(2, -2)} displayMode={true} />;
      }
      if (part.startsWith('\\(') && part.endsWith('\\)')) {
        return <MathRenderer key={index} content={part.slice(2, -2)} displayMode={false} />;
      }
      
      const formattedText = part
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-gray-900">$1</strong>')
        .replace(/\n/g, '<br/>');
        
      return <span key={index} dangerouslySetInnerHTML={{ __html: formattedText }} />;
    });
  }, [content]);

  return (
    <div className={`${className} leading-relaxed math-content`}>
      {renderedSegments}
    </div>
  );
};

const PythonCodeBlock: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const highlighted = useMemo(() => {
    return hljs.highlight(code, { language: 'python' }).value;
  }, [code]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-2xl overflow-hidden border border-gray-800 shadow-xl">
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
        </div>
        <button onClick={handleCopy} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors">
          {copied ? '已复制!' : '复制代码'}
        </button>
      </div>
      <pre className="p-5 bg-gray-900 text-[11px] font-mono leading-relaxed overflow-x-auto hljs">
        <code className="language-python" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
};

const AnalysisOverlay: React.FC<{ imageBase64: string | null; result: AnalysisResult }> = ({ imageBase64, result }) => {
  const [selectedId, setSelectedId] = useState<string | null>(result.problems[0]?.id || null);
  const [showCode, setShowCode] = useState(false);
  const selectedProblem = result.problems.find(p => p.id === selectedId);

  useEffect(() => {
    setShowCode(false);
  }, [selectedId]);

  // 辅助函数：清理模型返回的步骤中可能包含的重复序号
  const cleanStepText = (text: string) => {
    // 移除形如 "步骤 19:", "19.", "Step 1:" 等前缀
    return text.replace(/^(步骤\s*\d+[\s、:]*|\d+[\.\s、:]+|Step\s*\d+[\s、:]*)/i, '').trim();
  };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden bg-gray-200">
      <div className="flex-1 overflow-auto bg-gray-300 p-2 md:p-6 text-center">
        {imageBase64 ? (
          <div className="relative inline-block shadow-2xl bg-white align-top max-w-full">
            <img src={`data:image/jpeg;base64,${imageBase64}`} className="block max-w-full h-auto" alt="Homework Content" />
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox="0 0 1000 1000" preserveAspectRatio="none">
              {result.problems.map((p) => {
                const { ymin, xmin, ymax, xmax } = p.boundingBox;
                const active = selectedId === p.id;
                return (
                  <g key={p.id} className="pointer-events-auto cursor-pointer" onClick={() => setSelectedId(p.id)}>
                    <rect x={xmin} y={ymin} width={xmax - xmin} height={ymax - ymin}
                      className={`transition-all duration-200 ${active ? 'fill-brand-500/20 stroke-[4px]' : 'fill-transparent stroke-[2px] hover:fill-brand-500/5'}`}
                      stroke={p.isCorrect ? '#22c55e' : '#ef4444'} rx="2"
                    />
                    <circle cx={xmax} cy={ymin} r="12" fill={p.isCorrect ? '#22c55e' : '#ef4444'} className="drop-shadow-sm" />
                    <text x={xmax} y={ymin + 4} textAnchor="middle" fill="white" fontSize="12" fontWeight="black" className="select-none">{p.isCorrect ? '✓' : '✗'}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center p-20 text-gray-400 font-black text-2xl border-4 border-dashed border-gray-300 rounded-[3rem] bg-gray-50">纯文本分析模式</div>
        )}
      </div>

      <div className="md:w-[480px] w-full bg-white border-t md:border-t-0 md:border-l shadow-[-10px_0_30px_rgba(0,0,0,0.05)] z-10 flex flex-col shrink-0 animate-fade-in">
        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
          {selectedProblem ? (
            <div className="space-y-10">
              <div className="flex items-center justify-between">
                <span className="px-4 py-1.5 bg-brand-50 text-brand-600 text-[10px] font-black rounded-full uppercase tracking-widest border border-brand-100">{selectedProblem.subject}</span>
                <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wide ${selectedProblem.isCorrect ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>{selectedProblem.isCorrect ? '已掌握' : '需改进'}</div>
              </div>

              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">题目详情</h3>
                <MathContent content={selectedProblem.questionText} className="text-xl font-black text-gray-900 tracking-tight" />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 shadow-sm">
                  <p className="text-[10px] uppercase font-black text-gray-400 mb-3 tracking-widest">你的回答</p>
                  <MathContent content={selectedProblem.studentAnswer} className="text-lg font-bold text-gray-800" />
                </div>
                <div className="p-6 bg-green-50 rounded-3xl border border-green-100 shadow-sm">
                  <p className="text-[10px] uppercase font-black text-green-600 mb-3 tracking-widest">正确答案</p>
                  <MathContent content={selectedProblem.correctAnswer} className="text-lg font-bold text-green-700" />
                </div>
              </div>

              {selectedProblem.verificationCode && (
                <div className="space-y-4">
                  <button onClick={() => setShowCode(!showCode)} className="flex items-center justify-between w-full p-4 bg-gray-900 text-white rounded-2xl hover:bg-black transition-all shadow-lg active:scale-[0.98]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🐍</span>
                      <span className="text-xs font-black uppercase tracking-widest">Python 验算逻辑</span>
                    </div>
                    <span className={`text-xs transition-transform ${showCode ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {showCode && <div className="animate-fade-in"><PythonCodeBlock code={selectedProblem.verificationCode} /></div>}
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">解题思路</h3>
                <div className="bg-brand-50 p-6 rounded-3xl border border-brand-100">
                  <MathContent content={selectedProblem.hint} className="text-brand-800 font-medium" />
                </div>
              </div>

              {selectedProblem.solutionSteps && selectedProblem.solutionSteps.length > 0 && (
                <div className="space-y-6">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">详细步骤</h3>
                  <div className="space-y-6">
                    {selectedProblem.solutionSteps
                      .filter(s => s.trim().length > 0)
                      .map((step, idx) => (
                        <div key={idx} className="flex gap-4 group">
                          <div className="flex-shrink-0 w-7 h-7 bg-brand-500 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-md shadow-brand-100">
                            {idx + 1}
                          </div>
                          <MathContent content={cleanStepText(step)} className="text-gray-700 pt-1 text-sm md:text-base flex-1" />
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-4">
              <div className="text-6xl">🎯</div>
              <p className="font-black uppercase tracking-widest text-sm">请点击题目查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisOverlay;