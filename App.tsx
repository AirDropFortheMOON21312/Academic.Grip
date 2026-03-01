import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StudyGuide, TabId, Unit } from './types';
import { generateStudyGuide, FilePayload } from './services/gemini';
import Sidebar, { TABS } from './components/Sidebar';
import UploadZone from './components/UploadZone';
import QuizSection from './components/QuizSection';
import FlashcardDeck from './components/FlashcardDeck';
import CreateUnitModal from './components/CreateUnitModal';
import ToastContainer, { ToastMessage, ToastType } from './components/Toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { saveFiles, deleteUnitFiles, clearAllFiles, getFileByIndex } from './services/storage';
import Dashboard from './components/Dashboard';
import FileManager from './components/FileManager';
import { processFile } from './services/fileProcessor';
import LoginModal from './components/LoginModal';
import { getUser, logout } from './services/auth';
import ImageGenerator from './components/ImageGenerator';
import { 
  BookOpen, 
  Lightbulb, 
  PlayCircle, 
  RotateCcw,
  Download,
  Upload,
  Save,
  Menu,
  FileText,
  Plus,
  Loader2,
  AlertCircle,
  X,
  Key,
  ExternalLink,
  FolderPlus,
  ArrowRight,
  Clock,
  Cpu,
  Settings,
  Search,
  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';

// Loading Messages
const LOADING_MESSAGES = [
  "Initializing Academic Grip v4.1...",
  "Running optical character recognition...",
  "Analyzing semantic density...",
  "Cross-referencing concepts...",
  "Generating active recall matrices...",
  "Synthesizing Feynman models...",
  "Finalizing study suite..."
];

// --- FILE HELPERS ---

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const LOCAL_STORAGE_KEY = 'academic-grip-data-v4';
const LEGACY_STORAGE_KEY = 'academic-grip-data';
const MODEL_STORAGE_KEY = 'gemini_model_pref';
const API_KEY_STORAGE_KEY = 'gemini_api_key';

// --- COMPONENTS ---

const LoadingOverlay: React.FC<{ messages: string[] }> = ({ messages }) => {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-fade-in">
      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full flex flex-col items-center">
        <div className="relative w-20 h-20 mb-6">
            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-indigo-600 animate-pulse" />
            </div>
        </div>
        
        <h3 className="text-lg font-bold text-slate-800 mb-2 text-center min-h-[3rem]">
            {messages[msgIndex]}
        </h3>
        
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-4">
            <div className="h-full bg-indigo-600 animate-[progress_1.5s_ease-in-out_infinite] w-full origin-left transform -translate-x-full"></div>
        </div>
        <p className="text-xs text-slate-400 mt-4 font-medium">Do not close this window</p>
      </div>
    </div>
  );
};

const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void; onClearData: () => void }> = ({ isOpen, onClose, onClearData }) => {
  const [model, setModel] = useState('gemini-3.1-pro-preview');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isValidKey, setIsValidKey] = useState(true);

  // Google API Key Regex: Starts with AIza, followed by 35 alphanumeric/dash/underscore chars
  const API_KEY_REGEX = /^AIza[0-9A-Za-z\-_]{35}$/;

  useEffect(() => {
    if (isOpen) {
      const storedModel = localStorage.getItem(MODEL_STORAGE_KEY) || 'gemini-3.1-pro-preview';
      const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY) || '';
      setModel(storedModel);
      setApiKey(storedKey);
      setSaved(false);
      setIsValidKey(true); // Reset validation on open
    }
  }, [isOpen]);

  const handleKeyChange = (val: string) => {
    setApiKey(val);
    if (val.trim() === '') {
      setIsValidKey(true); // Empty is valid (falls back to env)
    } else {
      setIsValidKey(API_KEY_REGEX.test(val));
    }
  };

  const handleSave = () => {
    if (!isValidKey && apiKey.trim() !== '') return;
    
    localStorage.setItem(MODEL_STORAGE_KEY, model);
    if (apiKey.trim()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
    
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in border border-slate-100">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            Settings
          </h3>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Model Selector */}
          <div>
             <label className="block text-sm font-semibold text-slate-700 mb-2">
              AI Model
            </label>
            <div className="relative">
                <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-800 appearance-none text-base font-medium"
                >
                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Recommended - High Quality)</option>
                    <option value="gemini-3-flash-preview">Gemini 3.0 Flash (Balanced)</option>
                    <option value="gemini-2.5-flash-lite-latest">Gemini 2.5 Flash Lite (Fastest)</option>
                </select>
                 <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <Cpu className="w-5 h-5" />
                </div>
            </div>
             <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              <strong>Note:</strong> Gemini 3.1 Pro offers the best reasoning and note quality. Use Flash Lite for speed.
            </p>
          </div>

          {/* API Key Input */}
          <div>
             <label className="block text-sm font-semibold text-slate-700 mb-2">
              Custom API Key <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
                <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => handleKeyChange(e.target.value)}
                    placeholder="Use env variable by default..."
                    className={`
                      w-full pl-11 pr-12 py-3 bg-slate-50 border rounded-xl outline-none transition-all text-slate-800 text-sm font-mono
                      ${apiKey && isValidKey 
                        ? 'border-green-500 focus:ring-2 focus:ring-green-200' 
                        : apiKey && !isValidKey
                          ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                          : 'border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                      }
                    `}
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <Key className={`w-4 h-4 ${apiKey ? (isValidKey ? 'text-green-500' : 'text-red-500') : 'text-slate-400'}`} />
                </div>
                
                <button 
                  onClick={() => setShowKey(!showKey)}
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
            
            {/* Validation Feedback */}
            <div className="mt-2 min-h-[1.25rem]">
              {apiKey && !isValidKey && (
                <div className="flex items-start gap-1.5 text-red-500 text-xs animate-fade-in">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Invalid Key: Must start with 'AIza' and be 39 characters long.</span>
                </div>
              )}
              {apiKey && isValidKey && (
                <div className="flex items-center gap-1.5 text-green-600 text-xs animate-fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Valid format detected.</span>
                </div>
              )}
              {!apiKey && (
                <p className="text-xs text-slate-400">
                  Leave empty to use the system default key.
                </p>
              )}
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-100">
             <button onClick={onClearData} className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-2 transition-colors">
                <Trash2 className="w-4 h-4" /> Clear All Data
             </button>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-3 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors text-sm">Cancel</button>
          <button 
            onClick={handleSave}
            disabled={!isValidKey && apiKey.trim() !== ''}
            className={`px-6 py-3 rounded-lg font-medium text-white shadow-sm transition-all duration-300 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${saved ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {saved ? 'Saved' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ContentContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="pb-32 md:pb-8">{children}</div>
);

const SearchBar: React.FC<{ activeTab: string; searchQuery: string; setSearchQuery: (q: string) => void }> = ({ activeTab, searchQuery, setSearchQuery }) => (
  <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-xl pb-4 pt-2 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200/50 mb-6 transition-all">
    <div className="relative max-w-xl mx-auto md:mx-0 group">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
      <input 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={`Search ${activeTab === 'overview' ? 'notes' : activeTab}...`}
        className="w-full pl-10 pr-10 py-3 bg-white/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-base shadow-sm hover:bg-white"
      />
      {searchQuery && (
        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  </div>
);

const EmptyState: React.FC<{ message: string; onClear: () => void }> = ({ message, onClear }) => (
  <div className="flex flex-col items-center justify-center py-24 text-slate-400 animate-fade-in px-4 text-center">
    <Search className="w-16 h-16 mb-6 opacity-20" />
    <p className="text-base font-medium text-slate-600">{message}</p>
    <button onClick={onClear} className="mt-6 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors">Clear Search</button>
  </div>
);

// --- MAIN APP ---

const App: React.FC = () => {
  // State
  const [units, setUnits] = useState<Unit[]>([]);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isLoading, setIsLoading] = useState(false);
  
  // Enhanced Error State
  const [errorState, setErrorState] = useState<{message: string; detail?: string; type: 'quota' | 'auth' | 'general'} | null>(null);
  const [showErrorDetail, setShowErrorDetail] = useState(false);
  
  const [translateMode, setTranslateMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateUnitOpen, setIsCreateUnitOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [user, setUser] = useState<any>(getUser());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const pendingFilesRef = useRef<File[]>([]); // Store files for retry

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
    addToast(`Welcome back, ${userData.email}!`, "success");
    // Ideally trigger sync here
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    addToast("Logged out successfully.", "info");
  };

  const handleViewSource = async (index: number) => {
    if (!activeUnitId) return;
    try {
      const blob = await getFileByIndex(activeUnitId, index);
      if (blob) {
        const url = URL.createObjectURL(blob);
        setViewingImage(url);
      } else {
        addToast("Source image not found.", "error");
      }
    } catch (e) {
      console.error(e);
      addToast("Error loading image.", "error");
    }
  };

  const closeImageViewer = () => {
    if (viewingImage) {
      URL.revokeObjectURL(viewingImage);
      setViewingImage(null);
    }
  };

  const addToast = (message: string, type: ToastType) => {
    setToasts(prev => [...prev, { id: generateId(), message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedData) {
      try {
        setUnits(JSON.parse(savedData));
      } catch (e) { console.error("Failed to load v4 data", e); }
    } else {
      const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyData) {
        try {
          const oldData = JSON.parse(legacyData);
          if (oldData.detailedPageNotes) {
            const migratedUnit: Unit = {
              id: generateId(),
              title: "Imported Study Guide",
              createdAt: Date.now(),
              lastUpdated: Date.now(),
              data: oldData,
              fileCount: oldData.detailedPageNotes.length
            };
            setUnits([migratedUnit]);
            setActiveUnitId(migratedUnit.id);
            localStorage.removeItem(LEGACY_STORAGE_KEY);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([migratedUnit]));
            addToast("Legacy data successfully migrated!", "success");
          }
        } catch (e) { console.error("Legacy migration failed", e); }
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(units));
  }, [units]);

  const activeUnit = units.find(u => u.id === activeUnitId);

  useEffect(() => {
    setSearchQuery('');
  }, [activeUnitId, activeTab]);

  const filteredData = useMemo(() => {
    if (!activeUnit?.data) return null;
    const data = activeUnit.data;
    
    // Map notes to preserve original index for "View Source"
    const allNotes = data.detailedPageNotes.map((note, index) => ({ content: note, index }));
    
    const query = searchQuery.toLowerCase();
    if (!query) return { ...data, displayNotes: allNotes };
    
    return {
      ...data,
      detailedPageNotes: data.detailedPageNotes.filter(note => note.toLowerCase().includes(query)),
      displayNotes: allNotes.filter(item => item.content.toLowerCase().includes(query)),
      conceptMap: data.conceptMap.filter(concept => concept.toLowerCase().includes(query)),
      quiz: data.quiz.filter(q => q.question.toLowerCase().includes(query) || q.answer.toLowerCase().includes(query)),
      flashcards: data.flashcards.filter(card => card.front.toLowerCase().includes(query) || card.back.toLowerCase().includes(query)),
      feynmanExplanation: data.feynmanExplanation,
      audioScript: data.audioScript
    };
  }, [activeUnit, searchQuery]);

  const confirmCreateUnit = (name: string) => {
    const newUnit: Unit = {
      id: generateId(),
      title: name,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      data: null,
      fileCount: 0
    };
    setUnits(prev => [...prev, newUnit]);
    setActiveUnitId(newUnit.id);
    setActiveTab('overview');
    addToast(`Unit "${name}" created!`, "success");
  };

  const handleFileUpload = async (files: File[], translate: boolean, forceModel?: string) => {
    if (files.length === 0 || !activeUnitId) return;

    // Store for retry
    pendingFilesRef.current = files;

    setIsLoading(true);
    setErrorState(null);
    setShowErrorDetail(false);
    setTranslateMode(translate);

    // Sort files numerically
    const sortedFiles = Array.from(files).sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    try {
      // Save original files to IndexedDB
      const currentUnit = units.find(u => u.id === activeUnitId);
      // Use the current fileCount as the startIndex for new files
      const startIndex = currentUnit?.fileCount || 0;
      await saveFiles(activeUnitId, sortedFiles, startIndex);

      const filePromises = sortedFiles.map(processFile);
      
      const fileDataList = await Promise.all(filePromises);
      
      const pageOffset = currentUnit?.data?.detailedPageNotes.length || 0;

      const result = await generateStudyGuide(fileDataList, translate, pageOffset, forceModel);
      
      setUnits(prev => prev.map(u => {
        if (u.id !== activeUnitId) return u;
        if (!u.data) {
          return {
            ...u,
            lastUpdated: Date.now(),
            fileCount: u.fileCount + files.length,
            data: result
          };
        }
        const prevData = u.data;
        const oldWeight = prevData.detailedPageNotes.length;
        const newWeight = result.detailedPageNotes.length;
        const totalWeight = oldWeight + newWeight;
        const newScore = Math.round(((prevData.confidence.score * oldWeight) + (result.confidence.score * newWeight)) / totalWeight);

        return {
          ...u,
          lastUpdated: Date.now(),
          fileCount: u.fileCount + files.length,
          data: {
            ...prevData,
            summary: prevData.summary + "\n\n--- [NEW BATCH] ---\n\n" + result.summary,
            detailedPageNotes: [...prevData.detailedPageNotes, ...result.detailedPageNotes],
            conceptMap: [...new Set([...prevData.conceptMap, ...result.conceptMap])],
            quiz: [...prevData.quiz, ...result.quiz],
            flashcards: [...prevData.flashcards, ...result.flashcards],
            feynmanExplanation: prevData.feynmanExplanation + "\n\n" + result.feynmanExplanation,
            audioScript: prevData.audioScript + "\n\n" + result.audioScript,
            confidence: {
              score: newScore,
              reasoning: prevData.confidence.reasoning + "\n" + result.confidence.reasoning
            }
          }
        };
      }));
      
      addToast("Analysis complete!", "success");
      
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Clear pending
      pendingFilesRef.current = [];

    } catch (err: any) {
      console.error("Upload Error:", err);
      let errorMsg = err.message || "Unknown error occurred";
      let errorType: 'quota' | 'auth' | 'general' = 'general';
      let errorDetail = JSON.stringify(err, null, 2);

      if (errorMsg.includes("QUOTA") || errorMsg.includes("429")) {
        errorMsg = "Usage Limit Reached. The selected AI model is currently overloaded or you have hit the daily free tier limit.";
        errorType = 'quota';
      } else if (errorMsg.includes("API_KEY") || errorMsg.includes("403")) {
        errorMsg = "Authentication Failed. Please check your API Key configuration.";
        errorType = 'auth';
      } else if (errorMsg.includes("Candidate was stopped") || errorMsg.includes("Safety")) {
         errorMsg = "Content blocked by safety filters. Please try a different document.";
      }

      setErrorState({ message: errorMsg, detail: errorDetail, type: errorType });
      addToast("Failed to process files.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryWithFlash = () => {
    if (pendingFilesRef.current.length > 0) {
      // Force use of gemini-3-flash-preview
      handleFileUpload(pendingFilesRef.current, translateMode, 'gemini-3-flash-preview');
    }
  };

  const handleAddMoreFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const files = Array.from(e.target.files) as File[];
        handleFileUpload(files, translateMode);
    }
    e.target.value = '';
  };

  const handleDeleteUnit = async () => {
    if (!activeUnitId) return;
    if (window.confirm("Delete this unit and all its data?")) {
      await deleteUnitFiles(activeUnitId);
      const newUnits = units.filter(u => u.id !== activeUnitId);
      setUnits(newUnits);
      setActiveUnitId(null);
      addToast("Unit deleted.", "info");
    }
  };

  const handleClearData = async () => {
    if (window.confirm("WARNING: This will delete ALL units and uploaded files. This action cannot be undone.")) {
      await clearAllFiles();
      localStorage.clear();
      setUnits([]);
      setActiveUnitId(null);
      addToast("All data cleared.", "info");
      window.location.reload();
    }
  };

  const handleExport = () => {
    if (!activeUnit?.data) return;
    const blob = new Blob([JSON.stringify(activeUnit.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeUnit.title.replace(/\s+/g, '-').toLowerCase()}-study-guide.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast("Export started!", "success");
  };

  const renderContent = () => {
    if (!filteredData) return null;
    
    const content = (() => {
      switch (activeTab) {
        case 'overview':
          return (
            <ContentContainer>
              <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
                <SearchBar activeTab={activeTab} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
                {!searchQuery && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-6">
                      <div className="relative flex-shrink-0">
                          <svg className="w-20 h-20 transform -rotate-90">
                          <circle className="text-slate-100" strokeWidth="6" stroke="currentColor" fill="transparent" r="36" cx="40" cy="40" />
                          <circle className={`${filteredData.confidence.score > 70 ? 'text-green-500' : 'text-amber-500'} transition-all duration-1000`} strokeWidth="6" strokeDasharray={226} strokeDashoffset={226 - (226 * filteredData.confidence.score) / 100} strokeLinecap="round" stroke="currentColor" fill="transparent" r="36" cx="40" cy="40" />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center"><span className="text-xl font-bold text-slate-800">{filteredData.confidence.score}%</span></div>
                      </div>
                      <div><h3 className="font-bold text-slate-800">Quality Score</h3><p className="text-xs text-slate-500 mt-1 line-clamp-2">{filteredData.confidence.reasoning}</p></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-500">Total Material</span><span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">Active</span></div>
                        <div className="flex items-baseline gap-2"><span className="text-3xl font-bold text-slate-800">{filteredData.detailedPageNotes.length}</span><span className="text-sm text-slate-500">Sections</span></div>
                         <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden"><div className="h-full bg-indigo-500 w-full animate-pulse"></div></div>
                    </div>
                  </div>
                )}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 px-2"><BookOpen className="w-6 h-6 text-indigo-600" /><h2 className="text-xl font-bold text-slate-800">{searchQuery ? `Found ${filteredData.displayNotes.length} matching notes` : 'Core Notes'}</h2></div>

                  {filteredData.displayNotes.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                        <div className="bg-slate-50 p-4 rounded-full inline-flex mb-4">
                            <Search className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-slate-500 font-medium">No notes match your search.</p>
                        <button onClick={() => setSearchQuery('')} className="text-indigo-600 font-bold text-sm mt-2 hover:underline">Clear Search</button>
                    </div>
                  ) : (
                    filteredData.displayNotes.map((item, i) => (
                        <div key={i} className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-100 animate-fade-in relative overflow-hidden group hover:shadow-md transition-all duration-300">
                            <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
                                <div className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 border border-indigo-100">
                                    <FileText className="w-3.5 h-3.5" />
                                    Note {item.index + 1}
                                </div>
                                <button 
                                    onClick={() => handleViewSource(item.index)}
                                    className="text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Eye className="w-3.5 h-3.5" /> View Source
                                </button>
                            </div>
                            <div className="prose prose-slate prose-lg max-w-none text-slate-600 leading-relaxed">
                               <ReactMarkdown 
                                  remarkPlugins={[remarkGfm]} 
                                  components={{
                                    h1: (props) => <h1 className="text-3xl font-bold mb-6 text-slate-900 tracking-tight border-b border-slate-100 pb-4" {...props} />,
                                    h2: (props) => <h2 className="text-2xl font-bold mt-10 mb-4 text-slate-800 flex items-center gap-2" {...props} />,
                                    h3: (props) => <h3 className="text-xl font-semibold mt-8 mb-3 text-slate-800" {...props} />,
                                    p: (props) => <p className="mb-6 leading-7" {...props} />,
                                    ul: (props) => <ul className="list-disc pl-6 space-y-2 my-6 text-slate-600 marker:text-indigo-400" {...props} />,
                                    ol: (props) => <ol className="list-decimal pl-6 space-y-2 my-6 text-slate-600 marker:text-indigo-500 marker:font-bold" {...props} />,
                                    li: (props) => <li className="pl-2" {...props} />,
                                    strong: (props) => <strong className="font-bold text-slate-900 bg-indigo-50/50 px-1 rounded" {...props} />,
                                    a: (props) => <a className="text-indigo-600 font-medium hover:underline decoration-2 underline-offset-2" {...props} />,
                                    blockquote: (props) => <blockquote className="border-l-4 border-indigo-400 pl-6 py-2 my-8 bg-slate-50 italic text-slate-700 rounded-r-lg shadow-sm" {...props} />,
                                    code: ({node, inline, className, children, ...props}: any) => {
                                        return inline ? 
                                          <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono font-medium border border-slate-200" {...props}>{children}</code> :
                                          <pre className="bg-slate-900 text-slate-50 p-6 rounded-xl overflow-x-auto my-6 text-sm font-mono shadow-inner border border-slate-800"><code className="bg-transparent" {...props}>{children}</code></pre>
                                    },
                                    table: (props) => <div className="overflow-x-auto my-8 rounded-xl border border-slate-200 shadow-sm"><table className="min-w-full divide-y divide-slate-200" {...props} /></div>,
                                    thead: (props) => <thead className="bg-slate-50" {...props} />,
                                    th: (props) => <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider" {...props} />,
                                    td: (props) => <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 border-t border-slate-100" {...props} />,
                                    hr: (props) => <hr className="my-10 border-slate-200" {...props} />
                                  }}
                                >
                                  {item.content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ))
                  )}

      {viewingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={closeImageViewer}>
            <button onClick={closeImageViewer} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
                <X className="w-8 h-8" />
            </button>
            <img src={viewingImage} alt="Source" className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

                </div>
                {!searchQuery && (
                  <div className="flex justify-center pt-4">
                    <button onClick={() => addMoreInputRef.current?.click()} className="flex items-center gap-3 px-6 py-4 bg-white border-2 border-dashed border-indigo-200 rounded-xl text-indigo-600 font-semibold hover:bg-indigo-50 hover:border-indigo-300 transition-all group w-full md:w-auto justify-center active:scale-95">
                      <div className="bg-indigo-100 p-2 rounded-lg group-hover:bg-indigo-200 transition-colors"><Plus className="w-5 h-5" /></div><span>Add More Material</span>
                    </button>
                  </div>
                )}
              </div>
            </ContentContainer>
          );
        case 'files':
          return (
            <ContentContainer>
               {activeUnitId && <FileManager unitId={activeUnitId} />}
            </ContentContainer>
          );
        case 'concepts': return <ContentContainer><div className="max-w-5xl mx-auto animate-fade-in"><SearchBar activeTab={activeTab} searchQuery={searchQuery} setSearchQuery={setSearchQuery} /><div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100"><div className="flex items-center gap-3 mb-6"><Lightbulb className="w-6 h-6 text-amber-500" /><h2 className="text-2xl font-bold text-slate-800">Concept Map</h2></div>{filteredData.conceptMap.length === 0 ? <EmptyState message="No concepts match your search." onClear={() => setSearchQuery('')} /> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filteredData.conceptMap.map((concept, idx) => (<div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors flex items-start gap-3"><div className="w-2 h-2 rounded-full bg-indigo-400 mt-2 flex-shrink-0"></div><span className="text-slate-700 font-medium text-sm leading-relaxed">{concept}</span></div>))}</div>}</div></div></ContentContainer>;
        case 'quiz': return <ContentContainer><div className="max-w-5xl mx-auto"><SearchBar activeTab={activeTab} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />{filteredData.quiz.length === 0 ? <EmptyState message="No questions match your search." onClear={() => setSearchQuery('')} /> : <QuizSection questions={filteredData.quiz} />}</div></ContentContainer>;
        case 'feynman': return <ContentContainer><div className="max-w-4xl mx-auto animate-fade-in"><SearchBar activeTab={activeTab} searchQuery={searchQuery} setSearchQuery={setSearchQuery} /><div className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white p-8 md:p-12 rounded-2xl shadow-xl"><h2 className="text-2xl md:text-3xl font-bold mb-2">The Feynman Technique</h2><p className="text-indigo-200 mb-8">Deep understanding through simplification.</p><div className="bg-white/10 p-6 md:p-8 rounded-xl backdrop-blur-sm border border-white/10 text-white"><div className="prose prose-invert prose-lg max-w-none leading-relaxed font-light tracking-wide"><ReactMarkdown components={{ p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} /> }}>{filteredData.feynmanExplanation}</ReactMarkdown></div></div></div></div></ContentContainer>;
        case 'flashcards': return <ContentContainer><div className="max-w-6xl mx-auto"><SearchBar activeTab={activeTab} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />{filteredData.flashcards.length === 0 ? <EmptyState message="No flashcards match your search." onClear={() => setSearchQuery('')} /> : <FlashcardDeck cards={filteredData.flashcards} />}</div></ContentContainer>;
        case 'script': return <ContentContainer><div className="max-w-4xl mx-auto animate-fade-in"><SearchBar activeTab={activeTab} searchQuery={searchQuery} setSearchQuery={setSearchQuery} /><div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100"><div className="flex items-center gap-3 mb-6"><PlayCircle className="w-6 h-6 text-rose-500" /><h2 className="text-xl font-bold text-slate-800">Audio Script</h2></div><div className="prose prose-slate max-w-none"><div className="bg-slate-50 p-6 rounded-xl border border-slate-200 font-mono text-sm text-slate-700 whitespace-pre-wrap leading-loose">{filteredData.audioScript}</div></div></div></div></ContentContainer>;
        case 'image-gen': return <ContentContainer><div className="max-w-4xl mx-auto animate-fade-in"><ImageGenerator /></div></ContentContainer>;
        default: return null;
      }
    })();

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {isLoading && <LoadingOverlay messages={LOADING_MESSAGES} />}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onClearData={handleClearData} />
      <CreateUnitModal isOpen={isCreateUnitOpen} onClose={() => setIsCreateUnitOpen(false)} onCreate={confirmCreateUnit} />
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onSuccess={handleLoginSuccess} />
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
      
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        disabled={!activeUnit?.data && !isLoading} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        units={units}
        activeUnitId={activeUnitId}
        onSelectUnit={setActiveUnitId}
        onCreateUnit={() => setIsCreateUnitOpen(true)}
        onBackToDashboard={() => { setActiveUnitId(null); setActiveTab('overview'); }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
        onLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
      />
      
      <main className="flex-1 h-full overflow-hidden flex flex-col relative w-full bg-slate-50/50">
        <header className="bg-white h-16 border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shadow-sm shrink-0 z-30">
          <div className="flex items-center gap-2 md:hidden cursor-pointer" onClick={() => setActiveUnitId(null)}>
             <div className="bg-indigo-600 p-2 rounded-xl shadow-sm"><BookOpen className="w-5 h-5 text-white" /></div>
             <span className="font-bold text-slate-800 text-lg tracking-tight">Academic Grip</span>
          </div>
          <h1 className="hidden md:block text-lg font-semibold text-slate-700 truncate max-w-md">{activeUnit ? activeUnit.title : 'Study Dashboard'}</h1>
          <div className="flex items-center gap-3">
            {activeUnitId && <button onClick={() => setActiveUnitId(null)} className="md:hidden text-sm font-medium text-slate-500 mr-2 active:text-indigo-600">Back</button>}
            <input type="file" ref={addMoreInputRef} onChange={handleAddMoreFiles} accept=".pdf,image/png,image/jpeg,image/webp,.txt,.md,.csv,.json" multiple className="hidden" />
            {activeUnit?.data && (
                <>
                <button onClick={() => addMoreInputRef.current?.click()} className="hidden md:flex items-center gap-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg transition-colors shadow-sm"><Plus className="w-4 h-4" /><span>Add Material</span></button>
                <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>
                <button onClick={handleExport} className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors hidden sm:block" title="Export JSON"><Download className="w-5 h-5" /></button>
                <button onClick={handleDeleteUnit} className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"><RotateCcw className="w-4 h-4" /><span>Delete Unit</span></button>
                </>
            )}
             <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-500 hover:text-slate-800">
                <Menu className="w-6 h-6" />
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 scroll-smooth">
          {activeUnitId ? (
            activeUnit?.data ? (
              renderContent()
            ) : (
              <div className="h-full flex flex-col items-center justify-center animate-fade-in">
                 {errorState ? (
                    <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-red-100 text-center">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Analysis Failed</h3>
                        <p className="text-slate-600 mb-6 leading-relaxed">{errorState.message}</p>
                        
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => document.getElementById('file-upload-input')?.click()}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                Try Different Files
                            </button>
                            
                            {errorState.type === 'quota' && (
                                <button 
                                    onClick={handleRetryWithFlash}
                                    className="w-full py-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-semibold hover:bg-amber-100 transition-colors"
                                >
                                    Retry with Faster Model (Flash)
                                </button>
                            )}
                            
                            <button 
                                onClick={() => setShowErrorDetail(!showErrorDetail)}
                                className="text-xs text-slate-400 hover:text-slate-600 mt-2 underline"
                            >
                                {showErrorDetail ? 'Hide Details' : 'Show Technical Details'}
                            </button>
                        </div>
                        
                        {showErrorDetail && (
                            <div className="mt-6 text-left bg-slate-900 rounded-xl p-4 overflow-x-auto">
                                <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{errorState.detail}</pre>
                            </div>
                        )}
                    </div>
                 ) : (
                    <UploadZone onFileSelect={(files, translate) => handleFileUpload(files, translate)} isProcessing={isLoading} />
                 )}
              </div>
            )
          ) : (
            <Dashboard 
                units={units} 
                onSelectUnit={setActiveUnitId} 
                onCreateUnit={() => setIsCreateUnitOpen(true)}
                onDeleteUnit={async (id) => {
                    if (window.confirm("Delete this unit?")) {
                        await deleteUnitFiles(id);
                        setUnits(prev => prev.filter(u => u.id !== id));
                        addToast("Unit deleted", "info");
                    }
                }}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
