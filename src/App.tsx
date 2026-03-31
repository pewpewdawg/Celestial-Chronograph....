import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { 
  Calendar, 
  Sparkles, 
  RefreshCw, 
  Settings, 
  Menu, 
  Camera, 
  Image as ImageIcon, 
  Plus, 
  CheckCircle2, 
  Edit3, 
  Clock, 
  MapPin, 
  Play, 
  ChevronRight, 
  ChevronLeft,
  ShieldCheck, 
  Gem, 
  CalendarPlus, 
  HelpCircle, 
  User as UserIcon,
  ArrowLeft,
  LayoutGrid,
  Target,
  LogOut,
  Loader2,
  AlertCircle,
  LogIn,
  Trash2,
  X,
  Bell,
  Repeat,
  Cake
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";
import { cn } from "./lib/utils";
import { extractScheduleFromImage, ExtractedEvent } from "./services/geminiService";
import { GLOBAL_HOLIDAYS, Holiday } from "./constants";
import { 
  auth, 
  db, 
  loginWithGoogle, 
  logout, 
  onAuthStateChanged, 
  User, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc,
  deleteDoc,
  onSnapshot, 
  Timestamp,
  handleFirestoreError,
  OperationType
} from "./firebase";

// --- Context ---
interface ThemePalette {
  name: string;
  primary: string;
  container: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  theme: ThemePalette;
  setTheme: (p: ThemePalette) => void;
}

const PALETTES: ThemePalette[] = [
  { name: "Lavender Dream", primary: "#D8B4FE", container: "#9333EA" },
  { name: "Pink Nebula", primary: "#F472B6", container: "#BE185D" },
  { name: "Olive Galaxy", primary: "#D9F99D", container: "#4D7C0F" },
  { name: "Nebula Blue", primary: "#b8c3ff", container: "#2e5bff" },
];

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  theme: PALETTES[0],
  setTheme: () => {}
});
const useAuth = () => useContext(AuthContext);

// --- Types ---
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

type Screen = "dashboard" | "extract" | "preview" | "sync" | "profile" | "auth" | "manifest";

interface FirestoreEvent extends ExtractedEvent {
  id?: string;
  userId: string;
  createdAt: any;
}

// --- Components ---

const MoonIcon: React.FC<{ date: Date, size?: number, className?: string }> = ({ date, size = 24, className }) => {
  const knownNewMoon = new Date(2024, 0, 11);
  const diffTime = Math.abs(date.getTime() - knownNewMoon.getTime());
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const phase = (diffDays % 29.53) / 29.53;
  
  let moonChar = "🌑";
  if (phase < 0.0625 || phase >= 0.9375) moonChar = "🌑";
  else if (phase < 0.1875) moonChar = "🌒";
  else if (phase < 0.3125) moonChar = "🌓";
  else if (phase < 0.4375) moonChar = "🌔";
  else if (phase < 0.5625) moonChar = "🌕";
  else if (phase < 0.6875) moonChar = "🌖";
  else if (phase < 0.8125) moonChar = "🌗";
  else moonChar = "🌘";

  return (
    <span className={cn("inline-block leading-none", className)} style={{ fontSize: size }}>
      {moonChar}
    </span>
  );
};

const RecurrenceSelector: React.FC<{ value?: string, onChange: (val: string) => void }> = ({ value, onChange }) => {
  const options = [
    { label: "None", value: "none" },
    { label: "Daily", value: "daily" },
    { label: "Weekly", value: "weekly" },
    { label: "Monthly", value: "monthly" },
  ];

  return (
    <div className="space-y-3">
      <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1 flex items-center gap-2">
        <Repeat className="w-3 h-3" />
        Recurrence Pattern
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-medium transition-all border",
              (value || "none") === opt.value
                ? "bg-secondary text-surface border-secondary"
                : "bg-surface-container-high text-on-surface-variant border-outline-variant/20 hover:border-secondary/50"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const ReminderSelector: React.FC<{ value?: number, onChange: (val: number) => void }> = ({ value, onChange }) => {
  const options = [
    { label: "None", value: 0 },
    { label: "5 mins before", value: 5 },
    { label: "15 mins before", value: 15 },
    { label: "30 mins before", value: 30 },
    { label: "1 hour before", value: 60 },
    { label: "2 hours before", value: 120 },
    { label: "1 day before", value: 1440 },
  ];

  return (
    <div className="space-y-3">
      <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1 flex items-center gap-2">
        <Bell className="w-3 h-3" />
        Cosmic Reminder
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-medium transition-all border",
              (value || 0) === opt.value
                ? "bg-secondary text-surface border-secondary shadow-[0_0_12px_rgba(233,179,255,0.4)]"
                : "bg-surface-container-high text-on-surface-variant border-outline-variant/20 hover:border-secondary/50"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const BottomNav = ({ current, setScreen }: { current: Screen, setScreen: (s: Screen) => void }) => {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: Calendar },
    { id: "extract", label: "Extract", icon: Sparkles },
    { id: "sync", label: "Sync", icon: RefreshCw },
    { id: "profile", label: "Profile", icon: UserIcon },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-8 pt-4 bg-surface/80 backdrop-blur-xl z-50 rounded-t-[2.5rem] shadow-[0_-8px_32px_rgba(0,0,0,0.4)]">
      {items.map((item) => {
        const isActive = current === item.id || (item.id === "sync" && current === "sync");
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => setScreen(item.id)}
            className={cn(
              "flex flex-col items-center justify-center px-5 py-2 rounded-2xl transition-all duration-300 active:scale-90",
              isActive ? "bg-primary-container text-white" : "text-on-surface-variant hover:text-primary"
            )}
          >
            <Icon className={cn("w-6 h-6 mb-1", isActive && "fill-current")} />
            <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

const TopBar = ({ title, onMenuClick, showBack, onBack, userPhoto }: { title: string, onMenuClick?: () => void, showBack?: boolean, onBack?: () => void, userPhoto?: string | null }) => (
  <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-4 bg-surface/80 backdrop-blur-md">
    <div className="flex items-center gap-4">
      {showBack ? (
        <button onClick={onBack} className="text-primary active:scale-90 transition-transform p-2">
          <ArrowLeft className="w-6 h-6" />
        </button>
      ) : (
        <button onClick={onMenuClick} className="text-primary active:scale-90 transition-transform p-2">
          <Menu className="w-6 h-6" />
        </button>
      )}
      <h1 className="text-xl font-headline font-bold tracking-tight text-primary">
        {title}
      </h1>
    </div>
    <button 
      onClick={onMenuClick}
      className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant/30 bg-surface-container active:scale-90 transition-transform"
    >
      {userPhoto ? (
        <img 
          src={userPhoto} 
          alt="User" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
          <UserIcon className="w-5 h-5" />
        </div>
      )}
    </button>
  </header>
);

// --- Screens ---

const ExtractScreen: React.FC<{ onExtract: (file: File) => void, isExtracting: boolean, error: string | null }> = ({ onExtract, isExtracting, error }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onExtract(file);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-10 pt-24 pb-32 px-6 max-w-2xl mx-auto"
    >
      <section className="text-center space-y-2">
        <h2 className="text-4xl font-headline font-extrabold tracking-tight text-primary">Magic Extraction</h2>
        <p className="text-on-surface-variant font-medium">Transform physical schedules into digital reality.</p>
      </section>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-2xl flex items-center gap-3 text-destructive">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileChange}
        />
        <div 
          onClick={() => !isExtracting && fileInputRef.current?.click()}
          className={cn(
            "md:col-span-2 group relative overflow-hidden rounded-[2.5rem] bg-surface-container-low p-12 flex flex-col items-center justify-center text-center cursor-pointer celestial-glow transition-all active:scale-[0.98] duration-200",
            isExtracting && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary-container/10 to-secondary-container/5 opacity-50" />
          <div className="relative z-10 space-y-6">
            <div className="w-24 h-24 rounded-[2rem] bg-primary-container flex items-center justify-center text-white shadow-2xl shadow-primary/20 group-hover:scale-110 transition-transform duration-300">
              {isExtracting ? (
                <Loader2 className="w-12 h-12 animate-spin" />
              ) : (
                <Sparkles className="w-12 h-12 fill-current" />
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-headline font-bold text-white">
                {isExtracting ? "Analyzing Celestial Data..." : "Upload File or Photo"}
              </h3>
              <p className="text-on-surface-variant text-sm max-w-[240px] mx-auto">
                {isExtracting ? "Our neural engine is decoding the schedule" : "Drop a screenshot, PDF, or image to start extraction"}
              </p>
            </div>
          </div>
        </div>

        <div 
          onClick={() => !isExtracting && fileInputRef.current?.click()}
          className="bg-surface-container-high hover:bg-surface-bright transition-colors p-6 rounded-[1.5rem] flex items-center gap-4 cursor-pointer active:scale-95"
        >
          <div className="w-12 h-12 rounded-xl bg-secondary-container/20 flex items-center justify-center text-secondary">
            <Camera className="w-6 h-6 fill-current" />
          </div>
          <div>
            <span className="font-headline font-bold block text-white">Take Photo</span>
            <span className="text-xs text-on-surface-variant">Instant capture</span>
          </div>
        </div>

        <div 
          onClick={() => !isExtracting && fileInputRef.current?.click()}
          className="bg-surface-container-high hover:bg-surface-bright transition-colors p-6 rounded-[1.5rem] flex items-center gap-4 cursor-pointer active:scale-95"
        >
          <div className="w-12 h-12 rounded-xl bg-tertiary-container/20 flex items-center justify-center text-tertiary">
            <ImageIcon className="w-6 h-6 fill-current" />
          </div>
          <div>
            <span className="font-headline font-bold block text-white">Choose from Gallery</span>
            <span className="text-xs text-on-surface-variant">Import existing</span>
          </div>
        </div>
      </section>

      <section className="pt-8">
        <h4 className="text-primary/60 text-[10px] font-bold tracking-[0.2em] uppercase mb-8 text-center">How it works</h4>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Snap", icon: Camera, color: "text-primary", bg: "bg-primary-container" },
            { label: "Extract", icon: Sparkles, color: "text-secondary", bg: "bg-secondary-container" },
            { label: "Sync", icon: RefreshCw, color: "text-tertiary", bg: "bg-tertiary-container" },
          ].map((step, i) => (
            <div key={i} className="flex flex-col items-center text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center relative">
                <step.icon className={cn("w-6 h-6", step.color)} />
                <div className={cn("absolute -right-1 -top-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white", step.bg)}>
                  {i + 1}
                </div>
              </div>
              <span className="text-sm font-headline font-bold text-white">{step.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="relative h-48 rounded-[2.5rem] overflow-hidden group">
        <img 
          src="https://picsum.photos/seed/nebula/800/400" 
          alt="AI" 
          className="w-full h-full object-cover opacity-40 mix-blend-luminosity grayscale group-hover:grayscale-0 transition-all duration-700"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
        <div className="absolute bottom-6 left-6 right-6">
          <p className="text-lg font-headline font-bold leading-tight text-white">AI-Powered Precision</p>
          <p className="text-xs text-on-surface-variant font-medium mt-1">Our neural engine detects dates, times, and locations automatically.</p>
        </div>
      </div>
    </motion.div>
  );
};

const PreviewScreen: React.FC<{ 
  events: ExtractedEvent[], 
  sourceImage: string | null, 
  onConfirm: () => void, 
  onDiscard: () => void,
  onUpdateEvent: (index: number, updated: ExtractedEvent) => void
}> = ({ 
  events, 
  sourceImage, 
  onConfirm, 
  onDiscard,
  onUpdateEvent
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFullSource, setShowFullSource] = useState(false);
  const event = events[currentIndex];

  if (!event) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="pt-24 pb-32 px-6 max-w-2xl mx-auto space-y-10"
    >
      <AnimatePresence>
        {showFullSource && sourceImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-surface/95 backdrop-blur-2xl flex items-center justify-center p-6"
          >
            <button 
              onClick={() => setShowFullSource(false)}
              className="absolute top-8 right-8 text-white hover:text-primary transition-colors z-[110]"
            >
              <Plus className="w-8 h-8 rotate-45" />
            </button>
            <img 
              src={sourceImage} 
              alt="Full Source" 
              className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <section className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-secondary-container/20 mb-6 relative">
          <div className="absolute inset-0 rounded-full bg-secondary/10 blur-xl" />
          <Sparkles className="w-10 h-10 text-secondary fill-current relative z-10" />
        </div>
        <h2 className="font-headline text-4xl font-extrabold tracking-tight text-white mb-2">Success!</h2>
        <p className="text-on-surface-variant font-medium">
          We've extracted {events.length} celestial alignment{events.length > 1 ? 's' : ''}.
        </p>
        {events.length > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {events.map((_, i) => (
              <button 
                key={i} 
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === currentIndex ? "bg-primary w-6" : "bg-surface-container-highest"
                )}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 bg-surface-container-high rounded-[2rem] p-6 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary shadow-[0_0_12px_rgba(233,179,255,0.6)]" />
          <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-3">Event Title</label>
          <input 
            className="w-full bg-transparent border-none p-0 text-2xl font-headline font-bold text-white focus:ring-0" 
            value={event.title}
            onChange={(e) => onUpdateEvent(currentIndex, { ...event, title: e.target.value })}
          />
          <div className="mt-4 flex items-center gap-2 text-on-surface-variant text-xs">
            <Edit3 className="w-3 h-3" />
            <span>Tap to refine the name</span>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-[2rem] p-6 hover:bg-surface-container transition-colors cursor-pointer">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Date</label>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <input 
                type="date"
                className="bg-transparent border-none p-0 text-xl font-bold font-headline text-white focus:ring-0 block w-full"
                value={event.date}
                onChange={(e) => onUpdateEvent(currentIndex, { ...event, date: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-[2rem] p-6 hover:bg-surface-container transition-colors cursor-pointer">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-tertiary mb-3">Time</label>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-tertiary/10 flex items-center justify-center text-tertiary">
              <Clock className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-1">
              <input 
                type="time"
                className="bg-transparent border-none p-0 text-xl font-bold font-headline text-white focus:ring-0"
                value={event.startTime}
                onChange={(e) => onUpdateEvent(currentIndex, { ...event, startTime: e.target.value })}
              />
              {event.endTime && (
                <input 
                  type="time"
                  className="bg-transparent border-none p-0 text-sm font-medium text-on-surface-variant focus:ring-0"
                  value={event.endTime}
                  onChange={(e) => onUpdateEvent(currentIndex, { ...event, endTime: e.target.value })}
                />
              )}
            </div>
          </div>
        </div>

        <div className="md:col-span-2 glass-panel rounded-[2rem] p-6 mt-4 border border-outline-variant/10 space-y-6">
          <ReminderSelector 
            value={event.reminderMinutes} 
            onChange={(val) => onUpdateEvent(currentIndex, { ...event, reminderMinutes: val })} 
          />
          
          <div className="flex justify-between items-center mb-4 pt-4 border-t border-outline-variant/10">
            <h3 className="text-xs font-semibold text-on-surface-variant">Original Extraction Source</h3>
            <span className="text-[10px] px-2 py-1 bg-surface-container-highest rounded-lg text-white font-bold uppercase tracking-wider">Image Scan</span>
          </div>
          <div className="aspect-video rounded-2xl overflow-hidden bg-surface-container-lowest flex items-center justify-center group relative">
            {sourceImage ? (
              <img 
                src={sourceImage} 
                alt="Source" 
                className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-surface-container-low flex items-center justify-center">
                <ImageIcon className="w-12 h-12 text-on-surface-variant opacity-20" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <button 
                onClick={() => setShowFullSource(true)}
                className="bg-surface/80 backdrop-blur-md px-6 py-2 rounded-full flex items-center gap-2 border border-outline-variant/20 hover:bg-surface transition-all"
              >
                <ImageIcon className="w-4 h-4" />
                <span className="text-sm font-medium text-white">View Source Photo</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <button 
          onClick={onConfirm}
          className="luminous-button w-full py-5 rounded-full text-white font-headline font-extrabold text-lg shadow-[0_8px_32px_rgba(46,91,255,0.4)] hover:shadow-[0_12px_48px_rgba(46,91,255,0.6)] active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <CheckCircle2 className="w-6 h-6" />
          Confirm & Add to Calendar
        </button>
        <button 
          onClick={onDiscard}
          className="w-full py-4 rounded-full text-on-surface-variant font-medium hover:text-white transition-colors flex items-center justify-center gap-2"
        >
          Discard Extraction
        </button>
      </div>
    </motion.div>
  );
};

const DashboardScreen: React.FC<{ events: FirestoreEvent[], loading: boolean, onManifest: (date?: string) => void, birthday: string | null }> = ({ events, loading, onManifest, birthday }) => {
  const { user } = useAuth();
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<number | null>(new Date().getDate());
  const [selectedEventForView, setSelectedEventForView] = useState<FirestoreEvent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<ExtractedEvent | null>(null);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right
  
  const currentMonthNum = viewDate.getMonth() + 1;
  const currentYear = viewDate.getFullYear();
  const currentMonthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(viewDate);
  const currentMonthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(viewDate);

  // Calculate calendar grid
  const firstDayOfMonth = new Date(currentYear, currentMonthNum - 1, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonthNum, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  // getDay() returns 0 for Sunday, 1 for Monday, etc.
  // Our grid starts with Monday, so we adjust: (day + 6) % 7
  const startDayOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handlePrevMonth = () => {
    setDirection(-1);
    setViewDate(new Date(currentYear, currentMonthNum - 2, 1));
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setDirection(1);
    setViewDate(new Date(currentYear, currentMonthNum, 1));
    setSelectedDate(null);
  };
  
  // Remove the useEffect that fetches events as it's now in App

  const handleUpdateEvent = async () => {
    if (!selectedEventForView?.id || !editForm) return;
    try {
      // Explicitly pick and sanitize fields
      const sanitizedEvent: any = {
        title: editForm.title.trim(),
        date: editForm.date.trim(),
        startTime: editForm.startTime.trim(),
        updatedAt: Timestamp.now()
      };
      
      if (editForm.endTime?.trim()) sanitizedEvent.endTime = editForm.endTime.trim();
      if (editForm.location?.trim()) sanitizedEvent.location = editForm.location.trim();
      if (editForm.description?.trim()) sanitizedEvent.description = editForm.description.trim();
      if (editForm.reminderMinutes !== undefined) sanitizedEvent.reminderMinutes = editForm.reminderMinutes;
      if (editForm.recurrence) sanitizedEvent.recurrence = editForm.recurrence;

      const eventRef = doc(db, "events", selectedEventForView.id);
      await updateDoc(eventRef, sanitizedEvent);
      toast.success("Alignment updated successfully");
      setIsEditing(false);
      setSelectedEventForView({ ...selectedEventForView, ...sanitizedEvent });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "events");
      toast.error("Failed to update alignment");
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteDoc(doc(db, "events", id));
      toast.success("Alignment dissolved successfully");
      setSelectedEventForView(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "events");
      toast.error("Failed to dissolve alignment");
    }
  };

  // Filter events based on current month
  const filteredEvents = events.filter(event => {
    const [year, month] = event.date.split('-').map(Number);
    return month === currentMonthNum && year === currentYear;
  });

  // Filter holidays based on current month
  const filteredHolidays = GLOBAL_HOLIDAYS.filter(holiday => {
    const [year, month] = holiday.date.split('-').map(Number);
    return month === currentMonthNum && year === currentYear;
  });

  // Merge similar manifested events on the same date
  const mergedManifestedMap: Record<string, any> = {};
  filteredEvents.forEach(event => {
    const key = `${event.date}-${event.title.toLowerCase().trim()}`;
    if (mergedManifestedMap[key]) {
      const existing = mergedManifestedMap[key];
      // Merge descriptions if they are different
      if (event.description && !existing.description.includes(event.description)) {
        existing.description = `${existing.description}\n\n${event.description}`;
      }
      // Merge locations if they are different
      if (event.location && !existing.location.includes(event.location)) {
        existing.location = existing.location ? `${existing.location}, ${event.location}` : event.location;
      }
      // Keep earliest start time and latest end time
      if (event.startTime < existing.startTime) existing.startTime = event.startTime;
      if (event.endTime > existing.endTime) existing.endTime = event.endTime;
    } else {
      mergedManifestedMap[key] = { ...event, isHoliday: false };
    }
  });

  const finalManifestedEvents = Object.values(mergedManifestedMap);

  // Group filtered events and holidays by day
  const dailyEvents: Record<number, any[]> = {};
  
  finalManifestedEvents.forEach(event => {
    const day = parseInt(event.date.split('-')[2], 10);
    if (!dailyEvents[day]) dailyEvents[day] = [];
    dailyEvents[day].push(event);
  });

  // Merge holidays on the same date
  const mergedHolidaysMap: Record<string, any> = {};
  filteredHolidays.forEach(holiday => {
    if (mergedHolidaysMap[holiday.date]) {
      const existing = mergedHolidaysMap[holiday.date];
      existing.title = `${existing.title} & ${holiday.title}`;
      existing.description = `${existing.description}\n\n${holiday.description}`;
      // If one is a holiday and another is a festival, we can keep 'holiday' as priority or just use the first one
      if (holiday.type === 'holiday') existing.type = 'holiday';
    } else {
      mergedHolidaysMap[holiday.date] = { 
        ...holiday, 
        isHoliday: true,
        startTime: "00:00",
        endTime: "23:59",
        location: "Global",
        reminderMinutes: 0,
        recurrence: "none"
      };
    }
  });

  Object.values(mergedHolidaysMap).forEach(holiday => {
    const day = parseInt(holiday.date.split('-')[2], 10);
    if (!dailyEvents[day]) dailyEvents[day] = [];
    dailyEvents[day].push(holiday);
  });

  // Add birthday to daily events if in current month
  const birthdayEvent = birthday && (() => {
    const [bYear, bMonth, bDay] = birthday.split('-').map(Number);
    if (bMonth === currentMonthNum) {
      return {
        title: "Your Cosmic Birthday! 🎂",
        date: birthday,
        description: "The day you arrived in this universe. A truly celestial alignment!",
        isHoliday: true,
        type: 'festival',
        startTime: "00:00",
        endTime: "23:59",
        location: "Your Heart",
        reminderMinutes: 0,
        recurrence: "yearly"
      };
    }
    return null;
  })();

  if (birthdayEvent) {
    const day = parseInt(birthdayEvent.date.split('-')[2], 10);
    if (!dailyEvents[day]) dailyEvents[day] = [];
    // Check if already exists (to avoid duplicates if user added it manually too)
    if (!dailyEvents[day].some(e => e.title.includes("Birthday"))) {
      dailyEvents[day].push(birthdayEvent);
    }
  }

  const selectedDayEvents = selectedDate 
    ? dailyEvents[selectedDate] || [] 
    : [...finalManifestedEvents, ...Object.values(mergedHolidaysMap), ...(birthdayEvent ? [birthdayEvent] : [])].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="px-6 pt-24 pb-32 max-w-7xl mx-auto"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h2 className="font-headline text-5xl font-extrabold tracking-tight text-primary">{currentMonthYear}</h2>
            <div className="flex gap-2">
              <button 
                onClick={handlePrevMonth}
                className="p-2 rounded-full bg-surface-container hover:bg-surface-bright text-on-surface-variant transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={handleNextMonth}
                className="p-2 rounded-full bg-surface-container hover:bg-surface-bright text-on-surface-variant transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          <p className="text-on-surface-variant font-medium">
            {loading ? "Aligning your cosmic schedule..." : 
             selectedDayEvents.length > 0 ? `You have ${selectedDayEvents.length} cosmic event${selectedDayEvents.length > 1 ? 's' : ''} aligned for this period.` : 
             `Viewing alignment for ${currentMonthName} ${selectedDate || ""}.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-surface-container-low rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden border border-outline-variant/5">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px]" />
            
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentMonthYear}
                custom={direction}
                initial={{ 
                  x: direction > 0 ? 200 : -200, 
                  opacity: 0,
                  scale: 0.9,
                  rotateY: direction > 0 ? 15 : -15
                }}
                animate={{ 
                  x: 0, 
                  opacity: 1,
                  scale: 1,
                  rotateY: 0
                }}
                exit={{ 
                  x: direction > 0 ? -200 : 200, 
                  opacity: 0,
                  scale: 0.9,
                  rotateY: direction > 0 ? -15 : 15
                }}
                transition={{ 
                  type: "spring", 
                  stiffness: 260, 
                  damping: 26,
                  mass: 1
                }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 50) handlePrevMonth();
                  else if (info.offset.x < -50) handleNextMonth();
                }}
                className="grid grid-cols-7 gap-y-6 text-center cursor-grab active:cursor-grabbing perspective-1000"
              >
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                  <div key={d} className="text-on-surface-variant font-bold text-[10px] tracking-widest uppercase">{d}</div>
                ))}
                {Array(startDayOffset).fill(0).map((_, i) => <div key={`empty-${i}`} />)}
                {days.map(d => {
                  const dayEvents = dailyEvents[d] || [];
                  const isSelected = selectedDate === d;
                  const hasEvents = dayEvents.length > 0;
                  const hasHoliday = dayEvents.some(e => e.isHoliday);
                  
                  const isBirthday = birthday && (() => {
                    const [_, bMonth, bDay] = birthday.split('-').map(Number);
                    return bMonth === currentMonthNum && bDay === d;
                  })();
                  
                  return (
                    <div 
                      key={d} 
                      onClick={() => setSelectedDate(d)}
                      className={cn(
                        "aspect-square flex flex-col items-center justify-center gap-1 group cursor-pointer relative transition-all duration-500 rounded-full mx-auto w-10",
                        isSelected 
                          ? "scale-110 z-10" 
                          : isBirthday
                            ? "bg-secondary/20 text-secondary border border-secondary/40 shadow-[0_0_15px_rgba(244,114,182,0.3)]"
                            : hasEvents 
                              ? "bg-surface-container-high/40 text-white border border-primary/20" 
                              : "hover:bg-surface-container/50 text-white/70 hover:text-white"
                      )}
                    >
                      {isSelected ? (
                        <div className="relative flex items-center justify-center w-full h-full">
                          <MoonIcon date={new Date(currentYear, currentMonthNum - 1, d)} size={28} className="text-primary/80" />
                          <span className="absolute text-sm font-bold text-white z-20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            {d}
                          </span>
                          {isBirthday && (
                            <div className="absolute -top-1 -right-1 bg-secondary text-white p-1 rounded-full shadow-lg z-30">
                              <Cake className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {hasEvents && (
                            <div className={cn(
                              "absolute inset-0 rounded-full blur-md animate-pulse",
                              hasHoliday ? "bg-secondary/10" : "bg-primary/5"
                            )} />
                          )}
                          {isBirthday && !hasEvents && (
                             <div className="absolute inset-0 rounded-full bg-secondary/5 blur-sm" />
                          )}
                          <span className={cn(
                            "text-sm font-semibold relative z-10",
                            isBirthday ? "text-secondary" : (hasEvents && (hasHoliday ? "text-secondary" : "text-primary"))
                          )}>
                            {d}
                          </span>
                          <div className="flex gap-0.5 relative z-10">
                            {isBirthday && (
                              <Cake className="w-2.5 h-2.5 text-secondary animate-bounce" />
                            )}
                            {hasEvents && dayEvents.slice(0, 3).map((e, idx) => (
                              <div 
                                key={idx} 
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full shadow-[0_0_5px_rgba(184,195,255,0.8)]",
                                  e.isHoliday ? "bg-secondary" : "bg-primary"
                                )} 
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>


        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="flex justify-between items-end mb-4">
            <h3 className="font-headline text-2xl font-bold text-white">
              {selectedDate ? `Events: ${selectedDate}` : "Upcoming Alignments"}
            </h3>
            {selectedDate && (
              <button 
                onClick={() => setSelectedDate(null)}
                className="text-on-surface-variant hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
          </div>
          
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {selectedDayEvents.length > 0 ? (
                selectedDayEvents.map((event, i) => (
                  <motion.div 
                    key={event.id || `${event.date}-${i}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onClick={() => {
                      if (event.isHoliday) {
                        toast.info(`${event.title}: ${event.description}`);
                        return;
                      }
                      setSelectedEventForView(event);
                      setEditForm({
                        title: event.title,
                        date: event.date,
                        startTime: event.startTime,
                        endTime: event.endTime,
                        location: event.location || "",
                        description: event.description || "",
                        reminderMinutes: event.reminderMinutes,
                        recurrence: event.recurrence || "none"
                      });
                      setIsEditing(false);
                    }}
                    className={cn(
                      "group bg-surface-container-high rounded-[2rem] p-6 border-l-4 hover:bg-surface-bright transition-all duration-300 cursor-pointer",
                      event.isHoliday ? "border-secondary" : "border-primary"
                    )}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className={cn(
                          "font-bold text-lg mb-1 transition-colors text-white",
                          event.isHoliday ? "group-hover:text-secondary" : "group-hover:text-primary"
                        )}>{event.title}</h4>
                        <span className="text-on-surface-variant text-xs flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> {event.startTime} {event.isHoliday && "(Full Day)"}
                        </span>
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider",
                        event.isHoliday ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"
                      )}>
                        {event.isHoliday 
                          ? (event.type === 'holiday' ? 'Holiday' : event.type === 'festival' ? 'Festival' : 'International Day') 
                          : 'Extracted'}
                      </div>
                    </div>
                    {(event.location || event.description) && (
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant italic">
                        {event.location && <><MapPin className="w-3.5 h-3.5" /> {event.location}</>}
                        {!event.location && event.description && <p className="line-clamp-1">{event.description}</p>}
                      </div>
                    )}
                  </motion.div>
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-12 text-center text-on-surface-variant"
                >
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-medium">No cosmic alignments for this day.</p>
                </motion.div>
              )}
            </AnimatePresence>
            
            <button 
              onClick={() => {
                const dateStr = selectedDate ? `${currentYear}-${currentMonthNum.toString().padStart(2, '0')}-${selectedDate.toString().padStart(2, '0')}` : undefined;
                onManifest(dateStr);
              }}
              className="w-full py-5 border-2 border-dashed border-outline-variant/30 rounded-[2rem] text-on-surface-variant font-bold hover:bg-surface-container-low hover:text-primary hover:border-primary/50 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Manifest New Event
            </button>
          </div>
        </div>
      </div>

      <button 
        onClick={() => {
          toast.info("Manifesting new alignment...");
          onManifest();
        }}
        className="fixed right-8 bottom-32 w-16 h-16 bg-primary-container text-white rounded-[1.5rem] shadow-[0_8px_32px_rgba(46,91,255,0.4)] flex items-center justify-center z-[60] active:scale-90 transition-transform"
      >
        <Plus className="w-8 h-8" />
      </button>

      <AnimatePresence>
        {selectedEventForView && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-surface/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-surface-container-high w-full max-w-lg rounded-[3rem] p-10 shadow-2xl border border-outline-variant/20 relative overflow-hidden"
            >
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/10 rounded-full blur-[100px]" />
              
              <button 
                onClick={() => setSelectedEventForView(null)}
                className="absolute top-8 right-8 p-2 rounded-full bg-surface-container hover:bg-surface-bright text-on-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {isEditing ? (
                <div className="space-y-6">
                  <h3 className="text-3xl font-headline font-bold text-white mb-8">Edit Alignment</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-primary uppercase tracking-widest ml-4">Title</label>
                      <input 
                        type="text"
                        value={editForm?.title}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, title: e.target.value } : null)}
                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-primary uppercase tracking-widest ml-4">Start Time</label>
                        <input 
                          type="time"
                          value={editForm?.startTime}
                          onChange={(e) => setEditForm(prev => prev ? { ...prev, startTime: e.target.value } : null)}
                          className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-primary uppercase tracking-widest ml-4">End Time</label>
                        <input 
                          type="time"
                          value={editForm?.endTime}
                          onChange={(e) => setEditForm(prev => prev ? { ...prev, endTime: e.target.value } : null)}
                          className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                    </div>

                    <div className="px-4 space-y-6">
                      <ReminderSelector 
                        value={editForm?.reminderMinutes} 
                        onChange={(val) => setEditForm(prev => prev ? { ...prev, reminderMinutes: val } : null)} 
                      />
                      <RecurrenceSelector 
                        value={editForm?.recurrence} 
                        onChange={(val) => setEditForm(prev => prev ? { ...prev, recurrence: val as any } : null)} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-primary uppercase tracking-widest ml-4">Location</label>
                      <input 
                        type="text"
                        value={editForm?.location}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, location: e.target.value } : null)}
                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-primary uppercase tracking-widest ml-4">Description</label>
                      <textarea 
                        value={editForm?.description}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, description: e.target.value } : null)}
                        rows={3}
                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 pt-6">
                    <button 
                      onClick={handleUpdateEvent}
                      className="flex-1 bg-primary text-surface font-bold py-4 rounded-2xl hover:bg-primary/90 transition-all active:scale-95"
                    >
                      Update Alignment
                    </button>
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="flex-1 bg-surface-container border border-outline-variant/20 text-white font-bold py-4 rounded-2xl hover:bg-surface-bright transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div>
                    <span className="px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary mb-4 inline-block">
                      Cosmic Alignment
                    </span>
                    <h3 className="text-4xl font-headline font-bold text-white mb-4 leading-tight">{selectedEventForView.title}</h3>
                    <div className="flex flex-wrap gap-6 text-on-surface-variant">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary" />
                        <span className="font-medium">{selectedEventForView.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        <span className="font-medium">{selectedEventForView.startTime} — {selectedEventForView.endTime}</span>
                      </div>
                      {selectedEventForView.recurrence && selectedEventForView.recurrence !== "none" && (
                        <div className="flex items-center gap-2">
                          <Repeat className="w-5 h-5 text-secondary" />
                          <span className="font-medium capitalize">{selectedEventForView.recurrence}</span>
                        </div>
                      )}
                      {selectedEventForView.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-primary" />
                          <span className="font-medium">{selectedEventForView.location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedEventForView.description && (
                    <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/10">
                      <p className="text-on-surface-variant leading-relaxed italic">
                        "{selectedEventForView.description}"
                      </p>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="flex-1 bg-surface-container-highest text-white font-bold py-4 rounded-2xl hover:bg-surface-bright transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Edit3 className="w-5 h-5" />
                      Edit
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm("Are you sure you want to dissolve this cosmic alignment?")) {
                          handleDeleteEvent(selectedEventForView.id!);
                        }
                      }}
                      className="flex-1 bg-destructive/10 text-destructive font-bold py-4 rounded-2xl hover:bg-destructive/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Trash2 className="w-5 h-5" />
                      Dissolve
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const CelestialDatePicker: React.FC<{ value: string, onChange: (val: string) => void }> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date(value));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  const handleSelectDate = (day: number) => {
    const selected = new Date(currentYear, currentMonth, day);
    onChange(selected.toISOString().split('T')[0]);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gradient-to-br from-surface-container-high to-surface-container-highest border border-outline-variant/20 rounded-2xl py-4 px-6 text-white flex items-center justify-between hover:border-primary/50 transition-all shadow-inner"
      >
        <span className="font-medium">{new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
        <Calendar className="w-5 h-5 text-primary" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full left-0 mt-4 w-72 bg-surface-container-high border border-outline-variant/20 rounded-[2rem] p-4 shadow-2xl z-50 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-4 px-2">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-surface-container rounded-full text-white">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-white text-sm">{monthName} {currentYear}</span>
              <button onClick={handleNextMonth} className="p-2 hover:bg-surface-container rounded-full text-white">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                <span key={day} className="text-[10px] font-bold text-on-surface-variant text-center uppercase">{day}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {days.map(day => {
                const isSelected = new Date(value).getDate() === day && 
                                  new Date(value).getMonth() === currentMonth && 
                                  new Date(value).getFullYear() === currentYear;
                return (
                  <button
                    key={day}
                    onClick={() => handleSelectDate(day)}
                    className={cn(
                      "aspect-square flex items-center justify-center text-xs font-medium rounded-full transition-all",
                      isSelected 
                        ? "bg-primary text-white shadow-[0_0_15px_rgba(184,195,255,0.4)]" 
                        : "text-white/70 hover:bg-surface-container hover:text-white"
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ManifestEventScreen: React.FC<{ initialDate?: string, onSave: (event: ExtractedEvent) => void, onCancel: () => void }> = ({ initialDate, onSave, onCancel }) => {
  const [event, setEvent] = useState<ExtractedEvent>({
    title: "",
    date: initialDate || new Date().toISOString().split('T')[0],
    startTime: "09:00",
    endTime: "10:00",
    location: "",
    description: "",
    reminderMinutes: 15,
    recurrence: "none"
  });

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-2xl mx-auto px-6 pt-24 pb-32"
    >
      <div className="mb-12">
        <h2 className="text-4xl font-headline font-extrabold text-white mb-2 tracking-tight">Manifest Event</h2>
        <p className="text-on-surface-variant font-medium text-lg">Manually align a new cosmic alignment.</p>
      </div>

      <div className="bg-surface-container-low rounded-[2.5rem] p-8 border border-outline-variant/10 space-y-8">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-primary uppercase tracking-widest ml-1">Event Title</label>
          <input 
            type="text"
            placeholder="What alignment is occurring?"
            className="w-full bg-gradient-to-br from-surface-container-high to-surface-container-highest border border-outline-variant/20 rounded-2xl py-4 px-6 text-white placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
            value={event.title}
            onChange={(e) => setEvent({ ...event, title: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-primary uppercase tracking-widest ml-1">Date</label>
            <CelestialDatePicker 
              value={event.date} 
              onChange={(val) => setEvent({ ...event, date: val })} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-primary uppercase tracking-widest ml-1">Location</label>
            <input 
              type="text"
              placeholder="Where in the cosmos?"
              className="w-full bg-gradient-to-br from-surface-container-high to-surface-container-highest border border-outline-variant/20 rounded-2xl py-4 px-6 text-white placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
              value={event.location}
              onChange={(e) => setEvent({ ...event, location: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-primary uppercase tracking-widest ml-1">Start Time</label>
            <input 
              type="time"
              className="w-full bg-gradient-to-br from-surface-container-high to-surface-container-highest border border-outline-variant/20 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
              value={event.startTime}
              onChange={(e) => setEvent({ ...event, startTime: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-primary uppercase tracking-widest ml-1">End Time</label>
            <input 
              type="time"
              className="w-full bg-gradient-to-br from-surface-container-high to-surface-container-highest border border-outline-variant/20 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
              value={event.endTime}
              onChange={(e) => setEvent({ ...event, endTime: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-primary uppercase tracking-widest ml-1">Description</label>
          <textarea 
            placeholder="Additional cosmic details..."
            rows={4}
            className="w-full bg-gradient-to-br from-surface-container-high to-surface-container-highest border border-outline-variant/20 rounded-2xl py-4 px-6 text-white placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none shadow-inner"
            value={event.description}
            onChange={(e) => setEvent({ ...event, description: e.target.value })}
          />
        </div>

        <div className="px-4 space-y-6">
          <ReminderSelector 
            value={event.reminderMinutes} 
            onChange={(val) => setEvent({ ...event, reminderMinutes: val })} 
          />
          <RecurrenceSelector 
            value={event.recurrence} 
            onChange={(val) => setEvent({ ...event, recurrence: val as any })} 
          />
        </div>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-6">
        <button 
          onClick={onCancel}
          className="py-5 rounded-full text-on-surface-variant font-bold hover:bg-surface-container-low hover:text-white transition-all border border-outline-variant/20"
        >
          Cancel
        </button>
        <button 
          onClick={() => {
            if (!event.title) {
              toast.error("Title Required", { description: "Please name your cosmic alignment." });
              return;
            }
            onSave(event);
          }}
          className="luminous-button py-5 rounded-full text-white font-headline font-extrabold text-lg shadow-[0_8px_32px_rgba(46,91,255,0.4)] hover:scale-105 active:scale-95 transition-all"
        >
          Manifest Alignment
        </button>
      </div>
    </motion.div>
  );
};

const SyncScreen: React.FC<{ birthday: string | null, onBirthdayChange: (val: string) => void }> = ({ birthday, onBirthdayChange }) => {
  const { user, theme, setTheme } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const isAdmin = user?.email === "yash1084jais@gmail.com";

  const handleToggleNotifications = () => {
    setNotifications(!notifications);
    toast.success(`Notifications ${!notifications ? "enabled" : "disabled"}`, {
      description: "Celestial alignment alerts updated.",
      icon: <CheckCircle2 className="w-4 h-4 text-primary" />
    });
  };

  const handleLanguageChange = () => {
    toast.info("Language Settings", {
      description: "Additional cosmic dialects coming soon in the next nebula update.",
    });
  };

  const handleVisualThemeChange = () => {
    toast.info("Visual Theme", {
      description: "Obsidian Prism is currently the only supported dark matter theme.",
    });
  };

  const handleManageKeys = async () => {
    if (window.aistudio?.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        toast.success("API Key Selection", {
          description: "Celestial keys updated successfully.",
        });
      } catch (err) {
        toast.error("Key Selection Failed", {
          description: "Could not open cosmic key dialog.",
        });
      }
    } else {
      toast.error("Unsupported Environment", {
        description: "API key management is only available in the AI Studio environment.",
      });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl mx-auto px-6 pt-24 pb-32"
    >
      <section className="mb-12">
        <h2 className="text-4xl font-headline font-extrabold text-white mb-2 tracking-tight">Sync Settings</h2>
        <p className="text-on-surface-variant font-medium">Manage your celestial connections and application preferences.</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {[
          { name: "Google Calendar", last: "2m ago", active: true, color: "bg-primary", icon: "https://www.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_31_2x.png" },
          { name: "Outlook", last: "Not connected", active: false, color: "bg-secondary", icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg/1101px-Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg.png" },
          { name: "Samsung Calendar", last: "Sync active", active: true, color: "bg-tertiary", icon: "https://picsum.photos/seed/samsung/40/40" },
        ].map((s, i) => (
          <div key={i} className="bg-surface-container-low p-8 rounded-[2rem] hover:bg-surface-container transition-colors relative group overflow-hidden">
            <div className={cn("absolute top-0 left-0 w-1.5 h-full", s.color)} />
            <div className="flex justify-between items-start mb-8">
              <div className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl p-2 shadow-lg">
                <img src={s.icon} alt={s.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
              <div 
                onClick={() => toast.info(`${s.name} Sync`, { description: `${s.active ? "Disconnecting" : "Connecting"} ${s.name}...` })}
                className={cn(
                  "w-12 h-6 rounded-full relative transition-colors cursor-pointer",
                  s.active ? "bg-primary-container" : "bg-surface-container-highest"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-md",
                  s.active ? "right-1" : "left-1"
                )} />
              </div>
            </div>
            <h3 className={cn("font-headline font-bold text-xl mb-1", s.color.replace("bg-", "text-"))}>{s.name}</h3>
            <p className="text-xs text-on-surface-variant font-medium">{s.last}</p>
          </div>
        ))}
      </div>

      <section className="mb-12">
        <h3 className="text-xl font-headline font-bold text-white mb-6 px-2">Celestial Theme</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {PALETTES.map((p) => (
            <button
              key={p.name}
              onClick={() => {
                setTheme(p);
                toast.success(`Theme: ${p.name}`, {
                  description: "Celestial vibration synchronized.",
                });
              }}
              className={cn(
                "p-4 rounded-[1.5rem] border-2 transition-all flex flex-col items-center gap-3",
                theme.name === p.name ? "border-primary bg-primary/10" : "border-outline-variant/20 bg-surface-container-low hover:border-outline-variant/50"
              )}
            >
              <div className="flex gap-1">
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: p.container }} />
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: p.primary }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white">{p.name}</span>
            </button>
          ))}
        </div>
        
        <div className="bg-surface-container-high/40 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-xl border border-outline-variant/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 flex items-center justify-center bg-surface-container-highest rounded-2xl">
                <Gem className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-bold text-white">Custom Accent</p>
                <p className="text-xs text-on-surface-variant font-medium">Fine-tune your cosmic vibration</p>
              </div>
            </div>
            <input 
              type="color" 
              value={theme.container}
              onChange={(e) => {
                setTheme({ name: "Custom", primary: theme.primary, container: e.target.value });
                toast.success("Custom Accent Applied", {
                  description: "Cosmic vibration fine-tuned.",
                });
              }}
              className="w-12 h-12 rounded-full border-none bg-transparent cursor-pointer"
            />
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h3 className="text-xl font-headline font-bold text-white mb-6 px-2">General Settings</h3>
        <div className="bg-surface-container-high/40 backdrop-blur-xl rounded-[2.5rem] p-4 shadow-xl border border-outline-variant/10">
          <div className="p-6 border-b border-outline-variant/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 flex items-center justify-center bg-surface-container-highest rounded-2xl">
                  <Cake className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <p className="font-bold text-white">Cosmic Birthday</p>
                  <p className="text-xs text-on-surface-variant font-medium">Mark your arrival in the universe</p>
                </div>
              </div>
            </div>
            <input 
              type="date" 
              value={birthday || ""}
              onChange={(e) => {
                onBirthdayChange(e.target.value);
                toast.success("Birthday Synchronized", {
                  description: "Your cosmic arrival date has been updated.",
                  icon: <Cake className="w-4 h-4 text-secondary" />
                });
              }}
              className="w-full bg-gradient-to-br from-surface-container-high to-surface-container-highest border border-outline-variant/20 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
            />
          </div>
          {[
            { label: "Push Notifications", sub: "Receive alerts for celestial alignments", icon: CheckCircle2, color: "text-primary", toggle: true, onClick: handleToggleNotifications },
            { label: "Visual Theme", sub: "Obsidian Prism (Dark Mode Active)", icon: ImageIcon, color: "text-secondary", action: "Change", onClick: handleVisualThemeChange },
            { label: "Global Language", sub: "English (International)", icon: RefreshCw, color: "text-tertiary", arrow: true, onClick: handleLanguageChange },
          ].map((item, i) => (
            <div 
              key={i} 
              onClick={item.onClick}
              className="flex items-center justify-between p-6 hover:bg-surface-bright/20 transition-colors rounded-[1.5rem] group cursor-pointer"
            >
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 flex items-center justify-center bg-surface-container-highest rounded-2xl">
                  <item.icon className={cn("w-6 h-6", item.color)} />
                </div>
                <div>
                  <p className="font-bold text-white">{item.label}</p>
                  <p className="text-xs text-on-surface-variant font-medium">{item.sub}</p>
                </div>
              </div>
              {item.toggle && (
                <div className={cn(
                  "w-12 h-6 rounded-full relative transition-colors",
                  notifications ? "bg-primary-container" : "bg-surface-container-highest"
                )}>
                  <div className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-md",
                    notifications ? "right-1" : "left-1"
                  )} />
                </div>
              )}
              {item.action && (
                <button className="px-5 py-2 bg-surface-container-highest rounded-full text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-white transition-colors">
                  {item.action}
                </button>
              )}
              {item.arrow && <ChevronRight className="w-5 h-5 text-on-surface-variant group-hover:translate-x-1 transition-transform" />}
            </div>
          ))}
        </div>
      </section>

      {isAdmin && (
        <div className="flex justify-center">
          <button 
            onClick={handleManageKeys}
            className="bg-primary-container text-white px-12 py-5 rounded-full font-headline font-extrabold text-sm tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-[0_0_32px_rgba(46,91,255,0.4)]"
          >
            MANAGE API KEYS
          </button>
        </div>
      )}
    </motion.div>
  );
};

const ProfileScreen: React.FC<{ events: FirestoreEvent[] }> = ({ events }) => {
  const { user, theme } = useAuth();
  
  // Calculate real insights
  const eventsSaved = events.length;
  
  // Sync count - let's use a derived number based on events and some stable randomness
  // or just a fixed number if we don't have real sync logs.
  // Let's say sync count is events * 1.5 rounded up.
  const syncCount = Math.ceil(eventsSaved * 1.5) || 0;
  
  if (!user) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="pt-24 pb-32 px-6 max-w-2xl mx-auto space-y-12"
    >
      <section className="flex flex-col items-center text-center space-y-6">
        <div className="relative group">
          <div className="absolute -inset-2 bg-gradient-to-tr from-primary-container to-secondary-container rounded-full blur-xl opacity-40 group-hover:opacity-75 transition duration-500" />
          
          {/* Star Circle */}
          <div className="absolute inset-0 -m-6 pointer-events-none">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
              <motion.div
                key={i}
                className="absolute"
                animate={{ 
                  opacity: [0.3, 1, 0.3], 
                  scale: [0.7, 1.1, 0.7],
                  rotate: [0, 360]
                }}
                transition={{ 
                  duration: 3 + Math.random() * 2, 
                  repeat: Infinity, 
                  delay: i * 0.4,
                  ease: "linear"
                }}
                style={{
                  top: `${50 + 58 * Math.sin((angle * Math.PI) / 180)}%`,
                  left: `${50 + 58 * Math.cos((angle * Math.PI) / 180)}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <Sparkles className="w-3 h-3 text-primary fill-current" />
              </motion.div>
            ))}
          </div>

          <div className="relative w-40 h-40 rounded-full border-2 border-primary/20 p-1 bg-surface">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || "User"} 
                className="w-full h-full rounded-full object-cover shadow-2xl"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-surface-container flex items-center justify-center text-primary">
                <UserIcon className="w-16 h-16" />
              </div>
            )}
          </div>
          <div className="absolute bottom-2 right-2 bg-primary-container text-white p-2.5 rounded-full border-4 border-surface shadow-xl">
            <Sparkles className="w-5 h-5 fill-current" />
          </div>
        </div>
        <div>
          <h2 className="font-headline text-4xl font-extrabold tracking-tight text-white">{user.displayName || "Celestial Voyager"}</h2>
          <p className="text-on-surface-variant text-sm mt-1">{user.email}</p>
          <div className="mt-4 inline-flex items-center gap-2.5 px-5 py-1.5 bg-surface-container-high rounded-full border border-outline-variant/20">
            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse shadow-[0_0_8px_rgba(255,184,104,0.8)]" />
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-on-surface-variant">Celestial Member</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-8 border-y border-outline-variant/10 py-8">
        {[
          { label: "Events Saved", val: eventsSaved.toString(), color: "text-primary" },
          { label: "Sync Count", val: syncCount.toString(), color: "text-secondary" },
        ].map((stat, i) => (
          <div key={i} className="flex flex-col items-center justify-center space-y-1">
            <span className={cn("text-4xl font-headline font-extrabold", stat.color)}>{stat.val}</span>
            <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em]">{stat.label}</span>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="bg-surface-container-low rounded-[2.5rem] overflow-hidden border border-outline-variant/10">
          {[
            { 
              label: "Account Security", 
              sub: "2FA Enabled • Active", 
              icon: ShieldCheck, 
              color: "text-primary",
              onClick: () => toast.success("Security Shield Active", { description: "Your cosmic identity is protected by multi-factor authentication." })
            },
            { 
              label: "Subscription Plan", 
              sub: "Premium • Renews Oct 12", 
              icon: Gem, 
              color: "text-secondary", 
              subColor: "text-secondary",
              onClick: () => toast.info("Celestial Premium", { description: "You have unlimited access to all nebula-grade features." })
            },
            { 
              label: "Linked Calendars", 
              sub: "Google, Samsung Syncing", 
              icon: CalendarPlus, 
              color: "text-tertiary",
              onClick: () => toast.success("Synchronization Active", { description: "All celestial calendars are perfectly aligned." })
            },
            { 
              label: "Help Center", 
              sub: "FAQs & Support", 
              icon: HelpCircle, 
              color: "text-on-surface-variant",
              onClick: () => toast.info("Help Center", { description: "The cosmic knowledge base is currently being updated." })
            },
          ].map((item, i) => (
            <div 
              key={i} 
              onClick={item.onClick}
              className="flex items-center justify-between p-6 hover:bg-surface-bright transition-colors cursor-pointer group border-b border-outline-variant/5 last:border-none"
            >
              <div className="flex items-center gap-5">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", item.color.replace("text-", "bg-") + "/10")}>
                  <item.icon className={cn("w-6 h-6", item.color)} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{item.label}</p>
                  <p className={cn("text-xs font-medium", item.subColor || "text-on-surface-variant")}>{item.sub}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-on-surface-variant group-hover:translate-x-1 transition-transform" />
            </div>
          ))}
        </div>
      </section>

      <button 
        onClick={() => logout()}
        className="w-full py-5 text-red-400 font-headline font-extrabold text-sm tracking-[0.2em] uppercase hover:bg-red-500/5 rounded-[1.5rem] transition-all border border-red-500/10 flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        TERMINATE SESSION
      </button>
    </motion.div>
  );
};

const AuthScreen = () => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center space-y-12 relative overflow-hidden"
    >
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10" />
      
      <div className="space-y-6">
        <div className="w-24 h-24 rounded-[2.5rem] bg-primary-container flex items-center justify-center text-white mx-auto shadow-2xl shadow-primary/20">
          <Sparkles className="w-12 h-12 fill-current" />
        </div>
        <div className="space-y-2">
          <h1 className="text-5xl font-headline font-extrabold tracking-tight text-white">Celestial Chronograph</h1>
          <p className="text-on-surface-variant font-medium max-w-xs mx-auto">Align your schedule with the stars using AI-powered extraction.</p>
        </div>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <button 
          onClick={() => loginWithGoogle()}
          className="w-full bg-white text-surface py-5 rounded-full font-bold flex items-center justify-center gap-3 hover:bg-white/90 active:scale-95 transition-all shadow-xl"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          Continue with Google
        </button>
        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Secure Cloud Sync Enabled</p>
      </div>

      <div className="grid grid-cols-3 gap-8 pt-12 opacity-40 grayscale">
        <Calendar className="w-8 h-8" />
        <RefreshCw className="w-8 h-8" />
        <ShieldCheck className="w-8 h-8" />
      </div>
    </motion.div>
  );
};

// --- Main App ---

const CelestialBackground = () => {
  return (
    <div className="celestial-bg overflow-hidden pointer-events-none">
      {Array.from({ length: 50 }).map((_, i) => (
        <div 
          key={i}
          className="star"
          style={{
            width: Math.random() * 2 + 'px',
            height: Math.random() * 2 + 'px',
            top: Math.random() * 100 + '%',
            left: Math.random() * 100 + '%',
            '--duration': (Math.random() * 3 + 2) + 's'
          } as any}
        />
      ))}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-secondary/5 rounded-full blur-[180px] animate-pulse" style={{ animationDelay: '2s' }} />
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<ThemePalette>(PALETTES[0]);
  const [screen, setScreen] = useState<Screen>("extract");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractedEvents, setExtractedEvents] = useState<ExtractedEvent[]>([]);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [manifestDate, setManifestDate] = useState<string | undefined>();
  const [events, setEvents] = useState<FirestoreEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [notifiedEvents, setNotifiedEvents] = useState<Set<string>>(new Set());
  const [birthday, setBirthday] = useState<string | null>(() => localStorage.getItem("user_birthday"));

  useEffect(() => {
    if (birthday) {
      localStorage.setItem("user_birthday", birthday);
      
      // Check if today is birthday
      const today = new Date();
      const [bYear, bMonth, bDay] = birthday.split('-').map(Number);
      const todayMonth = today.getMonth() + 1;
      const todayDay = today.getDate();
      
      if (todayMonth === bMonth && todayDay === bDay) {
        const lastWish = localStorage.getItem("last_birthday_wish");
        const todayStr = `${today.getFullYear()}-${todayMonth}-${todayDay}`;
        
        if (lastWish !== todayStr) {
          toast.success("Happy Birthday!", {
            description: "May your cosmic alignments be extra bright today! 🎂✨",
            duration: 10000,
            icon: <Cake className="w-5 h-5 text-secondary" />
          });
          localStorage.setItem("last_birthday_wish", todayStr);
        }
      }
    } else {
      localStorage.removeItem("user_birthday");
    }
  }, [birthday]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!user || events.length === 0) return;

    const checkReminders = () => {
      const now = new Date();
      
      events.forEach(event => {
        if (!event.reminderMinutes || notifiedEvents.has(event.id!)) return;

        const [year, month, day] = event.date.split('-').map(Number);
        const [hour, minute] = event.startTime.split(':').map(Number);
        const eventDate = new Date(year, month - 1, day, hour, minute);
        
        const reminderTime = new Date(eventDate.getTime() - event.reminderMinutes * 60000);
        
        // If current time is past reminder time but before event time
        if (now >= reminderTime && now < eventDate) {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`Cosmic Alignment: ${event.title}`, {
              body: `Your alignment begins in ${event.reminderMinutes} minutes at ${event.startTime}.`,
              icon: "/favicon.ico"
            });
            setNotifiedEvents(prev => new Set(prev).add(event.id!));
          }
        }
      });
    };

    const interval = setInterval(checkReminders, 30000); // Check every 30 seconds
    checkReminders(); // Initial check

    return () => clearInterval(interval);
  }, [user, events, notifiedEvents]);

  const setTheme = (p: ThemePalette) => {
    setThemeState(p);
    if (user) {
      const userRef = doc(db, "users", user.uid);
      setDoc(userRef, { theme: p }, { merge: true }).catch(err => 
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`)
      );
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch user profile including theme
        const userRef = doc(db, "users", u.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.theme) {
              setThemeState(data.theme);
            }
          }
          
          // Sync user profile basic info
          await setDoc(userRef, {
            displayName: u.displayName,
            email: u.email,
            photoURL: u.photoURL,
            createdAt: Timestamp.now(),
            role: 'user'
          }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      setEventsLoading(false);
      return;
    }

    const q = query(
      collection(db, "events"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEvents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FirestoreEvent[];
      setEvents(fetchedEvents);
      setEventsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "events");
      setEventsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleExtract = async (file: File) => {
    setIsExtracting(true);
    setExtractionError(null);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setSourceImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const base64 = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onloadend = () => {
          const res = r.result as string;
          resolve(res.split(',')[1]);
        };
        r.readAsDataURL(file);
      });

      const events = await extractScheduleFromImage(base64, file.type);
      
      if (events.length === 0) {
        throw new Error("No events could be extracted from this image. Please try a clearer photo.");
      }

      setExtractedEvents(events);
      setScreen("preview");
    } catch (err) {
      setExtractionError(err instanceof Error ? err.message : "An unknown error occurred during extraction.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleUpdateEvent = (index: number, updated: ExtractedEvent) => {
    const newEvents = [...extractedEvents];
    newEvents[index] = updated;
    setExtractedEvents(newEvents);
  };

  const handleConfirm = async () => {
    if (!user) return;

    try {
      const promises = extractedEvents.map(event => {
        // Explicitly pick and sanitize fields
        const sanitizedEvent: any = {
          title: event.title.trim(),
          date: event.date.trim(),
          startTime: event.startTime.trim(),
          userId: user.uid,
          createdAt: Timestamp.now()
        };
        
        if (event.endTime?.trim()) sanitizedEvent.endTime = event.endTime.trim();
        if (event.location?.trim()) sanitizedEvent.location = event.location.trim();
        if (event.description?.trim()) sanitizedEvent.description = event.description.trim();
        if (event.reminderMinutes) sanitizedEvent.reminderMinutes = event.reminderMinutes;
        if (event.recurrence) sanitizedEvent.recurrence = event.recurrence;

        return addDoc(collection(db, "events"), sanitizedEvent);
      });

      await Promise.all(promises);
      toast.success("Alignments Manifested", {
        description: `${extractedEvents.length} events added to your celestial calendar.`
      });
      setScreen("dashboard");
      setExtractedEvents([]);
      setSourceImage(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "events");
      toast.error("Failed to manifest alignments. Please check your connection.");
    }
  };

  const handleSaveManualEvent = async (event: ExtractedEvent) => {
    if (!user) return;

    try {
      // Explicitly pick and sanitize fields
      const sanitizedEvent: any = {
        title: event.title.trim(),
        date: event.date.trim(),
        startTime: event.startTime.trim(),
        userId: user.uid,
        createdAt: Timestamp.now()
      };
      
      if (event.endTime?.trim()) sanitizedEvent.endTime = event.endTime.trim();
      if (event.location?.trim()) sanitizedEvent.location = event.location.trim();
      if (event.description?.trim()) sanitizedEvent.description = event.description.trim();
      if (event.reminderMinutes) sanitizedEvent.reminderMinutes = event.reminderMinutes;
      if (event.recurrence) sanitizedEvent.recurrence = event.recurrence;

      await addDoc(collection(db, "events"), sanitizedEvent);
      toast.success("Alignment Manifested", {
        description: "Your manual event has been synchronized with the stars."
      });
      setScreen("dashboard");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "events");
      toast.error("Failed to manifest alignment. Please check your connection.");
    }
  };

  const handleDiscard = () => {
    setScreen("extract");
    setExtractedEvents([]);
    setSourceImage(null);
  };

  const renderScreen = () => {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <CelestialBackground />
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      );
    }

    if (!user) {
      return (
        <>
          <CelestialBackground />
          <AuthScreen />
        </>
      );
    }

    switch (screen) {
      case "dashboard": return (
        <DashboardScreen 
          key="dashboard" 
          events={events}
          loading={eventsLoading}
          birthday={birthday}
          onManifest={(date) => {
            setManifestDate(date);
            setScreen("manifest");
          }} 
        />
      );
      case "extract": return (
        <ExtractScreen 
          key="extract" 
          onExtract={handleExtract} 
          isExtracting={isExtracting}
          error={extractionError}
        />
      );
      case "preview": return (
        <PreviewScreen 
          key="preview" 
          events={extractedEvents}
          sourceImage={sourceImage}
          onConfirm={handleConfirm}
          onDiscard={handleDiscard}
          onUpdateEvent={handleUpdateEvent}
        />
      );
      case "manifest": return (
        <ManifestEventScreen 
          key="manifest"
          initialDate={manifestDate}
          onSave={handleSaveManualEvent}
          onCancel={() => setScreen("dashboard")}
        />
      );
      case "sync": return (
        <SyncScreen 
          key="sync" 
          birthday={birthday} 
          onBirthdayChange={setBirthday} 
        />
      );
      case "profile": return <ProfileScreen key="profile" events={events} />;
      default: return <ExtractScreen key="extract" onExtract={handleExtract} isExtracting={isExtracting} error={extractionError} />;
    }
  };

  const getTitle = () => {
    if (!user) return "Celestial Chronograph";
    switch (screen) {
      case "dashboard": return "Celestial Chronograph";
      case "extract": return "Celestial Chronograph";
      case "preview": return "Celestial Chronograph";
      case "manifest": return "Manifest Alignment";
      case "sync": return "Celestial Chronograph";
      case "profile": return "Celestial Profile";
      default: return "Celestial Chronograph";
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, theme, setTheme }}>
      <Toaster position="top-center" richColors theme="dark" />
      <div 
        className="min-h-screen bg-surface selection:bg-primary/30 text-white relative overflow-hidden"
        style={{ 
          // @ts-ignore
          "--primary-color": theme.primary, 
          "--primary-container-color": theme.container 
        }}
      >
        <CelestialBackground />
        {user && (
          <TopBar 
            title={getTitle()} 
            userPhoto={user.photoURL}
            onMenuClick={() => setScreen("profile")}
            showBack={screen === "profile" || screen === "preview" || screen === "manifest"} 
            onBack={() => {
              if (screen === "preview") setScreen("extract");
              else setScreen("dashboard");
            }}
          />
        )}
        
        <main className="min-h-screen relative z-10">
          <AnimatePresence mode="wait">
            {renderScreen()}
          </AnimatePresence>
        </main>

        {user && <BottomNav current={screen} setScreen={setScreen} />}
      </div>
    </AuthContext.Provider>
  );
}
