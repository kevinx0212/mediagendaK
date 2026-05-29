/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import {
  Calendar, User as UserIcon, CreditCard, CheckCircle2, Plus, LogOut,
  LayoutDashboard, Settings, Wallet, Stethoscope, ShieldCheck, UserPlus,
  Trash2, Search, Clock, XCircle, RefreshCw, Filter, Users, ChevronRight,
  AlertCircle, MessageCircle, Archive, Edit, Send, BarChart3, FileText, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { cn } from './lib/utils';

// --- AI Initialization ---
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
  medicoNameAttended?: string; // Nuevo: Doctor que completó la atención
  urgency?: 'BAJA' | 'MEDIA' | 'ALTA';
  specialization?: string;
  symptoms?: string;
  notes?: string;
}

interface DoctorSchedule {
  id: string;
  medicoId: string;
  medicoName: string;
  day: string;
  startTime: string;
  endTime: string;
  type: 'DISPONIBLE' | 'DESCANSO';
  specialty?: string;
}

interface SupportMessage {
  id: string;
  senderName: string;
  senderDni: string;
  content: string;
  date: string;
  reply?: string;
  isRead: boolean;
}

// --- Constants ---
const today = new Date().toISOString().split('T')[0];

const SPECIALIZATION_PRICES: Record<string, number> = {
  'Cardiología': 120.00, 'Traumatología': 100.00, 'Pediatría': 80.00,
  'Dermatología': 90.00, 'Medicina General': 50.00, 'Neurología': 130.00,
  'Ginecología': 110.00, 'Oftalmología': 95.00,
};

const DEFAULT_PRICE = 50.00;

// --- Components ---
const Badge = ({ children, status }: { children: React.ReactNode, status: ApptStatus | string }) => {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    PAID: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    CANCELLED: "bg-red-500/10 text-red-500 border-red-500/20",
    COMPLETED: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    ALTA: "bg-red-500/10 text-red-500 border-red-500/20",
    MEDIA: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    BAJA: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  };
  return (
    <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border", styles[status] || "bg-gray-500/10 text-gray-500 border-gray-500/20")}>
      {children}
    </span>
  );
};

// --- Main App ---
export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Dialog States
  const [showPaymentDialog, setShowPaymentDialog] = useState<Appointment | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState<Appointment | null>(null);
  const [showReprogramDialog, setShowReprogramDialog] = useState<Appointment | null>(null);
  const [showRecipeDialog, setShowRecipeDialog] = useState<Appointment | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState<Appointment | null>(null);
  const [showVoucherDialog, setShowVoucherDialog] = useState<Appointment | null>(null);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showEditUserDialog, setShowEditUserDialog] = useState<UserProfile | null>(null);
  const [showCreateApptDialog, setShowCreateApptDialog] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showExternalSupport, setShowExternalSupport] = useState(false);

  // Auth Form State
  const [authTab, setAuthTab] = useState<Role>('admin');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPatientName, setFormPatientName] = useState('');
  const [formPatientDni, setFormPatientDni] = useState('');
  const [authError, setAuthError] = useState('');

  // Load Initial Data
  useEffect(() => {
    const savedProfile = sessionStorage.getItem('clinica_profile');
    const savedUsers = localStorage.getItem('clinica_users');
    const savedAppointments = localStorage.getItem('clinica_appointments');
    const savedSchedules = localStorage.getItem('clinica_schedules');
    const savedMessages = localStorage.getItem('clinica_messages');

    if (savedProfile) {
      const p = JSON.parse(savedProfile);
      setProfile(p);
      if (p.role === 'patient') setCurrentView('citas');
    }

    if (savedMessages) setMessages(JSON.parse(savedMessages));

    if (savedUsers) setUsers(JSON.parse(savedUsers));
    else {
      const defaultAdmin: UserProfile = { id: 'admin-1', name: 'ADMINISTRADOR', username: 'usuario', password: '123456', role: 'admin' };
      const defaultMedico: UserProfile = { id: 'medico-1', name: 'DR. EJEMPLO', username: 'medico', password: '123456', role: 'medico' };
      const defaultPatient: UserProfile = { id: 'p-1', name: 'JUAN PEREZ', dni: '77665544', role: 'patient', phone: '987654321', email: 'juan@example.com' };
      setUsers([defaultAdmin, defaultMedico, defaultPatient]);
    }

    if (savedAppointments) setAppointments(JSON.parse(savedAppointments));
    if (savedSchedules) setSchedules(JSON.parse(savedSchedules));

    setLoading(false);
  }, []);

  // Persistence
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('clinica_users', JSON.stringify(users));
      localStorage.setItem('clinica_appointments', JSON.stringify(appointments));
      localStorage.setItem('clinica_schedules', JSON.stringify(schedules));
      localStorage.setItem('clinica_messages', JSON.stringify(messages));
    }
  }, [users, appointments, schedules, messages, loading]);

  const handleLogout = () => {
    setProfile(null);
    setIsMobileMenuOpen(false);
    sessionStorage.removeItem('clinica_profile');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    let user;
    if (authTab === 'patient') {
      const inputName = formPatientName.toUpperCase().trim();
      const inputDni = formPatientDni.trim();
      const existingUser = users.find(u => u.dni === inputDni);

      if (existingUser) {
        if (existingUser.name.toUpperCase() !== inputName) {
          setAuthError('El Nombre no coincide con el Documento registrado. Por seguridad, verifica tus datos.');
          return;
        }
        user = existingUser;
      } else {
        if (!inputName || !inputDni) {
          setAuthError('Por favor ingresa nombre y documento válido.');
          return;
        }
        const newPatient: UserProfile = {
          id: Math.random().toString(36).substr(2, 9),
          name: inputName,
          dni: inputDni,
          role: 'patient',
        };
        setUsers(prev => [...prev, newPatient]);
        user = newPatient;
      }
    } else {
      user = users.find(u => u.role === authTab && u.username === formUsername && u.password === formPassword);
    }

    if (user) {
      setProfile(user);
      setCurrentView(user.role === 'patient' ? 'citas' : 'dashboard');
      sessionStorage.setItem('clinica_profile', JSON.stringify(user));
    } else {
      setAuthError('Credenciales incorrectas o usuario no encontrado.');
    }
  };

  const updateProfile = (data: Partial<UserProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...data };
    setProfile(updated);
    setUsers(users.map(u => u.id === profile.id ? updated : u));
    sessionStorage.setItem('clinica_profile', JSON.stringify(updated));
  };

  // --- Actions ---

  const createAppointment = (data: any, payNow: boolean) => {
    const price = SPECIALIZATION_PRICES[data.specialization] || SPECIALIZATION_PRICES[data.service] || DEFAULT_PRICE;
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
      specialization: data.specialization,
      symptoms: data.symptoms
    };
    setAppointments([newAppt, ...appointments]);
    setShowCreateApptDialog(false);

    if (payNow) {
      setShowPaymentDialog(newAppt);
    }
  };

  const cancelAppointment = (id: string, reason: string) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'CANCELLED', cancelReason: reason } : a));
    setShowCancelDialog(null);
  };

  const deleteAppointment = (id: string) => {
    setAppointments(appointments.filter(a => a.id !== id));
  };

  const processPayment = (id: string, method: 'YAPE' | 'PLIN' | 'CARD', ref: string) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, paymentStatus: 'PAID', paymentMethod: method, reference: ref, status: 'PAID' } : a));
    setShowPaymentDialog(null);
  };

  const completeAppointment = (id: string, medicoName: string) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'COMPLETED', medicoNameAttended: medicoName } : a));
    setShowCompleteDialog(null);
  };

  const addSchedulesBulk = (data: any) => {
    const newSchedules = data.days.map((day: string) => ({
      id: Math.random().toString(36).substr(2, 9),
      medicoId: profile?.id,
      medicoName: profile?.name,
      day,
      startTime: data.startTime,
      endTime: data.endTime,
      type: data.type,
      specialty: data.specialty
    }));
    setSchedules([...schedules, ...newSchedules]);
    setShowScheduleForm(false);
  };

  const sendSupportMessage = (data: any) => {
    const newMsg: SupportMessage = {
      id: Math.random().toString(36).substr(2, 9),
      senderName: data.name,
      senderDni: data.dni,
      content: data.content,
      date: new Date().toISOString(),
      isRead: false
    };
    setMessages([newMsg, ...messages]);
    setShowExternalSupport(false);
  };

  const replyToMessage = (id: string, reply: string) => {
    setMessages(messages.map(m => m.id === id ? { ...m, reply, isRead: true } : m));
  };

  // --- Filtering & Sorting ---
  const activeAppointments = profile?.role !== 'patient'
    ? appointments.filter(a => a.status !== 'CANCELLED' && a.status !== 'COMPLETED')
    : appointments;

  const filteredAppointments = activeAppointments.filter(a => {
    const matchesSearch = a.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || a.patientDni.includes(searchTerm);
    const matchesRole = profile?.role === 'patient' ? a.userId === profile.id : true;

    let matchesStatus = true;
    if (filterStatus === 'TODAY') matchesStatus = a.date === today;
    else if (['PENDING', 'PAID', 'COMPLETED', 'CANCELLED'].includes(filterStatus)) matchesStatus = a.status === filterStatus;
    else if (['ALTA', 'MEDIA', 'BAJA'].includes(filterStatus)) matchesStatus = a.urgency === filterStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const sortedAppointments = [...filteredAppointments].sort((a, b) => {
    const urgWeights: Record<string, number> = { 'ALTA': 3, 'MEDIA': 2, 'BAJA': 1 };
    return (urgWeights[b.urgency || 'BAJA'] || 0) - (urgWeights[a.urgency || 'BAJA'] || 0);
  });

  if (loading) return null;

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 font-sans relative">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.15)]">
              <Wallet className="text-emerald-500" size={32} />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter italic">MEDIAGENDAK</h1>
            <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest mt-1">kelcardozabr@uch.pe</p>
          </div>

          <div className={cn("bg-[#141414] border border-white/5 shadow-2xl rounded-3xl overflow-hidden transition-colors", !isDarkMode && "bg-white border-gray-200 shadow-xl")}>
            <div className={cn("flex border-b transition-colors", isDarkMode ? "bg-white/[0.02] border-white/5" : "bg-gray-50 border-gray-100")}>
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

            <form className="p-10" onSubmit={handleLogin}>
              {authTab === 'patient' ? (
                <>
                  <div className="space-y-2 mb-4">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Nombre Completo</label>
                    <input required type="text" value={formPatientName} onChange={(e) => setFormPatientName(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" placeholder="Ej: Juan Pérez" />
                  </div>
                  <div className="space-y-2 mb-6">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">DNI o CE</label>
                    <input required type="text" maxLength={12} value={formPatientDni} onChange={(e) => setFormPatientDni(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" placeholder="Documento de identidad" />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Usuario Institucional</label>
                    <input required type="text" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" placeholder="usuario" />
                  </div>
                  <div className="space-y-2 mb-6">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Contraseña</label>
                    <input required type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" placeholder="••••••••" />
                  </div>
                </>
              )}

              {authError && <p className="text-red-400 text-[10px] font-bold bg-red-400/10 p-4 rounded-xl border border-red-400/20 mb-4">{authError}</p>}

              <button type="submit" className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 uppercase tracking-widest text-xs">
                {authTab === 'patient' ? 'Ingreso Libre' : 'Entrar al Sistema'}
              </button>

              {authTab === 'patient' && (
                <button type="button" onClick={() => setShowExternalSupport(true)} className="w-full mt-6 text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-colors">
                  ¿Problemas de acceso o quejas? ATC
                </button>
              )}
            </form>
          </div>
        </motion.div >

        <AnimatePresence>
          {showExternalSupport && (
            <ExternalSupportModal onClose={() => setShowExternalSupport(false)} onSend={sendSupportMessage} />
          )}
        </AnimatePresence>
      </div >
    );
  }

  return (
    <div className={cn("min-h-screen flex font-sans transition-colors duration-300 overflow-hidden", isDarkMode ? "bg-[#0a0a0a] text-gray-300" : "bg-gray-50 text-gray-900")}>
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
            <SideNav profile={profile} currentView={currentView} setView={setCurrentView} isDarkMode={isDarkMode} />
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className={cn(
          "h-20 border-b flex items-center justify-between px-6 lg:px-10 backdrop-blur-xl z-50 shrink-0",
          isDarkMode ? "bg-[#0a0a0a]/80 border-white/5" : "bg-white/80 border-gray-100"
        )}>
          <div className="flex items-center gap-4">
            <h2 className={cn("text-xs font-black uppercase tracking-[0.2em]", isDarkMode ? "text-white" : "text-gray-900")}>{currentView}</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-white/[0.03] border border-white/5 rounded-full mr-2">
              <ShieldCheck size={14} className={cn(
                profile.role === 'admin' ? "text-red-500" : profile.role === 'medico' ? "text-emerald-500" : "text-blue-500"
              )} />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{profile.role}</span>
            </div>

            {profile.role !== 'medico' && (
              <button
                onClick={() => setShowCreateApptDialog(true)}
                className="bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest py-2.5 px-6 rounded-xl hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/10"
              >
                <Plus size={16} /> <span className="hidden sm:inline">Nueva Cita</span>
              </button>
            )}
          </div>
        </header>

        <div className={cn("flex-1 overflow-y-auto p-6 lg:p-10", isDarkMode ? "bg-[#0a0a0a]" : "bg-gray-50")}>
          <div className="max-w-7xl mx-auto">
            {currentView === 'dashboard' && profile.role !== 'patient' && (
              <DashboardView profile={profile} appointments={appointments} isDarkMode={isDarkMode} />
            )}

            {currentView === 'citas' && (
              <CitasView
                profile={profile}
                appointments={sortedAppointments}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                isDarkMode={isDarkMode}
                onPay={setShowPaymentDialog}
                onCancel={setShowCancelDialog}
                onReprogram={setShowReprogramDialog}
                onComplete={setShowCompleteDialog}
                onDelete={deleteAppointment}
                onAddRecipe={setShowRecipeDialog}
              />
            )}

            {currentView === 'historial' && profile.role === 'admin' && (
              <HistorialView appointments={appointments} onDelete={deleteAppointment} isDarkMode={isDarkMode} />
            )}

            {currentView === 'atc' && profile.role === 'admin' && (
              <ATCAdminView messages={messages} onReply={replyToMessage} isDarkMode={isDarkMode} />
            )}

            {currentView === 'mensajes' && profile.role === 'patient' && (
              <ATCPatientView profile={profile} messages={messages} onSend={sendSupportMessage} isDarkMode={isDarkMode} />
            )}

            {currentView === 'pagos' && profile.role === 'patient' && (
              <PagosPendientesView appointments={appointments.filter(a => a.userId === profile.id)} onPay={setShowPaymentDialog} onViewVoucher={setShowVoucherDialog} isDarkMode={isDarkMode} />
            )}

            {currentView === 'informacion' && profile.role === 'patient' && (
              <InformacionView profile={profile} onUpdate={updateProfile} isDarkMode={isDarkMode} />
            )}

            {currentView === 'usuarios' && profile.role === 'admin' && (
              <UsuariosView users={users} isDarkMode={isDarkMode} onCreate={() => setShowCreateUserDialog(true)} onEdit={setShowEditUserDialog} onDelete={(id: string) => setUsers(users.filter(u => u.id !== id))} />
            )}

            {currentView === 'horarios' && (
              <HorariosView schedules={schedules} setSchedules={setSchedules} profile={profile} isDarkMode={isDarkMode} onAdd={() => setShowScheduleForm(true)} />
            )}
          </div>
        </div>
      </main>

      {/* Dialogs */}
      <AnimatePresence>
        {showPaymentDialog && (
          <PaymentModal appt={showPaymentDialog} onClose={() => setShowPaymentDialog(null)} onConfirm={processPayment} />
        )}
        {showVoucherDialog && (
          <VoucherModal appt={showVoucherDialog} onClose={() => setShowVoucherDialog(null)} />
        )}
        {showCancelDialog && (
          <CancelModal appt={showCancelDialog} onClose={() => setShowCancelDialog(null)} onConfirm={cancelAppointment} />
        )}
        {showReprogramDialog && (
          <ReprogramModal appt={showReprogramDialog} onClose={() => setShowReprogramDialog(null)} onConfirm={(id: string, d: string, t: string) => { setAppointments(appointments.map(a => a.id === id ? { ...a, date: d, time: t } : a)); setShowReprogramDialog(null); }} />
        )}
        {showCompleteDialog && (
          <CompleteApptModal appt={showCompleteDialog} profile={profile!} onClose={() => setShowCompleteDialog(null)} onConfirm={completeAppointment} />
        )}
        {showRecipeDialog && (
          <RecipeModal appt={showRecipeDialog} profile={profile!} onClose={() => setShowRecipeDialog(null)} onConfirm={(apptId: string, notes: string) => { setAppointments(appointments.map(a => a.id === apptId ? { ...a, notes } : a)); setShowRecipeDialog(null); }} />
        )}
        {showCreateUserDialog && (
          <CreateUserModal onClose={() => setShowCreateUserDialog(false)} onConfirm={(d: any) => { setUsers([...users, { id: Math.random().toString(36).substr(2, 9), ...d }]); setShowCreateUserDialog(false); }} />
        )}
        {showEditUserDialog && (
          <EditUserModal user={showEditUserDialog} onClose={() => setShowEditUserDialog(null)} onConfirm={(d: any) => { setUsers(users.map(u => u.id === d.id ? d : u)); setShowEditUserDialog(null); }} />
        )}
        {showCreateApptDialog && (
          <CreateApptModal profile={profile!} schedules={schedules} onClose={() => setShowCreateApptDialog(false)} onConfirm={createAppointment} />
        )}
        {showScheduleForm && (
          <ScheduleModal onClose={() => setShowScheduleForm(false)} onConfirm={addSchedulesBulk} />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-Views ---

function SideNav({ profile, currentView, setView, isDarkMode }: any) {
  if (profile.role === 'patient') {
    return (
      <>
        <NavItem active={currentView === 'citas'} icon={<Calendar size={20} />} label="Mis Citas" onClick={() => setView('citas')} isDarkMode={isDarkMode} />
        <NavItem active={currentView === 'pagos'} icon={<CreditCard size={20} />} label="Pagos y Vouchers" onClick={() => setView('pagos')} isDarkMode={isDarkMode} />
        <NavItem active={currentView === 'mensajes'} icon={<MessageCircle size={20} />} label="Soporte y Quejas" onClick={() => setView('mensajes')} isDarkMode={isDarkMode} />
        <NavItem active={currentView === 'informacion'} icon={<UserIcon size={20} />} label="Mi Perfil" onClick={() => setView('informacion')} isDarkMode={isDarkMode} />
      </>
    );
  }

  return (
    <>
      <NavItem active={currentView === 'dashboard'} icon={<LayoutDashboard size={20} />} label="Dashboard Principal" onClick={() => setView('dashboard')} isDarkMode={isDarkMode} />
      <NavItem active={currentView === 'citas'} icon={<Activity size={20} />} label="Citas Activas" onClick={() => setView('citas')} isDarkMode={isDarkMode} />
      {profile.role === 'admin' && (
        <>
          <NavItem active={currentView === 'historial'} icon={<Archive size={20} />} label="Historial de BD" onClick={() => setView('historial')} isDarkMode={isDarkMode} />
          <NavItem active={currentView === 'horarios'} icon={<Clock size={20} />} label="Gestión de Horarios" onClick={() => setView('horarios')} isDarkMode={isDarkMode} />
          <NavItem active={currentView === 'usuarios'} icon={<Users size={20} />} label="Directorio Usuarios" onClick={() => setView('usuarios')} isDarkMode={isDarkMode} />
          <NavItem active={currentView === 'atc'} icon={<MessageCircle size={20} />} label="ATC / Reclamos" onClick={() => setView('atc')} isDarkMode={isDarkMode} />
        </>
      )}
      {profile.role === 'medico' && (
        <NavItem active={currentView === 'horarios'} icon={<Clock size={20} />} label="Mi Horario Médico" onClick={() => setView('horarios')} isDarkMode={isDarkMode} />
      )}
    </>
  );
}

function NavItem({ active, icon, label, onClick, isDarkMode }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-sm transition-all group",
        active
          ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
          : isDarkMode
            ? "text-gray-500 hover:bg-white/5 hover:text-gray-300"
            : "text-gray-500 hover:bg-gray-200 hover:text-gray-900"
      )}
    >
      <span className={cn("transition-transform group-hover:scale-110", active ? "text-black" : "text-emerald-500")}>{icon}</span>
      {label}
    </button>
  );
}

function DashboardView({ appointments, isDarkMode }: any) {
  // Cálculo de ingresos reales por especialidad
  const incomeMap: Record<string, number> = {};
  appointments.forEach((a: any) => {
    if (a.paymentStatus === 'PAID') {
      incomeMap[a.service] = (incomeMap[a.service] || 0) + a.amount;
    }
  });

  const maxIncome = Math.max(...Object.values(incomeMap) as number[], 1);

  return (
    <div className="space-y-10">
      <div className={cn("border rounded-[40px] p-12 relative overflow-hidden", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-200")}>
        <div className="flex items-center justify-between mb-8">
          <h2 className={cn("text-2xl font-black italic uppercase tracking-tight flex items-center gap-3", isDarkMode ? "text-white" : "text-gray-900")}>
            <BarChart3 className="text-emerald-500" /> Análisis Económico Real
          </h2>
        </div>

        {/* Gráfico de Barras CSS Puro */}
        <div className="flex items-end gap-6 h-72 mt-12 pb-8 border-b border-white/10">
          {Object.entries(incomeMap).map(([spec, amount]: any) => {
            const heightPercentage = Math.max((amount / maxIncome) * 100, 5); // Mínimo 5% de altura para que se vea
            return (
              <div key={spec} className="flex-1 flex flex-col items-center justify-end group h-full relative">
                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 text-[12px] font-black text-emerald-500 transition-opacity bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 whitespace-nowrap">
                  S/ {amount.toFixed(2)}
                </div>
                <div
                  className="w-full max-w-[80px] bg-emerald-500/20 rounded-t-xl relative overflow-hidden border border-emerald-500/30 transition-all duration-500 group-hover:bg-emerald-500/40"
                  style={{ height: `${heightPercentage}%` }}
                >
                  <div className="absolute bottom-0 w-full bg-emerald-500/50" style={{ height: '20%' }} />
                </div>
                <div className="absolute -bottom-8 text-[9px] text-gray-500 font-bold uppercase text-center w-full px-1 truncate">
                  {spec}
                </div>
              </div>
            );
          })}
          {Object.keys(incomeMap).length === 0 && (
            <p className="text-gray-500 text-sm italic w-full text-center pb-20">No hay ingresos registrados aún para generar el gráfico.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CitasView({ profile, appointments, searchTerm, setSearchTerm, filterStatus, setFilterStatus, onPay, onCancel, onReprogram, onComplete, onDelete, onAddRecipe, isDarkMode }: any) {
  const FILTERS = [
    { id: 'ALL', label: 'Todas' },
    { id: 'TODAY', label: 'Para Hoy' },
    { id: 'PENDING', label: 'Sin Pagar' },
    { id: 'PAID', label: 'Pagadas' },
    { id: 'ALTA', label: 'Urgencia Alta' },
    { id: 'MEDIA', label: 'Media' },
    { id: 'BAJA', label: 'Baja' },
  ];

  return (
    <div className="space-y-8">
      {/* Botones de Filtro Restaurados */}
      <div className="flex flex-col xl:flex-row gap-6 items-center justify-between">
        <div className="relative w-full xl:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre o DNI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn("w-full py-4 pl-12 pr-6 rounded-2xl text-sm outline-none transition-all border", isDarkMode ? "bg-[#141414] border-white/5 text-white focus:border-emerald-500/30" : "bg-white border-gray-200 text-gray-900 focus:border-emerald-500/30")}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full xl:w-auto pb-2 xl:pb-0 scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
                filterStatus === f.id ? "bg-emerald-500 text-black border-emerald-500" : isDarkMode ? "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10" : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {profile.role === 'patient' ? (
        // Vista Paciente (Tarjetas Restauradas con Permisos)
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {appointments.map((appt: any) => (
            <motion.div layout key={appt.id} className={cn("border rounded-3xl p-8 relative", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-200")}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className={cn("font-black text-lg mb-1 uppercase", isDarkMode ? "text-white" : "text-gray-900")}>{appt.service}</h4>
                  <p className="text-[10px] font-mono text-gray-500 uppercase">A nombre de: {appt.patientName}</p>
                </div>
                <Badge status={appt.status}>{appt.status}</Badge>
              </div>
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-xs text-gray-400"><Calendar size={14} className="text-emerald-500" /><span>{appt.date} {appt.time}</span></div>
                <div className="flex items-center gap-3 text-xs text-gray-400"><Activity size={14} className={appt.urgency === 'ALTA' ? "text-red-500" : "text-emerald-500"} /><span>Urgencia: {appt.urgency}</span></div>

                {appt.notes && (
                  <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 mt-4">
                    <p className="text-[9px] text-blue-400 font-black uppercase mb-2 flex items-center gap-2"><FileText size={12} /> Receta / Indicaciones</p>
                    <p className="text-xs text-gray-300 italic">"{appt.notes}"</p>
                  </div>
                )}
              </div>

              {/* Botones de acción del paciente restaurados */}
              <div className="flex flex-col gap-2">
                {appt.status === 'PENDING' && (
                  <>
                    <button onClick={() => onPay(appt)} className="w-full bg-emerald-500 text-black text-[10px] font-black uppercase py-3 rounded-xl hover:bg-emerald-400 transition-colors">Realizar Pago S/{appt.amount}</button>
                    <div className="flex gap-2">
                      <button onClick={() => onReprogram(appt)} className="flex-1 bg-white/5 text-white text-[10px] font-bold uppercase py-3 rounded-xl border border-white/10 hover:bg-white/10">Reprogramar</button>
                      <button onClick={() => onCancel(appt)} className="flex-1 bg-red-500/10 text-red-500 text-[10px] font-bold uppercase py-3 rounded-xl border border-red-500/20 hover:bg-red-500/20">Cancelar</button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          ))}
          {appointments.length === 0 && <p className="text-gray-500 italic p-8 col-span-full">No tienes citas programadas bajo estos filtros.</p>}
        </div>
      ) : (
        // Vista Admin/Medico (Tabla)
        <div className={cn("rounded-3xl border overflow-hidden", isDarkMode ? "border-white/5 bg-[#141414]" : "border-gray-200 bg-white")}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={cn("border-b text-[10px] uppercase font-black tracking-widest", isDarkMode ? "border-white/5 bg-white/5 text-gray-500" : "border-gray-200 bg-gray-50 text-gray-600")}>
                <th className="p-5">Paciente / DNI</th>
                <th className="p-5">Fecha y Hora</th>
                <th className="p-5">Especialidad</th>
                <th className="p-5">Prioridad</th>
                <th className="p-5">Estado</th>
                <th className="p-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a: any) => (
                <tr key={a.id} className={cn("border-b last:border-0 transition-colors", isDarkMode ? "border-white/5 hover:bg-white/[0.02]" : "border-gray-100 hover:bg-gray-50")}>
                  <td className="p-5">
                    <p className={cn("font-bold text-sm uppercase", isDarkMode ? "text-white" : "text-gray-900")}>{a.patientName}</p>
                    <p className="text-[10px] text-gray-500 font-mono">{a.patientDni}</p>
                  </td>
                  <td className="p-5 text-sm text-gray-400">{a.date} <span className="text-emerald-500 font-bold ml-2">{a.time}</span></td>
                  <td className="p-5 text-sm text-gray-400">{a.service}</td>
                  <td className="p-5"><Badge status={a.urgency || 'BAJA'}>{a.urgency || 'BAJA'}</Badge></td>
                  <td className="p-5"><Badge status={a.status}>{a.status}</Badge></td>
                  <td className="p-5 flex justify-end gap-2 items-center h-full">

                    {profile.role === 'admin' && (
                      <>
                        <button onClick={() => onReprogram(a)} className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500/20" title="Reprogramar"><Edit size={16} /></button>
                        <button onClick={() => onDelete(a.id)} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20" title="Eliminar Permanente"><Trash2 size={16} /></button>
                      </>
                    )}

                    {profile.role === 'medico' && (
                      <button onClick={() => onAddRecipe(a)} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-colors flex items-center gap-2 border", a.notes ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10")} title="Receta Médica">
                        <FileText size={14} /> {a.notes ? "Editar Receta" : "Dar Receta"}
                      </button>
                    )}

                    {(a.status === 'PAID') && profile.role !== 'patient' && (
                      <button onClick={() => onComplete(a)} className="px-4 py-2 bg-emerald-500 text-black rounded-xl text-[10px] font-black uppercase hover:bg-emerald-400 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/10" title="Finalizar Atención">
                        <CheckCircle2 size={14} /> Atender
                      </button>
                    )}

                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {appointments.length === 0 && <p className="p-8 text-center text-sm text-gray-500 italic">No hay citas que coincidan con la búsqueda o filtro actual.</p>}
        </div>
      )}
    </div>
  );
}

function HistorialView({ appointments, onDelete, isDarkMode }: any) {
  const history = appointments.filter((a: any) => a.status === 'CANCELLED' || a.status === 'COMPLETED');

  return (
    <div className="space-y-8">
      <h2 className={cn("text-2xl font-black italic uppercase tracking-tight flex items-center gap-3", isDarkMode ? "text-white" : "text-gray-900")}>
        <Archive className="text-emerald-500" /> Historial de Citas (Concluidas / Canceladas)
      </h2>
      <div className={cn("rounded-3xl border overflow-hidden", isDarkMode ? "border-white/5 bg-[#141414]" : "border-gray-200 bg-white")}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={cn("border-b text-[10px] uppercase font-black tracking-widest", isDarkMode ? "border-white/5 bg-white/5 text-gray-500" : "border-gray-200 bg-gray-50 text-gray-600")}>
              <th className="p-5">Paciente</th>
              <th className="p-5">Servicio</th>
              <th className="p-5">Estado</th>
              <th className="p-5">Detalle Final</th>
              <th className="p-5 text-right">Limpiar Registro</th>
            </tr>
          </thead>
          <tbody>
            {history.map((a: any) => (
              <tr key={a.id} className={cn("border-b last:border-0", isDarkMode ? "border-white/5" : "border-gray-100")}>
                <td className={cn("p-5 text-sm font-bold uppercase", isDarkMode ? "text-white" : "text-gray-900")}>{a.patientName}</td>
                <td className="p-5 text-sm text-gray-400">{a.service}</td>
                <td className="p-5"><Badge status={a.status}>{a.status}</Badge></td>
                <td className="p-5 text-[10px] text-gray-500 uppercase">
                  {a.status === 'COMPLETED' ? `Atendido por: ${a.medicoNameAttended || 'No especificado'}` : `Motivo: ${a.cancelReason || 'N/A'}`}
                </td>
                <td className="p-5 text-right">
                  <button onClick={() => onDelete(a.id)} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length === 0 && <p className="p-8 text-center text-sm text-gray-500 italic">El historial está limpio.</p>}
      </div>
    </div>
  );
}

function ATCAdminView({ messages, onReply, isDarkMode }: any) {
  return (
    <div className="space-y-8">
      <h2 className={cn("text-2xl font-black italic uppercase tracking-tight flex items-center gap-3", isDarkMode ? "text-white" : "text-gray-900")}>
        <MessageCircle className="text-blue-500" /> Panel ATC - Atención al Cliente
      </h2>
      <div className="grid gap-6">
        {messages.map((m: any) => (
          <div key={m.id} className={cn("p-8 rounded-3xl border relative overflow-hidden", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-200")}>
            <div className="absolute top-0 right-0 p-4 opacity-5"><MessageCircle size={48} /></div>
            <div className="flex justify-between items-center text-xs text-gray-500 mb-4 border-b border-white/5 pb-4">
              <div>
                <span className="font-black text-emerald-500 uppercase block text-sm">{m.senderName}</span>
                <span className="font-mono">DNI: {m.senderDni}</span>
              </div>
              <span>{new Date(m.date).toLocaleString()}</span>
            </div>

            <p className={cn("text-sm mb-6 leading-relaxed", isDarkMode ? "text-white" : "text-gray-900")}>{m.content}</p>

            {m.reply ? (
              <div className="p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-sm text-gray-300">
                <span className="font-black text-emerald-500 text-[10px] uppercase block mb-2 flex items-center gap-2"><CheckCircle2 size={14} /> Respuesta Enviada por ATC:</span>
                {m.reply}
              </div>
            ) : (
              <div className="flex gap-4">
                <input type="text" id={`reply-${m.id}`} placeholder="Escribe la respuesta oficial para el paciente..." className="flex-1 bg-white/[0.03] border border-white/5 px-5 py-4 rounded-xl text-sm outline-none text-white focus:border-emerald-500/30 transition-colors" />
                <button onClick={() => { const input = document.getElementById(`reply-${m.id}`) as HTMLInputElement; if (input.value) { onReply(m.id, input.value); input.value = ''; } }} className="bg-emerald-500 text-black px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">Responder</button>
              </div>
            )}
          </div>
        ))}
        {messages.length === 0 && <p className="p-12 text-center border rounded-3xl border-dashed border-gray-600 text-gray-500 italic">Bandeja de ATC vacía. No hay reclamos pendientes.</p>}
      </div>
    </div>
  );
}

function ATCPatientView({ profile, messages, onSend, isDarkMode }: any) {
  const [content, setContent] = useState('');
  const myMessages = messages.filter((m: any) => m.senderDni === profile.dni);

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <h2 className={cn("text-2xl font-black italic uppercase tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>Soporte y Quejas (ATC)</h2>

      <div className={cn("p-8 rounded-[32px] border mb-12", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-200")}>
        <p className="text-xs text-gray-500 mb-6">Si tuviste algún problema con tu cita, cobros, o el sistema, escríbenos aquí. Nuestro equipo administrativo te responderá a la brevedad.</p>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Detalla tu inconveniente..."
          className="w-full bg-white/[0.03] border border-white/5 p-5 rounded-2xl text-sm outline-none text-white h-32 mb-6 resize-none focus:border-emerald-500/50 transition-colors"
        />
        <button onClick={() => { if (content) { onSend({ name: profile.name, dni: profile.dni, content }); setContent(''); } }} className="w-full bg-emerald-500 text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">
          <Send size={16} /> Enviar Mensaje a Administración
        </button>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-4">Mi Historial de Mensajes</h3>
        {myMessages.map((m: any) => (
          <div key={m.id} className={cn("p-6 rounded-2xl border", isDarkMode ? "bg-white/[0.02] border-white/5" : "bg-gray-50 border-gray-200")}>
            <p className={cn("text-sm mb-4", isDarkMode ? "text-white" : "text-gray-900")}>{m.content}</p>
            {m.reply ? (
              <div className="p-4 bg-emerald-500/10 rounded-xl text-emerald-400 text-sm border border-emerald-500/20 flex gap-3">
                <ShieldCheck size={20} className="shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-[9px] uppercase tracking-widest mb-1 text-emerald-500">Respuesta Oficial ATC:</strong>
                  <span className="text-gray-300">{m.reply}</span>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-amber-500 uppercase font-bold flex items-center gap-2"><Clock size={12} /> Pendiente de revisión</p>
            )}
          </div>
        ))}
        {myMessages.length === 0 && <p className="text-gray-500 italic text-sm">No has enviado ningún mensaje a ATC.</p>}
      </div>
    </div>
  );
}

function InformacionView({ profile, onUpdate, isDarkMode }: any) {
  const [data, setData] = useState({ phone: profile.phone || '', email: profile.email || '' });
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className={cn("border rounded-[40px] p-12 relative overflow-hidden", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-200")}>
        <div className="flex items-center gap-6 mb-10 border-b border-white/5 pb-8">
          <div className="w-20 h-20 rounded-[30px] bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-3xl font-black border border-emerald-500/20">
            {profile.name.charAt(0)}
          </div>
          <div>
            <h2 className={cn("text-2xl font-black uppercase tracking-tight italic", isDarkMode ? "text-white" : "text-gray-900")}>{profile.name}</h2>
            <p className="text-xs text-gray-500 font-mono mt-1">DNI Registrado: {profile.dni}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Número de Contacto</label>
            <input type="tel" value={data.phone} onChange={e => setData({ ...data, phone: e.target.value })} className={cn("w-full py-4 px-5 rounded-2xl outline-none text-sm transition-all border", isDarkMode ? "bg-white/[0.03] border-white/5 text-white focus:border-emerald-500/50" : "bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500/50")} placeholder="Ej: 987654321" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Correo Electrónico (Para envío de Vouchers)</label>
            <input type="email" value={data.email} onChange={e => setData({ ...data, email: e.target.value })} className={cn("w-full py-4 px-5 rounded-2xl outline-none text-sm transition-all border", isDarkMode ? "bg-white/[0.03] border-white/5 text-white focus:border-emerald-500/50" : "bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500/50")} placeholder="correo@ejemplo.com" />
          </div>
          <button onClick={() => onUpdate(data)} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-xs mt-6 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors">Guardar Mis Datos</button>
        </div>
      </div>
    </div>
  );
}

function PagosPendientesView({ appointments, onPay, onViewVoucher, isDarkMode }: any) {
  const pending = appointments.filter((a: any) => a.paymentStatus === 'PENDING' && a.status !== 'CANCELLED');
  const paid = appointments.filter((a: any) => a.paymentStatus === 'PAID');

  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <h3 className={cn("text-sm font-black uppercase tracking-widest flex items-center gap-2", isDarkMode ? "text-white" : "text-gray-900")}><AlertCircle size={18} className="text-amber-500" /> Pendientes de Pago</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pending.map((a: any) => (
            <div key={a.id} className={cn("p-8 rounded-3xl border relative overflow-hidden", isDarkMode ? "bg-[#141414] border-amber-500/20" : "bg-white border-amber-500/30")}>
              <div className="absolute top-0 right-0 p-4 opacity-5"><CreditCard size={48} className="text-amber-500" /></div>
              <h4 className={cn("font-bold text-lg mb-2 uppercase", isDarkMode ? "text-white" : "text-gray-900")}>{a.service}</h4>
              <p className="text-[10px] text-gray-500 uppercase mb-6">{a.date} • {a.time}</p>
              <div className={cn("text-3xl font-black mb-6 italic", isDarkMode ? "text-white" : "text-gray-900")}>S/ {a.amount.toFixed(2)}</div>
              <button onClick={() => onPay(a)} className="w-full bg-emerald-500 text-black text-[10px] font-black uppercase py-4 rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors">Procesar Pago</button>
            </div>
          ))}
          {pending.length === 0 && <p className="text-gray-500 italic text-sm border border-dashed border-gray-600 p-8 rounded-2xl w-full text-center">Felicidades, no tienes pagos pendientes.</p>}
        </div>
      </div>

      <div className="space-y-6 pt-8 border-t border-white/5">
        <h3 className={cn("text-sm font-black uppercase tracking-widest flex items-center gap-2", isDarkMode ? "text-white" : "text-gray-900")}><CheckCircle2 size={18} className="text-emerald-500" /> Historial y Vouchers Digitales</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paid.map((a: any) => (
            <div key={a.id} className={cn("p-8 rounded-3xl border relative", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-200")}>
              <h4 className={cn("font-bold text-lg mb-2 uppercase", isDarkMode ? "text-white" : "text-gray-900")}>{a.service}</h4>
              <p className="text-[10px] text-emerald-500 font-black uppercase mb-8 flex items-center gap-2"><CheckCircle2 size={12} /> PAGADO • VÍA {a.paymentMethod}</p>
              <button onClick={() => onViewVoucher(a)} className={cn("w-full text-[10px] font-black uppercase py-4 rounded-xl flex items-center justify-center gap-2 transition-colors border", isDarkMode ? "bg-white/5 text-white border-white/10 hover:bg-white/10" : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200")}>
                <RefreshCw size={14} /> Abrir Voucher
              </button>
            </div>
          ))}
          {paid.length === 0 && <p className="text-gray-500 italic text-sm">Aún no hay comprobantes generados.</p>}
        </div>
      </div>
    </div>
  );
}

function UsuariosView({ users, isDarkMode, onCreate, onEdit, onDelete }: any) {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className={cn("text-2xl font-black italic uppercase tracking-tight flex items-center gap-3", isDarkMode ? "text-white" : "text-gray-900")}><Users className="text-blue-500" /> Directorio de Usuarios</h2>
        <button onClick={onCreate} className="bg-emerald-500 text-black text-[10px] font-black uppercase py-3 px-6 rounded-xl flex items-center gap-2 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"><UserPlus size={16} /> Crear Nuevo</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((u: any) => (
          <div key={u.id} className={cn("p-8 rounded-3xl border relative", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-200")}>
            <div className="flex justify-between items-start mb-6">
              <h4 className={cn("font-bold text-sm uppercase", isDarkMode ? "text-white" : "text-gray-900")}>{u.name}</h4>
              <span className={cn("text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded-md", u.role === 'admin' ? 'bg-red-500/10 text-red-500' : u.role === 'medico' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500')}>{u.role}</span>
            </div>
            <div className="space-y-2 text-xs text-gray-500 mb-8 border-l-2 border-white/10 pl-3">
              <p>DNI / CE: <span className="font-mono text-gray-300">{u.dni || 'N/A'}</span></p>
              <p>Teléfono: <span className="text-gray-300">{u.phone || 'N/A'}</span></p>
              <p>Email: <span className="text-gray-300 truncate block">{u.email || 'N/A'}</span></p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => onEdit(u)} className="flex-1 bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase py-3 rounded-xl hover:bg-blue-500/20 transition-colors flex justify-center items-center gap-2"><Edit size={14} /> Editar</button>
              {u.id !== 'admin-1' && <button onClick={() => onDelete(u.id)} className="flex-1 bg-red-500/10 text-red-500 text-[10px] font-black uppercase py-3 rounded-xl hover:bg-red-500/20 transition-colors flex justify-center items-center gap-2"><Trash2 size={14} /> Eliminar</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorariosView({ schedules, setSchedules, profile, isDarkMode, onAdd }: any) {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className={cn("text-2xl font-black italic uppercase tracking-tight flex items-center gap-3", isDarkMode ? "text-white" : "text-gray-900")}><Clock className="text-emerald-500" /> Gestión de Horarios</h2>
        {profile?.role === 'medico' && <button onClick={onAdd} className="bg-emerald-500 text-black text-[10px] font-black uppercase py-3 px-6 rounded-xl flex items-center gap-2 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"><Plus size={16} /> Crear Bloque Semanal</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {schedules.map((s: any) => (
          <div key={s.id} className={cn("p-6 rounded-3xl border relative overflow-hidden", isDarkMode ? "bg-[#141414]" : "bg-white", s.type === 'DESCANSO' ? "border-red-500/30 bg-red-500/5" : "border-white/5")}>
            <div className="flex justify-between mb-4">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{s.day}</p>
              <span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black uppercase border", s.type === 'DESCANSO' ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20")}>{s.type}</span>
            </div>
            <h4 className={cn("font-black text-xl mb-1", isDarkMode ? "text-white" : "text-gray-900")}>{s.type === 'DESCANSO' ? 'Libre' : `${s.startTime} - ${s.endTime}`}</h4>
            <p className="text-[10px] text-gray-500 uppercase font-bold mt-2 border-t border-white/5 pt-2">Dr(a). {s.medicoName}</p>
            {s.specialty && s.type !== 'DESCANSO' && <p className="text-[9px] text-blue-400 uppercase mt-1 tracking-widest">{s.specialty}</p>}

            {profile?.role === 'admin' && (
              <button onClick={() => setSchedules(schedules.filter((x: any) => x.id !== s.id))} className="mt-6 w-full py-2 bg-red-500/10 text-[9px] text-red-500 font-black uppercase rounded-lg hover:bg-red-500/20 transition-colors">Eliminar Turno</button>
            )}
          </div>
        ))}
        {schedules.length === 0 && <p className="col-span-full p-12 text-center text-gray-500 italic border border-dashed border-gray-600 rounded-3xl">El calendario está vacío. Los médicos deben registrar sus turnos.</p>}
      </div>
    </div>
  );
}

// --- Modals ---

function Modal({ children, title, onClose }: any) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-[#141414] border border-white/10 rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-10">
          <div className="flex justify-between items-center mb-10 pb-4 border-b border-white/5">
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight">{title}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full"><XCircle size={20} /></button>
          </div>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

// NUEVO MODAL: Completar cita eligiendo el doctor
function CompleteApptModal({ appt, profile, onClose, onConfirm }: any) {
  // Si el perfil es medico, por defecto usa su nombre. Si es admin, puede que lo escriba o elija.
  const [medicoName, setMedicoName] = useState(profile.role === 'medico' ? profile.name : '');

  return (
    <Modal title="Finalizar Atención Médica" onClose={onClose}>
      <div className="space-y-6">
        <p className="text-xs text-gray-400">Por favor, confirma el nombre del médico que realizó la atención para el registro histórico.</p>
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Doctor a Cargo</label>
          <input
            type="text"
            value={medicoName}
            onChange={(e) => setMedicoName(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm focus:border-emerald-500/50"
            placeholder="Dr. Apellido..."
          />
        </div>
        <button
          onClick={() => onConfirm(appt.id, medicoName)}
          disabled={!medicoName}
          className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors disabled:opacity-50"
        >
          Guardar y Completar Cita
        </button>
      </div>
    </Modal>
  );
}

function ExternalSupportModal({ onClose, onSend }: any) {
  const [data, setData] = useState({ name: '', dni: '', content: '' });
  return (
    <Modal title="Soporte y Reclamos (ATC)" onClose={onClose}>
      <div className="space-y-6">
        <p className="text-xs text-gray-400">Si tuviste problemas para ingresar o registrarte, déjanos tu mensaje y nuestro equipo se contactará contigo.</p>
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Nombre Completo</label>
          <input type="text" value={data.name} onChange={e => setData({ ...data, name: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm focus:border-emerald-500/50" placeholder="Ej: Juan Pérez" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">DNI / CE</label>
          <input type="text" value={data.dni} onChange={e => setData({ ...data, dni: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm focus:border-emerald-500/50" placeholder="Número de documento" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Tu Mensaje / Queja</label>
          <textarea value={data.content} onChange={e => setData({ ...data, content: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm h-32 resize-none focus:border-emerald-500/50" placeholder="Detalla tu inconveniente..." />
        </div>
        <button
          onClick={() => { if (data.name && data.dni && data.content) onSend(data); }}
          disabled={!data.name || !data.dni || !data.content}
          className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
        >
          Enviar Mensaje a ATC
        </button>
      </div>
    </Modal>
  );
}

function ScheduleModal({ onClose, onConfirm }: any) {
  const [data, setData] = useState({ days: [] as string[], startTime: '09:00', endTime: '18:00', type: 'DISPONIBLE', specialty: 'Medicina General' });
  const allDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const toggleDay = (d: string) => {
    if (data.days.includes(d)) setData({ ...data, days: data.days.filter(x => x !== d) });
    else setData({ ...data, days: [...data.days, d] });
  };

  return (
    <Modal title="Constructor de Horarios" onClose={onClose}>
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-4 bg-white/5 p-2 rounded-2xl">
          <button onClick={() => setData({ ...data, type: 'DISPONIBLE' })} className={cn("py-4 rounded-xl text-[10px] font-black uppercase transition-colors", data.type === 'DISPONIBLE' ? "bg-emerald-500 text-black shadow-md" : "text-gray-500 hover:text-white")}>Disponible (Laburo)</button>
          <button onClick={() => setData({ ...data, type: 'DESCANSO' })} className={cn("py-4 rounded-xl text-[10px] font-black uppercase transition-colors", data.type === 'DESCANSO' ? "bg-red-500 text-white shadow-md" : "text-gray-500 hover:text-white")}>Día de Descanso</button>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest border-b border-white/5 pb-2 block">Días a aplicar (Puedes elegir varios)</label>
          <div className="flex flex-wrap gap-3">
            {allDays.map(d => (
              <button key={d} onClick={() => toggleDay(d)} className={cn("px-5 py-3 rounded-xl text-[10px] font-bold border transition-colors shadow-sm", data.days.includes(d) ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-white/[0.02] border-white/10 text-gray-400 hover:bg-white/5")}>{d}</button>
            ))}
          </div>
        </div>

        {data.type === 'DISPONIBLE' && (
          <div className="space-y-6 pt-4 border-t border-white/5">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Especialidad a ejercer</label>
              <select value={data.specialty} onChange={e => setData({ ...data, specialty: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm">
                {Object.keys(SPECIALIZATION_PRICES).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Hora Inicio</label>
                <input type="time" value={data.startTime} onChange={e => setData({ ...data, startTime: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Hora Fin</label>
                <input type="time" value={data.endTime} onChange={e => setData({ ...data, endTime: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm" />
              </div>
            </div>
          </div>
        )}
        <button onClick={() => onConfirm(data)} disabled={data.days.length === 0} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-xs disabled:opacity-50 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 mt-4">Generar Bloque de Turnos</button>
      </div>
    </Modal>
  );
}

function CreateApptModal({ profile, schedules, onClose, onConfirm }: any) {
  const [step, setStep] = useState(1);
  const [symptoms, setSymptoms] = useState('');
  const [triageResult, setTriageResult] = useState<{ urgency: string, specialization: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const [data, setData] = useState({ name: profile.name, dni: profile.dni || '', date: '', time: '', service: 'Consulta General' });

  const runTriage = async () => {
    if (!symptoms) return;
    setLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analiza los siguientes síntomas médicos y determina la urgencia (BAJA, MEDIA, ALTA) y la especialidad médica adecuada de la siguiente lista: ${Object.keys(SPECIALIZATION_PRICES).join(', ')}. Responde EXCLUSIVAMENTE en JSON puro con las llaves "urgency" y "specialization". Síntomas del paciente: ${symptoms}`,
        config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { urgency: { type: Type.STRING }, specialization: { type: Type.STRING } }, required: ["urgency", "specialization"] } }
      });
      const result = JSON.parse(response.text || '{}');
      setTriageResult(result);

      // AUTO-ASIGNACIÓN SI ES ALTA URGENCIA
      let suggestedDate = '';
      let suggestedTime = '';
      if (result.urgency === 'ALTA') {
        const availableSlots = schedules.filter((s: any) => s.type === 'DISPONIBLE' && (s.specialty === result.specialization || s.specialty === 'Medicina General'));
        if (availableSlots.length > 0) {
          const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
          suggestedDate = tmr.toISOString().split('T')[0];
          suggestedTime = availableSlots[0].startTime;
        }
      }

      setData(prev => ({ ...prev, service: result.specialization, date: suggestedDate, time: suggestedTime }));
      setStep(2);
    } catch (error) {
      setTriageResult({ urgency: 'MEDIA', specialization: 'Medicina General' });
      setStep(2);
    } finally { setLoading(false); }
  };

  return (
    <Modal title="Triaje e IA Médica" onClose={onClose}>
      <div className="space-y-6">
        {step === 1 && (
          <div className="space-y-6">
            <p className="text-xs text-gray-400">Describe con detalle qué te duele o qué síntomas presentas. Nuestra inteligencia artificial derivará tu caso a la especialidad correcta.</p>
            <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm h-32 resize-none focus:border-emerald-500/50 transition-colors" placeholder="Ej: Tengo un dolor punzante en la espalda baja desde hace dos días..." />
            <button onClick={runTriage} disabled={loading || !symptoms} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Activity size={16} />}
              {loading ? "Analizando síntomas..." : "Iniciar Diagnóstico IA"}
            </button>
          </div>
        )}
        {step === 2 && triageResult && (
          <div className="space-y-8">
            <div className={cn("p-8 rounded-3xl border text-center space-y-3", triageResult.urgency === 'ALTA' ? "bg-red-500/10 border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)]" : "bg-white/5 border-white/10")}>
              {triageResult.urgency === 'ALTA' && <AlertCircle className="mx-auto text-red-500 mb-2 animate-pulse" size={32} />}
              <p className={cn("text-[10px] font-black uppercase tracking-widest", triageResult.urgency === 'ALTA' ? "text-red-500" : "text-emerald-500")}>Prioridad del Paciente: {triageResult.urgency}</p>
              <h4 className="text-2xl font-black text-white">{triageResult.specialization}</h4>
              {triageResult.urgency === 'ALTA' && data.date && <p className="text-[10px] text-red-400 font-bold uppercase mt-4 bg-red-500/10 p-2 rounded-lg inline-block">Emergencia: Turno automático asignado</p>}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Fecha</label>
                <input type="date" value={data.date} onChange={e => setData({ ...data, date: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm outline-none focus:border-emerald-500/50" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Hora</label>
                <input type="time" value={data.time} onChange={e => setData({ ...data, time: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm outline-none focus:border-emerald-500/50" />
              </div>
            </div>

            <div className="flex gap-4 mt-8 pt-6 border-t border-white/5">
              <button onClick={() => onConfirm({ ...data, symptoms, urgency: triageResult.urgency, specialization: triageResult.specialization, userId: profile.id }, true)} className="flex-1 bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors">Pagar Ahora</button>
              <button onClick={() => onConfirm({ ...data, symptoms, urgency: triageResult.urgency, specialization: triageResult.specialization, userId: profile.id }, false)} className="flex-1 bg-white/5 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] border border-white/10 hover:bg-white/10 transition-colors">Pagar Después</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PaymentModal({ appt, onClose, onConfirm }: any) {
  const [method, setMethod] = useState<'YAPE' | 'PLIN' | 'CARD'>('YAPE');
  const [ref, setRef] = useState('');
  return (
    <Modal title="Pasarela de Pago" onClose={onClose}>
      <div className="space-y-8">
        <div className="grid grid-cols-3 gap-4">
          {['YAPE', 'PLIN', 'CARD'].map((m: any) => (
            <button key={m} onClick={() => setMethod(m)} className={cn("py-5 rounded-2xl border text-[10px] font-black tracking-widest transition-all", method === m ? "bg-emerald-500 text-black border-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-white/5 text-gray-500 hover:bg-white/10")}>{m}</button>
          ))}
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Código de Operación</label>
          <input type="text" value={ref} onChange={(e) => setRef(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm focus:border-emerald-500/50" placeholder="Ej: TRX-88221" />
        </div>
        <button onClick={() => onConfirm(appt.id, method, ref)} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-xs hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">Abonar S/ {appt.amount.toFixed(2)}</button>
      </div>
    </Modal>
  );
}

function VoucherModal({ appt, onClose }: any) {
  return (
    <Modal title="Comprobante Digital" onClose={onClose}>
      <div className="p-10 bg-white text-black rounded-3xl space-y-8 font-mono relative overflow-hidden shadow-inner">
        <div className="absolute top-0 right-0 w-full h-3 bg-emerald-500" />
        <div className="text-center border-b border-gray-200 pb-6">
          <h3 className="font-black text-3xl italic tracking-tighter">MEDIAGENDAK</h3>
          <p className="text-[10px] text-gray-500 uppercase mt-2 font-sans tracking-widest">Voucher Electrónico Oficial</p>
        </div>
        <div className="space-y-4 text-sm bg-gray-50 p-6 rounded-2xl border border-gray-100">
          <div className="flex justify-between items-center"><span className="text-gray-400">PACIENTE:</span><span className="font-bold uppercase text-right">{appt.patientName}</span></div>
          <div className="flex justify-between items-center"><span className="text-gray-400">DNI:</span><span className="font-bold">{appt.patientDni}</span></div>
          <div className="flex justify-between items-center"><span className="text-gray-400">FECHA ATENCIÓN:</span><span className="font-bold">{appt.date} {appt.time}</span></div>
          <div className="flex justify-between items-center"><span className="text-gray-400">MÉTODO PAGO:</span><span className="font-bold">{appt.paymentMethod}</span></div>
          <div className="flex justify-between items-center"><span className="text-gray-400">OPERACIÓN:</span><span className="font-bold text-xs">{appt.reference || 'N/A'}</span></div>

          <div className="pt-4 border-t border-gray-200 mt-4 flex justify-between items-center"><span className="text-gray-500 font-bold uppercase">SERVICIO:</span><span className="font-black uppercase text-emerald-600">{appt.service}</span></div>
          <div className="flex justify-between items-center text-2xl pt-4 border-t-2 border-dashed border-gray-300 mt-4"><span className="font-black">TOTAL PAGO:</span><span className="font-black text-emerald-500">S/ {appt.amount.toFixed(2)}</span></div>
        </div>
        <div className="text-center pt-2">
          <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-2" />
          <p className="text-[8px] text-gray-400 sans-serif uppercase tracking-widest">Documento válido para reclamos ATC</p>
        </div>
      </div>
      <button onClick={() => window.print()} className="w-full mt-6 bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2">
        <Archive size={16} /> Guardar PDF / Imprimir
      </button>
    </Modal>
  );
}

function CancelModal({ appt, onClose, onConfirm }: any) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Confirmar Cancelación" onClose={onClose}>
      <div className="space-y-6">
        <p className="text-xs text-gray-400">Si cancelas tu cita y ya realizaste un pago, el monto será reembolsado a tu cuenta en 48 horas o quedará como saldo a favor.</p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none h-32 resize-none focus:border-red-500/50 transition-colors" placeholder="Detalla el motivo de la cancelación..." />
        <button onClick={() => onConfirm(appt.id, reason)} className="w-full bg-red-500/10 text-red-500 font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] hover:bg-red-500/20 border border-red-500/20 transition-colors">Ejecutar Cancelación Definitiva</button>
      </div>
    </Modal>
  );
}

function ReprogramModal({ appt, onClose, onConfirm }: any) {
  const [date, setDate] = useState(appt.date);
  const [time, setTime] = useState(appt.time);
  return (
    <Modal title="Reprogramar Cita" onClose={onClose}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Nueva Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-blue-500/50" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Nueva Hora</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-blue-500/50" />
          </div>
        </div>
        <button onClick={() => onConfirm(appt.id, date, time)} className="w-full bg-blue-500 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20 mt-4">Confirmar Reprogramación</button>
      </div>
    </Modal>
  );
}

function RecipeModal({ appt, profile, onClose, onConfirm }: any) {
  const [notes, setNotes] = useState(appt.notes || '');
  return (
    <Modal title="Emisión de Receta y Notas" onClose={onClose}>
      <div className="space-y-6">
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl mb-6">
          <p className="text-[10px] text-gray-500 uppercase font-black">Paciente: <span className="text-white">{appt.patientName}</span></p>
          <p className="text-[10px] text-gray-500 uppercase font-black">Motivo / Síntomas: <span className="text-gray-300 italic">"{appt.symptoms || 'No declarados'}"</span></p>
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none h-48 resize-none focus:border-emerald-500/50 transition-colors" placeholder="Escribe aquí los medicamentos, indicaciones de reposo o derivaciones médicas..." />
        <button onClick={() => onConfirm(appt.id, notes)} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">Fimar y Guardar Receta</button>
      </div>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onConfirm }: any) {
  const [data, setData] = useState(user);
  return (
    <Modal title="Editor de Perfil de Usuario" onClose={onClose}>
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Nombre Completo</label>
          <input type="text" value={data.name} onChange={e => setData({ ...data, name: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm outline-none focus:border-blue-500/50" placeholder="Nombre" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Teléfono</label>
            <input type="text" value={data.phone || ''} onChange={e => setData({ ...data, phone: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm outline-none focus:border-blue-500/50" placeholder="999..." />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Email</label>
            <input type="email" value={data.email || ''} onChange={e => setData({ ...data, email: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm outline-none focus:border-blue-500/50" placeholder="@" />
          </div>
        </div>
        <button onClick={() => onConfirm(data)} className="w-full bg-blue-500 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] mt-4 hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20">Aplicar Cambios a BD</button>
      </div>
    </Modal>
  );
}

function CreateUserModal({ onClose, onConfirm }: any) {
  const [data, setData] = useState({ name: '', username: '', password: '', dni: '', role: 'patient' });
  return (
    <Modal title="Creación de Nuevo Usuario" onClose={onClose}>
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3 bg-white/5 p-2 rounded-2xl">
          {['admin', 'medico', 'patient'].map(r => (
            <button key={r} onClick={() => setData({ ...data, role: r as any })} className={cn("py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-colors shadow-sm", data.role === r ? "bg-emerald-500 text-black" : "text-gray-500 hover:text-white")}>{r}</button>
          ))}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Nombre Completo</label>
          <input type="text" placeholder="Ej: Maria Gonzalez" onChange={e => setData({ ...data, name: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm focus:border-emerald-500/50" />
        </div>

        {data.role === 'patient' ? (
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Documento (DNI/CE)</label>
            <input type="text" placeholder="Número de documento" maxLength={12} onChange={e => setData({ ...data, dni: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm focus:border-emerald-500/50" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Usuario de Red</label>
              <input type="text" placeholder="admin01" onChange={e => setData({ ...data, username: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm focus:border-emerald-500/50" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Contraseña Acceso</label>
              <input type="password" placeholder="••••••••" onChange={e => setData({ ...data, password: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm focus:border-emerald-500/50" />
            </div>
          </div>
        )}
        <button onClick={() => onConfirm(data)} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl mt-4 uppercase tracking-widest text-[10px] hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">Guardar Nuevo Registro</button>
      </div>
    </Modal>
  );
}