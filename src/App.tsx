/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import {
  Calendar, User as UserIcon, CreditCard, CheckCircle2, Plus, LogOut,
  LayoutDashboard, Settings, Wallet, Stethoscope, ShieldCheck, UserPlus,
  Trash2, Search, Clock, XCircle, RefreshCw, Filter, Users, ChevronRight,
  AlertCircle, MessageCircle, Archive, Edit, Send, BarChart3, FileText
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
  const styles: any = {
    PENDING: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    PAID: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    CANCELLED: "bg-red-500/10 text-red-500 border-red-500/20",
    COMPLETED: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    ALTA: "bg-red-500/10 text-red-500 border-red-500/20",
    MEDIA: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    BAJA: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border", styles[status] || "bg-gray-500/10 text-gray-500 border-gray-500/20")}>
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
  const [showEditUserDialog, setShowEditUserDialog] = useState<UserProfile | null>(null);
  const [showCreateApptDialog, setShowCreateApptDialog] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showExternalSupport, setShowExternalSupport] = useState(false);

  const [authTab, setAuthTab] = useState<Role>('admin');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPatientName, setFormPatientName] = useState('');
  const [formPatientDni, setFormPatientDni] = useState('');
  const [authError, setAuthError] = useState('');

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
      setUsers([defaultAdmin, defaultMedico]);
    }
    if (savedAppointments) setAppointments(JSON.parse(savedAppointments));
    if (savedSchedules) setSchedules(JSON.parse(savedSchedules));

    setLoading(false);
  }, []);

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
          setAuthError('El Nombre no coincide con el Documento registrado.');
          return;
        }
        user = existingUser;
      } else {
        if (!inputName || !inputDni) { setAuthError('Ingresa datos válidos.'); return; }
        const newPatient: UserProfile = { id: Math.random().toString(36).substr(2, 9), name: inputName, dni: inputDni, role: 'patient' };
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
  const deleteAppointment = (id: string) => setAppointments(appointments.filter(a => a.id !== id));
  const processPayment = (id: string, method: 'YAPE' | 'PLIN' | 'CARD', ref: string) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, paymentStatus: 'PAID', paymentMethod: method, reference: ref, status: 'PAID' } : a));
    setShowPaymentDialog(null);
  };
  const completeAppointment = (id: string) => setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'COMPLETED' } : a));

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

  const activeAppointments = profile?.role !== 'patient' ? appointments.filter(a => a.status !== 'CANCELLED' && a.status !== 'COMPLETED') : appointments;
  const filteredAppointments = activeAppointments.filter(a => {
    const matchesSearch = a.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || a.patientDni.includes(searchTerm);
    const matchesRole = profile?.role === 'patient' ? a.userId === profile.id : true;
    let matchesStatus = true;
    if (filterStatus === 'TODAY') matchesStatus = a.date === today;
    else if (filterStatus !== 'ALL') matchesStatus = a.status === filterStatus;
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
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.15)]">
              <Wallet className="text-emerald-500" size={32} />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter italic">MEDIAGENDAK</h1>
            <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest mt-1">kelcardozabr@uch.pe</p>
          </div>
          <div className={cn("bg-[#141414] border border-white/5 shadow-2xl rounded-3xl overflow-hidden transition-colors", !isDarkMode && "bg-white border-gray-200 shadow-xl")}>
            <div className={cn("flex border-b", isDarkMode ? "bg-white/[0.02] border-white/5" : "bg-gray-50 border-gray-100")}>
              {(['admin', 'medico', 'patient'] as Role[]).map((role) => (
                <button key={role} onClick={() => { setAuthTab(role); setAuthError(''); }} className={cn("flex-1 py-5 text-[10px] font-black tracking-widest uppercase transition-all relative", authTab === role ? "text-emerald-500" : "text-gray-500 hover:text-gray-300")}>
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
                    <input required type="text" value={formPatientName} onChange={(e) => setFormPatientName(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 text-sm" placeholder="Juan Pérez" />
                  </div>
                  <div className="space-y-2 mb-6">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">DNI o CE</label>
                    <input required type="text" maxLength={12} value={formPatientDni} onChange={(e) => setFormPatientDni(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 text-sm" placeholder="12345678" />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Usuario</label>
                    <input required type="text" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 text-sm" placeholder="usuario" />
                  </div>
                  <div className="space-y-2 mb-6">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Contraseña</label>
                    <input required type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 text-sm" placeholder="••••••••" />
                  </div>
                </>
              )}
              {authError && <p className="text-red-400 text-[10px] font-bold bg-red-400/10 p-4 rounded-xl border border-red-400/20 mb-4">{authError}</p>}
              <button type="submit" className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl hover:bg-emerald-400 flex items-center justify-center uppercase tracking-widest text-xs">
                {authTab === 'patient' ? 'Ingreso Libre' : 'Entrar al Sistema'}
              </button>
              {authTab === 'patient' && (
                <button type="button" onClick={() => setShowExternalSupport(true)} className="w-full mt-4 text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest">
                  ¿Problemas de acceso? Escríbenos
                </button>
              )}
            </form>
          </div>
        </motion.div>
        <AnimatePresence>
          {showExternalSupport && <ExternalSupportModal onClose={() => setShowExternalSupport(false)} onSend={(d: any) => { setMessages([{ id: Math.random().toString(), senderName: d.name, senderDni: d.dni, content: d.content, date: new Date().toISOString(), isRead: false }, ...messages]); setShowExternalSupport(false); }} />}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen flex font-sans overflow-hidden", isDarkMode ? "bg-[#0a0a0a] text-gray-300" : "bg-gray-50 text-gray-900")}>
      <aside className={cn("w-72 border-r flex flex-col hidden lg:flex shrink-0", isDarkMode ? "bg-[#0f0f0f] border-white/5" : "bg-white border-gray-200")}>
        <div className="p-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20"><Wallet className="text-black" size={20} /></div>
            <span className={cn("font-black text-xl italic uppercase", isDarkMode ? "text-white" : "text-gray-900")}>MEDIAGENDAK</span>
          </div>
          <nav className="space-y-2"><SideNav profile={profile} currentView={currentView} setView={setCurrentView} isDarkMode={isDarkMode} /></nav>
        </div>
        <div className={cn("mt-auto p-8 border-t", isDarkMode ? "border-white/5 bg-white/[0.01]" : "border-gray-100 bg-gray-50/50")}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl border flex items-center justify-center font-black text-xl uppercase bg-white/5 text-emerald-500">{profile.name.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate uppercase text-white">{profile.name}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">{profile.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 text-gray-500 hover:text-red-500 text-xs font-bold p-2"><LogOut size={18} /> Cerrar Sesión</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className={cn("h-20 border-b flex items-center justify-between px-6 lg:px-10 backdrop-blur-xl z-50", isDarkMode ? "bg-[#0a0a0a]/80 border-white/5" : "bg-white/80 border-gray-100")}>
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white">{currentView}</h2>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-white/[0.03] border border-white/5 rounded-full">
              <ShieldCheck size={14} className={profile.role === 'admin' ? "text-red-500" : profile.role === 'medico' ? "text-emerald-500" : "text-blue-500"} />
              <span className="text-[10px] font-black uppercase text-gray-400">{profile.role}</span>
            </div>
            {profile.role !== 'medico' && (
              <button onClick={() => setShowCreateApptDialog(true)} className="bg-emerald-500 text-black text-[10px] font-black uppercase py-2.5 px-6 rounded-xl flex items-center gap-2"><Plus size={16} /> Cita</button>
            )}
          </div>
        </header>

        <div className={cn("flex-1 overflow-y-auto p-6 lg:p-10", isDarkMode ? "bg-[#0a0a0a]" : "bg-white")}>
          <div className="max-w-7xl mx-auto">
            {currentView === 'dashboard' && profile.role !== 'patient' && <DashboardView appointments={appointments} isDarkMode={isDarkMode} />}
            {currentView === 'citas' && <CitasView profile={profile} appointments={sortedAppointments} searchTerm={searchTerm} setSearchTerm={setSearchTerm} onPay={setShowPaymentDialog} onCancel={setShowCancelDialog} onReprogram={setShowReprogramDialog} onComplete={completeAppointment} onDelete={deleteAppointment} onAddRecipe={setShowRecipeDialog} isDarkMode={isDarkMode} />}
            {currentView === 'historial' && profile.role === 'admin' && <HistorialView appointments={appointments} onDelete={deleteAppointment} isDarkMode={isDarkMode} />}
            {currentView === 'atc' && profile.role === 'admin' && <ATCAdminView messages={messages} onReply={(id: string, r: string) => setMessages(messages.map(m => m.id === id ? { ...m, reply: r, isRead: true } : m))} isDarkMode={isDarkMode} />}
            {currentView === 'mensajes' && profile.role === 'patient' && <ATCPatientView profile={profile} messages={messages} onSend={(d: any) => setMessages([{ id: Math.random().toString(), senderName: d.name, senderDni: d.dni, content: d.content, date: new Date().toISOString(), isRead: false }, ...messages])} isDarkMode={isDarkMode} />}
            {currentView === 'pagos' && profile.role === 'patient' && <PagosPendientesView appointments={appointments.filter(a => a.userId === profile.id)} onPay={setShowPaymentDialog} onViewVoucher={setShowVoucherDialog} isDarkMode={isDarkMode} />}
            {currentView === 'informacion' && profile.role === 'patient' && <InformacionView profile={profile} onUpdate={updateProfile} isDarkMode={isDarkMode} />}
            {currentView === 'usuarios' && profile.role === 'admin' && <UsuariosView users={users} onCreate={() => setShowCreateUserDialog(true)} onEdit={setShowEditUserDialog} onDelete={(id: string) => setUsers(users.filter(u => u.id !== id))} isDarkMode={isDarkMode} />}
            {currentView === 'horarios' && <HorariosView schedules={schedules} setSchedules={setSchedules} profile={profile} onAdd={() => setShowScheduleForm(true)} isDarkMode={isDarkMode} />}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showPaymentDialog && <PaymentModal appt={showPaymentDialog} onClose={() => setShowPaymentDialog(null)} onConfirm={processPayment} />}
        {showVoucherDialog && <VoucherModal appt={showVoucherDialog} onClose={() => setShowVoucherDialog(null)} />}
        {showCancelDialog && <CancelModal appt={showCancelDialog} onClose={() => setShowCancelDialog(null)} onConfirm={cancelAppointment} />}
        {showReprogramDialog && <ReprogramModal appt={showReprogramDialog} onClose={() => setShowReprogramDialog(null)} onConfirm={(id: string, d: string, t: string) => { setAppointments(appointments.map(a => a.id === id ? { ...a, date: d, time: t } : a)); setShowReprogramDialog(null); }} />}
        {showRecipeDialog && <RecipeModal appt={showRecipeDialog} profile={profile!} onClose={() => setShowRecipeDialog(null)} onConfirm={(apptId: string, notes: string) => { setAppointments(appointments.map(a => a.id === apptId ? { ...a, notes } : a)); setShowRecipeDialog(null); }} />}
        {showCreateUserDialog && <CreateUserModal onClose={() => setShowCreateUserDialog(false)} onConfirm={(d: any) => { setUsers([...users, { id: Math.random().toString(), ...d }]); setShowCreateUserDialog(false); }} />}
        {showEditUserDialog && <EditUserModal user={showEditUserDialog} onClose={() => setShowEditUserDialog(null)} onConfirm={(d: any) => { setUsers(users.map(u => u.id === d.id ? d : u)); setShowEditUserDialog(null); }} />}
        {showCreateApptDialog && <CreateApptModal profile={profile!} schedules={schedules} onClose={() => setShowCreateApptDialog(false)} onConfirm={createAppointment} />}
        {showScheduleForm && <ScheduleModal onClose={() => setShowScheduleForm(false)} onConfirm={addSchedulesBulk} />}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-Views ---
function SideNav({ profile, currentView, setView, isDarkMode }: any) {
  if (profile.role === 'patient') {
    return (
      <>
        <NavItem active={currentView === 'citas'} icon={<Calendar size={20} />} label="Mis Citas" onClick={() => setView('citas')} />
        <NavItem active={currentView === 'pagos'} icon={<CreditCard size={20} />} label="Pagos y Vouchers" onClick={() => setView('pagos')} />
        <NavItem active={currentView === 'informacion'} icon={<UserIcon size={20} />} label="Mi Perfil" onClick={() => setView('informacion')} />
        <NavItem active={currentView === 'mensajes'} icon={<MessageCircle size={20} />} label="Soporte ATC" onClick={() => setView('mensajes')} />
      </>
    );
  }
  return (
    <>
      <NavItem active={currentView === 'dashboard'} icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={() => setView('dashboard')} />
      <NavItem active={currentView === 'citas'} icon={<Calendar size={20} />} label="Citas Activas" onClick={() => setView('citas')} />
      {profile.role === 'admin' && (
        <>
          <NavItem active={currentView === 'historial'} icon={<Archive size={20} />} label="Historial DB" onClick={() => setView('historial')} />
          <NavItem active={currentView === 'horarios'} icon={<Clock size={20} />} label="Horarios" onClick={() => setView('horarios')} />
          <NavItem active={currentView === 'usuarios'} icon={<Users size={20} />} label="Usuarios" onClick={() => setView('usuarios')} />
          <NavItem active={currentView === 'atc'} icon={<MessageCircle size={20} />} label="ATC (Quejas)" onClick={() => setView('atc')} />
        </>
      )}
      {profile.role === 'medico' && <NavItem active={currentView === 'horarios'} icon={<Clock size={20} />} label="Mi Horario" onClick={() => setView('horarios')} />}
    </>
  );
}

function NavItem({ active, icon, label, onClick }: any) {
  return (
    <button onClick={onClick} className={cn("w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-sm transition-all group", active ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-gray-500 hover:bg-white/5 hover:text-gray-300")}>
      <span className={cn("transition-transform group-hover:scale-110", active ? "text-black" : "text-emerald-500")}>{icon}</span>{label}
    </button>
  );
}

function DashboardView({ appointments, isDarkMode }: any) {
  // Calcular ingresos por especialidad
  const incomeMap: any = {};
  appointments.filter((a: any) => a.paymentStatus === 'PAID').forEach((a: any) => {
    incomeMap[a.service] = (incomeMap[a.service] || 0) + a.amount;
  });
  const maxIncome = Math.max(...Object.values(incomeMap) as number[], 1); // Evitar división por 0

  return (
    <div className="space-y-10">
      <div className={cn("border rounded-[40px] p-12 relative overflow-hidden", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black italic uppercase tracking-tight text-white flex items-center gap-2"><BarChart3 className="text-emerald-500" /> Análisis de Ingresos</h2>
        </div>
        <div className="flex items-end gap-4 h-64 mt-8">
          {Object.entries(incomeMap).map(([spec, amount]: any) => {
            const height = (amount / maxIncome) * 100;
            return (
              <div key={spec} className="flex-1 flex flex-col items-center justify-end group">
                <div className="opacity-0 group-hover:opacity-100 text-[10px] font-black text-emerald-500 mb-2 transition-opacity">S/ {amount.toFixed(2)}</div>
                <div className="w-full bg-emerald-500/20 rounded-t-xl relative overflow-hidden border border-emerald-500/30 transition-all hover:bg-emerald-500/40" style={{ height: `${height}%` }}>
                  <div className="absolute bottom-0 w-full bg-emerald-500/50" style={{ height: '20%' }} />
                </div>
                <div className="text-[9px] text-gray-500 font-bold uppercase mt-3 text-center truncate w-full px-1">{spec}</div>
              </div>
            );
          })}
          {Object.keys(incomeMap).length === 0 && <p className="text-gray-500 text-sm italic w-full text-center pb-20">No hay pagos registrados aún.</p>}
        </div>
      </div>
    </div>
  );
}

function InformacionView({ profile, onUpdate, isDarkMode }: any) {
  const [data, setData] = useState({ phone: profile.phone || '', email: profile.email || '' });
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className={cn("border rounded-[40px] p-12 relative overflow-hidden", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
        <h2 className="text-2xl font-black uppercase tracking-tight italic text-white mb-6">Mi Perfil</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Teléfono</label>
            <input type="tel" value={data.phone} onChange={e => setData({ ...data, phone: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm" placeholder="987654321" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Correo Electrónico</label>
            <input type="email" value={data.email} onChange={e => setData({ ...data, email: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm" placeholder="correo@ejemplo.com" />
          </div>
          <button onClick={() => onUpdate(data)} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-xs mt-4">Actualizar Datos</button>
        </div>
      </div>
    </div>
  );
}

function CitasView({ profile, appointments, searchTerm, setSearchTerm, onCancel, onReprogram, onComplete, onDelete, onAddRecipe, isDarkMode }: any) {
  return (
    <div className="space-y-8">
      <div className="relative w-full md:w-96 mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#141414] border border-white/5 py-4 pl-12 pr-6 rounded-2xl text-sm text-white outline-none focus:border-emerald-500/30" />
      </div>

      {profile.role === 'patient' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appointments.map((appt: any) => (
            <motion.div layout key={appt.id} className={cn("border rounded-3xl p-8 relative", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="font-black text-lg mb-1 uppercase text-white">{appt.patientName}</h4>
                  <p className="text-[10px] font-mono text-gray-500 uppercase">DNI: {appt.patientDni}</p>
                </div>
                <Badge status={appt.status}>{appt.status}</Badge>
              </div>
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-xs text-gray-400"><Calendar size={14} className="text-emerald-500" /><span>{appt.date} {appt.time}</span></div>
                <div className="flex items-center gap-3 text-xs text-gray-400"><Stethoscope size={14} className="text-emerald-500" /><span>{appt.service}</span></div>
                {appt.notes && (
                  <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 mt-4">
                    <p className="text-[9px] text-blue-400 font-black uppercase mb-1 flex items-center gap-1"><FileText size={12} /> Receta Médica:</p>
                    <p className="text-xs text-gray-300">{appt.notes}</p>
                  </div>
                )}
              </div>
              {appt.status === 'PENDING' && <button onClick={() => onCancel(appt)} className="w-full bg-red-500/10 text-red-500 text-[10px] font-black uppercase py-3 rounded-xl hover:bg-red-500/20">Cancelar Cita</button>}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className={cn("rounded-3xl border overflow-hidden", isDarkMode ? "border-white/5 bg-[#141414]" : "border-gray-200 bg-white")}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/5 text-[10px] uppercase font-black text-gray-500 tracking-widest">
                <th className="p-5">Paciente / DNI</th><th className="p-5">Fecha y Hora</th><th className="p-5">Especialidad</th><th className="p-5">Urgencia</th><th className="p-5">Estado</th><th className="p-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a: any) => (
                <tr key={a.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="p-5"><p className="font-bold text-sm uppercase text-white">{a.patientName}</p><p className="text-[10px] text-gray-500 font-mono">{a.patientDni}</p></td>
                  <td className="p-5 text-sm text-gray-400">{a.date} <span className="text-emerald-500 font-bold ml-2">{a.time}</span></td>
                  <td className="p-5 text-sm text-gray-400">{a.service}</td>
                  <td className="p-5"><Badge status={a.urgency || 'BAJA'}>{a.urgency || 'BAJA'}</Badge></td>
                  <td className="p-5"><Badge status={a.status}>{a.status}</Badge></td>
                  <td className="p-5 flex justify-end gap-2">
                    {profile.role === 'admin' && (
                      <>
                        <button onClick={() => onReprogram(a)} className="p-2 bg-white/5 text-white rounded-lg hover:bg-white/10" title="Reprogramar"><Edit size={14} /></button>
                        <button onClick={() => onDelete(a.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20" title="Eliminar"><Trash2 size={14} /></button>
                      </>
                    )}
                    {profile.role === 'medico' && (
                      <button onClick={() => onAddRecipe(a)} className={cn("p-2 rounded-lg transition-colors", a.notes ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" : "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20")} title={a.notes ? "Ver/Editar Receta" : "Añadir Receta"}><Stethoscope size={14} /></button>
                    )}
                    {(a.status === 'PAID') && profile.role !== 'patient' && (
                      <button onClick={() => onComplete(a.id)} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20" title="Completar Atención"><CheckCircle2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HistorialView({ appointments, onDelete, isDarkMode }: any) {
  const history = appointments.filter((a: any) => a.status === 'CANCELLED' || a.status === 'COMPLETED');
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black italic uppercase text-white">Historial de Citas</h2>
      <div className="rounded-3xl border border-white/5 bg-[#141414] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/5 text-[10px] uppercase font-black text-gray-500"><th className="p-5">Paciente</th><th className="p-5">Servicio</th><th className="p-5">Estado</th><th className="p-5 text-right">Borrar</th></tr>
          </thead>
          <tbody>
            {history.map((a: any) => (
              <tr key={a.id} className="border-b border-white/5 text-white">
                <td className="p-5 text-sm font-bold">{a.patientName}</td><td className="p-5 text-sm text-gray-400">{a.service}</td><td className="p-5"><Badge status={a.status}>{a.status}</Badge></td>
                <td className="p-5 text-right"><button onClick={() => onDelete(a.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ATCAdminView({ messages, onReply }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black italic uppercase text-white">Centro de Quejas ATC</h2>
      <div className="grid gap-4">
        {messages.map((m: any) => (
          <div key={m.id} className="p-6 rounded-2xl border border-white/5 bg-[#141414]">
            <div className="flex justify-between text-xs text-gray-500 mb-2"><span className="font-bold text-emerald-500 uppercase">{m.senderName} (DNI: {m.senderDni})</span><span>{new Date(m.date).toLocaleString()}</span></div>
            <p className="text-sm text-white mb-4">{m.content}</p>
            {m.reply ? (<div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-sm text-gray-400"><span className="font-bold text-emerald-500 text-[10px] uppercase block mb-1">Tu Respuesta:</span>{m.reply}</div>) : (
              <div className="flex gap-2">
                <input type="text" id={`reply-${m.id}`} placeholder="Respuesta..." className="flex-1 bg-white/[0.03] border border-white/5 px-4 rounded-xl text-sm text-white" />
                <button onClick={() => { const input = document.getElementById(`reply-${m.id}`) as HTMLInputElement; if (input.value) { onReply(m.id, input.value); input.value = ''; } }} className="bg-emerald-500 text-black px-4 py-2 rounded-xl text-xs font-bold uppercase">Enviar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ATCPatientView({ profile, messages, onSend }: any) {
  const [content, setContent] = useState('');
  const myMessages = messages.filter((m: any) => m.senderDni === profile.dni);
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black italic uppercase text-white">Soporte y Reclamos</h2>
      <div className="p-6 rounded-3xl border border-white/5 bg-[#141414] mb-8">
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="¿En qué te ayudamos?" className="w-full bg-white/[0.03] border border-white/5 p-4 rounded-xl text-sm text-white h-24 mb-4 resize-none" />
        <button onClick={() => { if (content) { onSend({ name: profile.name, dni: profile.dni, content }); setContent(''); } }} className="w-full bg-emerald-500 text-black py-3 rounded-xl font-bold uppercase text-xs flex items-center justify-center gap-2"><Send size={16} /> Enviar Mensaje</button>
      </div>
      <div className="space-y-4">
        {myMessages.map((m: any) => (
          <div key={m.id} className="p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
            <p className="text-sm text-gray-300 mb-2">{m.content}</p>
            {m.reply && (<div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400 text-sm border border-emerald-500/20"><strong>Respuesta ATC:</strong> {m.reply}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function PagosPendientesView({ appointments, onPay, onViewVoucher }: any) {
  const pending = appointments.filter((a: any) => a.paymentStatus === 'PENDING' && a.status !== 'CANCELLED');
  const paid = appointments.filter((a: any) => a.paymentStatus === 'PAID');

  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2"><AlertCircle size={18} className="text-amber-500" /> Pendientes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pending.map((a: any) => (
            <div key={a.id} className="p-8 rounded-3xl border border-amber-500/20 bg-[#141414]">
              <h4 className="font-bold text-lg mb-2 uppercase text-white">{a.service}</h4>
              <p className="text-[10px] text-gray-500 uppercase mb-6">{a.date} • {a.time}</p>
              <div className="text-2xl font-black text-white mb-6">S/ {a.amount.toFixed(2)}</div>
              <button onClick={() => onPay(a)} className="w-full bg-emerald-500 text-black text-[10px] font-black uppercase py-4 rounded-xl">Pagar Ahora</button>
            </div>
          ))}
          {pending.length === 0 && <p className="text-gray-500 italic text-sm">No hay pagos pendientes.</p>}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-500" /> Historial y Vouchers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paid.map((a: any) => (
            <div key={a.id} className="p-8 rounded-3xl border border-white/5 bg-[#141414]">
              <h4 className="font-bold text-lg mb-2 uppercase text-white">{a.service}</h4>
              <p className="text-[10px] text-emerald-500 font-black uppercase mb-6">PAGADO • {a.paymentMethod}</p>
              <button onClick={() => onViewVoucher(a)} className="w-full bg-white/5 text-white border border-white/10 text-[10px] font-black uppercase py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10">
                <RefreshCw size={14} /> Ver Voucher Digital
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsuariosView({ users, onCreate, onEdit, onDelete }: any) {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black italic uppercase text-white">Usuarios</h2>
        <button onClick={onCreate} className="bg-emerald-500 text-black text-[10px] font-black uppercase py-3 px-6 rounded-xl flex items-center gap-2"><UserPlus size={16} /> Crear</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {users.map((u: any) => (
          <div key={u.id} className="p-6 rounded-3xl border border-white/5 bg-[#141414]">
            <div className="flex justify-between items-start mb-4">
              <h4 className="font-bold text-sm uppercase text-white">{u.name}</h4>
              <span className="text-[10px] text-emerald-500 font-black tracking-widest uppercase">{u.role}</span>
            </div>
            <div className="space-y-1 text-xs text-gray-500 mb-6"><p>DNI: {u.dni || '-'}</p><p>Email: {u.email || '-'}</p></div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(u)} className="flex-1 bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase py-2 rounded-lg">Editar</button>
              {u.id !== 'admin-1' && <button onClick={() => onDelete(u.id)} className="flex-1 bg-red-500/10 text-red-500 text-[10px] font-black uppercase py-2 rounded-lg">Borrar</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorariosView({ schedules, setSchedules, profile, onAdd }: any) {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black italic uppercase text-white">Horarios</h2>
        {profile?.role === 'medico' && <button onClick={onAdd} className="bg-emerald-500 text-black text-[10px] font-black uppercase py-3 px-6 rounded-xl flex items-center gap-2"><Plus size={16} /> Turnos</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {schedules.map((s: any) => (
          <div key={s.id} className={cn("p-6 rounded-3xl border bg-[#141414]", s.type === 'DESCANSO' ? "border-red-500/30 opacity-70" : "border-white/5")}>
            <div className="flex justify-between mb-2"><p className="text-[10px] font-black text-emerald-500 uppercase">{s.day}</p><Badge status={s.type === 'DESCANSO' ? 'CANCELLED' : 'PAID'}>{s.type}</Badge></div>
            <h4 className="font-bold text-lg mb-1 text-white">{s.type === 'DESCANSO' ? 'Día Libre' : `${s.startTime} - ${s.endTime}`}</h4>
            <p className="text-xs text-gray-500 uppercase font-bold">{s.medicoName}</p>
            {profile?.role === 'admin' && <button onClick={() => setSchedules(schedules.filter((x: any) => x.id !== s.id))} className="mt-4 text-[10px] text-red-500 font-bold uppercase">Eliminar</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Modals ---
function Modal({ children, title, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#141414] border border-white/10 rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-10">
          <div className="flex justify-between items-center mb-10"><h3 className="text-xl font-black text-white uppercase italic tracking-tight">{title}</h3><button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><XCircle size={24} /></button></div>
          {children}
        </div>
      </motion.div>
    </div>
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
    <Modal title="Establecer Horarios (Múltiples Días)" onClose={onClose}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setData({ ...data, type: 'DISPONIBLE' })} className={cn("py-3 rounded-xl border text-[9px] font-black uppercase", data.type === 'DISPONIBLE' ? "bg-emerald-500 text-black border-emerald-500" : "bg-white/5 text-gray-500")}>Disponible</button>
          <button onClick={() => setData({ ...data, type: 'DESCANSO' })} className={cn("py-3 rounded-xl border text-[9px] font-black uppercase", data.type === 'DESCANSO' ? "bg-red-500 text-white border-red-500" : "bg-white/5 text-gray-500")}>Descanso</button>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Seleccionar Días</label>
          <div className="flex flex-wrap gap-2">
            {allDays.map(d => (
              <button key={d} onClick={() => toggleDay(d)} className={cn("px-4 py-2 rounded-lg text-[10px] font-bold border transition-colors", data.days.includes(d) ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-white/5 border-white/10 text-gray-400")}>{d}</button>
            ))}
          </div>
        </div>

        {data.type === 'DISPONIBLE' && (
          <>
            <select value={data.specialty} onChange={e => setData({ ...data, specialty: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm">
              {Object.keys(SPECIALIZATION_PRICES).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-4">
              <input type="time" value={data.startTime} onChange={e => setData({ ...data, startTime: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm" />
              <input type="time" value={data.endTime} onChange={e => setData({ ...data, endTime: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm" />
            </div>
          </>
        )}
        <button onClick={() => onConfirm(data)} disabled={data.days.length === 0} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-xs disabled:opacity-50">Guardar Bloque de Horarios</button>
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
        contents: `Analiza los siguientes síntomas médicos y determina la urgencia (BAJA, MEDIA, ALTA) y la especialidad médica adecuada de: ${Object.keys(SPECIALIZATION_PRICES).join(', ')}. Responde en JSON puro con llaves "urgency" y "specialization". Síntomas: ${symptoms}`,
        config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { urgency: { type: Type.STRING }, specialization: { type: Type.STRING } }, required: ["urgency", "specialization"] } }
      });
      const result = JSON.parse(response.text || '{}');
      setTriageResult(result);

      // LOGICA ALTA URGENCIA: Buscar turno próximo automáticamente
      let suggestedDate = '';
      let suggestedTime = '';
      if (result.urgency === 'ALTA') {
        const availableSlots = schedules.filter((s: any) => s.type === 'DISPONIBLE' && (s.specialty === result.specialization || s.specialty === 'Medicina General'));
        if (availableSlots.length > 0) {
          // En un entorno real se calcularía el día de la semana actual y se buscaría el próximo coincidente. 
          // Aquí para UX rápida le ponemos fecha de mañana (o el próximo día lógico en base al array).
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
    <Modal title="Agendar Cita con IA" onClose={onClose}>
      <div className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm h-32 resize-none" placeholder="Describe tus síntomas..." />
            <button onClick={runTriage} disabled={loading || !symptoms} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase text-xs disabled:opacity-50">{loading ? "Analizando..." : "Iniciar Triaje IA"}</button>
          </div>
        )}
        {step === 2 && triageResult && (
          <div className="space-y-6">
            <div className={cn("p-6 rounded-2xl border text-center space-y-2", triageResult.urgency === 'ALTA' ? "bg-red-500/10 border-red-500/30" : "bg-white/5 border-white/10")}>
              {triageResult.urgency === 'ALTA' && <AlertCircle className="mx-auto text-red-500 mb-2" size={24} />}
              <p className={cn("text-sm font-bold", triageResult.urgency === 'ALTA' ? "text-red-500" : "text-emerald-500")}>Urgencia: {triageResult.urgency}</p>
              <p className="text-sm text-white">Especialidad: {triageResult.specialization}</p>
              {triageResult.urgency === 'ALTA' && data.date && <p className="text-[10px] text-red-400 font-bold uppercase mt-2">Turno próximo auto-asignado por sistema</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input type="date" value={data.date} onChange={e => setData({ ...data, date: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm" />
              <input type="time" value={data.time} onChange={e => setData({ ...data, time: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm" />
            </div>
            <div className="flex gap-4">
              <button onClick={() => onConfirm({ ...data, symptoms, urgency: triageResult.urgency, specialization: triageResult.specialization, userId: profile.id }, true)} className="flex-1 bg-emerald-500 text-black font-black py-4 rounded-xl uppercase text-[10px]">Pagar Ahora</button>
              <button onClick={() => onConfirm({ ...data, symptoms, urgency: triageResult.urgency, specialization: triageResult.specialization, userId: profile.id }, false)} className="flex-1 bg-white/10 text-white font-black py-4 rounded-xl uppercase text-[10px] border border-white/20 hover:bg-white/20">Pagar Después</button>
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
    <Modal title="Procesar Pago" onClose={onClose}>
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          {['YAPE', 'PLIN', 'CARD'].map((m: any) => (
            <button key={m} onClick={() => setMethod(m)} className={cn("py-4 rounded-2xl border text-[10px] font-black tracking-widest transition-all", method === m ? "bg-emerald-500 text-black border-emerald-500" : "bg-white/5 text-gray-500")}>{m}</button>
          ))}
        </div>
        <input type="text" value={ref} onChange={(e) => setRef(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm" placeholder="Ref: TRX-88221" />
        <button onClick={() => onConfirm(appt.id, method, ref)} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-xs">Confirmar Pago S/ {appt.amount.toFixed(2)}</button>
      </div>
    </Modal>
  );
}

function VoucherModal({ appt, onClose }: any) {
  return (
    <Modal title="Voucher Digital" onClose={onClose}>
      <div className="p-8 bg-white text-black rounded-3xl space-y-6 font-mono relative">
        <div className="absolute top-0 right-0 w-full h-2 bg-emerald-500" />
        <div className="text-center border-b border-black/10 pb-4"><h3 className="font-black text-xl italic">MEDIAGENDAK</h3><p className="text-[10px] text-gray-500 uppercase">Comprobante</p></div>
        <div className="space-y-3 text-xs">
          <div className="flex justify-between"><span className="text-gray-500">MÉTODO:</span><span className="font-bold">{appt.paymentMethod}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">REF:</span><span className="font-bold">{appt.reference}</span></div>
          <div className="pt-2 border-t border-black/5 flex justify-between items-center"><span className="text-gray-500 font-bold uppercase">SERVICIO:</span><span className="font-black uppercase">{appt.service}</span></div>
          <div className="flex justify-between items-center text-lg pt-2 border-t border-dashed border-black/20"><span className="font-black">TOTAL:</span><span className="font-black">S/ {appt.amount.toFixed(2)}</span></div>
        </div>
      </div>
      <button onClick={() => window.print()} className="w-full mt-6 bg-emerald-500 text-black font-black py-4 rounded-xl uppercase text-xs">Imprimir Voucher</button>
    </Modal>
  );
}

function CancelModal({ appt, onClose, onConfirm }: any) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Cancelar Cita" onClose={onClose}>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none h-32 resize-none mb-6" placeholder="Motivo..." />
      <button onClick={() => onConfirm(appt.id, reason)} className="w-full bg-red-500 text-white font-black py-5 rounded-2xl uppercase text-xs">Confirmar Cancelación</button>
    </Modal>
  );
}

function ReprogramModal({ appt, onClose, onConfirm }: any) {
  const [date, setDate] = useState(appt.date);
  const [time, setTime] = useState(appt.time);
  return (
    <Modal title="Reprogramar" onClose={onClose}>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white mb-4" />
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white mb-6" />
      <button onClick={() => onConfirm(appt.id, date, time)} className="w-full bg-emerald-500 text-black py-4 rounded-2xl font-black uppercase text-xs">Actualizar</button>
    </Modal>
  );
}

function RecipeModal({ appt, profile, onClose, onConfirm }: any) {
  const [notes, setNotes] = useState(appt.notes || '');
  return (
    <Modal title="Receta Médica" onClose={onClose}>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none h-48 resize-none mb-6" placeholder="Prescripciones y notas de la consulta..." />
      <button onClick={() => onConfirm(appt.id, notes)} className="w-full bg-blue-500 text-white font-black py-5 rounded-2xl uppercase text-xs">Guardar Receta</button>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onConfirm }: any) {
  const [data, setData] = useState(user);
  return (
    <Modal title="Editar Usuario" onClose={onClose}>
      <div className="space-y-4">
        <input type="text" value={data.name} onChange={e => setData({ ...data, name: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-3 px-4 rounded-xl text-white text-sm" placeholder="Nombre" />
        <input type="text" value={data.phone || ''} onChange={e => setData({ ...data, phone: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-3 px-4 rounded-xl text-white text-sm" placeholder="Teléfono" />
        <input type="email" value={data.email || ''} onChange={e => setData({ ...data, email: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-3 px-4 rounded-xl text-white text-sm" placeholder="Email" />
        <button onClick={() => onConfirm(data)} className="w-full bg-emerald-500 text-black py-4 rounded-xl font-bold uppercase text-xs mt-4">Guardar Cambios</button>
      </div>
    </Modal>
  );
}

function CreateUserModal({ onClose, onConfirm }: any) {
  const [data, setData] = useState({ name: '', username: '', password: '', dni: '', role: 'patient' });
  return (
    <Modal title="Nuevo Usuario" onClose={onClose}>
      <div className="space-y-4">
        <input type="text" placeholder="Nombre Completo" onChange={e => setData({ ...data, name: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm" />
        <div className="grid grid-cols-3 gap-2">
          {['admin', 'medico', 'patient'].map(r => (
            <button key={r} onClick={() => setData({ ...data, role: r as any })} className={cn("py-3 rounded-xl border text-[9px] font-black tracking-widest uppercase", data.role === r ? "bg-emerald-500 text-black border-emerald-500" : "bg-white/5 text-gray-500")}>{r}</button>
          ))}
        </div>
        {data.role === 'patient' ? (
          <input type="text" placeholder="DNI o CE" maxLength={12} onChange={e => setData({ ...data, dni: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm" />
        ) : (
          <>
            <input type="text" placeholder="Usuario" onChange={e => setData({ ...data, username: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm" />
            <input type="password" placeholder="Contraseña" onChange={e => setData({ ...data, password: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm" />
          </>
        )}
        <button onClick={() => onConfirm(data)} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl mt-4 uppercase text-xs">Crear Usuario</button>
      </div>
    </Modal>
  );
}

function ExternalSupportModal({ onClose, onSend }: any) {
  const [data, setData] = useState({ name: '', dni: '', content: '' });
  return (
    <Modal title="Contactar Soporte ATC" onClose={onClose}>
      <div className="space-y-4">
        <input type="text" placeholder="Nombre Completo" value={data.name} onChange={e => setData({ ...data, name: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm" />
        <input type="text" placeholder="DNI o CE" maxLength={12} value={data.dni} onChange={e => setData({ ...data, dni: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm" />
        <textarea value={data.content} onChange={e => setData({ ...data, content: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none h-32 resize-none" placeholder="Describe tu problema..." />
        <button onClick={() => onSend(data)} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase text-xs">Enviar Mensaje</button>
      </div>
    </Modal>
  );
}