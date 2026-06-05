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

// @ts-ignore
const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY });

// --- Types ---
type Role = 'admin' | 'medico' | 'patient';
type ApptStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'COMPLETED';

interface UserProfile {
  id: string; name: string; username?: string; dni?: string;
  role: Role; password?: string; phone?: string; email?: string;
}

interface Appointment {
  id: string; patientName: string; patientDni: string; date: string;
  time: string; service: string; paymentMethod?: 'YAPE' | 'PLIN' | 'CARD';
  paymentStatus: 'PENDING' | 'PAID'; status: ApptStatus; amount: number;
  reference?: string; userId: string; cancelReason?: string;
  medicoId?: string; medicoNameAttended?: string; urgency?: 'BAJA' | 'MEDIA' | 'ALTA';
  specialization?: string; symptoms?: string; notes?: string;
}

interface DoctorSchedule {
  id: string; medicoId: string; medicoName: string; day: string;
  startTime: string; endTime: string; type: 'DISPONIBLE' | 'DESCANSO'; specialty?: string;
}

interface SupportMessage {
  id: string; senderName: string; senderDni: string; content: string;
  date: string; reply?: string; isRead: boolean;
}

const today = new Date().toISOString().split('T')[0];
const SPECIALIZATION_PRICES: Record<string, number> = {
  'Cardiología': 120.00, 'Traumatología': 100.00, 'Pediatría': 80.00,
  'Dermatología': 90.00, 'Medicina General': 50.00, 'Neurología': 130.00,
  'Ginecología': 110.00, 'Oftalmología': 95.00,
};
const DEFAULT_PRICE = 50.00;

// --- Subcomponents ---
const Badge = ({ children, status }: { children: React.ReactNode, status: ApptStatus | string }) => {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    PAID: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    CANCELLED: "bg-red-500/10 text-red-500 border-red-500/20",
    COMPLETED: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    ALTA: "bg-red-500/10 text-red-500 border-red-500/20 font-black",
    MEDIA: "bg-amber-500/10 text-amber-500 border-amber-500/20 font-bold",
    BAJA: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  };
  return <span className={cn("px-2.5 py-1 rounded-full text-[9px] uppercase tracking-widest border", styles[status] || "bg-gray-500/10 text-gray-500 border-gray-500/20")}>{children}</span>;
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
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Modals
  const [showPaymentDialog, setShowPaymentDialog] = useState<Appointment | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState<Appointment | null>(null);
  const [showReprogramDialog, setShowReprogramDialog] = useState<Appointment | null>(null);
  const [showRecipeDialog, setShowRecipeDialog] = useState<Appointment | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState<Appointment | null>(null);
  const [showVoucherDialog, setShowVoucherDialog] = useState<Appointment | null>(null);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showCreateApptDialog, setShowCreateApptDialog] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showExternalSupport, setShowExternalSupport] = useState(false);

  // Auth
  const [authTab, setAuthTab] = useState<Role>('admin');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPatientName, setFormPatientName] = useState('');
  const [formPatientDni, setFormPatientDni] = useState('');
  const [authError, setAuthError] = useState('');

  // INIT
  useEffect(() => {
    const savedProfile = sessionStorage.getItem('clinica_profile');
    const savedUsers = localStorage.getItem('clinica_users');
    const savedAppts = localStorage.getItem('clinica_appointments');

    if (savedProfile) {
      const p = JSON.parse(savedProfile);
      setProfile(p);
      setCurrentView(p.role === 'patient' ? 'citas' : 'dashboard');
    }

    if (savedUsers) setUsers(JSON.parse(savedUsers));
    else {
      setUsers([
        { id: 'admin-1', name: 'ADMINISTRADOR', username: 'usuario', password: '123456', role: 'admin' },
        { id: 'medico-1', name: 'DR. CARDOZA', username: 'medico', password: '123456', role: 'medico' },
        { id: 'p-1', name: 'JUAN PEREZ', dni: '77665544', role: 'patient' }
      ]);
    }

    if (savedAppts) setAppointments(JSON.parse(savedAppts));
    setSchedules(JSON.parse(localStorage.getItem('clinica_schedules') || '[]'));
    setMessages(JSON.parse(localStorage.getItem('clinica_messages') || '[]'));
    setLoading(false);
  }, []);

  // PERSISTENCE
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
    sessionStorage.removeItem('clinica_profile');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    let user;

    if (authTab === 'patient') {
      const inputName = formPatientName.toUpperCase().trim();
      const inputDni = formPatientDni.trim();
      const existingUser = users.find(u => u.dni === inputDni && u.role === 'patient');

      if (existingUser) {
        if (existingUser.name.toUpperCase() !== inputName) { setAuthError('El Nombre no coincide con el Documento registrado.'); return; }
        user = existingUser;
      } else {
        if (!inputName || !inputDni) { setAuthError('Completa todos los campos.'); return; }
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
      setAuthError('');
    } else {
      setAuthError('Credenciales incorrectas o usuario no encontrado.');
    }
  };

  // ACTIONS
  const createAppointment = (data: any, payNow: boolean) => {
    const price = SPECIALIZATION_PRICES[data.specialization] || SPECIALIZATION_PRICES[data.service] || DEFAULT_PRICE;
    const newAppt: Appointment = { id: Math.random().toString(36).substr(2, 9), patientName: data.name, patientDni: data.dni, date: data.date, time: data.time, service: data.service, paymentStatus: "PENDING", status: "PENDING", amount: price, userId: data.userId || profile?.id || 'guest', medicoId: data.medicoId, urgency: data.urgency, specialization: data.specialization, symptoms: data.symptoms };
    setAppointments([newAppt, ...appointments]);
    setShowCreateApptDialog(false);
    if (payNow) setShowPaymentDialog(newAppt);
  };

  const processPayment = (id: string, method: 'YAPE' | 'PLIN' | 'CARD', ref: string) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, paymentStatus: 'PAID', paymentMethod: method, reference: ref, status: 'PAID' } : a));
    setShowPaymentDialog(null);
  };

  const cancelAppointment = (id: string, reason: string) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'CANCELLED', cancelReason: reason } : a));
    setShowCancelDialog(null);
  };

  const reprogramAppointment = (id: string, d: string, t: string) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, date: d, time: t } : a));
    setShowReprogramDialog(null);
  };

  const completeAppointment = (id: string, medicoName: string) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'COMPLETED', medicoNameAttended: medicoName } : a));
    setShowCompleteDialog(null);
  };
  const addSchedulesBulk = (data: any) => {
    const newSchedules: DoctorSchedule[] = data.days.map((day: string) => ({
      id: Math.random().toString(36).substr(2, 9),
      medicoId: profile?.id || 'unknown',
      medicoName: profile?.name || 'Médico',
      day, startTime: data.startTime, endTime: data.endTime, type: data.type, specialty: data.specialty
    }));
    setSchedules([...schedules, ...newSchedules]);
    setShowScheduleForm(false);
  };

  const deleteAppointment = (id: string) => {
    setAppointments(appointments.filter(a => a.id !== id));
  };

  // FILTER LOGIC
  const activeAppointments = profile?.role !== 'patient' ? appointments.filter(a => a.status !== 'CANCELLED' && a.status !== 'COMPLETED') : appointments;

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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20"><Activity className="text-emerald-500" size={32} /></div>
            <h1 className="text-4xl font-black text-white italic">MEDIAGENDAK</h1>
            <p className="text-gray-500 text-[10px] uppercase tracking-widest mt-1">kelcardozabr@uch.pe</p>
          </div>
          <div className="bg-[#141414] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex border-b border-white/5">
              {(['admin', 'medico', 'patient'] as Role[]).map(role => (
                <button key={role} onClick={() => { setAuthTab(role); setAuthError(''); }} className={cn("flex-1 py-5 text-[10px] font-black tracking-widest uppercase relative", authTab === role ? "text-emerald-500" : "text-gray-500")}>
                  {role === 'admin' ? 'Admin' : role === 'medico' ? 'Médico' : 'Paciente'}
                  {authTab === role && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
                </button>
              ))}
            </div>
            <form className="p-8" onSubmit={handleLogin}>
              {authTab === 'patient' ? (
                <>
                  <input required type="text" value={formPatientName} onChange={e => setFormPatientName(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none mb-4 text-sm" placeholder="Nombre Completo" />
                  <input required type="text" value={formPatientDni} onChange={e => setFormPatientDni(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none mb-6 text-sm" placeholder="DNI o CE" />
                </>
              ) : (
                <>
                  <input required type="text" value={formUsername} onChange={e => setFormUsername(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none mb-4 text-sm" placeholder="Usuario" />
                  <input required type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none mb-6 text-sm" placeholder="Contraseña" />
                </>
              )}
              {authError && <p className="text-red-400 text-xs text-center mb-4">{authError}</p>}
              <button type="submit" className="w-full bg-emerald-500 text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs hover:bg-emerald-400">Ingresar al Sistema</button>
              {authTab === 'patient' && <button type="button" onClick={() => setShowExternalSupport(true)} className="w-full mt-4 text-[10px] text-gray-500 uppercase tracking-widest hover:text-white">Soporte ATC Externo</button>}
            </form>
          </div>
        </motion.div>
        {showExternalSupport && (
          <Modal title="Soporte ATC" onClose={() => setShowExternalSupport(false)}>
            <div className="space-y-4">
              <input type="text" id="atc-name" placeholder="Nombre" className="w-full bg-white/5 p-4 rounded-xl text-white outline-none text-sm" />
              <input type="text" id="atc-dni" placeholder="DNI" className="w-full bg-white/5 p-4 rounded-xl text-white outline-none text-sm" />
              <textarea id="atc-msg" placeholder="Reclamo..." className="w-full bg-white/5 p-4 rounded-xl text-white outline-none h-24 resize-none text-sm" />
              <button onClick={() => {
                const n = (document.getElementById('atc-name') as HTMLInputElement).value;
                const d = (document.getElementById('atc-dni') as HTMLInputElement).value;
                const m = (document.getElementById('atc-msg') as HTMLInputElement).value;
                if (n && d && m) { setMessages([...messages, { id: Math.random().toString(), senderName: n, senderDni: d, content: m, date: new Date().toISOString(), isRead: false }]); setShowExternalSupport(false); }
              }} className="w-full bg-emerald-500 text-black py-4 rounded-xl font-bold uppercase text-xs">Enviar Reclamo</button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#050505] text-gray-300 font-sans">
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 bg-[#0a0a0a] flex flex-col hidden lg:flex">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10 text-emerald-500"><Activity size={24} /><span className="font-black text-xl italic text-white tracking-tight">MEDIAGENDAK</span></div>
          <nav className="space-y-2">
            {profile.role === 'patient' ? (
              <>
                <NavBtn id="citas" icon={<Calendar size={18} />} label="Mis Citas" currentView={currentView} setView={setCurrentView} />
                <NavBtn id="pagos" icon={<CreditCard size={18} />} label="Finanzas" currentView={currentView} setView={setCurrentView} />
                <NavBtn id="mensajes" icon={<MessageCircle size={18} />} label="Soporte ATC" currentView={currentView} setView={setCurrentView} />
                <NavBtn id="informacion" icon={<UserIcon size={18} />} label="Perfil" currentView={currentView} setView={setCurrentView} />
              </>
            ) : (
              <>
                <NavBtn id="dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" currentView={currentView} setView={setCurrentView} />
                <NavBtn id="citas" icon={<Activity size={18} />} label="Citas Activas" currentView={currentView} setView={setCurrentView} />
                {profile.role === 'admin' && (
                  <>
                    <NavBtn id="historial" icon={<Archive size={18} />} label="Historial BD" currentView={currentView} setView={setCurrentView} />
                    <NavBtn id="horarios" icon={<Clock size={18} />} label="Horarios" currentView={currentView} setView={setCurrentView} />
                    <NavBtn id="usuarios" icon={<Users size={18} />} label="Usuarios" currentView={currentView} setView={setCurrentView} />
                    <NavBtn id="atc" icon={<MessageCircle size={18} />} label="Reclamos ATC" currentView={currentView} setView={setCurrentView} />
                  </>
                )}
                {profile.role === 'medico' && <NavBtn id="horarios" icon={<Clock size={18} />} label="Mi Horario" currentView={currentView} setView={setCurrentView} />}
              </>
            )}
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-white/5">
          <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 bg-emerald-500/20 text-emerald-500 rounded-xl flex justify-center items-center font-black">{profile.name.charAt(0)}</div><div><p className="text-xs font-bold text-white uppercase">{profile.name}</p><p className="text-[10px] text-gray-500 uppercase">{profile.role}</p></div></div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-red-400 text-xs font-bold py-2"><LogOut size={16} /> Cerrar Sesión</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#0a0a0a]/80 sticky top-0 z-40 backdrop-blur-md">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white">{currentView}</h2>
          <div className="flex items-center gap-4">
            <span className="px-3 py-1 bg-white/5 rounded-lg text-[9px] font-black uppercase text-emerald-500 border border-emerald-500/20">{profile.role}</span>
            {profile.role !== 'medico' && <button onClick={() => setShowCreateApptDialog(true)} className="bg-emerald-500 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase flex gap-2"><Plus size={14} /> Cita</button>}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-6xl mx-auto">
            {currentView === 'dashboard' && profile.role !== 'patient' && <DashboardView appointments={appointments} />}
            {currentView === 'citas' && <CitasView profile={profile} appointments={sortedAppointments} allAppointments={appointments} searchTerm={searchTerm} setSearchTerm={setSearchTerm} filterStatus={filterStatus} setFilterStatus={setFilterStatus} onPay={setShowPaymentDialog} onCancel={(a: any) => setShowCancelDialog(a)} onReprogram={(a: any) => setShowReprogramDialog(a)} onComplete={(a: any) => setShowCompleteDialog(a)} onDelete={deleteAppointment} onAddRecipe={(a: any) => setShowRecipeDialog(a)} />}
            {currentView === 'historial' && profile.role === 'admin' && <HistorialView appointments={appointments} onDelete={deleteAppointment} />}
            {currentView === 'atc' && profile.role === 'admin' && <ATCAdminView messages={messages} onReply={(id: string, r: string) => setMessages(messages.map(m => m.id === id ? { ...m, reply: r, isRead: true } : m))} />}
            {currentView === 'mensajes' && profile.role === 'patient' && <ATCPatientView profile={profile} messages={messages} onSend={(d: any) => setMessages([{ id: Math.random().toString(), senderName: d.name, senderDni: d.dni, content: d.content, date: new Date().toISOString(), isRead: false }, ...messages])} />}
            {currentView === 'pagos' && profile.role === 'patient' && <PagosPendientesView appointments={appointments.filter(a => a.userId === profile.id)} onPay={setShowPaymentDialog} onViewVoucher={setShowVoucherDialog} />}
            {currentView === 'informacion' && profile.role === 'patient' && <InformacionView profile={profile} onUpdate={(d: any) => { setProfile({ ...profile, ...d }); setUsers(users.map(u => u.id === profile.id ? { ...profile, ...d } : u)); }} />}
            {currentView === 'usuarios' && profile.role === 'admin' && <UsuariosView users={users} onCreate={() => setShowCreateUserDialog(true)} onDelete={(id: string) => setUsers(users.filter(u => u.id !== id))} />}
            {currentView === 'horarios' && <HorariosView schedules={schedules} setSchedules={setSchedules} profile={profile} onAdd={() => setShowScheduleForm(true)} />}
          </div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showPaymentDialog && <PaymentModal appt={showPaymentDialog} onClose={() => setShowPaymentDialog(null)} onConfirm={processPayment} />}
        {showVoucherDialog && <VoucherModal appt={showVoucherDialog} onClose={() => setShowVoucherDialog(null)} />}
        {showCancelDialog && <CancelModal appt={showCancelDialog} onClose={() => setShowCancelDialog(null)} onConfirm={cancelAppointment} />}
        {showReprogramDialog && <ReprogramModal appt={showReprogramDialog} onClose={() => setShowReprogramDialog(null)} onConfirm={reprogramAppointment} />}
        {showCompleteDialog && <CompleteApptModal appt={showCompleteDialog} profile={profile!} onClose={() => setShowCompleteDialog(null)} onConfirm={completeAppointment} />}
        {showRecipeDialog && <RecipeModal appt={showRecipeDialog} onClose={() => setShowRecipeDialog(null)} onConfirm={(id: string, n: string) => { setAppointments(appointments.map(a => a.id === id ? { ...a, notes: n } : a)); setShowRecipeDialog(null); }} />}
        {showCreateUserDialog && <CreateUserModal onClose={() => setShowCreateUserDialog(false)} onConfirm={(d: any) => { setUsers([...users, { id: Math.random().toString(), ...d }]); setShowCreateUserDialog(false); }} />}
        {showCreateApptDialog && <CreateApptModal profile={profile!} schedules={schedules} onClose={() => setShowCreateApptDialog(false)} onConfirm={createAppointment} />}
        {showScheduleForm && <ScheduleModal onClose={() => setShowScheduleForm(false)} onConfirm={addSchedulesBulk} />}
      </AnimatePresence>
    </div>
  );
}

// --- Componentes de Vista ---

const NavBtn = ({ id, icon, label, currentView, setView }: any) => (
  <button onClick={() => setView(id)} className={cn("w-full flex items-center gap-4 px-5 py-3.5 rounded-xl font-bold text-xs transition-all", currentView === id ? "bg-emerald-500/10 text-emerald-400" : "text-gray-500 hover:bg-white/5 hover:text-white")}>
    {icon} {label}
  </button>
);

function DashboardView({ appointments }: any) {
  const incomeMap: Record<string, number> = {};
  appointments.forEach((a: any) => { if (a.paymentStatus === 'PAID') incomeMap[a.service] = (incomeMap[a.service] || 0) + a.amount; });
  const maxIncome = Math.max(...Object.values(incomeMap) as number[], 1);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-6">
        <div className="p-6 bg-[#141414] rounded-3xl border border-white/5"><p className="text-[10px] text-gray-500 uppercase font-black mb-2">Ingresos</p><p className="text-3xl font-black text-emerald-400">S/ {Object.values(incomeMap).reduce((a, b) => a + b, 0).toFixed(2)}</p></div>
        <div className="p-6 bg-[#141414] rounded-3xl border border-white/5"><p className="text-[10px] text-gray-500 uppercase font-black mb-2">Citas Activas</p><p className="text-3xl font-black text-white">{appointments.filter((a: any) => a.status === 'PENDING').length}</p></div>
        <div className="p-6 bg-[#141414] rounded-3xl border border-white/5"><p className="text-[10px] text-gray-500 uppercase font-black mb-2">Casos ALTA</p><p className="text-3xl font-black text-red-400">{appointments.filter((a: any) => a.urgency === 'ALTA' && a.status === 'PENDING').length}</p></div>
      </div>
      <div className="bg-[#141414] p-8 rounded-3xl border border-white/5 h-80 flex flex-col">
        <h3 className="text-sm font-black uppercase text-white mb-8 border-b border-white/5 pb-4">Análisis de Ingresos</h3>
        <div className="flex-1 flex items-end gap-6">
          {Object.entries(incomeMap).map(([k, v]: any) => (
            <div key={k} className="flex-1 flex flex-col justify-end items-center h-full group">
              <span className="opacity-0 group-hover:opacity-100 text-[10px] text-emerald-400 font-bold mb-2">S/ {v}</span>
              <div className="w-full bg-emerald-500/20 rounded-t-lg transition-all border border-emerald-500/30" style={{ height: `${Math.max((v / maxIncome) * 100, 5)}%` }} />
              <span className="text-[8px] text-gray-500 uppercase font-bold mt-2 truncate w-full text-center">{k}</span>
            </div>
          ))}
          {Object.keys(incomeMap).length === 0 && <p className="text-gray-500 w-full text-center pb-10 italic">No hay ingresos registrados.</p>}
        </div>
      </div>
    </div>
  );
}

function CitasView({ profile, appointments, searchTerm, setSearchTerm, filterStatus, setFilterStatus, onPay, onCancel, onReprogram, onComplete, onDelete, onAddRecipe }: any) {
  const filters = [{ id: 'ALL', l: 'Todas' }, { id: 'PENDING', l: 'Sin Pagar' }, { id: 'PAID', l: 'Pagadas' }, { id: 'ALTA', l: 'Urgencia Alta' }];
  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-center bg-[#141414] p-4 rounded-2xl border border-white/5">
        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-64 bg-[#0a0a0a] border border-white/10 p-3 rounded-xl text-xs text-white outline-none" />
        <div className="flex gap-2">
          {filters.map(f => <button key={f.id} onClick={() => setFilterStatus(f.id)} className={cn("px-4 py-2 rounded-lg text-[9px] font-black uppercase", filterStatus === f.id ? "bg-emerald-500 text-black" : "bg-white/5 text-gray-400 hover:bg-white/10")}>{f.l}</button>)}
        </div>
      </div>

      {profile.role === 'patient' ? (
        <div className="grid grid-cols-2 gap-6">
          {appointments.map((a: any) => (
            <div key={a.id} className="bg-[#141414] p-8 rounded-3xl border border-white/5 relative">
              <div className="flex justify-between mb-4"><h4 className="font-black text-xl text-white uppercase">{a.service}</h4><Badge status={a.status}>{a.status}</Badge></div>
              <div className="space-y-2 mb-6 text-xs text-gray-400"><p>Fecha: {a.date} {a.time}</p><p className={a.urgency === 'ALTA' ? 'text-red-400 font-bold' : ''}>Urgencia: {a.urgency}</p></div>
              {a.notes && <div className="p-3 bg-white/5 rounded-xl border border-white/10 mb-6 text-xs text-gray-300 italic">" {a.notes} "</div>}
              {a.status === 'PENDING' && (
                <div className="space-y-2">
                  <button onClick={() => onPay(a)} className="w-full bg-emerald-500 text-black font-black uppercase text-[10px] py-3 rounded-xl">Pagar S/ {a.amount}</button>
                  <div className="flex gap-2">
                    <button onClick={() => onReprogram(a)} className="flex-1 border border-white/10 text-white font-bold uppercase text-[10px] py-3 rounded-xl">Reprogramar</button>
                    <button onClick={() => onCancel(a)} className="flex-1 bg-red-500/10 text-red-500 border border-red-500/20 font-bold uppercase text-[10px] py-3 rounded-xl">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#141414] border border-white/5 rounded-3xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-[9px] uppercase font-black text-gray-500"><th className="p-4">Paciente</th><th className="p-4">Horario</th><th className="p-4">Especialidad</th><th className="p-4">Info</th><th className="p-4 text-right">Acciones</th></thead>
            <tbody>
              {appointments.map((a: any) => (
                <tr key={a.id} className="border-t border-white/5 hover:bg-white/[0.02] text-xs text-gray-300">
                  <td className="p-4 font-bold text-white uppercase">{a.patientName} <span className="block font-mono text-[9px] text-gray-500 mt-1">{a.patientDni}</span></td>
                  <td className="p-4">{a.date} <span className="text-emerald-500 font-bold ml-1">{a.time}</span></td>
                  <td className="p-4">{a.service}</td>
                  <td className="p-4"><Badge status={a.urgency}>{a.urgency}</Badge> <Badge status={a.status}>{a.status}</Badge></td>
                  <td className="p-4 text-right space-x-2">
                    {profile.role === 'admin' && (<><button onClick={() => onReprogram(a)} className="p-2 bg-blue-500/10 text-blue-500 rounded"><Edit size={14} /></button><button onClick={() => onDelete(a.id)} className="p-2 bg-red-500/10 text-red-500 rounded"><Trash2 size={14} /></button></>)}
                    {profile.role === 'medico' && <button onClick={() => onAddRecipe(a)} className={cn("px-3 py-2 rounded font-bold uppercase text-[9px]", a.notes ? "bg-emerald-500/10 text-emerald-500" : "bg-white/10 text-white")}><FileText size={12} className="inline mr-1" /> Receta</button>}
                    {profile.role !== 'patient' && a.status === 'PAID' && <button onClick={() => onComplete(a)} className="p-2 bg-emerald-500 text-black rounded"><CheckCircle2 size={14} /></button>}
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

function HistorialView({ appointments, onDelete }: any) {
  const history = appointments.filter((a: any) => a.status === 'CANCELLED' || a.status === 'COMPLETED');
  return (
    <div className="bg-[#141414] border border-white/5 rounded-3xl overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-white/5 text-[9px] uppercase font-black text-gray-500"><th className="p-4">Paciente</th><th className="p-4">Estado</th><th className="p-4">Nota Cierre</th><th className="p-4 text-right">Borrar</th></thead>
        <tbody>
          {history.map((a: any) => (
            <tr key={a.id} className="border-t border-white/5 text-xs text-gray-300">
              <td className="p-4 font-bold text-white uppercase">{a.patientName}</td><td className="p-4"><Badge status={a.status}>{a.status}</Badge></td>
              <td className="p-4 italic">{a.status === 'COMPLETED' ? `Dr. ${a.medicoNameAttended}` : a.cancelReason}</td>
              <td className="p-4 text-right"><button onClick={() => onDelete(a.id)} className="p-2 bg-red-500/10 text-red-500 rounded"><Trash2 size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ATCAdminView({ messages, onReply }: any) {
  return (
    <div className="space-y-4">
      {messages.map((m: any) => (
        <div key={m.id} className="p-6 bg-[#141414] border border-white/5 rounded-2xl">
          <p className="text-xs text-emerald-500 font-bold mb-2">{m.senderName} ({m.senderDni})</p>
          <p className="text-sm text-white mb-4">{m.content}</p>
          {m.reply ? <div className="p-3 bg-white/5 text-gray-300 text-xs rounded border border-white/10">Respuesta: {m.reply}</div> : (
            <div className="flex gap-2"><input id={`r-${m.id}`} type="text" className="flex-1 bg-[#0a0a0a] p-3 rounded text-xs text-white outline-none border border-white/10" placeholder="Responder..." /><button onClick={() => { const i = document.getElementById(`r-${m.id}`) as HTMLInputElement; if (i.value) { onReply(m.id, i.value); i.value = ''; } }} className="bg-emerald-500 text-black px-4 font-bold text-[10px] uppercase rounded">Enviar</button></div>
          )}
        </div>
      ))}
    </div>
  );
}

function ATCPatientView({ profile, messages, onSend }: any) {
  const [msg, setMsg] = useState('');
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="p-6 bg-[#141414] border border-white/5 rounded-3xl"><textarea value={msg} onChange={e => setMsg(e.target.value)} className="w-full bg-[#0a0a0a] p-4 rounded-xl text-white outline-none border border-white/10 h-24 mb-4 resize-none text-sm" placeholder="Escribe tu reclamo..." /><button onClick={() => { if (msg) { onSend({ name: profile.name, dni: profile.dni, content: msg }); setMsg(''); } }} className="w-full bg-emerald-500 text-black font-black uppercase text-[10px] py-4 rounded-xl">Enviar Reclamo</button></div>
      {messages.filter((m: any) => m.senderDni === profile.dni).map((m: any) => (
        <div key={m.id} className="p-4 bg-white/5 rounded-2xl text-xs"><p className="text-white mb-2">{m.content}</p>{m.reply && <p className="text-emerald-400 p-2 bg-emerald-500/10 rounded">Respuesta: {m.reply}</p>}</div>
      ))}
    </div>
  );
}

function PagosPendientesView({ appointments, onPay, onViewVoucher }: any) {
  return (
    <div className="space-y-10">
      <div>
        <h3 className="text-white font-black uppercase text-sm mb-4">Pendientes</h3>
        <div className="grid grid-cols-3 gap-6">
          {appointments.filter((a: any) => a.paymentStatus === 'PENDING' && a.status !== 'CANCELLED').map((a: any) => (
            <div key={a.id} className="p-6 bg-[#141414] border border-amber-500/20 rounded-3xl"><h4 className="text-white font-black uppercase mb-4">{a.service}</h4><p className="text-2xl font-black text-white mb-6">S/ {a.amount}</p><button onClick={() => onPay(a)} className="w-full bg-amber-500 text-black font-black text-[10px] uppercase py-3 rounded-xl">Pagar</button></div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-white font-black uppercase text-sm mb-4">Vouchers Digitales</h3>
        <div className="grid grid-cols-3 gap-6">
          {appointments.filter((a: any) => a.paymentStatus === 'PAID').map((a: any) => (
            <div key={a.id} className="p-6 bg-[#141414] border border-white/5 rounded-3xl"><h4 className="text-white font-black uppercase mb-4">{a.service}</h4><button onClick={() => onViewVoucher(a)} className="w-full border border-white/20 text-white font-black text-[10px] uppercase py-3 rounded-xl">Ver Voucher</button></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InformacionView({ profile, onUpdate }: any) {
  const [d, setD] = useState({ phone: profile.phone || '', email: profile.email || '' });
  return (
    <div className="max-w-xl mx-auto p-10 bg-[#141414] border border-white/5 rounded-[40px]">
      <h2 className="text-2xl text-white font-black italic uppercase mb-8">{profile.name} <span className="block text-xs font-sans text-gray-500 mt-2">DNI: {profile.dni}</span></h2>
      <input type="text" value={d.phone} onChange={e => setD({ ...d, phone: e.target.value })} placeholder="Teléfono" className="w-full bg-[#0a0a0a] border border-white/10 p-4 rounded-xl text-white outline-none mb-4" />
      <input type="email" value={d.email} onChange={e => setD({ ...d, email: e.target.value })} placeholder="Email" className="w-full bg-[#0a0a0a] border border-white/10 p-4 rounded-xl text-white outline-none mb-8" />
      <button onClick={() => onUpdate(d)} className="w-full bg-emerald-500 text-black py-4 rounded-xl font-black uppercase text-[10px]">Actualizar</button>
    </div>
  );
}

function UsuariosView({ users, onCreate, onDelete }: any) {
  return (
    <div className="space-y-6">
      <button onClick={onCreate} className="bg-emerald-500 text-black px-6 py-3 rounded-xl font-black uppercase text-[10px]">Nuevo Usuario</button>
      <div className="grid grid-cols-3 gap-6">
        {users.map((u: any) => (
          <div key={u.id} className="p-6 bg-[#141414] border border-white/5 rounded-3xl">
            <h4 className="text-white font-bold uppercase mb-1">{u.name}</h4><p className="text-[10px] text-gray-500 font-mono mb-4">{u.dni || u.username}</p><Badge status={u.role === 'admin' ? 'CANCELLED' : u.role === 'medico' ? 'BAJA' : 'COMPLETED'}>{u.role}</Badge>
            {u.role !== 'admin' && <button onClick={() => onDelete(u.id)} className="mt-6 w-full text-[10px] uppercase font-bold text-red-500 border border-red-500/20 py-2 rounded-lg">Eliminar</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function HorariosView({ schedules, setSchedules, profile, onAdd }: any) {
  return (
    <div className="space-y-6">
      {profile?.role === 'medico' && <button onClick={onAdd} className="bg-emerald-500 text-black px-6 py-3 rounded-xl font-black uppercase text-[10px]">Crear Horario</button>}
      <div className="grid grid-cols-4 gap-6">
        {schedules.map((s: any) => (
          <div key={s.id} className="p-6 bg-[#141414] border border-white/5 rounded-3xl"><p className="text-emerald-500 font-black text-[10px] uppercase mb-2">{s.day}</p><h4 className="text-white font-black text-xl mb-4">{s.type === 'DESCANSO' ? 'LIBRE' : `${s.startTime}-${s.endTime}`}</h4><p className="text-xs text-gray-400">Dr. {s.medicoName}</p><button onClick={() => setSchedules(schedules.filter((x: any) => x.id !== s.id))} className="mt-4 text-red-500 text-[10px] font-bold uppercase">Borrar</button></div>
        ))}
      </div>
    </div>
  );
}

// --- Modals ---

function Modal({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-white/10 rounded-[32px] w-full max-w-md p-8">
        <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4"><h3 className="text-white font-black italic uppercase">{title}</h3><button onClick={onClose} className="text-gray-500 hover:text-white"><XCircle /></button></div>
        {children}
      </div>
    </div>
  );
}

function CreateApptModal({ profile, schedules, onClose, onConfirm }: any) {
  const [symptoms, setSymptoms] = useState('');
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [d, setD] = useState({ date: '', time: '' });

  const triage = async () => {
    setLoading(true);
    try {
      const resp = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analiza: ${symptoms}. Determina urgencia (BAJA, MEDIA, ALTA) y especialidad de: ${Object.keys(SPECIALIZATION_PRICES).join(', ')}. Solo JSON {"urgency":"", "specialization":""}`,
        config: { responseMimeType: "application/json" }
      });
      const data = JSON.parse(resp.text || '{}');
      setRes(data);
      if (data.urgency === 'ALTA') {
        const slots = schedules.filter((s: any) => s.type === 'DISPONIBLE');
        if (slots.length > 0) { const tmr = new Date(); tmr.setDate(tmr.getDate() + 1); setD({ date: tmr.toISOString().split('T')[0], time: slots[0].startTime }); }
      }
    } catch { setRes({ urgency: 'MEDIA', specialization: 'Medicina General' }); }
    setLoading(false);
  };

  return (
    <Modal title="Triaje IA" onClose={onClose}>
      {!res ? (
        <div className="space-y-4"><textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} placeholder="Síntomas..." className="w-full bg-[#0a0a0a] border border-white/10 p-4 rounded-xl text-white text-sm h-32 resize-none" /><button onClick={triage} disabled={loading || !symptoms} className="w-full bg-emerald-500 text-black py-4 rounded-xl font-black uppercase text-[10px]">{loading ? 'Analizando...' : 'Ejecutar IA'}</button></div>
      ) : (
        <div className="space-y-6">
          <div className="text-center p-4 border border-white/10 rounded-xl bg-white/5"><p className="text-emerald-500 font-black text-[10px] uppercase">{res.urgency}</p><h4 className="text-white font-black text-xl">{res.specialization}</h4></div>
          <input type="date" value={d.date} onChange={e => setD({ ...d, date: e.target.value })} className="w-full bg-[#0a0a0a] p-3 rounded-xl text-white outline-none text-sm border border-white/10" />
          <input type="time" value={d.time} onChange={e => setD({ ...d, time: e.target.value })} className="w-full bg-[#0a0a0a] p-3 rounded-xl text-white outline-none text-sm border border-white/10" />
          <div className="flex gap-2"><button onClick={() => onConfirm({ name: profile.name, dni: profile.dni, service: res.specialization, urgency: res.urgency, symptoms, ...d }, true)} className="flex-1 bg-emerald-500 text-black py-4 rounded-xl font-black text-[10px] uppercase">Pagar Ya</button><button onClick={() => onConfirm({ name: profile.name, dni: profile.dni, service: res.specialization, urgency: res.urgency, symptoms, ...d }, false)} className="flex-1 border border-white/20 text-white py-4 rounded-xl font-black text-[10px] uppercase">Pagar Clínia</button></div>
        </div>
      )}
    </Modal>
  );
}

function PaymentModal({ appt, onClose, onConfirm }: any) {
  const [ref, setRef] = useState('');
  return (
    <Modal title="Pasarela" onClose={onClose}>
      <input type="text" value={ref} onChange={e => setRef(e.target.value)} placeholder="Nro de Operación YAPE/PLIN/TARJETA" className="w-full bg-[#0a0a0a] border border-white/10 p-4 rounded-xl text-white outline-none mb-6 text-sm" />
      <button onClick={() => onConfirm(appt.id, 'YAPE', ref)} className="w-full bg-emerald-500 text-black py-4 rounded-xl font-black uppercase text-[10px]">Abonar S/{appt.amount}</button>
    </Modal>
  );
}

function VoucherModal({ appt, onClose }: any) {
  return (
    <Modal title="Voucher" onClose={onClose}>
      <div className="bg-white text-black p-6 rounded-2xl font-mono text-sm space-y-2 mb-6">
        <h4 className="text-center font-black italic text-xl border-b pb-4 mb-4">MEDIAGENDAK</h4>
        <p>PACIENTE: {appt.patientName}</p><p>DNI: {appt.patientDni}</p><p>SERVICIO: {appt.service}</p><p>FECHA: {appt.date}</p><p className="pt-4 border-t font-black text-lg">TOTAL: S/{appt.amount}</p>
      </div>
      <button onClick={() => window.print()} className="w-full bg-white/10 text-white border border-white/20 py-4 rounded-xl font-black uppercase text-[10px]">Imprimir</button>
    </Modal>
  );
}

function CompleteApptModal({ appt, profile, onClose, onConfirm }: any) {
  const [n, setN] = useState(profile.name);
  return (
    <Modal title="Cerrar Cita" onClose={onClose}>
      <input type="text" value={n} onChange={e => setN(e.target.value)} placeholder="Firma Médico" className="w-full bg-[#0a0a0a] border border-white/10 p-4 rounded-xl text-white outline-none mb-6 text-sm" />
      <button onClick={() => onConfirm(appt.id, n)} className="w-full bg-emerald-500 text-black py-4 rounded-xl font-black uppercase text-[10px]">Finalizar Atención</button>
    </Modal>
  );
}

function CancelModal({ appt, onClose, onConfirm }: any) {
  const [r, setR] = useState('');
  return (
    <Modal title="Anular" onClose={onClose}>
      <textarea value={r} onChange={e => setR(e.target.value)} placeholder="Motivo..." className="w-full bg-[#0a0a0a] border border-white/10 p-4 rounded-xl text-white outline-none h-24 resize-none mb-6 text-sm" />
      <button onClick={() => onConfirm(appt.id, r)} className="w-full bg-red-500 text-white py-4 rounded-xl font-black uppercase text-[10px]">Confirmar Anulación</button>
    </Modal>
  );
}

function ReprogramModal({ appt, onClose, onConfirm }: any) {
  const [d, setD] = useState({ date: appt.date, time: appt.time });
  return (
    <Modal title="Reprogramar" onClose={onClose}>
      <input type="date" value={d.date} onChange={e => setD({ ...d, date: e.target.value })} className="w-full bg-[#0a0a0a] border border-white/10 p-4 rounded-xl text-white outline-none mb-4 text-sm" />
      <input type="time" value={d.time} onChange={e => setD({ ...d, time: e.target.value })} className="w-full bg-[#0a0a0a] border border-white/10 p-4 rounded-xl text-white outline-none mb-6 text-sm" />
      <button onClick={() => onConfirm(appt.id, d.date, d.time)} className="w-full bg-blue-500 text-white py-4 rounded-xl font-black uppercase text-[10px]">Actualizar</button>
    </Modal>
  );
}

function RecipeModal({ appt, onClose, onConfirm }: any) {
  const [n, setN] = useState(appt.notes || '');
  return (
    <Modal title="Receta" onClose={onClose}>
      <textarea value={n} onChange={e => setN(e.target.value)} placeholder="Indicaciones..." className="w-full bg-[#0a0a0a] border border-white/10 p-4 rounded-xl text-white outline-none h-40 resize-none mb-6 text-sm" />
      <button onClick={() => onConfirm(appt.id, n)} className="w-full bg-emerald-500 text-black py-4 rounded-xl font-black uppercase text-[10px]">Guardar</button>
    </Modal>
  );
}

function ScheduleModal({ onClose, onConfirm }: any) {
  const [d, setD] = useState({ days: [] as string[], type: 'DISPONIBLE', startTime: '08:00', endTime: '16:00', specialty: 'Medicina General' });
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  return (
    <Modal title="Horario" onClose={onClose}>
      <div className="flex flex-wrap gap-2 mb-4">{days.map(x => <button key={x} onClick={() => setD({ ...d, days: d.days.includes(x) ? d.days.filter(y => y !== x) : [...d.days, x] })} className={cn("px-3 py-1 rounded text-xs", d.days.includes(x) ? "bg-emerald-500 text-black" : "bg-white/5 text-gray-400")}>{x}</button>)}</div>
      <div className="flex gap-2 mb-4"><button onClick={() => setD({ ...d, type: 'DISPONIBLE' })} className={cn("flex-1 py-2 rounded text-[10px] font-black uppercase", d.type === 'DISPONIBLE' ? "bg-emerald-500 text-black" : "bg-white/5 text-white")}>Disponible</button><button onClick={() => setD({ ...d, type: 'DESCANSO' })} className={cn("flex-1 py-2 rounded text-[10px] font-black uppercase", d.type === 'DESCANSO' ? "bg-red-500 text-white" : "bg-white/5 text-white")}>Descanso</button></div>
      {d.type === 'DISPONIBLE' && (
        <div className="space-y-4 mb-6">
          <select value={d.specialty} onChange={e => setD({ ...d, specialty: e.target.value })} className="w-full bg-[#0a0a0a] border border-white/10 p-3 rounded-xl text-white outline-none text-sm">{Object.keys(SPECIALIZATION_PRICES).map(s => <option key={s} value={s}>{s}</option>)}</select>
          <div className="flex gap-4"><input type="time" value={d.startTime} onChange={e => setD({ ...d, startTime: e.target.value })} className="flex-1 bg-[#0a0a0a] border border-white/10 p-3 rounded-xl text-white outline-none text-sm" /><input type="time" value={d.endTime} onChange={e => setD({ ...d, endTime: e.target.value })} className="flex-1 bg-[#0a0a0a] border border-white/10 p-3 rounded-xl text-white outline-none text-sm" /></div>
        </div>
      )}
      <button onClick={() => onConfirm(d)} disabled={d.days.length === 0} className="w-full bg-emerald-500 text-black py-4 rounded-xl font-black uppercase text-[10px]">Guardar</button>
    </Modal>
  );
}

function CreateUserModal({ onClose, onConfirm }: any) {
  const [d, setD] = useState({ name: '', dni: '', role: 'patient' as Role, username: '', password: '' });
  return (
    <Modal title="Usuario" onClose={onClose}>
      <div className="flex gap-2 mb-4">{['admin', 'medico', 'patient'].map(r => <button key={r} onClick={() => setD({ ...d, role: r as Role })} className={cn("flex-1 py-2 rounded text-[9px] font-black uppercase", d.role === r ? "bg-emerald-500 text-black" : "bg-white/5 text-gray-400")}>{r}</button>)}</div>
      <input type="text" placeholder="Nombre" onChange={e => setD({ ...d, name: e.target.value })} className="w-full bg-[#0a0a0a] border border-white/10 p-3 rounded-xl text-white mb-4 outline-none text-sm" />
      {d.role === 'patient' ? <input type="text" placeholder="DNI" onChange={e => setD({ ...d, dni: e.target.value })} className="w-full bg-[#0a0a0a] border border-white/10 p-3 rounded-xl text-white mb-6 outline-none text-sm" /> : (
        <div className="flex gap-2 mb-6"><input type="text" placeholder="Usuario" onChange={e => setD({ ...d, username: e.target.value })} className="flex-1 bg-[#0a0a0a] border border-white/10 p-3 rounded-xl text-white outline-none text-sm" /><input type="password" placeholder="Pass" onChange={e => setD({ ...d, password: e.target.value })} className="flex-1 bg-[#0a0a0a] border border-white/10 p-3 rounded-xl text-white outline-none text-sm" /></div>
      )}
      <button onClick={() => onConfirm(d)} className="w-full bg-emerald-500 text-black py-4 rounded-xl font-black uppercase text-[10px]">Crear</button>
    </Modal>
  );
}