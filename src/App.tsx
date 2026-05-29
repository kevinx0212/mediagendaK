/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import {
  Calendar,
  User as UserIcon,
  CreditCard,
  CheckCircle2,
  Plus,
  LogOut,
  LayoutDashboard,
  Settings,
  Wallet,
  Stethoscope,
  ShieldCheck,
  UserPlus,
  Trash2,
  Search,
  Clock,
  XCircle,
  RefreshCw,
  Filter,
  Users,
  ChevronRight,
  AlertCircle,
  MessageCircle,
  Archive,
  Edit,
  Send
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
  'Cardiología': 120.00,
  'Traumatología': 100.00,
  'Pediatría': 80.00,
  'Dermatología': 90.00,
  'Medicina General': 50.00,
  'Neurología': 130.00,
  'Ginecología': 110.00,
  'Oftalmología': 95.00,
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

  // UI State
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<ApptStatus | 'ALL' | 'TODAY'>('ALL');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Dialog States
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

  // Auth Form State
  const [authTab, setAuthTab] = useState<Role>('admin');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPatientName, setFormPatientName] = useState('');
  const [formPatientDni, setFormPatientDni] = useState('');
  const [authError, setAuthError] = useState('');

  // Load Initial Data
  useEffect(() => {
    // CAMBIO: Sesión ahora se guarda en sessionStorage para cerrarse al salir
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
      const defaultPatients: UserProfile[] = [
        { id: 'p-1', name: 'JUAN PEREZ', dni: '77665544', role: 'patient', phone: '987654321', email: 'juan@example.com' },
      ];
      setUsers([defaultAdmin, defaultMedico, ...defaultPatients]);
    }

    if (savedAppointments) setAppointments(JSON.parse(savedAppointments));
    else setAppointments([]);

    if (savedSchedules) setSchedules(JSON.parse(savedSchedules));
    else setSchedules([]);

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
          setAuthError('Por favor ingresa nombre y documento.');
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

  // --- Actions ---

  const createAppointment = (data: any) => {
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

  const completeAppointment = (id: string) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'COMPLETED' } : a));
  };

  const createUser = (data: any) => {
    const newUser: UserProfile = {
      id: Math.random().toString(36).substr(2, 9),
      name: data.name,
      username: data.username,
      password: data.password,
      dni: data.dni,
      role: data.role
    };
    setUsers([...users, newUser]);
    setShowCreateUserDialog(false);
  };

  const updateUser = (data: UserProfile) => {
    setUsers(users.map(u => u.id === data.id ? data : u));
    setShowEditUserDialog(null);
  };

  const deleteUser = (id: string) => {
    if (id === 'admin-1') return; // Protect master admin
    setUsers(users.filter(u => u.id !== id));
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

  // --- Filters & Sorting ---

  // Excluimos las canceladas y completadas de la vista principal del dashboard para Admin/Medico (van al historial)
  const activeAppointments = profile?.role !== 'patient'
    ? appointments.filter(a => a.status !== 'CANCELLED' && a.status !== 'COMPLETED')
    : appointments;

  const filteredAppointments = activeAppointments.filter(a => {
    const matchesSearch = a.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || a.patientDni.includes(searchTerm);
    const matchesRole = profile?.role === 'patient' ? a.userId === profile.id : true;
    let matchesStatus = true;
    if (filterStatus === 'TODAY') matchesStatus = a.date === today;
    else if (filterStatus !== 'ALL') matchesStatus = a.status === filterStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Ordenar por Urgencia (ALTA primero)
  const sortedAppointments = [...filteredAppointments].sort((a, b) => {
    const urgWeights: any = { 'ALTA': 3, 'MEDIA': 2, 'BAJA': 1, undefined: 0 };
    return (urgWeights[b.urgency] || 0) - (urgWeights[a.urgency] || 0);
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
                    <input required type="text" value={formPatientName} onChange={(e) => setFormPatientName(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" placeholder="Juan Pérez" />
                  </div>
                  <div className="space-y-2 mb-6">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">DNI o CE</label>
                    <input required type="text" maxLength={12} value={formPatientDni} onChange={(e) => setFormPatientDni(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" placeholder="12345678" />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Usuario</label>
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
                <button type="button" onClick={() => setShowExternalSupport(true)} className="w-full mt-4 text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-colors">
                  ¿Problemas de acceso? Escríbenos
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

      <main className="flex-1 flex flex-col min-w-0">
        <header className={cn("h-20 border-b flex items-center justify-between px-6 lg:px-10 backdrop-blur-xl z-50 shrink-0", isDarkMode ? "bg-[#0a0a0a]/80 border-white/5" : "bg-white/80 border-gray-100")}>
          <div className="flex items-center gap-4">
            <h2 className={cn("text-xs font-black uppercase tracking-[0.2em] hidden sm:block", isDarkMode ? "text-white" : "text-gray-900")}>{currentView}</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-white/[0.03] border border-white/5 rounded-full mr-2">
              <ShieldCheck size={14} className={cn(profile.role === 'admin' ? "text-red-500" : profile.role === 'medico' ? "text-emerald-500" : "text-blue-500")} />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{profile.role}</span>
            </div>

            {profile.role !== 'medico' && (
              <button onClick={() => setShowCreateApptDialog(true)} className="bg-emerald-500 text-black text-[9px] sm:text-[10px] font-black uppercase tracking-widest py-2.5 px-4 sm:px-6 rounded-xl hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/10">
                <Plus size={16} /> <span className="hidden xs:inline">Cita</span>
              </button>
            )}
          </div>
        </header>

        <div className={cn("flex-1 overflow-y-auto p-6 lg:p-10", isDarkMode ? "bg-[#0a0a0a]" : "bg-white")}>
          <div className="max-w-7xl mx-auto">
            {currentView === 'dashboard' && profile.role !== 'patient' && <DashboardView profile={profile} appointments={appointments} isDarkMode={isDarkMode} />}

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
                onComplete={completeAppointment}
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
              <PagosPendientesView appointments={appointments.filter(a => a.userId === profile.id)} isDarkMode={isDarkMode} onPay={setShowPaymentDialog} onViewVoucher={setShowVoucherDialog} />
            )}

            {currentView === 'usuarios' && profile.role === 'admin' && (
              <UsuariosView users={users} isDarkMode={isDarkMode} onCreate={() => setShowCreateUserDialog(true)} onEdit={setShowEditUserDialog} onDelete={deleteUser} />
            )}

            {currentView === 'horarios' && (
              <HorariosView schedules={schedules} setSchedules={setSchedules} profile={profile} isDarkMode={isDarkMode} onAdd={() => setShowScheduleForm(true)} />
            )}
          </div>
        </div>
      </main>

      {/* Dialogs */}
      <AnimatePresence>
        {showPaymentDialog && <PaymentModal appt={showPaymentDialog} onClose={() => setShowPaymentDialog(null)} onConfirm={processPayment} />}
        {showVoucherDialog && <VoucherModal appt={showVoucherDialog} onClose={() => setShowVoucherDialog(null)} />}
        {showCancelDialog && <CancelModal appt={showCancelDialog} onClose={() => setShowCancelDialog(null)} onConfirm={cancelAppointment} />}
        {showReprogramDialog && <ReprogramModal appt={showReprogramDialog} schedules={schedules} onClose={() => setShowReprogramDialog(null)} onConfirm={(id: string, d: string, t: string) => { setAppointments(appointments.map(a => a.id === id ? { ...a, date: d, time: t } : a)); setShowReprogramDialog(null); }} />}
        {showRecipeDialog && <RecipeModal appt={showRecipeDialog} profile={profile!} onClose={() => setShowRecipeDialog(null)} onConfirm={(apptId: string, notes: string) => { setAppointments(appointments.map(a => a.id === apptId ? { ...a, notes } : a)); setShowRecipeDialog(null); }} />}
        {showCreateUserDialog && <CreateUserModal onClose={() => setShowCreateUserDialog(false)} onConfirm={createUser} />}
        {showEditUserDialog && <EditUserModal user={showEditUserDialog} onClose={() => setShowEditUserDialog(null)} onConfirm={updateUser} />}
        {showCreateApptDialog && <CreateApptModal profile={profile!} schedules={schedules} onClose={() => setShowCreateApptDialog(false)} onConfirm={createAppointment} />}
        {showScheduleForm && <ScheduleModal onClose={() => setShowScheduleForm(false)} onConfirm={(s: any) => { setSchedules([...schedules, { id: Math.random().toString(36).substr(2, 9), medicoId: profile.id, medicoName: profile.name, ...s }]); setShowScheduleForm(false); }} />}
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
        <NavItem active={currentView === 'pagos'} icon={<CreditCard size={20} />} label="Pagos Pendientes" onClick={() => setView('pagos')} isDarkMode={isDarkMode} />
        <NavItem active={currentView === 'mensajes'} icon={<MessageCircle size={20} />} label="Soporte ATC" onClick={() => setView('mensajes')} isDarkMode={isDarkMode} />
      </>
    );
  }

  return (
    <>
      <NavItem active={currentView === 'dashboard'} icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={() => setView('dashboard')} isDarkMode={isDarkMode} />
      <NavItem active={currentView === 'citas'} icon={<Calendar size={20} />} label="Citas Activas" onClick={() => setView('citas')} isDarkMode={isDarkMode} />
      {profile.role === 'admin' && (
        <>
          <NavItem active={currentView === 'historial'} icon={<Archive size={20} />} label="Historial DB" onClick={() => setView('historial')} isDarkMode={isDarkMode} />
          <NavItem active={currentView === 'horarios'} icon={<Clock size={20} />} label="Horarios" onClick={() => setView('horarios')} isDarkMode={isDarkMode} />
          <NavItem active={currentView === 'usuarios'} icon={<Users size={20} />} label="Usuarios" onClick={() => setView('usuarios')} isDarkMode={isDarkMode} />
          <NavItem active={currentView === 'atc'} icon={<MessageCircle size={20} />} label="ATC (Quejas)" onClick={() => setView('atc')} isDarkMode={isDarkMode} />
        </>
      )}
      {profile.role === 'medico' && (
        <NavItem active={currentView === 'horarios'} icon={<Clock size={20} />} label="Mi Horario" onClick={() => setView('horarios')} isDarkMode={isDarkMode} />
      )}
    </>
  );
}

function NavItem({ active, icon, label, onClick, isDarkMode }: any) {
  return (
    <button onClick={onClick} className={cn("w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-sm transition-all group", active ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : isDarkMode ? "text-gray-500 hover:bg-white/5 hover:text-gray-300" : "text-gray-400 hover:bg-emerald-500/5 hover:text-emerald-600")}>
      <span className={cn("transition-transform group-hover:scale-110", active ? "text-black" : "text-emerald-500")}>{icon}</span>
      {label}
    </button>
  );
}

function DashboardView({ profile, appointments, isDarkMode }: any) {
  return (
    <div className="space-y-10">
      <div className={cn("border rounded-[40px] p-12 text-center relative overflow-hidden transition-colors", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
        <LayoutDashboard className="mx-auto text-emerald-500/20 mb-6" size={80} />
        <h2 className={cn("text-3xl font-black mb-4 tracking-tight uppercase italic", isDarkMode ? "text-white" : "text-gray-900")}>Bienvenido, {profile.name}</h2>
        <p className="text-gray-500 text-sm max-w-xl mx-auto leading-relaxed">Panel principal de MEDIAGENDAK.</p>
      </div>
    </div>
  );
}

// Vista principal de Citas (Pacientes en Tarjetas, Personal en Tabla)
function CitasView({ profile, appointments, searchTerm, setSearchTerm, filterStatus, setFilterStatus, onPay, onCancel, onReprogram, onComplete, onDelete, onAddRecipe, isDarkMode }: any) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input type="text" placeholder="Buscar por nombre o DNI..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#141414] border border-white/5 py-4 pl-12 pr-6 rounded-2xl text-sm text-white outline-none focus:border-emerald-500/30 transition-all" />
        </div>
      </div>

      {profile.role === 'patient' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {appointments.map((appt: any) => (
            <motion.div layout key={appt.id} className={cn("border rounded-3xl p-8 transition-all group relative", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className={cn("font-black text-lg mb-1 uppercase tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>{appt.patientName}</h4>
                  <p className="text-[10px] font-mono text-gray-500 uppercase">DNI: {appt.patientDni}</p>
                </div>
                <Badge status={appt.status}>{appt.status}</Badge>
              </div>
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-xs text-gray-400"><Calendar size={14} className="text-emerald-500" /><span>{appt.date} {appt.time}</span></div>
                <div className="flex items-center gap-3 text-xs text-gray-400"><Stethoscope size={14} className="text-emerald-500" /><span>{appt.service}</span></div>
              </div>
              {appt.status === 'PENDING' && <button onClick={() => onCancel(appt)} className="w-full bg-red-500/10 text-red-500 text-[10px] font-black uppercase py-3 rounded-xl hover:bg-red-500/20">Cancelar Cita</button>}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className={cn("rounded-3xl border overflow-hidden", isDarkMode ? "border-white/5 bg-[#141414]" : "border-gray-200 bg-white")}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={cn("border-b text-[10px] uppercase font-black tracking-widest", isDarkMode ? "border-white/5 bg-white/5 text-gray-500" : "border-gray-200 bg-gray-50 text-gray-600")}>
                <th className="p-5">Paciente / DNI</th>
                <th className="p-5">Fecha y Hora</th>
                <th className="p-5">Especialidad</th>
                <th className="p-5">Urgencia</th>
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
                  <td className="p-5 flex justify-end gap-2">
                    {profile.role === 'admin' && (
                      <>
                        <button onClick={() => onReprogram(a)} className="p-2 bg-white/5 text-white rounded-lg hover:bg-white/10" title="Reprogramar"><Edit size={14} /></button>
                        <button onClick={() => onDelete(a.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20" title="Eliminar Permanente"><Trash2 size={14} /></button>
                      </>
                    )}
                    {profile.role === 'medico' && (
                      <button onClick={() => onAddRecipe(a)} className="p-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20" title="Receta"><Stethoscope size={14} /></button>
                    )}
                    {(a.status === 'PAID') && profile.role !== 'patient' && (
                      <button onClick={() => onComplete(a.id)} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20" title="Completar"><CheckCircle2 size={14} /></button>
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

// Historial (Admin)
function HistorialView({ appointments, onDelete, isDarkMode }: any) {
  const history = appointments.filter((a: any) => a.status === 'CANCELLED' || a.status === 'COMPLETED');

  return (
    <div className="space-y-6">
      <h2 className={cn("text-2xl font-black italic uppercase tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>Historial de Citas (Concluidas / Canceladas)</h2>
      <div className={cn("rounded-3xl border overflow-hidden", isDarkMode ? "border-white/5 bg-[#141414]" : "border-gray-200 bg-white")}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={cn("border-b text-[10px] uppercase font-black tracking-widest", isDarkMode ? "border-white/5 bg-white/5 text-gray-500" : "border-gray-200 bg-gray-50 text-gray-600")}>
              <th className="p-5">Paciente</th>
              <th className="p-5">Servicio</th>
              <th className="p-5">Estado</th>
              <th className="p-5">Motivo/Nota</th>
              <th className="p-5 text-right">Borrar BD</th>
            </tr>
          </thead>
          <tbody>
            {history.map((a: any) => (
              <tr key={a.id} className={cn("border-b last:border-0", isDarkMode ? "border-white/5" : "border-gray-100")}>
                <td className="p-5 text-sm font-bold">{a.patientName}</td>
                <td className="p-5 text-sm text-gray-400">{a.service}</td>
                <td className="p-5"><Badge status={a.status}>{a.status}</Badge></td>
                <td className="p-5 text-xs text-gray-500 italic max-w-xs truncate">{a.cancelReason || a.notes || '-'}</td>
                <td className="p-5 text-right">
                  <button onClick={() => onDelete(a.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsuariosView({ users, isDarkMode, onCreate, onEdit, onDelete }: any) {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className={cn("text-2xl font-black italic uppercase tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>Base de Datos de Usuarios</h2>
        <button onClick={onCreate} className="bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest py-3 px-6 rounded-xl flex items-center gap-2">
          <UserPlus size={16} /> Crear
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((u: any) => (
          <div key={u.id} className={cn("p-6 rounded-3xl relative overflow-hidden border", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
            <div className="flex justify-between items-start mb-4">
              <h4 className={cn("font-bold text-sm uppercase", isDarkMode ? "text-white" : "text-gray-900")}>{u.name}</h4>
              <span className="text-[10px] text-emerald-500 font-black tracking-widest uppercase">{u.role}</span>
            </div>
            <div className="space-y-1 text-xs text-gray-500 mb-6">
              <p>DNI: {u.dni || '-'}</p>
              <p>Tel: {u.phone || '-'}</p>
              <p>Email: {u.email || '-'}</p>
              {u.password && <p>Pass: ******</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(u)} className="flex-1 bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase py-2 rounded-lg">Editar</button>
              {u.id !== 'admin-1' && (
                <button onClick={() => onDelete(u.id)} className="flex-1 bg-red-500/10 text-red-500 text-[10px] font-black uppercase py-2 rounded-lg">Eliminar</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ATCAdminView({ messages, onReply, isDarkMode }: any) {
  return (
    <div className="space-y-6">
      <h2 className={cn("text-2xl font-black italic uppercase tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>ATC - Atención de Quejas</h2>
      <div className="grid gap-4">
        {messages.map((m: any) => (
          <div key={m.id} className={cn("p-6 rounded-2xl border", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span className="font-bold text-emerald-500 uppercase">{m.senderName} (DNI: {m.senderDni})</span>
              <span>{new Date(m.date).toLocaleString()}</span>
            </div>
            <p className={cn("text-sm mb-4", isDarkMode ? "text-white" : "text-gray-900")}>{m.content}</p>
            {m.reply ? (
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-sm text-gray-400">
                <span className="font-bold text-emerald-500 text-[10px] uppercase block mb-1">Respuesta ATC:</span>
                {m.reply}
              </div>
            ) : (
              <div className="flex gap-2">
                <input type="text" id={`reply-${m.id}`} placeholder="Escribe tu respuesta..." className="flex-1 bg-white/[0.03] border border-white/5 px-4 rounded-xl text-sm outline-none text-white" />
                <button onClick={() => { const input = document.getElementById(`reply-${m.id}`) as HTMLInputElement; if (input.value) { onReply(m.id, input.value); input.value = ''; } }} className="bg-emerald-500 text-black px-4 py-2 rounded-xl text-xs font-bold uppercase">Responder</button>
              </div>
            )}
          </div>
        ))}
        {messages.length === 0 && <p className="text-gray-500 italic">No hay mensajes pendientes.</p>}
      </div>
    </div>
  );
}

function ATCPatientView({ profile, messages, onSend, isDarkMode }: any) {
  const [content, setContent] = useState('');
  const myMessages = messages.filter((m: any) => m.senderDni === profile.dni);

  return (
    <div className="space-y-6">
      <h2 className={cn("text-2xl font-black italic uppercase tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>Centro de Soporte</h2>
      <div className={cn("p-6 rounded-3xl border mb-8", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100")}>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="¿En qué podemos ayudarte o qué problema tuviste?" className="w-full bg-white/[0.03] border border-white/5 p-4 rounded-xl text-sm outline-none text-white h-24 mb-4 resize-none" />
        <button onClick={() => { if (content) { onSend({ name: profile.name, dni: profile.dni, content }); setContent(''); } }} className="w-full bg-emerald-500 text-black py-3 rounded-xl font-bold uppercase text-xs flex items-center justify-center gap-2"><Send size={16} /> Enviar Mensaje a ATC</button>
      </div>

      <div className="space-y-4">
        {myMessages.map((m: any) => (
          <div key={m.id} className={cn("p-4 rounded-2xl border", isDarkMode ? "bg-white/[0.02] border-white/5" : "bg-gray-50 border-gray-100")}>
            <p className="text-sm text-gray-300 mb-2">{m.content}</p>
            {m.reply && (
              <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400 text-sm border border-emerald-500/20">
                <strong>Respuesta:</strong> {m.reply}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HorariosView({ schedules, setSchedules, profile, onAdd, isDarkMode }: any) {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className={cn("text-2xl font-black italic uppercase tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>Horarios y Turnos</h2>
        {profile?.role === 'medico' && (
          <button onClick={onAdd} className="bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest py-3 px-6 rounded-xl flex items-center gap-2">
            <Plus size={16} /> Gestionar Turno
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {schedules.map((s: any) => (
          <div key={s.id} className={cn("p-6 rounded-3xl border", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100", s.type === 'DESCANSO' && "border-red-500/30 opacity-70")}>
            <div className="flex justify-between mb-2">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{s.day}</p>
              <Badge status={s.type === 'DESCANSO' ? 'CANCELLED' : 'PAID'}>{s.type}</Badge>
            </div>
            <h4 className={cn("font-bold text-lg mb-1", isDarkMode ? "text-white" : "text-gray-900")}>{s.type === 'DESCANSO' ? 'Día Libre' : `${s.startTime} - ${s.endTime}`}</h4>
            <p className="text-xs text-gray-500 uppercase font-bold">{s.medicoName}</p>
            {s.specialty && <p className="text-[10px] text-blue-400 font-mono mt-2">{s.specialty}</p>}
            {profile?.role === 'admin' && (
              <button onClick={() => setSchedules(schedules.filter((x: any) => x.id !== s.id))} className="mt-4 text-[10px] text-red-500 font-bold uppercase">Eliminar Turno</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PagosPendientesView({ appointments, onPay, onViewVoucher, isDarkMode }: any) {
  const pending = appointments.filter((a: any) => a.paymentStatus === 'PENDING' && a.status !== 'CANCELLED');
  return (
    <div className="space-y-6">
      <h3 className={cn("text-sm font-black uppercase tracking-widest flex items-center gap-2", isDarkMode ? "text-white" : "text-gray-900")}><AlertCircle size={18} className="text-amber-500" /> Pendientes de Pago</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pending.map((a: any) => (
          <div key={a.id} className={cn("p-8 rounded-3xl border", isDarkMode ? "bg-[#141414] border-amber-500/20" : "bg-white border-amber-500/20")}>
            <h4 className="font-bold text-lg mb-2 uppercase text-white">{a.service}</h4>
            <p className="text-[10px] text-gray-500 uppercase mb-6">{a.date} • {a.time}</p>
            <div className="text-2xl font-black text-white mb-6">S/ {a.amount.toFixed(2)}</div>
            <button onClick={() => onPay(a)} className="w-full bg-emerald-500 text-black text-[10px] font-black uppercase py-4 rounded-xl">Pagar Ahora</button>
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
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight">{title}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><XCircle size={24} /></button>
          </div>
          {children}
        </div>
      </motion.div>
    </div>
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
            <button key={m} onClick={() => setMethod(m)} className={cn("py-4 rounded-2xl border text-[10px] font-black tracking-widest transition-all", method === m ? "bg-emerald-500 text-black border-emerald-500" : "bg-white/5 text-gray-500 border-white/5")}>{m}</button>
          ))}
        </div>
        <div className="space-y-2">
          <input type="text" value={ref} onChange={(e) => setRef(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm" placeholder="Ref: TRX-88221" />
        </div>
        <button onClick={() => onConfirm(appt.id, method, ref)} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-xs">Confirmar Pago S/ {appt.amount.toFixed(2)}</button>
      </div>
    </Modal>
  );
}

function VoucherModal({ appt, onClose }: any) {
  return <Modal title="Voucher" onClose={onClose}><div>Imprimir</div></Modal>;
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
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none h-48 resize-none mb-6" placeholder="Prescripciones..." />
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
        {data.role !== 'patient' && (
          <input type="password" placeholder="Nueva Contraseña" onChange={e => setData({ ...data, password: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-3 px-4 rounded-xl text-white text-sm" />
        )}
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
            <button key={r} onClick={() => setData({ ...data, role: r as any })} className={cn("py-3 rounded-xl border text-[9px] font-black tracking-widest uppercase", data.role === r ? "bg-emerald-500 text-black border-emerald-500" : "bg-white/5 text-gray-500 border-white/5")}>{r}</button>
          ))}
        </div>
        {data.role === 'patient' ? (
          <input type="text" placeholder="DNI o CE" maxLength={12} onChange={e => setData({ ...data, dni: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm" />
        ) : (
          <>
            <input type="text" placeholder="Usuario" onChange={e => setData({ ...data, username: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm" />
            <input type="password" placeholder="Contraseña" onChange={e => setData({ ...data, password: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm" />
          </>
        )}
        <button onClick={() => onConfirm(data)} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl mt-4 uppercase tracking-widest text-xs">Crear Usuario</button>
      </div>
    </Modal>
  );
}

function ExternalSupportModal({ onClose, onSend }: any) {
  const [data, setData] = useState({ name: '', dni: '', content: '' });
  return (
    <Modal title="Soporte ATC" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-gray-400 mb-4">Ingresa tus datos registrados para buscarte en el sistema y cuéntanos tu problema.</p>
        <input type="text" placeholder="Tu Nombre Completo" onChange={e => setData({ ...data, name: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm" />
        <input type="text" placeholder="DNI o CE" maxLength={12} onChange={e => setData({ ...data, dni: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm" />
        <textarea placeholder="Detalle de tu problema..." onChange={e => setData({ ...data, content: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none h-24 resize-none text-sm" />
        <button onClick={() => onSend(data)} disabled={!data.name || !data.dni || !data.content} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl mt-2 uppercase text-xs disabled:opacity-50">Enviar Mensaje</button>
      </div>
    </Modal>
  );
}

function ScheduleModal({ onClose, onConfirm }: any) {
  const [data, setData] = useState({ day: 'Lunes', startTime: '09:00', endTime: '18:00', type: 'DISPONIBLE', specialty: 'Medicina General' });
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  return (
    <Modal title="Establecer Horario" onClose={onClose}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setData({ ...data, type: 'DISPONIBLE' })} className={cn("py-3 rounded-xl border text-[9px] font-black tracking-widest uppercase", data.type === 'DISPONIBLE' ? "bg-emerald-500 text-black border-emerald-500" : "bg-white/5 text-gray-500")}>Disponible</button>
          <button onClick={() => setData({ ...data, type: 'DESCANSO' })} className={cn("py-3 rounded-xl border text-[9px] font-black tracking-widest uppercase", data.type === 'DESCANSO' ? "bg-red-500 text-white border-red-500" : "bg-white/5 text-gray-500")}>Día de Descanso</button>
        </div>

        <select value={data.day} onChange={e => setData({ ...data, day: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm">
          {days.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

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
        <button onClick={() => onConfirm(data)} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-xs">Guardar Horario</button>
      </div>
    </Modal>
  );
}

function CreateApptModal({ profile, schedules, onClose, onConfirm }: any) {
  const [step, setStep] = useState(1);
  const [symptoms, setSymptoms] = useState('');
  const [triageResult, setTriageResult] = useState<{ urgency: string, specialization: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    name: profile.name,
    dni: profile.dni || '',
    date: '',
    time: '',
    service: 'Consulta General',
    amount: DEFAULT_PRICE
  });

  const runTriage = async () => {
    if (!symptoms) return;
    setLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analiza los siguientes síntomas médicos y determina la urgencia (BAJA, MEDIA, ALTA) y la especialidad médica más adecuada de esta lista: ${Object.keys(SPECIALIZATION_PRICES).join(', ')}. Responde solo en formato JSON con las llaves "urgency" y "specialization". Síntomas: ${symptoms}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { urgency: { type: Type.STRING }, specialization: { type: Type.STRING } },
            required: ["urgency", "specialization"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      const price = SPECIALIZATION_PRICES[result.specialization] || DEFAULT_PRICE;
      setTriageResult(result);
      setData(prev => ({ ...prev, service: result.specialization, amount: price }));
      setStep(2);
    } catch (error) {
      setTriageResult({ urgency: 'MEDIA', specialization: 'Medicina General' });
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Agendar Cita con IA" onClose={onClose}>
      <div className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm h-32 resize-none" placeholder="Describe tus síntomas para el Triaje IA..." />
            <button onClick={runTriage} disabled={loading || !symptoms} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl hover:bg-emerald-400 uppercase text-xs disabled:opacity-50">
              {loading ? "Analizando con IA..." : "Iniciar Triaje IA"}
            </button>
          </div>
        )}
        {step === 2 && triageResult && (
          <div className="space-y-6">
            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
              <p className="text-sm font-bold text-emerald-500">Urgencia Detectada: {triageResult.urgency}</p>
              <p className="text-sm text-white">Especialidad Sugerida: {triageResult.specialization}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input type="date" value={data.date} onChange={e => setData({ ...data, date: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm" />
              <input type="time" value={data.time} onChange={e => setData({ ...data, time: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white text-sm" />
            </div>
            <button onClick={() => onConfirm({ ...data, symptoms, urgency: triageResult.urgency, specialization: triageResult.specialization, userId: profile.id })} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-xs">Agendar Cita</button>
          </div>
        )}
      </div>
    </Modal>
  );
}