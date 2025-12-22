
import React, { useState, useRef } from 'react';
import { AppView, AnalysisResult } from './types';
import { analyzeHomeworkImage, analyzeHomeworkText } from './services/geminiService';
import AnalysisOverlay from './components/AnalysisOverlay';
import LoadingScreen from './components/LoadingScreen';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.HOME);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setView(AppView.ANALYZING);
    setError(null);
    try {
      // 保持原始图片尺寸和大小，不做任何处理
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setCurrentImage(base64);
      const result = await analyzeHomeworkImage(base64);
      setAnalysisResult(result);
      setView(AppView.RESULTS);
    } catch (err) {
      console.error('Analysis error:', err);
      setError("分析遇到问题，请确保图片清晰且网络连接正常。");
      setView(AppView.HOME);
    }
  };

  return (
    <div className="min-h-screen bg-white selection:bg-brand-100">
      {view === AppView.HOME && (
        <div className="max-w-2xl mx-auto px-6 pt-20 pb-12 animate-fade-in">
          <header className="text-center space-y-4 mb-16">
            <div className="inline-block px-4 py-1.5 bg-brand-50 text-brand-600 rounded-full text-xs font-black tracking-widest uppercase mb-2">
              Gemini 3 Multimodal Engine
            </div>
            <h1 className="text-6xl font-black text-gray-900 tracking-tighter">
              全能解题<span className="text-brand-500">助手</span>
            </h1>
            <p className="text-gray-400 font-medium text-lg">原始尺寸识别 · 像素级对齐 · 深度逻辑解析</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="group bg-gray-50 rounded-[2.5rem] p-8 text-left border-2 border-transparent hover:border-brand-500 hover:bg-white transition-all shadow-sm"
            >
              <div className="w-16 h-16 bg-brand-500 text-white rounded-2xl flex items-center justify-center text-3xl shadow-xl shadow-brand-200 mb-6 group-hover:scale-110 transition-transform">📸</div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">原始图片批改</h3>
              <p className="text-gray-500 text-sm leading-relaxed">上传练习册照片，不压缩不裁切，100% 还原题目原貌。</p>
            </button>
            
            <div className="bg-gray-50 rounded-[2.5rem] p-8 border-2 border-transparent hover:border-brand-500 hover:bg-white transition-all shadow-sm group">
              <div className="w-16 h-16 bg-white text-brand-500 rounded-2xl flex items-center justify-center text-3xl shadow-md mb-6 border border-gray-100 group-hover:scale-110 transition-transform">✍️</div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">纯文本解析</h3>
              <p className="text-gray-500 text-sm leading-relaxed">粘贴复杂题目内容，利用 Gemini 3 进行逻辑推导。</p>
            </div>
          </div>

          <div className="relative">
            <textarea 
              className="w-full p-8 bg-gray-50 border-2 border-gray-100 rounded-[2.5rem] focus:border-brand-500 focus:bg-white focus:ring-0 text-lg transition-all min-h-[180px] resize-none"
              placeholder="在此输入或粘贴题目文字..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
            />
            <button 
              disabled={!inputText.trim()}
              onClick={async () => {
                setView(AppView.ANALYZING);
                try {
                  const res = await analyzeHomeworkText(inputText);
                  setAnalysisResult(res);
                  setView(AppView.RESULTS);
                } catch { setError("识别失败，请检查输入内容"); setView(AppView.HOME); }
              }}
              className="absolute bottom-6 right-6 px-8 py-4 bg-brand-500 text-white rounded-2xl font-black shadow-xl shadow-brand-200 disabled:opacity-0 transition-all hover:bg-brand-600 active:scale-95"
            >
              立即解析
            </button>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} 
          />
          {error && <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-2xl text-center font-bold border border-red-100">{error}</div>}
        </div>
      )}

      {view === AppView.ANALYZING && <LoadingScreen />}

      {view === AppView.RESULTS && analysisResult && (
        <div className="w-full h-screen flex flex-col overflow-hidden bg-gray-100">
          <header className="h-16 border-b flex items-center px-6 justify-between shrink-0 bg-white z-20">
            <button onClick={() => setView(AppView.HOME)} className="flex items-center gap-2 text-gray-500 font-bold hover:text-brand-500 transition-colors">
              <span className="text-2xl">←</span> 返回首页
            </button>
            <div className="font-black text-xs tracking-widest text-gray-300 uppercase">Analysis Engine Result</div>
            <div className="w-20"></div>
          </header>
          <div className="flex-1 overflow-hidden">
            <AnalysisOverlay imageBase64={currentImage} result={analysisResult} />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
