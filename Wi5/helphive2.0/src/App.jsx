
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp,
  query,
  orderBy 
} from 'firebase/firestore';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  MapPin, 
  Camera, 
  Zap, 
  Droplets, 
  Trash2, 
  Hammer, 
  Search, 
  BarChart3, 
  User, 
  ShieldCheck,
  Menu,
  X,
  Plus,
  Briefcase,
  IdCard,
  Sparkles,
  Wrench
} from 'lucide-react';

// ==========================================
// CONFIGURATION SECTION (FILL THIS IN!)
// ==========================================

const firebaseConfig = {
  
  apiKey: "AIzaSyAWgvLYYIlq1foF8jNnMWML3H1G3717S3c",
  authDomain: "helphive-1668a.firebaseapp.com",
  projectId: "helphive-1668a",
  storageBucket: "helphive-1668a.firebasestorage.app",
  messagingSenderId: "317009978430",
  appId: "1:317009978430:web:485a366b8bbf5907865d6f"
};

// IMPORTANT: You still need to paste your Gemini Key here!
const GEMINI_API_KEY = "AIzaSyB3i1I_cf-i4efWw2OFJUGd6vRo-Eb1elI"; 

// ==========================================
// END CONFIGURATION
// ==========================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'helphive-hackathon-demo'; 

// --- Gemini API Helper ---
const callGemini = async (prompt) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("PASTE_")) {
     console.error("Gemini API Key is missing!");
     return "Error: AI Key is missing in App.jsx code.";
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error communicating with AI service.";
  }
};

// --- Utility: Smart Categorization & Routing Logic ---
const detectCategory = (text) => {
  const lowerText = text.toLowerCase();
  if (lowerText.match(/water|leak|drip|flush|sink|toilet|tap|pipe|plumb/)) return 'Plumbing';
  if (lowerText.match(/light|spark|switch|fan|wire|power|electric|dark|ac|air condition/)) return 'Electrical';
  if (lowerText.match(/desk|chair|window|door|lock|handle|break|broken|bench/)) return 'Furniture';
  if (lowerText.match(/dirt|dust|trash|bin|smell|stain|clean|mess|garbage/)) return 'Cleaning';
  if (lowerText.match(/wifi|net|computer|server|slow|login|internet|projector/)) return 'IT';
  return 'General';
};

const CATEGORIES = {
  Plumbing: { color: 'bg-blue-100 text-blue-700', icon: Droplets },
  Electrical: { color: 'bg-yellow-100 text-yellow-700', icon: Zap },
  Furniture: { color: 'bg-orange-100 text-orange-700', icon: Hammer },
  Cleaning: { color: 'bg-green-100 text-green-700', icon: Trash2 },
  IT: { color: 'bg-purple-100 text-purple-700', icon: BarChart3 }, 
  General: { color: 'bg-gray-100 text-gray-700', icon: AlertTriangle },
};

const STATUS_STEPS = ['Reported', 'Assigned', 'In Progress', 'Resolved'];

// --- Main Application Component ---
export default function HelpHiveApp() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [issues, setIssues] = useState([]);
  const [role, setRole] = useState('student'); 
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Faculty State
  const [showFacultyLogin, setShowFacultyLogin] = useState(false);
  const [facultyProfile, setFacultyProfile] = useState(null);

  // --- Auth & Data Fetching ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const q = collection(db, 'helphive_issues'); 
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedIssues = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      fetchedIssues.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setIssues(fetchedIssues);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching issues:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Actions ---
  const handleSubmitIssue = async (issueData) => {
    if (!user) {
        alert("⚠️ Error: You are not logged in yet. Please check your internet connection.");
        return;
    }
    try {
      await addDoc(collection(db, 'helphive_issues'), {
        ...issueData,
        userId: user.uid,
        status: 'Reported',
        timestamp: serverTimestamp(),
        upvotes: 0
      });
      alert("✅ Report Submitted Successfully!");
      setView('feed');
    } catch (e) {
      console.error("Error submitting:", e);
      alert(`❌ Submission Failed: ${e.message}. (Check if your Ad Blocker is on!)`);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      const issueRef = doc(db, 'helphive_issues', id);
      await updateDoc(issueRef, { status: newStatus });
    } catch (e) {
      console.error("Error updating status:", e);
    }
  };

  const handleFacultyLogin = (profile) => {
    setFacultyProfile(profile);
    setRole('admin');
    setShowFacultyLogin(false);
    setView('admin');
  };

  const handleLogout = () => {
    setRole('student');
    setFacultyProfile(null);
    setView('home');
  };

  // --- Navigation Render ---
  const Navbar = () => (
    <nav className="bg-[#2A4D9C] text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center cursor-pointer" onClick={() => setView('home')}>
            <div className="bg-white p-1.5 rounded-lg mr-2">
              <Hammer className="h-6 w-6 text-[#2A4D9C]" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight leading-none">HelpHive</span>
              <span className="text-[10px] text-blue-100 tracking-wider">SILICON UNIVERSITY</span>
            </div>
          </div>
          
          <div className="hidden md:flex space-x-4 items-center">
            <NavBtn active={view === 'report'} onClick={() => setView('report')}>Report Issue</NavBtn>
            <NavBtn active={view === 'feed'} onClick={() => setView('feed')}>Live Feed</NavBtn>
            
            {role === 'admin' && (
               <NavBtn active={view === 'admin'} onClick={() => setView('admin')}>My Dashboard</NavBtn>
            )}
            
            <div className="ml-4 pl-4 border-l border-blue-400">
              {role === 'student' ? (
                <button 
                  onClick={() => setShowFacultyLogin(true)}
                  className="px-4 py-1.5 rounded-full text-xs font-bold bg-white text-[#2A4D9C] hover:bg-blue-50 transition-colors shadow-sm"
                >
                  Faculty Login
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-blue-200 font-mono">
                    {facultyProfile?.name} • {facultyProfile?.expertise}
                  </span>
                  <button 
                    onClick={handleLogout}
                    className="px-3 py-1 rounded-full text-xs font-bold border border-blue-300 text-blue-100 hover:bg-[#1e3a7a]"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="md:hidden flex items-center">
            {/* ACCESSIBILITY FIX: Added aria-label */}
            <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
                className="text-blue-100 hover:text-white"
                aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>
      
      {isMobileMenuOpen && (
        <div className="md:hidden bg-[#1e3a7a] pb-4 px-4">
          <MobileNavBtn onClick={() => { setView('report'); setIsMobileMenuOpen(false); }}>Report Issue</MobileNavBtn>
          <MobileNavBtn onClick={() => { setView('feed'); setIsMobileMenuOpen(false); }}>Live Feed</MobileNavBtn>
          {role === 'admin' && (
             <MobileNavBtn onClick={() => { setView('admin'); setIsMobileMenuOpen(false); }}>Admin Dashboard</MobileNavBtn>
          )}
          <div className="mt-4 pt-4 border-t border-blue-800">
             {role === 'student' ? (
                <button 
                  onClick={() => { setShowFacultyLogin(true); setIsMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-amber-400 font-bold"
                >
                  Faculty Login
                </button>
             ) : (
                <button 
                  onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-red-300 font-bold"
                >
                  Logout (Faculty)
                </button>
             )}
          </div>
        </div>
      , [])}
    </nav>
  );

  if (showFacultyLogin) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <Navbar />
        <FacultyLoginModal 
          onLogin={handleFacultyLogin} 
          onCancel={() => setShowFacultyLogin(false)} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {view === 'home' && <LandingPage onViewChange={setView} />}
        {view === 'report' && <ReportPage onSubmit={handleSubmitIssue} />}
        {view === 'feed' && <FeedPage issues={issues} />}
        {view === 'admin' && (
          <AdminPage 
            issues={issues} 
            updateStatus={updateStatus} 
            role={role} 
            facultyProfile={facultyProfile}
          />
        )}
      </main>
    </div>
  );
}

// --- Sub-Components ---

function NavBtn({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active 
        ? 'bg-[#1e3a7a] text-amber-400' 
        : 'text-blue-100 hover:bg-[#1e3a7a] hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function MobileNavBtn({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-blue-100 hover:text-white hover:bg-[#1e3a7a]"
    >
      {children}
    </button>
  );
}

function FacultyLoginModal({ onLogin, onCancel }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [expertise, setExpertise] = useState('Plumbing');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (id && name) {
      onLogin({ id, name, expertise });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-[#2A4D9C] p-6 text-center">
          <Briefcase className="w-10 h-10 text-white mx-auto mb-2" />
          <h2 className="text-xl font-bold text-white">Faculty Registration</h2>
          <p className="text-blue-200 text-sm">Please verify your credentials to access tickets.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="faculty-id" className="block text-sm font-semibold text-slate-700 mb-1">College Faculty ID</label>
            <input 
              id="faculty-id"
              type="text" 
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. SIL-FAC-001"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#2A4D9C]"
              required 
            />
          </div>
          <div>
            <label htmlFor="faculty-name" className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
            <input 
              id="faculty-name"
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prof. Name"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#2A4D9C]"
              required 
            />
          </div>
          <div>
            <label htmlFor="faculty-expertise" className="block text-sm font-semibold text-slate-700 mb-1">Area of Expertise</label>
            <select 
              id="faculty-expertise"
              value={expertise}
              onChange={(e) => setExpertise(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#2A4D9C] bg-white"
            >
              {Object.keys(CATEGORIES).map(cat => (
                <option key={cat} value={cat}>{cat} Department</option>
              ))}
            </select>
          </div>
          
          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 px-4 py-2 rounded-lg bg-[#2A4D9C] text-white font-bold hover:bg-[#1e3a7a]"
            >
              Register & Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LandingPage({ onViewChange }) {
  return (
    <div className="flex flex-col items-center justify-center pt-10 pb-20 text-center">
      <div className="bg-blue-50 p-4 rounded-full mb-6 animate-bounce-slow">
        <Hammer className="h-12 w-12 text-[#2A4D9C]" />
      </div>
      <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6">
        Silicon University <span className="text-[#2A4D9C]">HelpHive</span>
      </h1>
      <p className="text-xl text-slate-600 max-w-2xl mb-10">
        A dedicated portal for Silicon students to report campus issues. 
        Automatically routed to the right faculty member for a quicker fix.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <button 
          onClick={() => onViewChange('report')}
          className="flex-1 bg-[#2A4D9C] hover:bg-[#1e3a7a] text-white text-lg font-bold py-4 px-8 rounded-xl shadow-lg transition-transform transform hover:-translate-y-1 flex items-center justify-center gap-2"
        >
          <Camera className="w-5 h-5" /> Report Issue
        </button>
        <button 
          onClick={() => onViewChange('feed')}
          className="flex-1 bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-200 text-lg font-bold py-4 px-8 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
        >
          <Search className="w-5 h-5" /> Track Status
        </button>
      </div>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
        <FeatureCard 
          icon={<User className="w-6 h-6 text-[#2A4D9C]"/>} 
          title="Faculty Routing" 
        />
        <FeatureCard 
          icon={<MapPin className="w-6 h-6 text-[#2A4D9C]"/>} 
          title="Silicon Map" 
        />
        <FeatureCard 
          icon={<CheckCircle className="w-6 h-6 text-[#2A4D9C]"/>} 
          title="Live Updates" 
        />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center h-40 hover:shadow-md transition-shadow">
      <div className="bg-blue-50 p-4 rounded-full mb-4">
        {icon}
      </div>
      <h3 className="font-bold text-lg text-slate-800">{title}</h3>
    </div>
  );
}

function ReportPage({ onSubmit }) {
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('General');
  const [location, setLocation] = useState('');
  const [sic, setSic] = useState('');
  const [selectedZone, setSelectedZone] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Auto-detect category when description changes
  useEffect(() => {
    if (desc.length > 3) {
      setCategory(detectCategory(desc));
    }
  }, [desc]);

  const handleEnhanceDescription = async () => {
    if (!desc || desc.length < 5) return;
    setIsEnhancing(true);
    const enhanced = await callGemini(
      `Rewrite this campus maintenance issue description to be clear, professional, and detailed for a facility manager. Keep it under 50 words. Original: "${desc}"`
    );
    setDesc(enhanced.replace(/^"|"$/g, '')); 
    setIsEnhancing(false);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size exceeds 5MB limit.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!desc || !location || !sic) return;
    setLoading(true);
    setTimeout(() => {
      onSubmit({
        description: desc,
        category,
        location,
        sic,
        zoneCode: selectedZone,
        imageUrl: photoPreview || `https://api.dicebear.com/7.x/shapes/svg?seed=${Date.now()}` 
      });
      setLoading(false);
    }, 800);
  };

  const zones = [
    { id: 'G1', name: 'Gate 1', class: 'bg-slate-100 border-slate-300' },
    { id: 'G2', name: 'Gate 2', class: 'bg-slate-100 border-slate-300' },
    { id: 'G3', name: 'Gate 3', class: 'bg-slate-100 border-slate-300' },
    { id: 'CSE', name: 'CSE Building', class: 'bg-cyan-100 border-cyan-300' },
    { id: 'ECE', name: 'ECE Building', class: 'bg-blue-100 border-blue-300' },
    { id: 'EEE', name: 'EEE Building', class: 'bg-yellow-100 border-yellow-300' },
    { id: 'LIB', name: 'Library', class: 'bg-indigo-100 border-indigo-300' },
    { id: 'LIBC', name: 'Library Corridor', class: 'bg-indigo-50 border-indigo-200' },
    { id: 'SKY', name: 'Sky Lab', class: 'bg-sky-100 border-sky-300' },
    { id: 'NL', name: 'North Lawn', class: 'bg-green-100 border-green-300' },
    { id: 'SL', name: 'South Lawn', class: 'bg-green-100 border-green-300' },
    { id: 'SPORT', name: 'Sports Complex', class: 'bg-emerald-100 border-emerald-300' },
    { id: 'GYM', name: 'Gym', class: 'bg-red-100 border-red-300' },
    { id: 'VC', name: 'Veg Canteen', class: 'bg-orange-100 border-orange-300' },
    { id: 'NVC', name: 'Non-Veg Canteen', class: 'bg-orange-100 border-orange-300' },
    { id: '4C', name: '4th Year Canteen', class: 'bg-orange-50 border-orange-200' },
    { id: 'CAF', name: 'Cafeteria', class: 'bg-amber-100 border-amber-300' },
    { id: 'SC', name: 'Staff Canteen', class: 'bg-amber-100 border-amber-300' },
    { id: 'ABD', name: 'ABD Shop', class: 'bg-purple-100 border-purple-300' },
    { id: 'BH1', name: 'Boys Hostel 1', class: 'bg-teal-100 border-teal-300' },
    { id: 'BH2', name: 'Boys Hostel 2', class: 'bg-teal-100 border-teal-300' },
    { id: 'GH', name: 'Girls Hostel', class: 'bg-pink-100 border-pink-300' },
    { id: 'GST', name: 'Guest House', class: 'bg-stone-100 border-stone-300' },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-[#2A4D9C] px-6 py-4 border-b border-blue-900 flex items-center gap-3">
          <div className="bg-white p-2 rounded-full">
            <Plus className="w-5 h-5 text-[#2A4D9C]" />
          </div>
          <h2 className="text-xl font-bold text-white">New Report - Silicon University</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* SIC Input */}
          <div>
            {/* ACCESSIBILITY FIX: Added htmlFor and id */}
            <label htmlFor="sic-input" className="block text-sm font-semibold text-slate-700 mb-2">
              SIC No. (Student ID)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <IdCard className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="sic-input"
                type="text"
                value={sic}
                onChange={(e) => setSic(e.target.value.toUpperCase())}
                placeholder="e.g. 21BTECH001"
                className="w-full pl-10 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#2A4D9C] transition-all"
                required
              />
            </div>
          </div>

          {/* Description Input */}
          <div>
            <div className="flex justify-between items-center mb-2">
              {/* ACCESSIBILITY FIX: Added htmlFor and id */}
              <label htmlFor="desc-input" className="block text-sm font-semibold text-slate-700">
                Problem Description
              </label>
              {desc.length > 5 && (
                <button
                  type="button"
                  onClick={handleEnhanceDescription}
                  disabled={isEnhancing}
                  className="text-xs flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-md hover:bg-amber-100 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  {isEnhancing ? 'Enhancing...' : 'AI Enhance'}
                </button>
              )}
            </div>
            <textarea
              id="desc-input"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Describe the issue... (Important: Please include Room No, Floor No, Wing, etc.)"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#2A4D9C] transition-all h-24 resize-none"
              required
            />
            {desc.length > 3 && (
              <div className="mt-2 flex flex-wrap gap-2 text-sm animate-fade-in">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 w-full">
                  <span className="text-slate-500 text-xs uppercase tracking-wide">Category Detected:</span>
                  <span className={`px-2 py-0.5 rounded-md font-bold text-xs ${CATEGORIES[category]?.color || 'bg-gray-100'}`}>
                    {category}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Silicon Map Picker */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Tap Location on Campus Map
            </label>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-80 overflow-y-auto mb-3 pr-1">
                {zones.map((zone) => (
                  <button
                    type="button"
                    key={zone.id}
                    onClick={() => {
                      setSelectedZone(zone.id);
                      setLocation(zone.name);
                    }}
                    className={`${zone.class} min-h-[60px] rounded-lg border-2 p-2 flex flex-col items-center justify-center transition-all hover:brightness-95 ${selectedZone === zone.id ? 'ring-4 ring-[#2A4D9C] scale-[0.98] z-10' : 'opacity-80 hover:opacity-100'}`}
                  >
                    <MapPin className={`w-4 h-4 mb-1 ${selectedZone === zone.id ? 'text-[#2A4D9C]' : 'text-slate-500'}`} />
                    <span className="text-[10px] font-bold text-center leading-tight text-slate-700">{zone.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Photo Upload Section */}
          <div>
            {/* ACCESSIBILITY FIX: Added htmlFor and id */}
            <label htmlFor="photo-upload" className="block text-sm font-semibold text-slate-700 mb-2">
              Add Photo (Max 5MB)
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer relative bg-slate-50 min-h-[120px]">
              <input 
                id="photo-upload"
                type="file" 
                accept="image/*" 
                onChange={handlePhotoChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                title="Upload an image" // Additional accessibility
              />
              {photoPreview ? (
                <div className="relative w-full h-48 z-20">
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                  {/* ACCESSIBILITY FIX: Added aria-label */}
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setPhotoPreview(null);
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600 transition-colors"
                    aria-label="Remove selected photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center pointer-events-none">
                  <Camera className="w-8 h-8 mb-2 text-slate-300" />
                  <span className="text-sm font-medium">Tap to upload image</span>
                  <span className="text-xs text-slate-300 mt-1">Supports JPG, PNG</span>
                </div>
              )}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#2A4D9C] hover:bg-[#1e3a7a] text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-70"
          >
            {loading ? 'Submitting Report...' : 'Submit Report'}
          </button>
        </form>
      </div>
    </div>
  );
}

function FeedPage({ issues }) {
  if (issues.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="bg-slate-100 p-6 rounded-full inline-block mb-4">
          <CheckCircle className="w-12 h-12 text-slate-300" />
        </div>
        <h3 className="text-xl font-bold text-slate-700">All systems operational</h3>
        <p className="text-slate-500">No active issues at Silicon University right now.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Campus Issue Tracker</h2>
        <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold">
          {issues.length} Active Tickets
        </span>
      </div>

      <div className="grid gap-4">
        {issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
      </div>
    </div>
  );
}

function IssueCard({ issue, isAdmin, onStatusChange }) {
  const [aiGuide, setAiGuide] = useState(null);
  const [loadingGuide, setLoadingGuide] = useState(false);

  const CatIcon = CATEGORIES[issue.category]?.icon || AlertTriangle;
  const statusColor = {
    'Reported': 'bg-red-100 text-red-700 border-red-200',
    'Assigned': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'In Progress': 'bg-blue-100 text-blue-700 border-blue-200',
    'Resolved': 'bg-green-100 text-green-700 border-green-200'
  };

  const handleGenerateGuide = async () => {
    setLoadingGuide(true);
    const guide = await callGemini(
      `Act as a facility maintenance expert. For the following ${issue.category} issue: "${issue.description}", provide a concise bulleted list of 3 steps to repair it and a list of 2-3 essential tools needed. Format cleanly.`
    );
    setAiGuide(guide);
    setLoadingGuide(false);
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${CATEGORIES[issue.category]?.color.split(' ')[0].replace('bg-', 'bg-') || 'bg-gray-300'}`}></div>
      
      <div className="flex items-start gap-4 pl-2">
        <div className={`p-3 rounded-lg hidden sm:block ${CATEGORIES[issue.category]?.color || 'bg-gray-100'}`}>
          <CatIcon className="w-6 h-6" />
        </div>

        <div className="flex-1">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${statusColor[issue.status]}`}>
                  {issue.status}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {issue.timestamp?.seconds ? new Date(issue.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}
                </span>
              </div>
              <h3 className="font-bold text-slate-900">{issue.category} Issue</h3>
            </div>
            {issue.imageUrl && (
              <div className="w-12 h-12 bg-slate-100 rounded-md overflow-hidden relative group">
                 <img src={issue.imageUrl} alt="Issue" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
          
          <p className="text-slate-600 text-sm mb-3">{issue.description}</p>
          
          <div className="flex flex-wrap gap-3 text-xs text-slate-500 font-medium mb-3">
             <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
               <MapPin className="w-3 h-3" /> {issue.location}
             </span>
             {issue.sic && (
               <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                 <IdCard className="w-3 h-3" /> {issue.sic}
               </span>
             )}
          </div>

          {/* AI Repair Guide Section for Admin */}
          {isAdmin && (
            <div className="mb-4">
               {!aiGuide ? (
                 <button 
                  onClick={handleGenerateGuide}
                  disabled={loadingGuide}
                  className="text-xs flex items-center gap-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors font-medium border border-indigo-200"
                 >
                   {loadingGuide ? (
                     <span className="animate-pulse">Generating Plan...</span>
                   ) : (
                     <>
                       <Sparkles className="w-3 h-3" /> ✨ AI Repair Guide
                     </>
                   )}
                 </button>
               ) : (
                 <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 text-xs text-slate-700 animate-fade-in">
                   <div className="flex items-center gap-2 mb-1 font-bold text-indigo-800">
                     <Wrench className="w-3 h-3" /> Suggested Repair Plan
                   </div>
                   <div className="whitespace-pre-wrap leading-relaxed">
                     {aiGuide}
                   </div>
                 </div>
               )}
            </div>
          )}

          {isAdmin && (
            <div className="pt-4 border-t border-slate-100 flex gap-2 overflow-x-auto">
               {STATUS_STEPS.map((step) => (
                 <button
                  key={step}
                  onClick={() => onStatusChange(issue.id, step)}
                  disabled={issue.status === step}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                    issue.status === step 
                    ? 'bg-[#2A4D9C] text-white cursor-default' 
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                 >
                   {step}
                 </button>
               ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminPage({ issues, updateStatus, role, facultyProfile }) {
  // Filter issues based on faculty expertise
  const filteredIssues = useMemo(() => {
    if (!facultyProfile) return [];
    return issues.filter(issue => issue.category === facultyProfile.expertise);
  }, [issues, facultyProfile]);

  const stats = useMemo(() => {
    const total = filteredIssues.length;
    const resolved = filteredIssues.filter(i => i.status === 'Resolved').length;
    const pending = total - resolved;
    return { total, resolved, pending };
  }, [filteredIssues]);

  if (role !== 'admin' || !facultyProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldCheck className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Restricted Access</h2>
        <p className="text-slate-500 max-w-md mt-2">
          This area is for registered faculty members only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-[#2A4D9C] rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
           <div>
             <h2 className="text-2xl font-bold">Faculty Dashboard</h2>
             <p className="text-blue-200 text-sm">Welcome, {facultyProfile.name} • <span className="text-amber-400 font-bold">{facultyProfile.expertise} Dept</span></p>
           </div>
           <div className="mt-4 md:mt-0 bg-[#1e3a7a] px-4 py-2 rounded-lg text-sm font-mono text-amber-400">
             ID: {facultyProfile.id}
           </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox label="Your Tickets" value={stats.total} />
          <StatBox label="Pending" value={stats.pending} color="text-red-400" />
          <StatBox label="Resolved" value={stats.resolved} color="text-green-400" />
          <StatBox label="Efficiency" value={`${stats.total ? Math.round((stats.resolved/stats.total)*100) : 0}%`} color="text-amber-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xl font-bold text-slate-800">{facultyProfile.expertise} Issues</h3>
          {filteredIssues.map((issue) => (
            <IssueCard 
              key={issue.id} 
              issue={issue} 
              isAdmin={true} 
              onStatusChange={updateStatus} 
            />
          ))}
          {filteredIssues.length === 0 && (
            <div className="bg-white p-10 rounded-xl text-center border border-slate-100">
              <CheckCircle className="w-12 h-12 text-green-200 mx-auto mb-3"/>
              <p className="text-slate-500">No pending issues for {facultyProfile.expertise}!</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-amber-50 p-6 rounded-xl border border-amber-100">
            <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4 text-amber-700"/>
                <h3 className="font-bold text-amber-900">Task Reminder</h3>
            </div>
            <p className="text-sm text-amber-800">
              Please ensure all "{facultyProfile.expertise}" tickets labeled "High Priority" are resolved within 24 hours as per university policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color = 'text-white' }) {
  return (
    <div className="bg-[#1e3a7a] p-4 rounded-xl">
      <p className="text-blue-200 text-xs uppercase tracking-wider font-semibold">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}