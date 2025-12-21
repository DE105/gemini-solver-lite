
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
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          const base64 = (event.target.result as string).split(',')[1];
          setCurrentImage(base64);
          setView(AppView.ANALYZING);
          setError(null);
          try {
            const result = await analyzeHomeworkImage(base64);
            setAnalysisResult(result);
            setView(AppView.RESULTS);
          } catch (err) {
            setError("识别失败，请检查网络或重试。");
            setView(AppView.HOME);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTextSubmit = async () => {
    if (!inputText.trim()) return;
    setCurrentImage(null);
    setView(AppView.ANALYZING);
    setError(null);
    try {
      const result = await analyzeHomeworkText(inputText);
      setAnalysisResult(result);
      setView(AppView.RESULTS);
    } catch (err) {
      setError("解题失败，请稍后重试。");
      setView(AppView.HOME);
    }
  };

  const renderHome = () => (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-brand-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-green-100 rounded-full blur-3xl opacity-50"></div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto no-scrollbar">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">
                全能解题助手<span className="text-brand-500 text-2xl align-top ml-1">Lite</span>
            </h1>
            <p className="text-brand-600 mb-8 text-lg font-medium">
              Gemini 3 · 多模态解题 + Python 辅助验算
            </p>

            <div className="w-full max-w-sm space-y-6">
                {/* Text Input Area */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-inner group focus-within:ring-2 focus-within:ring-brand-500 transition-all">
                    <textarea 
                      placeholder="手输题目或粘贴题目..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-0 text-gray-700 placeholder-gray-400 resize-none h-24 text-base"
                    />
                    <button 
                      onClick={handleTextSubmit}
                      disabled={!inputText.trim()}
                      className="mt-2 w-full bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95 text-sm"
                    >
                      提交解题
                    </button>
                </div>

                <div className="flex items-center gap-4 text-gray-300">
                  <div className="flex-1 h-px bg-current"></div>
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400">或 拍照分析</span>
                  <div className="flex-1 h-px bg-current"></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => cameraInputRef.current?.click()}
                        className="bg-brand-600 hover:bg-brand-700 text-white py-4 rounded-2xl shadow-lg transform transition active:scale-95 flex flex-col items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        </svg>
                        <span className="font-bold">拍照解题</span>
                    </button>

                    <button 
                        onClick={() => galleryInputRef.current?.click()}
                        className="bg-brand-50 hover:bg-brand-100 text-brand-700 py-4 rounded-2xl border border-brand-200 transition active:scale-95 flex flex-col items-center justify-center gap-2"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25z" />
                        </svg>
                        <span className="font-bold">上传照片</span>
                    </button>
                </div>
            </div>
            
            {error && <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-lg max-w-xs text-sm border border-red-100">{error}</div>}
        </div>
        
        <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
        <input type="file" ref={galleryInputRef} accept="image/*" className="hidden" onChange={handleFileSelect} />
    </div>
  );

  return (
    <div className="h-screen w-full bg-gray-100 flex justify-center items-center">
        <div className={`w-full h-full bg-white shadow-2xl overflow-hidden relative transition-all duration-500 ${view === AppView.RESULTS ? 'md:max-w-6xl md:h-[90vh] md:rounded-3xl' : 'max-w-md'}`}>
            {view === AppView.HOME && renderHome()}
            {view === AppView.ANALYZING && <LoadingScreen />}
            {view === AppView.RESULTS && analysisResult && (
                <div className="h-full flex flex-col">
                    <header className="h-16 shrink-0 bg-white border-b border-gray-100 flex items-center px-4 justify-between z-30">
                        <button 
                          onClick={() => setView(AppView.HOME)} 
                          className="flex items-center gap-2 text-gray-600 hover:text-brand-600 transition-colors font-medium"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                            返回
                        </button>
                        <div className="text-center absolute left-1/2 -translate-x-1/2 hidden sm:block">
                            <span className="font-bold text-gray-800">解题报告</span>
                        </div>
                        <div className="text-xs text-gray-400 font-mono">
                          Gemini 3 Powered
                        </div>
                    </header>
                    <div className="flex-1 overflow-hidden relative">
                        <AnalysisOverlay imageBase64={currentImage} result={analysisResult} />
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default App;
