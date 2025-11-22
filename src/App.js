import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, TreeDeciduous, CheckCircle2, XCircle, ArrowRight, 
  RefreshCcw, Trophy, Brain, Sparkles, Volume2, History,
  Search, Upload, Download, Settings, Save, Trash2, Share2, Link as LinkIcon,
  Eye, MessageCircle, Construction, Anchor, Scroll, 
  Sun, Umbrella, Heart, Zap, Globe, Target, Flag, Star, Compass, Loader2, GraduationCap,
  Shuffle, AlertCircle, Filter, Layers, FileDown
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, addDoc, collection } from "firebase/firestore";

// ------------------------------------------------------------------
// ⚠️ 重要：請將下方的 firebaseConfig 替換成你從 Firebase 後台複製的內容
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDK3-cqlescL-IsjJhvsgvfBWsGAwb7JiM",
  authDomain: "rootmaster-d7548.firebaseapp.com",
  projectId: "rootmaster-d7548",
  storageBucket: "rootmaster-d7548.firebasestorage.app",
  messagingSenderId: "536194643036",
  appId: "1:536194643036:web:10faabc92cff0388452299",
};

// 檢查設定是否有效
const isConfigValid = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("請填入");

// 初始化 Firebase
let app, auth, db;
const appId = "root-master-production-v1";

if (isConfigValid) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
}

// --- 種子資料 ---
const SEED_DATA = [
  {
    id: "root_spect", root: "Spect", rootMeaning: "看 (Look)",
    questions: [
      { id: "q_inspect", word: "Inspect", parts: [{p:"In", m:"內"}, {p:"Spect", m:"看"}], correctAnswer: "檢查", options: ["檢查", "期待", "尊重", "懷疑"], explanation: "往裡面(In)看(Spect)，引申為仔細檢查。" },
      { id: "q_prospect", word: "Prospect", parts: [{p:"Pro", m:"前"}, {p:"Spect", m:"看"}], correctAnswer: "前景", options: ["前景", "回憶", "專家", "保護"], explanation: "往前(Pro)看(Spect)，看到未來的景象。" },
      { id: "q_retrospect", word: "Retrospect", parts: [{p:"Retro", m:"後"}, {p:"Spect", m:"看"}], correctAnswer: "回顧", options: ["展望", "透視", "回顧", "預測"], explanation: "往後(Retro)看(Spect)。" }
    ]
  },
  {
    id: "root_dict", root: "Dict", rootMeaning: "說 (Speak)",
    questions: [
      { id: "q_predict", word: "Predict", parts: [{p:"Pre", m:"預先"}, {p:"Dict", m:"說"}], correctAnswer: "預測", options: ["保證", "預測", "命令", "反駁"], explanation: "發生前(Pre)先說(Dict)。" },
      { id: "q_verdict", word: "Verdict", parts: [{p:"Ver", m:"真"}, {p:"Dict", m:"說"}], correctAnswer: "裁決", options: ["真理", "裁決", "字典", "詩句"], explanation: "說出(Dict)真實(Ver)的結果。" }
    ]
  },
  {
    id: "root_port", root: "Port", rootMeaning: "運/拿 (Carry)",
    questions: [
      { id: "q_import", word: "Import", parts: [{p:"Im", m:"進"}, {p:"Port", m:"運"}], correctAnswer: "進口", options: ["出口", "進口", "報告", "支持"], explanation: "運(Port)進(Im)港口。" },
      { id: "q_portable", word: "Portable", parts: [{p:"Port", m:"拿"}, {p:"able", m:"可"}], correctAnswer: "可攜帶的", options: ["進口的", "重要的", "可攜帶的", "傳送的"], explanation: "可以(able)被拿著(Port)走的。" }
    ]
  }
];

// --- 輔助函式 ---
const getIconForWord = (word, meaning) => {
  const lower = (word + " " + meaning).toLowerCase();
  if (lower.includes("look") || lower.includes("see") || lower.includes("spect")) return <Eye />;
  if (lower.includes("speak") || lower.includes("say") || lower.includes("dict")) return <MessageCircle />;
  if (lower.includes("build") || lower.includes("struct")) return <Construction />;
  if (lower.includes("go") || lower.includes("move") || lower.includes("port")) return <ArrowRight />;
  const fallbackIcons = [<Star/>, <Target/>, <Flag/>, <Compass/>, <Zap/>, <Globe/>, <BookOpen/>];
  return fallbackIcons[word.length % fallbackIcons.length];
};

const checkIsRoot = (partText, rootText) => {
    if (!partText || !rootText) return false;
    const rootVariants = rootText.toLowerCase().split('/').map(s => s.trim());
    const p = partText.toLowerCase();
    return rootVariants.some(variant => p.includes(variant));
};

// --- 主程式元件 ---
export default function App() {
  const [view, setView] = useState('home');
  const [gameData, setGameData] = useState(SEED_DATA);
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState([]); 
  const [mistakes, setMistakes] = useState([]);   
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pendingSharedData, setPendingSharedData] = useState(null); 
  
  const [quizQueue, setQuizQueue] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [quizMode, setQuizMode] = useState('standard'); 
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Auth & Load
  useEffect(() => {
    if (!isConfigValid || !auth) return;
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (error) { console.error(error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const savedData = localStorage.getItem('rootMasterData_v3');
    if (savedData) { try { setGameData(JSON.parse(savedData)); } catch (e) {} }
    const savedStats = localStorage.getItem('rootMasterUserStats_v1');
    if (savedStats) { 
      try {
        const stats = JSON.parse(savedStats);
        setFavorites(stats.favorites || []);
        setMistakes(stats.mistakes || []);
      } catch (e) {} 
    }
  }, []);

  useEffect(() => { localStorage.setItem('rootMasterUserStats_v1', JSON.stringify({ favorites, mistakes })); }, [favorites, mistakes]);
  useEffect(() => { if (gameData !== SEED_DATA) localStorage.setItem('rootMasterData_v3', JSON.stringify(gameData)); }, [gameData]);

  // Check Shared Link
  useEffect(() => {
    if (!user || !db) return;
    const checkForShareLink = async () => {
      const params = new URLSearchParams(window.location.search);
      const shareId = params.get('shareId');
      if (shareId) {
        setIsDownloading(true);
        try {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'shared_dictionaries', shareId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const sharedData = JSON.parse(docSnap.data().jsonData);
            if(Array.isArray(sharedData)) setPendingSharedData(sharedData);
          } else {
            alert("❌ 連結無效");
          }
        } catch (error) { console.error(error); } 
        finally { 
          setIsDownloading(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };
    checkForShareLink();
  }, [user]);

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.8;
      window.speechSynthesis.speak(u);
    }
  };

  // Logic
  const handleMergeData = (newData) => {
      if (!Array.isArray(newData)) return;
      const normalized = newData.map((root, rIdx) => ({
        ...root, id: root.id || `imp_${Date.now()}_${rIdx}`,
        questions: root.questions.map((q, qIdx) => ({ ...q, id: q.id || `q_${Date.now()}_${rIdx}_${qIdx}` }))
      }));
      const merged = [...gameData, ...normalized];
      const unique = merged.filter((v,i,a)=>a.findIndex(t=>(t.id===v.id))===i);
      setGameData(unique);
      setPendingSharedData(null);
      alert("✅ 匯入成功！");
  };

  const handleReplaceData = (newData) => {
      if (!Array.isArray(newData)) return;
      if (window.confirm("確定要覆蓋所有資料嗎？此動作無法復原。")) {
          setGameData(newData);
          setFavorites([]);
          setMistakes([]);
          setPendingSharedData(null);
          alert("🔄 資料庫已替換！");
      }
  };

  const startQuiz = (mode) => {
      // 1. 準備題目
      const allQuestions = gameData.flatMap(root => 
          root.questions.map(q => ({
              ...q,
              rootId: root.id,
              rootName: root.root,
              rootMeaning: root.rootMeaning,
              // 🌟 關鍵修改：在這裡打亂每個題目的選項
              options: [...q.options].sort(() => Math.random() - 0.5) 
          }))
      );

      let queue = [];
      if (mode === 'standard') {
          queue = allQuestions; // 題目依序，但選項已隨機
      } else if (mode === 'random') {
          queue = [...allQuestions].sort(() => Math.random() - 0.5); // 題目也隨機
      } else if (mode === 'mistakes') {
          queue = allQuestions.filter(q => mistakes.includes(q.id));
      }

      if (queue.length === 0) { alert("沒有題目可以練習。"); return; }
      
      setQuizQueue(queue);
      setQuizMode(mode);
      setCurrentQuestionIndex(0);
      setScore(0);
      setView('game');
      setShowExplanation(false);
      setSelectedOption(null);
  };

  const toggleFavorite = (rootId) => {
      setFavorites(prev => prev.includes(rootId) ? prev.filter(id => id !== rootId) : [...prev, rootId]);
  };

  const handleShareLink = async () => {
    if (!user || !db) { alert("請先設定 Firebase"); return; }
    setIsSharing(true);
    try {
      const jsonString = JSON.stringify(gameData);
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'shared_dictionaries');
      const docRef = await addDoc(colRef, { jsonData: jsonString, createdAt: new Date(), authorId: user.uid });
      const url = `${window.location.href.split('?')[0]}?shareId=${docRef.id}`;
      
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert("🔗 連結已複製！");
    } catch (err) { alert("分享失敗"); }
    finally { setIsSharing(false); }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    const fileReaders = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const json = JSON.parse(e.target.result);
            if (Array.isArray(json)) resolve({ success: true, data: json, filename: file.name });
            else resolve({ success: false, filename: file.name, error: "Format Invalid" });
          } catch (err) { resolve({ success: false, filename: file.name, error: "Parse Error" }); }
        };
        reader.readAsText(file);
      });
    });
    try {
        const results = await Promise.all(fileReaders);
        const validData = results.filter(r => r.success).flatMap(r => r.data);
        if (validData.length > 0) handleMergeData(validData);
        else alert("❌ 無效檔案");
    } catch (error) { alert("匯入錯誤"); }
    event.target.value = '';
  };

  const handleResetData = () => {
    if (window.confirm("⚠️ 確定重置？")) {
      setGameData(SEED_DATA);
      localStorage.setItem('rootMasterData_v3', JSON.stringify(SEED_DATA));
    }
  };

  const downloadBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gameData, null, 2));
    const node = document.createElement('a');
    node.setAttribute("href", dataStr);
    node.setAttribute("download", "root_master_backup.json");
    document.body.appendChild(node);
    node.click();
    node.remove();
  };

  // Components
  const ShareReceiverModal = () => {
      if (!pendingSharedData) return null;
      return (
          <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border-4 border-indigo-100">
                  <h3 className="text-xl font-bold text-center mb-4 text-slate-800">收到題庫分享！</h3>
                  <div className="space-y-3">
                      <button onClick={() => handleMergeData(pendingSharedData)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow hover:bg-indigo-700 active:scale-95 transition-all">合併匯入</button>
                      <button onClick={() => handleReplaceData(pendingSharedData)} className="w-full bg-white border-2 border-indigo-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-50 active:scale-95 transition-all">覆蓋資料</button>
                      <button onClick={() => setPendingSharedData(null)} className="w-full text-slate-400 py-2 text-xs hover:text-slate-600">取消</button>
                  </div>
              </div>
          </div>
      );
  };

  const HomeScreen = () => {
    const totalWords = useMemo(() => gameData.reduce((acc, r) => acc + r.questions.length, 0), [gameData]);
    
    if (!isConfigValid) {
      return (
        <div className="flex flex-col items-center justify-center h-screen p-6 text-center bg-slate-50">
            <AlertCircle size={48} className="text-red-500 mb-4"/>
            <h1 className="text-xl font-bold">Firebase 未設定</h1>
            <p className="text-slate-500 mt-2">請在 src/App.js 中填入 config</p>
        </div>
      );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-5 animate-in fade-in zoom-in duration-300 relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-indigo-50">
        {isDownloading && <div className="absolute inset-0 bg-white/90 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={48}/></div>}
        <ShareReceiverModal />
        
        <div className="absolute top-10 left-5 text-yellow-400 opacity-40 animate-bounce"><Star size={48} fill="currentColor" /></div>
        <div className="absolute bottom-12 right-6 text-green-400 opacity-40 animate-bounce"><Zap size={40} fill="currentColor"/></div>
        
        <div className="relative group cursor-pointer mt-8 mb-2 transition-transform hover:scale-105">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-[2rem] shadow-2xl relative z-10 border-4 border-white">
            <TreeDeciduous size={72} className="text-white" />
            </div>
            <div className="absolute -top-8 -right-8 z-20 animate-bounce">
            <div className="bg-yellow-300 text-yellow-900 px-3 py-2 rounded-2xl border-4 border-white shadow-xl transform rotate-12 flex items-center gap-2">
                <GraduationCap size={20} className="text-indigo-600" />
                <div className="flex flex-col items-start -space-y-1"><span className="text-[10px] font-bold uppercase">Teacher</span><span className="text-sm font-black">Johnson</span></div>
            </div>
            </div>
        </div>
        
        <div className="z-10 mb-4">
            <h1 className="font-black text-slate-800 text-4xl mb-2">RootMaster</h1>
            <p className="text-slate-500 text-xs font-bold bg-white/80 px-4 py-1 rounded-full border border-slate-100">Teacher Johnson 的字根記憶魔法 🌳</p>
        </div>

        <div className="bg-white/70 backdrop-blur-md p-4 rounded-3xl border border-white shadow-lg w-full max-w-xs mx-auto mb-4">
            <div className="grid grid-cols-3 divide-x divide-slate-100">
                <div className="flex flex-col items-center p-1"><span className="text-[10px] text-slate-400 font-bold">字根</span><span className="text-xl font-black text-indigo-600">{gameData.length}</span></div>
                <div className="flex flex-col items-center p-1"><span className="text-[10px] text-slate-400 font-bold">單字</span><span className="text-xl font-black text-blue-600">{totalWords}</span></div>
                <div className="flex flex-col items-center p-1"><span className="text-[10px] text-slate-400 font-bold">錯題</span><span className="text-xl font-black text-pink-500">{mistakes.length}</span></div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full max-w-xs z-10">
            <button onClick={() => startQuiz('standard')} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-2xl shadow-lg flex flex-col items-center col-span-2 active:scale-95 transition-all"><Brain size={24}/><span className="font-black mt-1">標準闖關</span></button>
            <button onClick={() => startQuiz('random')} className="bg-white border-2 border-purple-100 text-purple-600 p-3 rounded-2xl shadow-sm flex flex-col items-center active:scale-95 transition-all"><Shuffle size={20}/><span className="font-bold text-sm mt-1">隨機測驗</span></button>
            <button onClick={() => startQuiz('mistakes')} disabled={mistakes.length===0} className={`bg-white border-2 border-orange-100 text-orange-500 p-3 rounded-2xl shadow-sm flex flex-col items-center active:scale-95 transition-all ${mistakes.length===0 ? 'opacity-50 grayscale' : ''}`}><AlertCircle size={20}/><span className="font-bold text-sm mt-1">錯題特訓</span></button>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full max-w-xs z-10 mt-2">
            <button onClick={() => setView('dictionary')} className="bg-white p-3 rounded-2xl shadow-sm flex items-center justify-center gap-2 font-bold text-sm text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"><BookOpen size={18} className="text-indigo-500"/> 字根字典</button>
            <button onClick={handleShareLink} className="bg-white p-3 rounded-2xl shadow-sm flex items-center justify-center gap-2 font-bold text-sm text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"><Share2 size={18} className="text-blue-500"/> 分享題庫</button>
        </div>
        
        <div className="flex justify-center gap-6 mt-4 w-full max-w-xs z-10">
            <div className="cursor-pointer text-slate-400 hover:text-green-600 flex items-center gap-1.5 text-xs font-bold relative group transition-colors">
                <input type="file" accept=".json" multiple onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10"/>
                <Layers size={14}/> 批次匯入
            </div>
            <button onClick={downloadBackup} className="text-slate-400 hover:text-indigo-600 flex items-center gap-1.5 text-xs font-bold transition-colors"><Download size={14}/> 備份</button>
            {gameData.length > SEED_DATA.length && <button onClick={handleResetData} className="text-red-300 hover:text-red-500 flex items-center gap-1.5 text-xs font-bold transition-colors"><Trash2 size={14}/> 重置</button>}
        </div>
        </div>
    );
  };

  const DictionaryScreen = () => {
    const filtered = gameData.filter(r => {
      const match = r.root.toLowerCase().includes(searchQuery.toLowerCase()) || r.rootMeaning.includes(searchQuery) || r.questions.some(q => q.word.toLowerCase().includes(searchQuery.toLowerCase()));
      return showFavoritesOnly ? (match && favorites.includes(r.id)) : match;
    });

    return (
      <div className="flex flex-col h-full bg-slate-50">
        {/* Header - Sticky */}
        <div className="bg-white p-4 shadow-sm z-10 sticky top-0">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
                <button onClick={() => setView('home')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                    <ArrowRight className="rotate-180" size={24}/>
                </button>
                <h2 className="font-bold text-xl text-slate-800">字根字典</h2>
            </div>
            <button 
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`p-2 rounded-full transition-colors ${showFavoritesOnly ? 'bg-pink-100 text-pink-500' : 'bg-slate-100 text-slate-400'}`}
            >
                <Heart size={24} fill={showFavoritesOnly ? "currentColor" : "none"}/>
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
            <input 
                type="text" 
                placeholder="搜尋單字 (Ex: inspect) 或字根..." 
                className="w-full bg-slate-100 pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {filtered.length === 0 ? (
             <div className="text-center text-slate-400 mt-20">
                <Search size={48} className="mx-auto mb-2 opacity-20"/>
                <p>找不到相關內容</p>
             </div>
          ) : (
            filtered.map((r, i) => (
                <div key={r.id || i} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Root Header */}
                <div className="bg-gradient-to-r from-indigo-50 to-white p-4 flex justify-between items-center border-b border-indigo-100">
                    <div className="flex items-center gap-3">
                        <button onClick={() => toggleFavorite(r.id)} className="text-slate-400 hover:text-pink-500 transition-colors p-1 rounded-full hover:bg-white">
                            <Heart size={20} className={favorites.includes(r.id) ? "text-pink-500 fill-pink-500" : ""}/>
                        </button>
                        <div className="flex flex-col">
                            <div className="flex items-baseline gap-2">
                                <span className="font-black text-xl text-indigo-700 tracking-tight">{r.root}</span>
                                <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-100 shadow-sm">{r.questions.length}</span>
                            </div>
                            <span className="text-sm text-slate-500 font-medium">{r.rootMeaning}</span>
                        </div>
                    </div>
                </div>
                
                {/* Words List */}
                <div className="divide-y divide-slate-50">
                    {r.questions.map((q, j) => (
                    <div key={q.id ? `${q.id}-${i}-${j}` : `${i}-${j}`} className="p-4 flex flex-col gap-3 hover:bg-slate-50 transition-colors group">
                        {/* Top Row: Word & Audio */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="text-indigo-500 bg-indigo-50 p-2 rounded-lg group-hover:bg-indigo-100 transition-colors">
                                    {getIconForWord(q.word, q.explanation)}
                                </div>
                                <span className="font-bold text-lg text-slate-800">{q.word}</span>
                            </div>
                            <button onClick={() => speak(q.word)} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all">
                                <Volume2 size={20}/>
                            </button>
                        </div>

                        {/* Parts Breakdown */}
                        <div className="flex flex-wrap gap-2 pl-12"> 
                            {q.parts.map((p,k) => {
                                const partText = p.p || p.part || "";
                                const isRoot = checkIsRoot(partText, r.root);
                                return (
                                    <div key={k} className={`flex items-center px-2.5 py-1 rounded-md border text-xs font-bold ${isRoot ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                        {partText}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Meaning & Explanation */}
                        <div className="pl-12">
                            <div className="font-bold text-slate-700 mb-1.5 text-base">
                                {q.correctAnswer}
                            </div>
                            <div className="text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-sm leading-relaxed">
                                <span className="font-bold text-indigo-400 text-xs mr-1.5 px-1.5 py-0.5 bg-white rounded border border-indigo-100">解析</span>
                                {q.explanation}
                            </div>
                        </div>
                    </div>
                    ))}
                </div>
                </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const GameScreen = () => {
    const q = quizQueue[currentQuestionIndex];
    if (!q) return <div>Loading...</div>;
    const handleNext = () => {
        setShowExplanation(false);
        setSelectedOption(null);
        if (currentQuestionIndex < quizQueue.length - 1) setCurrentQuestionIndex(prev => prev + 1);
        else setView('result');
    };
    
    return (
      <div className="flex flex-col h-full">
        <div className="bg-white p-4 flex justify-between items-center shadow-sm border-b border-slate-100">
            <button onClick={() => setView('home')}><XCircle className="text-slate-400 hover:text-slate-600"/></button>
            <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{quizMode === 'random' ? 'Random' : q.rootName}</span>
                <span className="font-black text-indigo-600">{currentQuestionIndex + 1} / {quizQueue.length}</span>
            </div>
            <span className="font-bold text-yellow-500 flex gap-1 items-center bg-yellow-50 px-2 py-1 rounded-full"><Trophy size={16}/> {score}</span>
        </div>
        <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-5 rounded-2xl mb-6 shadow-lg shadow-indigo-200 transform scale-110 mt-4">
                {getIconForWord(q.word, q.explanation)}
            </div>
            
            {/* 🌟 修正：新增發音按鈕與單字並排 */}
            <div className="flex items-center justify-center gap-3 mb-3">
                <h2 className="text-4xl font-black text-slate-800 text-center">{q.word}</h2>
                <button 
                    onClick={() => speak(q.word)} 
                    className="p-2 bg-indigo-100 text-indigo-600 rounded-full hover:bg-indigo-200 transition-colors"
                >
                    <Volume2 size={24} />
                </button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mb-8">
                {q.parts.map((p,i) => (
                    <span key={i} className={`px-3 py-1 rounded-lg text-sm font-bold border ${checkIsRoot(p.p, q.rootName||'') ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                        {p.p}
                    </span>
                ))}
            </div>
            <div className="w-full space-y-3">
                {q.options.map((opt, i) => (
                    <button key={i} onClick={() => { if(!showExplanation) { setSelectedOption(opt); setIsCorrect(opt===q.correctAnswer); setShowExplanation(true); if(opt===q.correctAnswer){setScore(s=>s+100); if(quizMode==='mistakes') setMistakes(m=>m.filter(id=>id!==q.id));} else { if(!mistakes.includes(q.id)) setMistakes(m=>[...m, q.id]); } speak(q.word); } }} 
                    className={`w-full p-4 rounded-xl border-2 font-bold text-lg text-left transition-all active:scale-98 ${showExplanation ? (opt===q.correctAnswer ? 'bg-green-50 border-green-500 text-green-700' : (opt===selectedOption ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-100 text-slate-300')) : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:shadow-md'}`}>
                        {opt}
                    </button>
                ))}
            </div>
            {showExplanation && (
                <div className="mt-auto bg-indigo-50 p-5 rounded-2xl w-full border border-indigo-100 animate-in slide-in-from-bottom-4 fade-in">
                    <div className="flex items-center gap-2 mb-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                        <Sparkles size={14}/> 記憶解析
                    </div>
                    <p className="text-slate-700 mb-4 font-medium text-lg leading-relaxed">{q.explanation}</p>
                    <button onClick={handleNext} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2">
                        下一題 <ArrowRight size={18}/>
                    </button>
                </div>
            )}
        </div>
      </div>
    );
  };

  const ResultScreen = () => (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in">
        <div className="mb-6 relative">
            <div className="absolute inset-0 bg-yellow-200 blur-2xl opacity-40 rounded-full"></div>
            <Trophy size={100} className="text-yellow-500 relative z-10 drop-shadow-lg"/>
        </div>
        <h2 className="text-4xl font-black text-slate-800 mb-2">
            {quizMode === 'mistakes' && mistakes.length === 0 ? "弱點清除成功！" : "恭喜完成！"}
        </h2>
        <p className="text-slate-500 mb-8 text-lg font-medium">你的字根知識樹又長大了 🌱</p>
        
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 w-full mb-8 transform rotate-1">
            <span className="text-slate-400 text-xs uppercase font-bold tracking-widest">Total Score</span>
            <div className="text-6xl font-black text-indigo-600 mt-2">{score}</div>
        </div>

        <div className="space-y-3 w-full">
            <button onClick={() => setView('home')} className="w-full bg-slate-800 hover:bg-slate-900 text-white px-8 py-4 rounded-xl font-bold shadow-lg transition-all active:scale-95">回到首頁</button>
            <button onClick={() => startQuiz(quizMode)} className="w-full bg-white border-2 border-slate-200 hover:border-indigo-500 text-slate-700 px-8 py-4 rounded-xl font-bold transition-all active:scale-95">再玩一次</button>
        </div>
    </div>
  );

  // 6. Main Render (Conditional Rendering)
  return (
    <div className="w-full max-w-md mx-auto h-[850px] bg-white shadow-2xl rounded-[2.5rem] overflow-hidden border-[8px] border-slate-900 relative font-sans selection:bg-indigo-100">
      {view === 'home' && <HomeScreen />}
      {view === 'dictionary' && <DictionaryScreen />}
      {view === 'game' && <GameScreen />}
      {view === 'result' && <ResultScreen />}
    </div>
  );
}