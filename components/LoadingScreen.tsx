
import React, { useEffect, useState } from 'react';

const MESSAGES = [
  "Gemini 正在审视作业页面...",
  "正在识别手写内容与公式...",
  "正在核对标准答案...",
  "正在构建深度解析逻辑...",
  "即将呈现批改结果...",
];

const LoadingScreen: React.FC = () => {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-white p-6 w-full max-w-md mx-auto">
      <div className="relative w-32 h-32 mb-12">
        <div className="absolute inset-0 border-[6px] border-brand-100 rounded-[2.5rem] animate-pulse"></div>
        <div className="absolute inset-4 border-[6px] border-brand-500 rounded-[1.5rem] border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-4xl">
          ✨
        </div>
      </div>
      
      <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">智能分析中</h2>
      <p className="text-brand-600 font-bold min-h-[1.5rem] transition-all duration-300">
        {MESSAGES[msgIndex]}
      </p>
      
      <div className="mt-12 w-full bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
        <div className="flex gap-2 mb-4">
          <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
          <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed font-medium">
          正在利用 Gemini 3 的多模态视觉能力进行像素级识别，无需人工干预。
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
