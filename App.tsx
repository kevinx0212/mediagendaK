/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, User as UserIcon, CreditCard, CheckCircle2, Plus, LogOut,
  LayoutDashboard, Settings, Wallet, Stethoscope, ShieldCheck, UserPlus,
  Trash2, Search, Clock, XCircle, RefreshCw, Filter, Users, ChevronRight,
  AlertCircle, MessageSquare, Edit2, Save, X, Archive, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { cn } from './lib/utils';

// @ts-ignore
const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY });

// --- Types ---
type Role = 'admin' | 'medico' | 'patient';
type ApptStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'COMPLETED';

interface UserProfile {
  id: string;
  name: string;
  username?: string;
  dni?: string;
  role: Role;
  password?: string;
  phone?: string;
  email?: string;
  specialization?: string;
  restDays?: string[];
}

interface Appointment {
  id: string;
  patientName: string;
  patientDni: string;
  date: string;
  time: string;
  service: string;
  paymentMethod?: 'YAPE' | 'PLIN' | 'CARD';
  paymentStatus: 'PENDING' | 'PAID';
  status: ApptStatus;
  amount: number;
  reference?: string;
  userId: string;
  cancelReason?: string;
  medicoId?: string;
  urgency?: 'BAJA' | 'MEDIA' | 'ALTA';
  specialization?: string;
  symptoms?: string;
  notes?: string;
}

interface ChatMessage {
  id: string;
  patientName: string;
  patientDni: string;
  text: string;
  from: 'patient' | 'admin';
  timestamp: string;
  read: boolean;
}

interface DoctorSchedule {
  id: string;
  medicoId: string;
  medicoName: string;
  day: string;
  startTime: string;
  endTime: string;
}

// --- Constants ---
const today = new Date().toISOString().split('T')[0];
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const SPECIALIZATION_PRICES: Record<string, number> = {
  'Cardiología': 120.00, 'Traumatología': 100.00, 'Pediatría': 80.00,
  'Dermatología': 90.00, 'Medicina General': 50.00, 'Neurología': 130.00,
  'Ginecología': 110.00, 'Oftalmología': 95.00,
};
const DEFAULT_PRICE = 50.00;

// --- Badge ---
const Badge = ({ children, status }: { children: React.ReactNode, status: ApptStatus }) => {
  const styles = {
    PENDING: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    PAID: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    CANCELLED: "bg-red-500/10 text-red-500 border-red-500/20",
    COMPLETED: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border", styles[status])}>
      {children}
    </span>
  );
};

// ===================== MAIN APP =====================
export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<ApptStatus | 'ALL' | 'TODAY'>('ALL');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const [showPaymentDialog, setShowPaymentDialog] = useState<Appointment | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState<Appointment | null>(null);
  const [showReprogramDialog, setShowReprogramDialog] = useState<Appointment | null>(null);
  const [showRecipeDialog, setShowRecipeDialog] = useState<Appointment | null>(null);
  const [showVoucherDialog, setShowVoucherDialog] = useState<Appointment | null>(null);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showCreateApptDialog, setShowCreateApptDialog] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showEditUserDialog, setShowEditUserDialog] = useState<UserProfile | null>(null);

  const [authTab, setAuthTab] = useState<Role>('admin');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPatientName, setFormPatientName] = useState('');
  const [formPatientDni, setFormPatientDni] = useState('');
  const [authError, setAuthError] = useState('');

  // Load data — use sessionStorage for profile (auto-logout on close), localStorage for data
  useEffect(() => {
    const savedProfile = sessionStorage.getItem('clinica_profile');
    const savedUsers = localStorage.getItem('clinica_users');
    const savedAppointments = localStorage.getItem('clinica_appointments');
    const savedSchedules = localStorage.getItem('clinica_schedules');
    const savedChats = localStorage.getItem('clinica_chats');

    if (savedProfile) {
      const p = JSON.parse(savedProfile);
      setProfile(p);
      if (p.role === 'patient') setCurrentView('citas');
    }

    if (savedUsers) {
      setUsers(JSON.parse(savedUsers));
    } else {
      const defaultAdmin: UserProfile = { id: 'admin-1', name: 'ADMINISTRADOR', username: 'usuario', password: '123456', role: 'admin' };
      const defaultMedico: UserProfile = { id: 'medico-1', name: 'DR. EJEMPLO', username: 'medico', password: '123456', role: 'medico', specialization: 'Medicina General', restDays: ['Domingo'] };
      setUsers([defaultAdmin, defaultMedico]);
    }

    if (savedAppointments) setAppointments(JSON.parse(savedAppointments));
    if (savedSchedules) setSchedules(JSON.parse(savedSchedules));
    if (savedChats) setChatMessages(JSON.parse(savedChats));

    setLoading(false);
  }, []);

  // Persist data
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('clinica_users', JSON.stringify(users));
      localStorage.setItem('clinica_appointments', JSON.stringify(appointments));
      localStorage.setItem('clinica_schedules', JSON.stringify(schedules));
      localStorage.setItem('clinica_chats', JSON.stringify(chatMessages));
    }
  }, [users, appointments, schedules, chatMessages, loading]);

  const handleLogout = () => {
    setProfile(null);
    setIsMobileMenuOpen(false);
    sessionStorage.removeItem('clinica_profile');
  };

  const updateProfile = (data: Partial<UserProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...data };
    setProfile(updated);
    setUsers(users.map(u => u.id === profile.id ? updated : u));
    sessionStorage.setItem('clinica_profile', JSON.stringify(updated));
  };

  // Validate DNI/CE: must match BOTH name AND document number
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (authTab === 'patient') {
      if (!formPatientName.trim() || !formPatientDni.trim()) {
        setAuthError('Por favor ingresa tu nombre y DNI/CE.');
        return;
      }
      // Validate document length: DNI=8, CE=9-12
      const dniClean = formPatientDni.trim();
      if (dniClean.length < 8 || dniClean.length > 12) {
        setAuthError('El DNI debe tener 8 dígitos y el CE entre 9 y 12 dígitos.');
        return;
      }

      // Search for existing patient by DNI AND name match
      const existingByDni = users.find(u => u.role === 'patient' && u.dni === dniClean);

      if (existingByDni) {
        // DNI exists — validate name matches
        const inputName = formPatientName.trim().toUpperCase();
        const storedName = existingByDni.name.trim().toUpperCase();
        if (inputName !== storedName) {
          setAuthError('El nombre no coincide con el DNI/CE registrado.');
          return;
        }
        setProfile(existingByDni);
        setCurrentView('citas');
        sessionStorage.setItem('clinica_profile', JSON.stringify(existingByDni));
      } else {
        // New patient — create on the fly
        const newPatient: UserProfile = {
          id: Math.random().toString(36).substr(2, 9),
          name: formPatientName.trim().toUpperCase(),
          dni: dniClean,
          role: 'patient',
        };
        const updated = [...users, newPatient];
        setUsers(updated);
        setProfile(newPatient);
        setCurrentView('citas');
        sessionStorage.setItem('clinica_profile', JSON.stringify(newPatient));
      }
    } else {
      const user = users.find(u => u.role === authTab && u.username === formUsername && u.password === formPassword);
      if (user) {
        setProfile(user);
        setCurrentView('dashboard');
        sessionStorage.setItem('clinica_profile', JSON.stringify(user));
      } else {
        setAuthError('Credenciales incorrectas.');
      }
    }
  };

  // --- Appointment Actions ---
  const createAppointment = (data: any) => {
    const price = SPECIALIZATION_PRICES[data.service] || DEFAULT_PRICE;
    const newAppt: Appointment = {
      id: Math.random().toString(36).substr(2, 9),
      patientName: data.name,
      patientDni: data.dni,
      date: data.date,
      time: data.time,
      service: data.service,
      paymentStatus: "PENDING",
      status: "PENDING",
      amount: price,
      userId: data.userId || profile?.id || 'guest',
      medicoId: data.medicoId,
      urgency: data.urgency,
      symptoms: data.symptoms,
    };
    setAppointments([newAppt, ...appointments]);
    setShowCreateApptDialog(false);
  };

  const cancelAppointment = (id: string, reason: string) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'CANCELLED', cancelReason: reason } : a));
    setShowCancelDialog(null);
  };

  const deleteAppointment = (id: string) => {
    setAppointments(appointments.filter(a => a.id !== id));
  };

  const reprogramAppointment = (id: string, newDate: string, newTime: string) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, date: newDate, time: newTime } : a));
    setShowReprogramDialog(null);
  };

  const processPayment = (id: string, method: 'YAPE' | 'PLIN' | 'CARD', ref: string) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, paymentStatus: 'PAID', paymentMethod: method, reference: ref, status: 'PAID' } : a));
    setShowPaymentDialog(null);
  };

  const completeAppointment = (id: string) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'COMPLETED' } : a));
  };

  const addRecipe = (apptId: string, notes: string) => {
    setAppointments(appointments.map(a => a.id === apptId ? { ...a, notes } : a));
    setShowRecipeDialog(null);
  };

  const addSchedule = (newSchedule: any) => {
    const schedule: DoctorSchedule = {
      id: Math.random().toString(36).substr(2, 9),
      medicoId: profile?.id || '',
      medicoName: profile?.name || '',
      ...newSchedule,
    };
    setSchedules([...schedules, schedule]);
    setShowScheduleForm(false);
  };

  const deleteSchedule = (id: string) => setSchedules(schedules.filter(s => s.id !== id));

  // --- User Actions ---
  const createUser = (data: any) => {
    const newUser: UserProfile = {
      id: Math.random().toString(36).substr(2, 9),
      name: data.name.toUpperCase(),
      username: data.username,
      password: data.password,
      dni: data.dni,
      role: data.role,
      phone: data.phone,
      email: data.email,
      specialization: data.specialization,
      restDays: data.restDays || [],
    };
    setUsers([...users, newUser]);
    setShowCreateUserDialog(false);
  };

  const editUser = (data: Partial<UserProfile>) => {
    if (!showEditUserDialog) return;
    setUsers(users.map(u => u.id === showEditUserDialog.id ? { ...u, ...data } : u));
    setShowEditUserDialog(null);
  };

  const deleteUser = (id: string) => {
    // Protect admin-1
    if (id === 'admin-1') return;
    setUsers(users.filter(u => u.id !== id));
  };

  // --- Chat ---
  const sendChatMessage = (patientName: string, patientDni: string, text: string, from: 'patient' | 'admin') => {
    const msg: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      patientName,
      patientDni,
      text,
      from,
      timestamp: new Date().toISOString(),
      read: from === 'admin',
    };
    setChatMessages(prev => [...prev, msg]);
  };

  const markRead = (patientDni: string) => {
    setChatMessages(prev => prev.map(m => m.patientDni === patientDni ? { ...m, read: true } : m));
  };

  // --- Filters ---
  const activeAppointments = appointments.filter(a => a.status !== 'CANCELLED');
  const cancelledAppointments = appointments.filter(a => a.status === 'CANCELLED');

  const sortByUrgency = (appts: Appointment[]) => {
    const order = { 'ALTA': 0, 'MEDIA': 1, 'BAJA': 2, undefined: 3 };
    return [...appts].sort((a, b) => {
      if (a.date === today && b.date === today) {
        return (order[a.urgency as keyof typeof order] ?? 3) - (order[b.urgency as keyof typeof order] ?? 3);
      }
      return 0;
    });
  };

  const filteredAppointments = sortByUrgency(activeAppointments.filter(a => {
    const matchesSearch = a.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || a.patientDni.includes(searchTerm);
    const matchesRole = profile?.role === 'patient' ? a.userId === profile.id : true;
    let matchesStatus = true;
    if (filterStatus === 'TODAY') matchesStatus = a.date === today;
    else if (filterStatus !== 'ALL') matchesStatus = a.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  }));

  const unreadChats = chatMessages.filter(m => !m.read && m.from === 'patient').length;

  if (loading) return null;

  // ===================== LOGIN SCREEN =====================
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 font-sans">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.15)]">
              <Wallet className="text-emerald-500" size={32} />
            </div>
            <h1 className="text-4xl font-black text-white mb-1 tracking-tighter italic">MEDIAGENDAK</h1>
            <p className="text-gray-500 text-[10px] uppercase tracking-[0.3em] font-bold">Sistema de Gestión Médica</p>
          </div>

          <div className="bg-[#141414] border border-white/5 shadow-2xl rounded-3xl overflow-hidden">
            <div className="flex border-b bg-white/[0.02] border-white/5">
              {(['admin', 'medico', 'patient'] as Role[]).map((role) => (
                <button
                  key={role}
                  onClick={() => { setAuthTab(role); setAuthError(''); }}
                  className={cn(
                    "flex-1 py-5 text-[10px] font-black tracking-widest uppercase transition-all relative",
                    authTab === role ? "text-emerald-500" : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  {role === 'admin' ? 'Admin' : role === 'medico' ? 'Médico' : 'Paciente'}
                  {authTab === role && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
                </button>
              ))}
            </div>

            <form className="p-10 space-y-4" onSubmit={handleLogin}>
              {authTab === 'patient' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Nombre y Apellido</label>
                    <input required type="text" value={formPatientName} onChange={e => setFormPatientName(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" placeholder="Juan Pérez" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">DNI (8 dígitos) o CE (9–12 dígitos)</label>
                    <input required type="text" value={formPatientDni} onChange={e => setFormPatientDni(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" placeholder="77665544" maxLength={12} />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Usuario</label>
                    <input required type="text" value={formUsername} onChange={e => setFormUsername(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" placeholder="usuario" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Contraseña</label>
                    <input required type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" placeholder="••••••••" />
                  </div>
                </>
              )}

              {authError && <p className="text-red-400 text-[10px] font-bold bg-red-400/10 p-4 rounded-xl border border-red-400/20">{authError}</p>}

              <button type="submit" className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 uppercase tracking-widest text-xs">
                {authTab === 'patient' ? 'Ingreso Libre' : 'Entrar al Sistema'}
              </button>
            </form>

            <div className="pb-8 pt-2 border-t border-white/5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                {authTab === 'patient' ? '¿Problemas con tu ingreso?' : 'Solo personal autorizado'}
              </p>
              {authTab === 'patient' && (
                <a href="mailto:kelcardozabr@uch.pe" className="text-emerald-500 text-[10px] font-bold hover:underline">
                  kelcardozabr@uch.pe
                </a>
              )}
            </div>
          </div>

          {/* Public ATC contact form */}
          <PublicContactForm onSend={sendChatMessage} isDarkMode={true} />
        </motion.div>
      </div>
    );
  }

  // ===================== MAIN DASHBOARD =====================
  return (
    <div className={cn("min-h-screen flex font-sans transition-colors duration-300 overflow-hidden", isDarkMode ? "bg-[#0a0a0a] text-gray-300" : "bg-gray-50 text-gray-900")}>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] lg:hidden">
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              onClick={e => e.stopPropagation()}
              className="w-72 h-full bg-[#0f0f0f] border-r border-white/5 p-8">
              <div className="flex items-center gap-3 mb-10">
                <Wallet className="text-emerald-500" size={24} />
                <span className="text-white font-black text-xl italic uppercase">MEDIAGENDAK</span>
              </div>
              <nav className="space-y-2">
                <SideNav profile={profile} currentView={currentView} setView={(v: any) => { setCurrentView(v); setIsMobileMenuOpen(false); }} isDarkMode={isDarkMode} unreadChats={unreadChats} />
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Desktop */}
      <aside className={cn("w-72 border-r flex flex-col hidden lg:flex shrink-0", isDarkMode ? "bg-[#0f0f0f] border-white/5" : "bg-white border-gray-200 shadow-sm")}>
        <div className="p-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Wallet className="text-black" size={20} />
            </div>
            <span className={cn("font-black text-xl tracking-tighter italic uppercase", isDarkMode ? "text-white" : "text-gray-900")}>MEDIAGENDAK</span>
          </div>
          <nav className="space-y-2">
            <SideNav profile={profile} currentView={currentView} setView={setCurrentView} isDarkMode={isDarkMode} unreadChats={unreadChats} />
          </nav>
        </div>
        <div className={cn("mt-auto p-8 border-t", isDarkMode ? "border-white/5 bg-white/[0.01]" : "border-gray-100 bg-gray-50/50")}>
          <div className="flex items-center gap-4 mb-6">
            <div className={cn("w-12 h-12 rounded-2xl border flex items-center justify-center font-black text-xl uppercase", isDarkMode ? "bg-white/5 border-white/10 text-emerald-500" : "bg-emerald-500 text-black border-emerald-500/10")}>
              {profile.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("font-bold text-sm truncate uppercase tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>{profile.name}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">{profile.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 text-gray-500 hover:text-red-500 text-xs font-bold transition-all p-2 rounded-xl hover:bg-red-400/5 group">
            <LogOut size={18} className="group-hover:rotate-12 transition-transform" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className={cn("h-20 border-b flex items-center justify-between px-6 lg:px-10 backdrop-blur-xl z-50 shrink-0", isDarkMode ? "bg-[#0a0a0a]/80 border-white/5" : "bg-white/80 border-gray-100")}>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className={cn("lg:hidden p-2 hover:text-emerald-500", isDarkMode ? "text-gray-400" : "text-gray-500")}>
              <Filter size={24} />
            </button>
            <h2 className={cn("text-xs font-black uppercase tracking-[0.2em] hidden sm:block", isDarkMode ? "text-white" : "text-gray-900")}>{currentView}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-white/[0.03] border border-white/5 rounded-full mr-2">
              <ShieldCheck size={14} className={cn(profile.role === 'admin' ? "text-red-500" : profile.role === 'medico' ? "text-emerald-500" : "text-blue-500")} />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{profile.role}</span>
            </div>
            {profile.role !== 'medico' && (
              <button onClick={() => setShowCreateApptDialog(true)}
                className="bg-emerald-500 text-black text-[9px] sm:text-[10px] font-black uppercase tracking-widest py-2.5 px-4 sm:px-6 rounded-xl hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/10">
                <Plus size={16} /> <span className="hidden xs:inline">Cita</span>
              </button>
            )}
            <button onClick={handleLogout} className="lg:hidden p-2.5 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className={cn("flex-1 overflow-y-auto p-6 lg:p-10", isDarkMode ? "bg-[#0a0a0a]" : "bg-white")}>
          <div className="max-w-7xl mx-auto">
            {currentView === 'dashboard' && profile.role !== 'patient' && (
              <DashboardView profile={profile} appointments={appointments} isDarkMode={isDarkMode} />
            )}
            {currentView === 'citas' && (
              <CitasView
                profile={profile}
                appointments={filteredAppointments}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                isDarkMode={isDarkMode}
                onPay={setShowPaymentDialog}
                onCancel={setShowCancelDialog}
                onReprogram={setShowReprogramDialog}
                onComplete={completeAppointment}
                onAddRecipe={setShowRecipeDialog}
                onDelete={profile.role === 'admin' ? deleteAppointment : undefined}
              />
            )}
            {currentView === 'canceladas' && profile.role === 'admin' && (
              <CancelladasView
                appointments={cancelledAppointments}
                isDarkMode={isDarkMode}
                onDelete={deleteAppointment}
              />
            )}
            {currentView === 'pagos' && profile.role === 'patient' && (
              <PagosPendientesView
                appointments={appointments.filter(a => a.userId === profile.id)}
                isDarkMode={isDarkMode}
                onPay={setShowPaymentDialog}
                onViewVoucher={setShowVoucherDialog}
              />
            )}
            {currentView === 'informacion' && profile.role === 'patient' && (
              <InformacionView profile={profile} isDarkMode={isDarkMode} onUpdate={updateProfile} />
            )}
            {currentView === 'usuarios' && profile.role === 'admin' && (
              <UsuariosView
                users={users}
                isDarkMode={isDarkMode}
                onCreate={() => setShowCreateUserDialog(true)}
                onEdit={setShowEditUserDialog}
                onDelete={deleteUser}
              />
            )}
            {currentView === 'horarios' && (
              <HorariosView
                schedules={schedules}
                profile={profile}
                users={users}
                isDarkMode={isDarkMode}
                onAdd={() => setShowScheduleForm(true)}
                onDelete={deleteSchedule}
              />
            )}
            {currentView === 'atc' && (profile.role === 'admin') && (
              <ATCView
                messages={chatMessages}
                users={users}
                isDarkMode={isDarkMode}
                onReply={(patientName, patientDni, text) => sendChatMessage(patientName, patientDni, text, 'admin')}
                onMarkRead={markRead}
              />
            )}
            {currentView === 'mensajes' && profile.role === 'patient' && (
              <MensajesView
                profile={profile}
                messages={chatMessages.filter(m => m.patientDni === profile.dni)}
                isDarkMode={isDarkMode}
                onSend={(text) => sendChatMessage(profile.name, profile.dni || '', text, 'patient')}
              />
            )}
            {currentView === 'ajustes' && (
              <AjustesView profile={profile} isDarkMode={isDarkMode} toggleTheme={() => setIsDarkMode(!isDarkMode)} />
            )}
          </div>
        </div>
      </main>

      {/* Dialogs */}
      <AnimatePresence>
        {showPaymentDialog && <PaymentModal appt={showPaymentDialog} onClose={() => setShowPaymentDialog(null)} onConfirm={processPayment} />}
        {showVoucherDialog && <VoucherModal appt={showVoucherDialog} onClose={() => setShowVoucherDialog(null)} />}
        {showCancelDialog && <CancelModal appt={showCancelDialog} onClose={() => setShowCancelDialog(null)} onConfirm={cancelAppointment} />}
        {showReprogramDialog && <ReprogramModal appt={showReprogramDialog} schedules={schedules} onClose={() => setShowReprogramDialog(null)} onConfirm={reprogramAppointment} />}
        {showRecipeDialog && <RecipeModal appt={showRecipeDialog} profile={profile} onClose={() => setShowRecipeDialog(null)} onConfirm={addRecipe} />}
        {showCreateUserDialog && <CreateUserModal onClose={() => setShowCreateUserDialog(false)} onConfirm={createUser} />}
        {showEditUserDialog && <EditUserModal user={showEditUserDialog} onClose={() => setShowEditUserDialog(null)} onConfirm={editUser} />}
        {showCreateApptDialog && <CreateApptModal profile={profile} schedules={schedules} onClose={() => setShowCreateApptDialog(false)} onConfirm={createAppointment} />}
        {showScheduleForm && <ScheduleModal onClose={() => setShowScheduleForm(false)} onConfirm={addSchedule} />}
      </AnimatePresence>
    </div>
  );
}

// ===================== SIDENAV =====================
function SideNav({ profile, currentView, setView, isDarkMode, unreadChats }: any) {
  if (profile.role === 'patient') {
    return (
      <>
        <NavItem active={currentView === 'citas'} icon={<Calendar size={20} />} label="Mis Citas" onClick={() => setView('citas')} isDarkMode={isDarkMode} />
        <NavItem active={currentView === 'pagos'} icon={<CreditCard size={20} />} label="Pagos Pendientes" onClick={() => setView('pagos')} isDarkMode={isDarkMode} />
        <NavItem active={currentView === 'mensajes'} icon={<MessageSquare size={20} />} label="Mensajes" onClick={() => setView('mensajes')} isDarkMode={isDarkMode} />
        <NavItem active={currentView === 'informacion'} icon={<UserIcon size={20} />} label="Mi Información" onClick={() => setView('informacion')} isDarkMode={isDarkMode} />
        <NavItem active={currentView === 'ajustes'} icon={<Settings size={20} />} label="Ajustes" onClick={() => setView('ajustes')} isDarkMode={isDarkMode} />
      </>
    );
  }
  if (profile.role === 'medico') {
    return (
      <>
        <NavItem active={currentView === 'dashboard'} icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={() => setView('dashboard')} isDarkMode={isDarkMode} />
        <NavItem active={currentView === 'citas'} icon={<Calendar size={20} />} label="Citas Médicas" onClick={() => setView('citas')} isDarkMode={isDarkMode} />
        <NavItem active={currentView === 'horarios'} icon={<Clock size={20} />} label="Mi Horario" onClick={() => setView('horarios')} isDarkMode={isDarkMode} />
        <NavItem active={currentView === 'ajustes'} icon={<Settings size={20} />} label="Configuración" onClick={() => setView('ajustes')} isDarkMode={isDarkMode} />
      </>
    );
  }
  // Admin
  return (
    <>
      <NavItem active={currentView === 'dashboard'} icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={() => setView('dashboard')} isDarkMode={isDarkMode} />
      <NavItem active={currentView === 'citas'} icon={<Calendar size={20} />} label="Citas Médicas" onClick={() => setView('citas')} isDarkMode={isDarkMode} />
      <NavItem active={currentView === 'canceladas'} icon={<Archive size={20} />} label="Canceladas" onClick={() => setView('canceladas')} isDarkMode={isDarkMode} />
      <NavItem active={currentView === 'horarios'} icon={<Clock size={20} />} label="Horarios Médicos" onClick={() => setView('horarios')} isDarkMode={isDarkMode} />
      <NavItem active={currentView === 'usuarios'} icon={<Users size={20} />} label="Usuarios" onClick={() => setView('usuarios')} isDarkMode={isDarkMode} />
      <NavItem active={currentView === 'atc'} icon={<MessageSquare size={20} />} label={`ATC${unreadChats > 0 ? ` (${unreadChats})` : ''}`} onClick={() => setView('atc')} isDarkMode={isDarkMode} badge={unreadChats} />
      <NavItem active={currentView === 'ajustes'} icon={<Settings size={20} />} label="Configuración" onClick={() => setView('ajustes')} isDarkMode={isDarkMode} />
    </>
  );
}

function NavItem({ active, icon, label, onClick, isDarkMode, badge }: any) {
  return (
    <button onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-sm transition-all group",
        active ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
          : isDarkMode ? "text-gray-500 hover:bg-white/5 hover:text-gray-300"
            : "text-gray-400 hover:bg-emerald-500/5 hover:text-emerald-600"
      )}>
      <span className={cn("transition-transform group-hover:scale-110", active ? "text-black" : "text-emerald-500")}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge > 0 && !active && (
        <span className="bg-red-500 text-white text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center">{badge}</span>
      )}
    </button>
  );
}

// ===================== DASHBOARD =====================
function DashboardView({ profile, appointments, isDarkMode }: any) {
  const stats = [
    { label: 'Citas Totales', value: appointments.length, color: isDarkMode ? 'text-white' : 'text-gray-900' },
    { label: 'Pendientes', value: appointments.filter((a: any) => a.status === 'PENDING').length, color: 'text-amber-500' },
    { label: 'Completadas', value: appointments.filter((a: any) => a.status === 'COMPLETED').length, color: 'text-blue-500' },
    { label: 'Ingresos', value: `S/ ${appointments.filter((a: any) => a.paymentStatus === 'PAID').reduce((acc: number, curr: any) => acc + curr.amount, 0).toFixed(2)}`, color: 'text-emerald-500' },
  ];

  const todayAppts = appointments
    .filter((a: any) => a.date === today && a.status !== 'CANCELLED')
    .sort((a: any, b: any) => {
      const order: any = { 'ALTA': 0, 'MEDIA': 1, 'BAJA': 2 };
      return (order[a.urgency] ?? 3) - (order[b.urgency] ?? 3);
    });

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <div key={i} className={cn("border p-8 rounded-3xl shadow-xl transition-colors", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
            <p className="text-[10px] uppercase font-black tracking-widest text-gray-500 mb-2">{s.label}</p>
            <h3 className={cn("text-4xl font-black tracking-tighter", s.color)}>{s.value}</h3>
          </div>
        ))}
      </div>

      <div className={cn("border rounded-[40px] p-12 text-center relative overflow-hidden transition-colors", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
        <LayoutDashboard className="mx-auto text-emerald-500/20 mb-6" size={80} />
        <h2 className={cn("text-3xl font-black mb-4 tracking-tight uppercase italic", isDarkMode ? "text-white" : "text-gray-900")}>Bienvenido, {profile.name}</h2>
        <p className="text-gray-500 text-sm max-w-xl mx-auto leading-relaxed">Panel de control MEDIAGENDAK. Gestiona citas, revisa historiales y mantén el control total.</p>
      </div>

      <div className="space-y-6">
        <h3 className={cn("text-sm font-black uppercase tracking-widest flex items-center gap-2", isDarkMode ? "text-white" : "text-gray-900")}>
          <Calendar size={18} className="text-emerald-500" /> Agenda de Hoy — por Prioridad
        </h3>

        {/* Table view for today's appointments */}
        <div className={cn("border rounded-2xl overflow-hidden", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
          {todayAppts.length === 0 ? (
            <p className="text-center text-gray-500 text-xs p-8">No hay citas para hoy.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className={cn("border-b", isDarkMode ? "border-white/5 bg-white/[0.02]" : "border-gray-100 bg-gray-50")}>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-black">Hora</th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-black">Paciente</th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-black">Servicio</th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-black">Urgencia</th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-black">Estado</th>
                </tr>
              </thead>
              <tbody>
                {todayAppts.map((a: any) => (
                  <tr key={a.id} className={cn("border-b last:border-0 transition-colors", isDarkMode ? "border-white/5 hover:bg-white/[0.02]" : "border-gray-50 hover:bg-gray-50")}>
                    <td className="px-5 py-3 font-mono text-emerald-500 font-bold">{a.time}</td>
                    <td className={cn("px-5 py-3 font-bold uppercase", isDarkMode ? "text-white" : "text-gray-900")}>{a.patientName}</td>
                    <td className="px-5 py-3 text-gray-400">{a.service}</td>
                    <td className="px-5 py-3">
                      {a.urgency && (
                        <span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black",
                          a.urgency === 'ALTA' ? "bg-red-500/10 text-red-500" :
                            a.urgency === 'MEDIA' ? "bg-amber-500/10 text-amber-500" :
                              "bg-emerald-500/10 text-emerald-500"
                        )}>{a.urgency}</span>
                      )}
                    </td>
                    <td className="px-5 py-3"><Badge status={a.status}>{a.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== CITAS VIEW =====================
function CitasView({ profile, appointments, searchTerm, setSearchTerm, filterStatus, setFilterStatus, onPay, onCancel, onReprogram, onComplete, onAddRecipe, onDelete, isDarkMode }: any) {
  const isStaff = profile.role === 'admin' || profile.role === 'medico';

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input type="text" placeholder="Buscar por nombre o DNI..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-[#141414] border border-white/5 py-4 pl-12 pr-6 rounded-2xl text-sm text-white outline-none focus:border-emerald-500/30 transition-all" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {(['ALL', 'TODAY', 'PENDING', 'PAID', 'COMPLETED'] as any[]).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
                filterStatus === s ? "bg-emerald-500 text-black border-emerald-500" : "bg-white/5 text-gray-500 border-white/5 hover:border-white/10")}>
              {s === 'ALL' ? 'Todas' : s === 'TODAY' ? 'Hoy' : s}
            </button>
          ))}
        </div>
      </div>

      {isStaff ? (
        // TABLE for admin/medico
        <div className={cn("border rounded-2xl overflow-hidden", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
          {appointments.length === 0 ? (
            <p className="text-center text-gray-500 text-xs p-8">No hay citas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className={cn("border-b", isDarkMode ? "border-white/5 bg-white/[0.02]" : "border-gray-100 bg-gray-50")}>
                    {['Paciente', 'DNI/CE', 'Fecha', 'Hora', 'Servicio', 'Monto', 'Urgencia', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-black whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a: any) => (
                    <tr key={a.id} className={cn("border-b last:border-0 transition-colors", isDarkMode ? "border-white/5 hover:bg-white/[0.02]" : "border-gray-50 hover:bg-gray-50",
                      a.urgency === 'ALTA' && a.date === today ? "border-l-2 border-l-red-500" : "")}>
                      <td className={cn("px-4 py-3 font-bold uppercase whitespace-nowrap", isDarkMode ? "text-white" : "text-gray-900")}>{a.patientName}</td>
                      <td className="px-4 py-3 font-mono text-gray-400">{a.patientDni}</td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{a.date}</td>
                      <td className="px-4 py-3 font-mono text-emerald-500 font-bold">{a.time}</td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{a.service}</td>
                      <td className={cn("px-4 py-3 font-bold whitespace-nowrap", isDarkMode ? "text-white" : "text-gray-900")}>S/ {a.amount?.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        {a.urgency && (
                          <span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black",
                            a.urgency === 'ALTA' ? "bg-red-500/10 text-red-500" :
                              a.urgency === 'MEDIA' ? "bg-amber-500/10 text-amber-500" :
                                "bg-emerald-500/10 text-emerald-500")}>{a.urgency}</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><Badge status={a.status}>{a.status}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {a.status === 'PENDING' && <button onClick={() => onPay(a)} title="Pagar" className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all"><CreditCard size={12} /></button>}
                          {a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && <button onClick={() => onCancel(a)} title="Cancelar" className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"><XCircle size={12} /></button>}
                          {a.status === 'PAID' && profile.role === 'medico' && <button onClick={() => onComplete(a.id)} title="Completar" className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-all"><CheckCircle2 size={12} /></button>}
                          {(profile.role === 'medico' || profile.role === 'admin') && <button onClick={() => onAddRecipe(a)} title="Receta" className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all"><Edit2 size={12} /></button>}
                          {profile.role === 'admin' && onDelete && <button onClick={() => onDelete(a.id)} title="Eliminar" className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"><Trash2 size={12} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        // CARDS for patients
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {appointments.length === 0 ? (
            <p className="text-gray-500 text-xs col-span-3 text-center py-10">No tienes citas registradas.</p>
          ) : appointments.map((appt: any) => (
            <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} key={appt.id}
              className={cn("border rounded-3xl p-8 transition-all group relative overflow-hidden",
                isDarkMode ? "bg-[#141414] border-white/5 hover:border-emerald-500/20" : "bg-white border-gray-100 shadow-sm hover:border-emerald-500/20")}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className={cn("font-black text-lg mb-1 uppercase tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>{appt.patientName}</h4>
                  <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">DNI/CE: {appt.patientDni}</p>
                </div>
                <Badge status={appt.status}>{appt.status}</Badge>
              </div>
              <div className="space-y-3 mb-6 text-xs text-gray-400">
                <div className="flex items-center gap-2"><Calendar size={14} className="text-emerald-500" />{appt.date} — {appt.time}</div>
                <div className="flex items-center gap-2"><Stethoscope size={14} className="text-emerald-500" />{appt.service}</div>
                <div className="flex items-center gap-2"><Wallet size={14} className="text-emerald-500" />S/ {appt.amount?.toFixed(2)}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {appt.status === 'PENDING' && <button onClick={() => onPay(appt)} className="flex-1 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-[10px] font-black hover:bg-emerald-500/20 transition-all">Pagar</button>}
                {appt.status !== 'COMPLETED' && appt.status !== 'CANCELLED' && <button onClick={() => onCancel(appt)} className="flex-1 py-2 rounded-xl bg-red-500/10 text-red-500 text-[10px] font-black hover:bg-red-500/20 transition-all">Cancelar</button>}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== CANCELADAS VIEW (Admin) =====================
function CancelladasView({ appointments, isDarkMode, onDelete }: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Archive className="text-red-500" size={20} />
        <h2 className={cn("text-sm font-black uppercase tracking-widest", isDarkMode ? "text-white" : "text-gray-900")}>
          Citas Canceladas ({appointments.length})
        </h2>
      </div>
      <div className={cn("border rounded-2xl overflow-hidden", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
        {appointments.length === 0 ? (
          <p className="text-center text-gray-500 text-xs p-8">No hay citas canceladas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className={cn("border-b", isDarkMode ? "border-white/5 bg-white/[0.02]" : "border-gray-100 bg-gray-50")}>
                  {['Paciente', 'DNI/CE', 'Fecha', 'Servicio', 'Motivo', 'Monto', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-black">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appointments.map((a: any) => (
                  <tr key={a.id} className={cn("border-b last:border-0", isDarkMode ? "border-white/5" : "border-gray-50")}>
                    <td className={cn("px-4 py-3 font-bold uppercase", isDarkMode ? "text-white" : "text-gray-900")}>{a.patientName}</td>
                    <td className="px-4 py-3 font-mono text-gray-400">{a.patientDni}</td>
                    <td className="px-4 py-3 text-gray-400">{a.date}</td>
                    <td className="px-4 py-3 text-gray-400">{a.service}</td>
                    <td className="px-4 py-3 text-gray-500 italic max-w-xs truncate">{a.cancelReason || '—'}</td>
                    <td className={cn("px-4 py-3 font-bold", isDarkMode ? "text-white" : "text-gray-900")}>S/ {a.amount?.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => onDelete(a.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== PAGOS VIEW =====================
function PagosPendientesView({ appointments, isDarkMode, onPay, onViewVoucher }: any) {
  const pending = appointments.filter((a: any) => a.paymentStatus === 'PENDING' && a.status !== 'CANCELLED');
  const paid = appointments.filter((a: any) => a.paymentStatus === 'PAID');
  return (
    <div className="space-y-10">
      <Section title="Pagos Pendientes" icon={<AlertCircle className="text-amber-500" size={18} />} isDarkMode={isDarkMode}>
        {pending.length === 0 ? <Empty text="No tienes pagos pendientes." /> : pending.map((a: any) => (
          <PayRow key={a.id} a={a} isDarkMode={isDarkMode} onPay={onPay} />
        ))}
      </Section>
      <Section title="Historial de Pagos" icon={<CheckCircle2 className="text-emerald-500" size={18} />} isDarkMode={isDarkMode}>
        {paid.length === 0 ? <Empty text="Sin pagos registrados." /> : paid.map((a: any) => (
          <PayRow key={a.id} a={a} isDarkMode={isDarkMode} onViewVoucher={onViewVoucher} />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, icon, children, isDarkMode }: any) {
  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400">{icon}{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function PayRow({ a, isDarkMode, onPay, onViewVoucher }: any) {
  return (
    <div className={cn("flex items-center justify-between p-5 rounded-2xl border", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
      <div>
        <p className={cn("font-bold text-sm uppercase", isDarkMode ? "text-white" : "text-gray-900")}>{a.service}</p>
        <p className="text-[10px] text-gray-500">{a.date} — {a.time}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={cn("font-black", isDarkMode ? "text-white" : "text-gray-900")}>S/ {a.amount?.toFixed(2)}</span>
        {onPay && <button onClick={() => onPay(a)} className="py-2 px-4 rounded-xl bg-emerald-500 text-black text-[10px] font-black hover:bg-emerald-400 transition-all">Pagar</button>}
        {onViewVoucher && a.reference && <button onClick={() => onViewVoucher(a)} className="py-2 px-4 rounded-xl bg-blue-500/10 text-blue-400 text-[10px] font-black hover:bg-blue-500/20 transition-all">Voucher</button>}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-gray-500 text-xs text-center py-4">{text}</p>;
}

// ===================== INFORMACION VIEW =====================
function InformacionView({ profile, isDarkMode, onUpdate }: any) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone || '');
  const [email, setEmail] = useState(profile.email || '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onUpdate({ name: name.toUpperCase(), phone, email });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-lg space-y-6">
      <h2 className={cn("text-sm font-black uppercase tracking-widest", isDarkMode ? "text-white" : "text-gray-900")}>Mi Información</h2>
      {[
        { label: 'Nombre', value: name, set: setName },
        { label: 'Teléfono', value: phone, set: setPhone },
        { label: 'Correo', value: email, set: setEmail },
      ].map(f => (
        <div key={f.label} className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{f.label}</label>
          <input value={f.value} onChange={e => f.set(e.target.value)}
            className={cn("w-full py-4 px-5 rounded-2xl text-sm outline-none transition-all border", isDarkMode ? "bg-white/[0.03] border-white/5 text-white focus:border-emerald-500/50" : "bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500")} />
        </div>
      ))}
      <button onClick={handleSave} className="bg-emerald-500 text-black font-black py-4 px-8 rounded-2xl hover:bg-emerald-400 transition-all text-xs uppercase tracking-widest flex items-center gap-2">
        <Save size={16} />{saved ? '¡Guardado!' : 'Guardar'}
      </button>
    </div>
  );
}

// ===================== USUARIOS VIEW =====================
function UsuariosView({ users, isDarkMode, onCreate, onEdit, onDelete }: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={cn("text-sm font-black uppercase tracking-widest", isDarkMode ? "text-white" : "text-gray-900")}>Usuarios ({users.length})</h2>
        <button onClick={onCreate} className="bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest py-3 px-6 rounded-xl hover:bg-emerald-400 transition-all flex items-center gap-2">
          <UserPlus size={16} /> Nuevo Usuario
        </button>
      </div>
      <div className={cn("border rounded-2xl overflow-hidden", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={cn("border-b", isDarkMode ? "border-white/5 bg-white/[0.02]" : "border-gray-100 bg-gray-50")}>
                {['Nombre', 'Rol', 'Usuario/DNI', 'Teléfono', 'Correo', 'Especialidad', 'Acciones'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-black whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} className={cn("border-b last:border-0", isDarkMode ? "border-white/5 hover:bg-white/[0.02]" : "border-gray-50 hover:bg-gray-50")}>
                  <td className={cn("px-4 py-3 font-bold uppercase", isDarkMode ? "text-white" : "text-gray-900")}>{u.name}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black uppercase",
                      u.role === 'admin' ? "bg-red-500/10 text-red-500" :
                        u.role === 'medico' ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-400")}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-400">{u.username || u.dni || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{u.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{u.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{u.specialization || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => onEdit(u)} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"><Edit2 size={12} /></button>
                      {u.id !== 'admin-1' && (
                        <button onClick={() => onDelete(u.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"><Trash2 size={12} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===================== HORARIOS VIEW =====================
function HorariosView({ schedules, profile, users, isDarkMode, onAdd, onDelete }: any) {
  const medicos = users.filter((u: any) => u.role === 'medico');
  const mySchedules = profile.role === 'medico'
    ? schedules.filter((s: any) => s.medicoId === profile.id)
    : schedules;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className={cn("text-sm font-black uppercase tracking-widest", isDarkMode ? "text-white" : "text-gray-900")}>
          {profile.role === 'medico' ? 'Mi Horario' : 'Horarios Médicos'}
        </h2>
        {profile.role === 'medico' && (
          <button onClick={onAdd} className="bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest py-3 px-6 rounded-xl hover:bg-emerald-400 transition-all flex items-center gap-2">
            <Plus size={16} /> Agregar Turno
          </button>
        )}
      </div>

      {/* Medico info: specialization + rest days */}
      {profile.role === 'medico' && (
        <div className={cn("border rounded-2xl p-6 space-y-3", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
          <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Especialidad</p>
          <p className={cn("font-bold text-sm", isDarkMode ? "text-white" : "text-gray-900")}>{profile.specialization || 'No asignada'}</p>
          <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-3">Días de Descanso</p>
          <div className="flex flex-wrap gap-2">
            {DIAS_SEMANA.map(d => (
              <span key={d} className={cn("px-3 py-1 rounded-full text-[10px] font-black",
                profile.restDays?.includes(d) ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-white/5 text-gray-500 border border-white/5")}>{d}</span>
            ))}
          </div>
        </div>
      )}

      {/* Admin: show all doctors with their schedules */}
      {profile.role === 'admin' && (
        <div className="space-y-6">
          {medicos.length === 0 ? (
            <Empty text="No hay médicos registrados." />
          ) : medicos.map((med: any) => {
            const medSchedules = schedules.filter((s: any) => s.medicoId === med.id);
            return (
              <div key={med.id} className={cn("border rounded-2xl overflow-hidden", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
                <div className={cn("px-6 py-4 border-b flex items-center justify-between", isDarkMode ? "border-white/5 bg-white/[0.02]" : "border-gray-100 bg-gray-50")}>
                  <div>
                    <p className={cn("font-black uppercase text-sm", isDarkMode ? "text-white" : "text-gray-900")}>{med.name}</p>
                    <p className="text-[10px] text-emerald-500 font-bold">{med.specialization || 'Sin especialidad'}</p>
                  </div>
                  <div className="flex gap-1">
                    {med.restDays?.map((d: string) => (
                      <span key={d} className="px-2 py-0.5 rounded-full text-[8px] font-black bg-red-500/10 text-red-500">{d}</span>
                    ))}
                  </div>
                </div>
                {medSchedules.length === 0 ? (
                  <p className="text-gray-500 text-xs p-4 text-center">Sin turnos registrados.</p>
                ) : (
                  <table className="w-full text-xs">
                    <tbody>
                      {medSchedules.map((s: any) => (
                        <tr key={s.id} className={cn("border-b last:border-0", isDarkMode ? "border-white/5" : "border-gray-50")}>
                          <td className={cn("px-4 py-3 font-bold", isDarkMode ? "text-white" : "text-gray-900")}>{s.day}</td>
                          <td className="px-4 py-3 text-emerald-500 font-mono">{s.startTime} — {s.endTime}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => onDelete(s.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20"><Trash2 size={12} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Medico: own schedule table */}
      {profile.role === 'medico' && (
        <div className={cn("border rounded-2xl overflow-hidden", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
          {mySchedules.length === 0 ? (
            <p className="text-center text-gray-500 text-xs p-8">No tienes turnos registrados.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className={cn("border-b", isDarkMode ? "border-white/5 bg-white/[0.02]" : "border-gray-100 bg-gray-50")}>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-black">Día</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-black">Horario</th>
                  <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-black">Acción</th>
                </tr>
              </thead>
              <tbody>
                {mySchedules.map((s: any) => (
                  <tr key={s.id} className={cn("border-b last:border-0", isDarkMode ? "border-white/5" : "border-gray-50")}>
                    <td className={cn("px-4 py-3 font-bold", isDarkMode ? "text-white" : "text-gray-900")}>{s.day}</td>
                    <td className="px-4 py-3 text-emerald-500 font-mono">{s.startTime} — {s.endTime}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => onDelete(s.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20"><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ===================== ATC VIEW (Admin) =====================
function ATCView({ messages, users, isDarkMode, onReply, onMarkRead }: any) {
  const [selectedDni, setSelectedDni] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Group by patient
  const conversations = Array.from(new Set(messages.map((m: any) => m.patientDni))) as string[];

  const selectedMessages = selectedDni ? messages.filter((m: any) => m.patientDni === selectedDni) : [];
  const selectedPatientName = selectedMessages[0]?.patientName || selectedDni;

  const handleSelect = (dni: string) => {
    setSelectedDni(dni);
    onMarkRead(dni);
  };

  const handleReply = () => {
    if (!replyText.trim() || !selectedDni) return;
    onReply(selectedPatientName, selectedDni, replyText);
    setReplyText('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedMessages.length]);

  return (
    <div className="space-y-4">
      <h2 className={cn("text-sm font-black uppercase tracking-widest", isDarkMode ? "text-white" : "text-gray-900")}>ATC — Atención al Cliente</h2>
      <div className={cn("flex border rounded-2xl overflow-hidden h-[600px]", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
        {/* Sidebar */}
        <div className={cn("w-72 border-r flex flex-col shrink-0", isDarkMode ? "border-white/5" : "border-gray-100")}>
          <div className={cn("p-4 border-b text-[10px] font-black uppercase tracking-widest text-gray-500", isDarkMode ? "border-white/5" : "border-gray-100")}>
            Conversaciones ({conversations.length})
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="text-center text-gray-500 text-xs p-6">Sin mensajes aún.</p>
            ) : conversations.map((dni: string) => {
              const convMsgs = messages.filter((m: any) => m.patientDni === dni);
              const last = convMsgs[convMsgs.length - 1];
              const unread = convMsgs.filter((m: any) => !m.read && m.from === 'patient').length;
              return (
                <button key={dni} onClick={() => handleSelect(dni)}
                  className={cn("w-full text-left p-4 border-b transition-all",
                    selectedDni === dni ? "bg-emerald-500/10 border-emerald-500/20" : isDarkMode ? "border-white/5 hover:bg-white/[0.02]" : "border-gray-50 hover:bg-gray-50")}>
                  <div className="flex items-center justify-between mb-1">
                    <p className={cn("font-bold text-xs uppercase truncate", isDarkMode ? "text-white" : "text-gray-900")}>{last?.patientName}</p>
                    {unread > 0 && <span className="bg-red-500 text-white text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center shrink-0">{unread}</span>}
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono">DNI/CE: {dni}</p>
                  <p className="text-[10px] text-gray-500 truncate mt-1 italic">{last?.text}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col">
          {!selectedDni ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-xs">Selecciona una conversación</div>
          ) : (
            <>
              <div className={cn("p-4 border-b flex items-center gap-3", isDarkMode ? "border-white/5" : "border-gray-100")}>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-black text-sm">{selectedPatientName.charAt(0)}</div>
                <div>
                  <p className={cn("font-bold text-sm uppercase", isDarkMode ? "text-white" : "text-gray-900")}>{selectedPatientName}</p>
                  <p className="text-[10px] text-gray-500 font-mono">DNI/CE: {selectedDni}</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedMessages.map((m: any) => (
                  <div key={m.id} className={cn("flex", m.from === 'admin' ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-xs px-4 py-2 rounded-2xl text-xs",
                      m.from === 'admin' ? "bg-emerald-500 text-black font-bold rounded-br-sm" : isDarkMode ? "bg-white/5 text-gray-300 rounded-bl-sm" : "bg-gray-100 text-gray-700 rounded-bl-sm")}>
                      <p>{m.text}</p>
                      <p className={cn("text-[8px] mt-1", m.from === 'admin' ? "text-black/60" : "text-gray-500")}>{new Date(m.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className={cn("p-4 border-t flex gap-2", isDarkMode ? "border-white/5" : "border-gray-100")}>
                <input value={replyText} onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReply()}
                  placeholder="Escribe una respuesta..."
                  className={cn("flex-1 py-3 px-4 rounded-xl text-sm outline-none transition-all border", isDarkMode ? "bg-white/[0.03] border-white/5 text-white focus:border-emerald-500/50" : "bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500")} />
                <button onClick={handleReply} className="bg-emerald-500 text-black font-black px-5 rounded-xl hover:bg-emerald-400 transition-all text-xs">Enviar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== MENSAJES VIEW (Patient) =====================
function MensajesView({ profile, messages, isDarkMode, onSend }: any) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="space-y-4">
      <h2 className={cn("text-sm font-black uppercase tracking-widest", isDarkMode ? "text-white" : "text-gray-900")}>Mensajes — Atención al Cliente</h2>
      <div className={cn("flex flex-col border rounded-2xl overflow-hidden h-[500px]", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
        <div className={cn("p-4 border-b", isDarkMode ? "border-white/5" : "border-gray-100")}>
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Chat con Administración</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-gray-500 text-xs mt-10">Escribe un mensaje para contactar con administración.</p>
          ) : messages.map((m: any) => (
            <div key={m.id} className={cn("flex", m.from === 'patient' ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-xs px-4 py-2 rounded-2xl text-xs",
                m.from === 'patient' ? "bg-emerald-500 text-black font-bold rounded-br-sm" : isDarkMode ? "bg-white/5 text-gray-300 rounded-bl-sm" : "bg-gray-100 text-gray-700 rounded-bl-sm")}>
                <p>{m.text}</p>
                <p className={cn("text-[8px] mt-1", m.from === 'patient' ? "text-black/60" : "text-gray-500")}>{new Date(m.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className={cn("p-4 border-t flex gap-2", isDarkMode ? "border-white/5" : "border-gray-100")}>
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Escribe tu mensaje..."
            className={cn("flex-1 py-3 px-4 rounded-xl text-sm outline-none transition-all border", isDarkMode ? "bg-white/[0.03] border-white/5 text-white focus:border-emerald-500/50" : "bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500")} />
          <button onClick={handleSend} className="bg-emerald-500 text-black font-black px-5 rounded-xl hover:bg-emerald-400 transition-all text-xs">Enviar</button>
        </div>
      </div>
    </div>
  );
}

// ===================== PUBLIC CONTACT FORM =====================
function PublicContactForm({ onSend, isDarkMode }: any) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [dni, setDni] = useState('');
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dni.trim() || !msg.trim()) return;
    onSend(name.toUpperCase().trim(), dni.trim(), msg);
    setSent(true);
    setTimeout(() => { setSent(false); setMsg(''); setOpen(false); }, 2500);
  };

  return (
    <div className="mt-6">
      <button onClick={() => setOpen(!open)} className="w-full text-[10px] text-gray-500 hover:text-emerald-500 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2">
        <MessageSquare size={14} /> ¿Problemas para ingresar? Escríbenos
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mt-4 bg-[#141414] border border-white/5 rounded-2xl p-6">
            {sent ? (
              <p className="text-emerald-500 text-xs font-bold text-center">¡Mensaje enviado! Te responderemos pronto.</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-4">Contactar con ATC</p>
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="Nombre completo"
                  className="w-full bg-white/[0.03] border border-white/5 py-3 px-4 rounded-xl text-white text-xs outline-none focus:border-emerald-500/50 transition-all" />
                <input required value={dni} onChange={e => setDni(e.target.value)} placeholder="DNI o CE" maxLength={12}
                  className="w-full bg-white/[0.03] border border-white/5 py-3 px-4 rounded-xl text-white text-xs outline-none focus:border-emerald-500/50 transition-all" />
                <textarea required value={msg} onChange={e => setMsg(e.target.value)} placeholder="¿En qué podemos ayudarte?" rows={3}
                  className="w-full bg-white/[0.03] border border-white/5 py-3 px-4 rounded-xl text-white text-xs outline-none focus:border-emerald-500/50 transition-all resize-none" />
                <button type="submit" className="w-full bg-emerald-500 text-black font-black py-3 rounded-xl hover:bg-emerald-400 transition-all text-xs uppercase tracking-widest">
                  Enviar Mensaje
                </button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===================== AJUSTES VIEW =====================
function AjustesView({ profile, isDarkMode, toggleTheme }: any) {
  return (
    <div className="max-w-lg space-y-6">
      <h2 className={cn("text-sm font-black uppercase tracking-widest", isDarkMode ? "text-white" : "text-gray-900")}>Configuración</h2>
      <div className={cn("border rounded-2xl p-6 space-y-4", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
        <div className="flex items-center justify-between">
          <p className={cn("font-bold text-sm", isDarkMode ? "text-white" : "text-gray-900")}>Modo Oscuro</p>
          <button onClick={toggleTheme} className={cn("w-12 h-6 rounded-full transition-all relative", isDarkMode ? "bg-emerald-500" : "bg-gray-300")}>
            <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all", isDarkMode ? "left-7" : "left-1")} />
          </button>
        </div>
        <div className={cn("pt-4 border-t text-xs space-y-1", isDarkMode ? "border-white/5 text-gray-500" : "border-gray-100 text-gray-400")}>
          <p>Usuario: <span className="font-bold">{profile.name}</span></p>
          <p>Rol: <span className="font-bold uppercase">{profile.role}</span></p>
          {profile.dni && <p>DNI/CE: <span className="font-mono">{profile.dni}</span></p>}
        </div>
      </div>
    </div>
  );
}

// ===================== MODALS =====================
function ModalWrapper({ children, onClose }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="bg-[#141414] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ModalTitle({ children }: any) {
  return <h3 className="text-white font-black text-lg uppercase tracking-tight mb-6">{children}</h3>;
}

function InputField({ label, ...props }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{label}</label>
      <input className="w-full bg-white/[0.03] border border-white/5 py-3 px-4 rounded-xl text-white text-sm outline-none focus:border-emerald-500/50 transition-all" {...props} />
    </div>
  );
}

function PaymentModal({ appt, onClose, onConfirm }: any) {
  const [method, setMethod] = useState<'YAPE' | 'PLIN' | 'CARD'>('YAPE');
  const [ref, setRef] = useState('');
  return (
    <ModalWrapper onClose={onClose}>
      <ModalTitle>Registrar Pago</ModalTitle>
      <div className="space-y-4">
        <p className="text-gray-400 text-xs">Cita: <span className="text-white font-bold">{appt.patientName}</span> — S/ {appt.amount?.toFixed(2)}</p>
        <div className="flex gap-2">
          {(['YAPE', 'PLIN', 'CARD'] as const).map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={cn("flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all", method === m ? "bg-emerald-500 text-black" : "bg-white/5 text-gray-400 hover:bg-white/10")}>
              {m}
            </button>
          ))}
        </div>
        <InputField label="Referencia / Código" value={ref} onChange={(e: any) => setRef(e.target.value)} placeholder="TRX-12345" />
        <button onClick={() => onConfirm(appt.id, method, ref)} className="w-full bg-emerald-500 text-black font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-widest text-xs">
          Confirmar Pago
        </button>
      </div>
    </ModalWrapper>
  );
}

function VoucherModal({ appt, onClose }: any) {
  return (
    <ModalWrapper onClose={onClose}>
      <ModalTitle>Voucher de Pago</ModalTitle>
      <div className="space-y-3 text-xs text-gray-400">
        <p>Paciente: <span className="text-white font-bold">{appt.patientName}</span></p>
        <p>Servicio: <span className="text-white">{appt.service}</span></p>
        <p>Fecha: <span className="text-white">{appt.date} — {appt.time}</span></p>
        <p>Monto: <span className="text-emerald-500 font-bold">S/ {appt.amount?.toFixed(2)}</span></p>
        <p>Método: <span className="text-white">{appt.paymentMethod}</span></p>
        <p>Referencia: <span className="text-white font-mono">{appt.reference}</span></p>
      </div>
      <button onClick={onClose} className="w-full mt-6 bg-white/5 text-gray-300 font-black py-4 rounded-2xl hover:bg-white/10 transition-all text-xs uppercase">Cerrar</button>
    </ModalWrapper>
  );
}

function CancelModal({ appt, onClose, onConfirm }: any) {
  const [reason, setReason] = useState('');
  return (
    <ModalWrapper onClose={onClose}>
      <ModalTitle>Cancelar Cita</ModalTitle>
      <div className="space-y-4">
        <p className="text-gray-400 text-xs">¿Seguro que deseas cancelar la cita de <span className="text-white font-bold">{appt.patientName}</span>?</p>
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Motivo</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Motivo de cancelación..."
            className="w-full bg-white/[0.03] border border-white/5 py-3 px-4 rounded-xl text-white text-sm outline-none focus:border-red-500/50 transition-all resize-none" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 rounded-2xl bg-white/5 text-gray-300 font-black text-xs hover:bg-white/10 transition-all">Volver</button>
          <button onClick={() => onConfirm(appt.id, reason)} className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-black text-xs hover:bg-red-400 transition-all uppercase">Cancelar Cita</button>
        </div>
      </div>
    </ModalWrapper>
  );
}

function ReprogramModal({ appt, onClose, onConfirm }: any) {
  const [date, setDate] = useState(appt.date);
  const [time, setTime] = useState(appt.time);
  return (
    <ModalWrapper onClose={onClose}>
      <ModalTitle>Reprogramar Cita</ModalTitle>
      <div className="space-y-4">
        <InputField label="Nueva Fecha" type="date" value={date} onChange={(e: any) => setDate(e.target.value)} min={today} />
        <InputField label="Nueva Hora" type="time" value={time} onChange={(e: any) => setTime(e.target.value)} />
        <button onClick={() => onConfirm(appt.id, date, time)} className="w-full bg-emerald-500 text-black font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-widest text-xs">
          Confirmar
        </button>
      </div>
    </ModalWrapper>
  );
}

function RecipeModal({ appt, profile, onClose, onConfirm }: any) {
  const [notes, setNotes] = useState(appt.notes || '');
  const [loading, setLoading] = useState(false);

  const generateAI = async () => {
    setLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-04-17',
        contents: `Genera una receta médica breve y profesional para: Síntomas: ${appt.symptoms || 'No especificados'}. Especialidad: ${appt.service}. Solo incluye diagnóstico presuntivo, medicamentos con dosis y recomendaciones. Máximo 80 palabras.`,
      });
      setNotes(response.text);
    } catch (e) { setNotes('Error al generar con IA.'); }
    setLoading(false);
  };

  return (
    <ModalWrapper onClose={onClose}>
      <ModalTitle>Receta Médica</ModalTitle>
      <div className="space-y-4">
        <p className="text-gray-400 text-xs">Paciente: <span className="text-white font-bold">{appt.patientName}</span></p>
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Notas / Receta</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
            className="w-full bg-white/[0.03] border border-white/5 py-3 px-4 rounded-xl text-white text-sm outline-none focus:border-emerald-500/50 transition-all resize-none" />
        </div>
        <button onClick={generateAI} disabled={loading} className="w-full py-3 rounded-xl bg-purple-500/10 text-purple-400 font-black text-xs hover:bg-purple-500/20 transition-all uppercase tracking-widest">
          {loading ? 'Generando...' : '✨ Generar con IA'}
        </button>
        <button onClick={() => onConfirm(appt.id, notes)} className="w-full bg-emerald-500 text-black font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-widest text-xs">
          Guardar Receta
        </button>
      </div>
    </ModalWrapper>
  );
}

function CreateUserModal({ onClose, onConfirm }: any) {
  const [form, setForm] = useState({ name: '', username: '', password: '', dni: '', role: 'patient', phone: '', email: '', specialization: '', restDays: [] as string[] });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleRest = (d: string) => set('restDays', form.restDays.includes(d) ? form.restDays.filter((x: string) => x !== d) : [...form.restDays, d]);

  return (
    <ModalWrapper onClose={onClose}>
      <ModalTitle>Nuevo Usuario</ModalTitle>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div className="flex gap-2">
          {(['admin', 'medico', 'patient'] as Role[]).map(r => (
            <button key={r} onClick={() => set('role', r)}
              className={cn("flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all", form.role === r ? "bg-emerald-500 text-black" : "bg-white/5 text-gray-400 hover:bg-white/10")}>
              {r}
            </button>
          ))}
        </div>
        <InputField label="Nombre Completo" value={form.name} onChange={(e: any) => set('name', e.target.value)} placeholder="Juan Pérez" />
        {form.role !== 'patient' && <InputField label="Usuario" value={form.username} onChange={(e: any) => set('username', e.target.value)} placeholder="juanp" />}
        {form.role !== 'patient' && <InputField label="Contraseña" type="password" value={form.password} onChange={(e: any) => set('password', e.target.value)} placeholder="••••••" />}
        {form.role === 'patient' && <InputField label="DNI o CE" value={form.dni} onChange={(e: any) => set('dni', e.target.value)} placeholder="77665544" maxLength={12} />}
        <InputField label="Teléfono" value={form.phone} onChange={(e: any) => set('phone', e.target.value)} placeholder="987654321" />
        <InputField label="Correo" type="email" value={form.email} onChange={(e: any) => set('email', e.target.value)} placeholder="correo@example.com" />
        {form.role === 'medico' && (
          <>
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Especialidad</label>
              <select value={form.specialization} onChange={e => set('specialization', e.target.value)}
                className="w-full bg-white/[0.03] border border-white/5 py-3 px-4 rounded-xl text-white text-sm outline-none focus:border-emerald-500/50 transition-all">
                <option value="">Seleccionar...</option>
                {Object.keys(SPECIALIZATION_PRICES).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Días de Descanso</label>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map(d => (
                  <button key={d} type="button" onClick={() => toggleRest(d)}
                    className={cn("px-3 py-1 rounded-full text-[9px] font-black transition-all", form.restDays.includes(d) ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white/5 text-gray-500 border border-white/5 hover:border-white/10")}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <button onClick={() => onConfirm(form)} className="w-full bg-emerald-500 text-black font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-widest text-xs mt-2">
          Crear Usuario
        </button>
      </div>
    </ModalWrapper>
  );
}

function EditUserModal({ user, onClose, onConfirm }: any) {
  const [form, setForm] = useState({
    name: user.name, password: user.password || '', phone: user.phone || '',
    email: user.email || '', specialization: user.specialization || '', restDays: user.restDays || []
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleRest = (d: string) => set('restDays', form.restDays.includes(d) ? form.restDays.filter((x: string) => x !== d) : [...form.restDays, d]);

  return (
    <ModalWrapper onClose={onClose}>
      <ModalTitle>Editar Usuario</ModalTitle>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Rol: <span className="text-emerald-500">{user.role}</span></p>
        <InputField label="Nombre" value={form.name} onChange={(e: any) => set('name', e.target.value)} />
        {user.role !== 'patient' && <InputField label="Nueva Contraseña" type="password" value={form.password} onChange={(e: any) => set('password', e.target.value)} placeholder="Dejar vacío para no cambiar" />}
        <InputField label="Teléfono" value={form.phone} onChange={(e: any) => set('phone', e.target.value)} />
        <InputField label="Correo" type="email" value={form.email} onChange={(e: any) => set('email', e.target.value)} />
        {user.role === 'medico' && (
          <>
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Especialidad</label>
              <select value={form.specialization} onChange={e => set('specialization', e.target.value)}
                className="w-full bg-white/[0.03] border border-white/5 py-3 px-4 rounded-xl text-white text-sm outline-none focus:border-emerald-500/50 transition-all">
                <option value="">Seleccionar...</option>
                {Object.keys(SPECIALIZATION_PRICES).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Días de Descanso</label>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map(d => (
                  <button key={d} type="button" onClick={() => toggleRest(d)}
                    className={cn("px-3 py-1 rounded-full text-[9px] font-black transition-all", form.restDays.includes(d) ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white/5 text-gray-500 border border-white/5 hover:border-white/10")}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <button onClick={() => onConfirm(form)} className="w-full bg-emerald-500 text-black font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-widest text-xs mt-2">
          Guardar Cambios
        </button>
      </div>
    </ModalWrapper>
  );
}

function CreateApptModal({ profile, schedules, onClose, onConfirm }: any) {
  const [form, setForm] = useState({
    name: profile.role === 'patient' ? profile.name : '',
    dni: profile.role === 'patient' ? profile.dni : '',
    date: today, time: '09:00', service: 'Medicina General',
    urgency: 'BAJA' as 'BAJA' | 'MEDIA' | 'ALTA', symptoms: '', medicoId: ''
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <ModalWrapper onClose={onClose}>
      <ModalTitle>Nueva Cita</ModalTitle>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <InputField label="Nombre del Paciente" value={form.name} onChange={(e: any) => set('name', e.target.value)} placeholder="Juan Pérez" disabled={profile.role === 'patient'} />
        <InputField label="DNI o CE" value={form.dni} onChange={(e: any) => set('dni', e.target.value)} placeholder="77665544" disabled={profile.role === 'patient'} maxLength={12} />
        <InputField label="Fecha" type="date" value={form.date} onChange={(e: any) => set('date', e.target.value)} min={today} />
        <InputField label="Hora" type="time" value={form.time} onChange={(e: any) => set('time', e.target.value)} />
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Servicio</label>
          <select value={form.service} onChange={e => set('service', e.target.value)}
            className="w-full bg-white/[0.03] border border-white/5 py-3 px-4 rounded-xl text-white text-sm outline-none focus:border-emerald-500/50 transition-all">
            {Object.keys(SPECIALIZATION_PRICES).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Urgencia</label>
          <div className="flex gap-2">
            {(['BAJA', 'MEDIA', 'ALTA'] as const).map(u => (
              <button key={u} onClick={() => set('urgency', u)}
                className={cn("flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all",
                  form.urgency === u
                    ? u === 'ALTA' ? "bg-red-500 text-white" : u === 'MEDIA' ? "bg-amber-500 text-black" : "bg-emerald-500 text-black"
                    : "bg-white/5 text-gray-400 hover:bg-white/10")}>
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Síntomas</label>
          <textarea value={form.symptoms} onChange={e => set('symptoms', e.target.value)} rows={2} placeholder="Describe los síntomas..."
            className="w-full bg-white/[0.03] border border-white/5 py-3 px-4 rounded-xl text-white text-sm outline-none focus:border-emerald-500/50 transition-all resize-none" />
        </div>
        <button onClick={() => onConfirm({ ...form, userId: profile.id })}
          className="w-full bg-emerald-500 text-black font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-widest text-xs mt-2">
          Crear Cita
        </button>
      </div>
    </ModalWrapper>
  );
}

function ScheduleModal({ onClose, onConfirm }: any) {
  const [day, setDay] = useState('Lunes');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');

  return (
    <ModalWrapper onClose={onClose}>
      <ModalTitle>Agregar Turno</ModalTitle>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Día</label>
          <select value={day} onChange={e => setDay(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/5 py-3 px-4 rounded-xl text-white text-sm outline-none focus:border-emerald-500/50 transition-all">
            {DIAS_SEMANA.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <InputField label="Hora de Inicio" type="time" value={startTime} onChange={(e: any) => setStartTime(e.target.value)} />
        <InputField label="Hora de Fin" type="time" value={endTime} onChange={(e: any) => setEndTime(e.target.value)} />
        <button onClick={() => onConfirm({ day, startTime, endTime })}
          className="w-full bg-emerald-500 text-black font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-widest text-xs">
          Guardar Turno
        </button>
      </div>
    </ModalWrapper>
  );
}