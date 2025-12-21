import React, { useEffect, useState } from 'react';

const MESSAGES = [
  "正在识别作业内容...",
  "AI 正在区分学科类型...",
  "正在检索知识库 & 运行验证...",
  "正在生成详细解析...",
  "整理思路点拨中...",
];

const LoadingScreen: React.FC = () => {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-brand-50 p-6">
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 border-4 border-brand-200 rounded-full animate-ping opacity-25"></div>
        <div className="absolute inset-2 border-4 border-brand-500 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-3xl">
          🎓
        </div>
      </div>
      
      <h2 className="text-xl font-bold text-gray-800 mb-2">作业批改中</h2>
      <p className="text-brand-600 font-medium min-h-[1.5rem] transition-all duration-300">
        {MESSAGES[msgIndex]}
      </p>
      
      <div className="mt-8 p-4 bg-white/50 rounded-lg text-xs text-gray-500 max-w-xs text-center">
        <p>Gemini AI 正在根据学科自动选择 Python 引擎或知识库进行双重校验，确保准确率。</p>
      </div>
    </div>
  );
};

export default LoadingScreen;