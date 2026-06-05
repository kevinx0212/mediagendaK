/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import {
  Calendar, User as UserIcon, CreditCard, CheckCircle2, Plus, LogOut,
  LayoutDashboard, Settings, Wallet, Stethoscope, ShieldCheck, UserPlus,
  Trash2, Search, Clock, XCircle, RefreshCw, Filter, Users, ChevronRight,
  AlertCircle, MessageCircle, Archive, Edit, Send, BarChart3, FileText, Activity, History
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
  return <span className={cn("px-2.5 py-1 rounded-md text-[9px] uppercase tracking-widest border", styles[status] || "bg-gray-500/10 text-gray-500 border-gray-500/20")}>{children}</span>;
};

const InputGroup = ({ label, ...props }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest flex items-center gap-2">{label}</label>
    <input className="w-full bg-[#0a0a0a] border border-white/10 p-4 rounded-xl text-white outline-none focus:border-emerald-500/50 transition-colors text-sm shadow-inner" {...props} />
  </div>
);

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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[440px]">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]"><Activity className="text-emerald-500" size={36} /></div>
            <h1 className="text-4xl font-black text-white italic tracking-tighter">MEDIAGENDAK</h1>
            <p className="text-gray-500 text-[10px] uppercase tracking-[0.3em] font-black mt-2">Plataforma Empresarial</p>
          </div>
          <div className="bg-[#141414] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
            <div className="flex border-b border-white/5 bg-white/[0.02]">
              {(['admin', 'medico', 'patient'] as Role[]).map(role => (
                <button key={role} onClick={() => { setAuthTab(role); setAuthError(''); }} className={cn("flex-1 py-5 text-[10px] font-black tracking-widest uppercase relative transition-colors", authTab === role ? "text-white" : "text-gray-600 hover:text-gray-400")}>
                  {role === 'admin' ? 'Gestión' : role === 'medico' ? 'Personal' : 'Pacientes'}
                  {authTab === role && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_10px_#10b981]" />}
                </button>
              ))}
            </div>
            <form className="p-8 space-y-6" onSubmit={handleLogin}>
              {authTab === 'patient' ? (
                <>
                  <InputGroup label="Nombre y Apellidos" type="text" value={formPatientName} onChange={(e: any) => setFormPatientName(e.target.value)} placeholder="Ej. Juan Pérez" />
                  <InputGroup label="Documento de Identidad" type="text" maxLength={15} value={formPatientDni} onChange={(e: any) => setFormPatientDni(e.target.value)} placeholder="DNI, CE o Pasaporte" />
                </>
              ) : (
                <>
                  <InputGroup label="Usuario Corporativo" type="text" value={formUsername} onChange={(e: any) => setFormUsername(e.target.value)} placeholder="ID de Empleado" />
                  <InputGroup label="Contraseña" type="password" value={formPassword} onChange={(e: any) => setFormPassword(e.target.value)} placeholder="••••••••" />
                </>
              )}
              {authError && <p className="text-red-400 text-[10px] bg-red-500/10 border border-red-500/20 p-3 rounded-xl font-bold text-center flex justify-center items-center gap-2"><AlertCircle size={14} /> {authError}</p>}
              <button type="submit" className="w-full bg-emerald-500 text-black font-black py-4 rounded-xl uppercase tracking-widest text-[10px] hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">Ingresar a la Plataforma</button>

              {authTab === 'patient' && <button type="button" onClick={() => setShowExternalSupport(true)} className="w-full text-[10px] text-gray-500 uppercase tracking-widest hover:text-white transition-colors pt-2">¿Problemas de acceso? Soporte ATC</button>}
            </form>
          </div>
        </motion.div>

        {/* Modal Soporte Externo */}
        <AnimatePresence>
          {showExternalSupport && (
            <Modal title="Soporte Técnico ATC" onClose={() => setShowExternalSupport(false)}>
              <div className="space-y-6">
                <p className="text-xs text-gray-400">Si presentas errores para ingresar, envíanos tu caso detallado.</p>
                <InputGroup id="atc-name" label="Nombre Completo" placeholder="Ej. Ana García" />
                <InputGroup id="atc-dni" label="DNI Registrado" placeholder="Número de documento" />
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Detalle del Error</label>
                  <textarea id="atc-msg" placeholder="Describe qué problema presentas..." className="w-full bg-[#0a0a0a] border border-white/10 p-4 rounded-xl text-white outline-none h-28 resize-none text-sm focus:border-emerald-500/50 shadow-inner" />
                </div>
                <button onClick={() => {
                  const n = (document.getElementById('atc-name') as HTMLInputElement).value;
                  const d = (document.getElementById('atc-dni') as HTMLInputElement).value;
                  const m = (document.getElementById('atc-msg') as HTMLInputElement).value;
                  if (n && d && m) { setMessages([{ id: Math.random().toString(), senderName: n, senderDni: d, content: m, date: new Date().toISOString(), isRead: false }, ...messages]); setShowExternalSupport(false); }
                }} className="w-full bg-emerald-500 text-black py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">Enviar Reclamo a Sistemas</button>
              </div>
            </Modal>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#050505] text-gray-300 font-sans selection:bg-emerald-500/30">
      <aside className="w-[280px] border-r border-white/5 bg-[#0a0a0a] flex flex-col hidden lg:flex relative z-20">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10 text-emerald-500"><div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20"><Activity size={20} /></div><div><span className="font-black text-xl italic text-white tracking-tight block leading-none">MEDIAGENDAK</span><span className="text-[8px] uppercase tracking-widest font-black text-emerald-500">Pro System</span></div></div>
          <nav className="space-y-2">
            {profile.role === 'patient' ? (
              <>
                <NavBtn id="citas" icon={<Calendar size={18} />} label="Mis Citas Activas" currentView={currentView} setView={setCurrentView} />
                <NavBtn id="historial-paciente" icon={<History size={18} />} label="Mi Historial Clínico" currentView={currentView} setView={setCurrentView} />
                <NavBtn id="pagos" icon={<CreditCard size={18} />} label="Finanzas y Vouchers" currentView={currentView} setView={setCurrentView} />
                <NavBtn id="mensajes" icon={<MessageCircle size={18} />} label="Soporte ATC" currentView={currentView} setView={setCurrentView} />
                <div className="h-px bg-white/5 my-4 mx-2"></div>
                <NavBtn id="informacion" icon={<UserIcon size={18} />} label="Ajustes de Perfil" currentView={currentView} setView={setCurrentView} />
              </>
            ) : (
              <>
                <NavBtn id="dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" currentView={currentView} setView={setCurrentView} />
                <NavBtn id="citas" icon={<Activity size={18} />} label="Citas Activas" currentView={currentView} setView={setCurrentView} />
                <div className="h-px bg-white/5 my-4 mx-2"></div>
                {profile.role === 'admin' && (
                  <>
                    <NavBtn id="historial" icon={<Archive size={18} />} label="Historial Global BD" currentView={currentView} setView={setCurrentView} />
                    <NavBtn id="horarios" icon={<Clock size={18} />} label="Gestión de Horarios" currentView={currentView} setView={setCurrentView} />
                    <NavBtn id="usuarios" icon={<Users size={18} />} label="Directorio Usuarios" currentView={currentView} setView={setCurrentView} />
                    <NavBtn id="atc" icon={<MessageCircle size={18} />} label="Reclamos ATC" currentView={currentView} setView={setCurrentView} />
                  </>
                )}
                {profile.role === 'medico' && <NavBtn id="horarios" icon={<Clock size={18} />} label="Mi Horario Médico" currentView={currentView} setView={setCurrentView} />}
              </>
            )}
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-white/5">
          <div className="flex items-center gap-3 mb-6 bg-white/[0.02] border border-white/5 p-3 rounded-2xl"><div className="w-10 h-10 bg-emerald-500/20 text-emerald-500 rounded-xl flex justify-center items-center font-black">{profile.name.charAt(0)}</div><div className="flex-1 min-w-0"><p className="text-xs font-bold text-white uppercase truncate">{profile.name}</p><p className="text-[9px] text-gray-500 uppercase tracking-widest">{profile.role}</p></div></div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-red-400 text-xs font-bold py-3 bg-white/5 hover:bg-red-500/10 rounded-xl transition-colors"><LogOut size={16} /> Cerrar Sesión</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#0a0a0a]/90 sticky top-0 z-40 backdrop-blur-xl">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2"><LayoutDashboard size={14} className="text-emerald-500" /> {currentView.replace('-', ' ')}</h2>
          <div className="flex items-center gap-4">
            <span className="px-4 py-1.5 bg-white/5 rounded-lg text-[9px] font-black uppercase text-emerald-500 border border-emerald-500/20 tracking-widest">{profile.role}</span>
            {profile.role !== 'medico' && <button onClick={() => setShowCreateApptDialog(true)} className="bg-emerald-500 text-black px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors"><Plus size={14} /> Nueva Cita</button>}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-7xl mx-auto">
            {currentView === 'dashboard' && profile.role !== 'patient' && <DashboardView appointments={appointments} />}
            {currentView === 'citas' && <CitasView profile={profile} appointments={sortedAppointments} allAppointments={appointments} searchTerm={searchTerm} setSearchTerm={setSearchTerm} filterStatus={filterStatus} setFilterStatus={setFilterStatus} onPay={setShowPaymentDialog} onCancel={(a: any) => setShowCancelDialog(a)} onReprogram={(a: any) => setShowReprogramDialog(a)} onComplete={(a: any) => setShowCompleteDialog(a)} onDelete={(id: string) => { setAppointments(appointments.filter(a => a.id !== id)) }} onAddRecipe={(a: any) => setShowRecipeDialog(a)} />}
            {currentView === 'historial-paciente' && profile.role === 'patient' && <HistorialPacienteView appointments={appointments.filter(a => a.userId === profile.id && a.status === 'COMPLETED')} />}
            {currentView === 'historial' && profile.role === 'admin' && <HistorialGlobalView appointments={appointments} onDelete={(id: string) => { setAppointments(appointments.filter(a => a.id !== id)) }} />}
            {currentView === 'atc' && profile.role === 'admin' && <ATCAdminView messages={messages} onReply={(id: string, r: string) => setMessages(messages.map(m => m.id === id ? { ...m, reply: r, isRead: true } : m))} />}
            {currentView === 'mensajes' && profile.role === 'patient' && <ATCPatientView profile={profile} messages={messages} onSend={(d: any) => setMessages([{ id: Math.random().toString(), senderName: d.name, senderDni: d.dni, content: d.content, date: new Date().toISOString(), isRead: false }, ...messages])} />}
            {currentView === 'pagos' && profile.role === 'patient' && <PagosPendientesView appointments={appointments.filter(a => a.userId === profile.id)} onPay={setShowPaymentDialog} onViewVoucher={setShowVoucherDialog} />}
            {currentView === 'informacion' && profile.role === 'patient' && <InformacionView profile={profile} onUpdate={(d: any) => { setProfile({ ...profile, ...d }); setUsers(users.map(u => u.id === profile.id ? { ...profile, ...d } : u)); }} />}
            {currentView === 'usuarios' && profile.role === 'admin' && <UsuariosView users={users} onCreate={() => setShowCreateUserDialog(true)} onDelete={(id: string) => setUsers(users.filter(u => u.id !== id))} />}
            {currentView === 'horarios' && <HorariosView schedules={schedules} setSchedules={setSchedules} profile={profile} onAdd={() => setShowScheduleForm(true)} />}
          </div>
        </div>
      </main>

      {/* Modals Generales */}
      <AnimatePresence>
        {showPaymentDialog && <PaymentModal appt={showPaymentDialog} onClose={() => setShowPaymentDialog(null)} onConfirm={processPayment} />}
        {showVoucherDialog && <VoucherModal appt={showVoucherDialog} onClose={() => setShowVoucherDialog(null)} />}
        {showCancelDialog && <CancelModal appt={showCancelDialog} onClose={() => setShowCancelDialog(null)} onConfirm={cancelAppointment} />}
        {showReprogramDialog && <ReprogramModal appt={showReprogramDialog} onClose={() => setShowReprogramDialog(null)} onConfirm={reprogramAppointment} />}
        {showCompleteDialog && <CompleteApptModal appt={showCompleteDialog} profile={profile!} onClose={() => setShowCompleteDialog(null)} onConfirm={completeAppointment} />}
        {showRecipeDialog && <RecipeModal appt={showRecipeDialog} onClose={() => setShowRecipeDialog(null)} onConfirm={(id: string, n: string) => { setAppointments(appointments.map(a => a.id === id ? { ...a, notes: n } : a)); setShowRecipeDialog(null); }} />}
        {showCreateUserDialog && <CreateUserModal onClose={() => setShowCreateUserDialog(false)} onConfirm={(d: any) => { setUsers([...users, { id: Math.random().toString(36).substr(2, 9), ...d }]); setShowCreateUserDialog(false); }} />}
        {showCreateApptDialog && <CreateApptModal profile={profile!} schedules={schedules} onClose={() => setShowCreateApptDialog(false)} onConfirm={createAppointment} />}
        {showScheduleForm && <ScheduleModal onClose={() => setShowScheduleForm(false)} onConfirm={(d: any) => {
          const newSchedules = d.days.map((day: string) => ({ id: Math.random().toString(36).substr(2, 9), medicoId: profile?.id, medicoName: profile?.name, day, startTime: d.startTime, endTime: d.endTime, type: d.type, specialty: d.specialty }));
          setSchedules([...schedules, ...newSchedules]); setShowScheduleForm(false);
        }} />}
      </AnimatePresence>
    </div>
  );
}

// --- Componentes de Vista ---

const NavBtn = ({ id, icon, label, currentView, setView }: any) => (
  <button onClick={() => setView(id)} className={cn("w-full flex items-center gap-4 px-5 py-4 rounded-xl font-bold text-xs transition-all relative overflow-hidden group", currentView === id ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-gray-500 hover:bg-white/5 hover:text-white border border-transparent")}>
    <span className={cn("relative z-10 transition-transform group-hover:scale-110", currentView === id ? "text-emerald-400" : "")}>{icon}</span>
    <span className="relative z-10">{label}</span>
  </button>
);

function DashboardView({ appointments }: any) {
  const incomeMap: Record<string, number> = {};
  appointments.forEach((a: any) => { if (a.paymentStatus === 'PAID') incomeMap[a.service] = (incomeMap[a.service] || 0) + a.amount; });
  const maxIncome = Math.max(...Object.values(incomeMap) as number[], 1);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 bg-[#141414] rounded-3xl border border-white/5 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><BarChart3 size={48} /></div><p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Ingresos Verificados</p><p className="text-4xl font-black text-emerald-400">S/ {Object.values(incomeMap).reduce((a, b) => a + b, 0).toFixed(2)}</p></div>
        <div className="p-8 bg-[#141414] rounded-3xl border border-white/5 relative overflow-hidden"><p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Citas Activas (En Cola)</p><p className="text-4xl font-black text-white">{appointments.filter((a: any) => a.status === 'PENDING').length}</p></div>
        <div className="p-8 bg-[#141414] rounded-3xl border border-red-500/20 relative overflow-hidden"><p className="text-[10px] text-red-500 uppercase font-black tracking-widest mb-2">Urgencia ALTA</p><p className="text-4xl font-black text-red-400">{appointments.filter((a: any) => a.urgency === 'ALTA' && a.status === 'PENDING').length}</p></div>
      </div>
      <div className="bg-[#141414] p-10 rounded-[32px] border border-white/5 h-96 flex flex-col">
        <h3 className="text-sm font-black uppercase text-white tracking-widest mb-8 border-b border-white/5 pb-4 flex items-center gap-2"><Activity className="text-emerald-500" /> Análisis de Ingresos por Especialidad</h3>
        <div className="flex-1 flex items-end gap-6 pb-4">
          {Object.entries(incomeMap).map(([k, v]: any) => (
            <div key={k} className="flex-1 flex flex-col justify-end items-center h-full group relative">
              <span className="opacity-0 group-hover:opacity-100 text-[10px] text-emerald-400 font-black mb-3 absolute -top-8 transition-opacity bg-black/50 px-2 py-1 rounded border border-white/10">S/ {v}</span>
              <div className="w-full max-w-[60px] bg-gradient-to-t from-emerald-600/30 to-emerald-400/50 rounded-t-xl transition-all border border-emerald-500/30 group-hover:border-emerald-400/60" style={{ height: `${Math.max((v / maxIncome) * 100, 5)}%` }} />
              <span className="text-[9px] text-gray-400 uppercase font-bold mt-4 truncate w-full text-center group-hover:text-white transition-colors">{k}</span>
            </div>
          ))}
          {Object.keys(incomeMap).length === 0 && <p className="text-gray-500 w-full text-center pb-10 italic text-sm">No hay ingresos registrados para analizar.</p>}
        </div>
      </div>
    </div>
  );
}

function CitasView({ profile, appointments, searchTerm, setSearchTerm, filterStatus, setFilterStatus, onPay, onCancel, onReprogram, onComplete, onDelete, onAddRecipe }: any) {
  const filters = [{ id: 'ALL', l: 'Todas' }, { id: 'PENDING', l: 'Sin Pagar' }, { id: 'PAID', l: 'Pagadas' }, { id: 'ALTA', l: 'Emergencias' }];
  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-center bg-[#141414] p-5 rounded-2xl border border-white/5">
        <div className="relative w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input type="text" placeholder="Buscar por paciente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-[#0a0a0a] border border-white/10 py-3 pl-10 pr-4 rounded-xl text-xs text-white outline-none focus:border-emerald-500/50 transition-colors" />
        </div>
        <div className="flex gap-2">
          {filters.map(f => <button key={f.id} onClick={() => setFilterStatus(f.id)} className={cn("px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors", filterStatus === f.id ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white")}>{f.l}</button>)}
        </div>
      </div>

      {profile.role === 'patient' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appointments.map((a: any) => (
            <div key={a.id} className="bg-[#141414] p-8 rounded-[32px] border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-[100px] transition-transform group-hover:scale-110" />
              <div className="flex justify-between items-start mb-6 relative z-10"><h4 className="font-black text-xl text-white uppercase tracking-tight">{a.service}</h4><Badge status={a.status}>{a.status}</Badge></div>
              <div className="space-y-3 mb-8 text-xs text-gray-400 relative z-10">
                <p className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/5"><Calendar size={14} className="text-emerald-500" /> {a.date} • {a.time}</p>
                <p className={cn("flex items-center gap-2 p-2 rounded-lg border border-white/5", a.urgency === 'ALTA' ? 'bg-red-500/10 text-red-400' : 'bg-white/5')}><Activity size={14} /> Prioridad: {a.urgency}</p>
              </div>

              {a.status === 'PENDING' && (
                <div className="space-y-3 relative z-10">
                  <button onClick={() => onPay(a)} className="w-full bg-emerald-500 text-black font-black uppercase tracking-widest text-[10px] py-4 rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors">Abonar S/ {a.amount}</button>
                  <div className="flex gap-3">
                    <button onClick={() => onReprogram(a)} className="flex-1 bg-white/5 border border-white/10 text-white font-bold uppercase tracking-widest text-[9px] py-3.5 rounded-xl hover:bg-white/10 transition-colors">Modificar</button>
                    <button onClick={() => onCancel(a)} className="flex-1 bg-red-500/10 text-red-500 border border-red-500/20 font-bold uppercase tracking-widest text-[9px] py-3.5 rounded-xl hover:bg-red-500/20 transition-colors">Anular</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {appointments.length === 0 && <p className="text-gray-500 italic p-12 text-center col-span-full border border-dashed border-white/10 rounded-[32px]">No tienes citas activas actualmente.</p>}
        </div>
      ) : (
        <div className="bg-[#141414] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-white/[0.02] text-[9px] uppercase font-black text-gray-500 tracking-widest border-b border-white/5"><th className="p-6">Paciente</th><th className="p-6">Horario Asignado</th><th className="p-6">Departamento</th><th className="p-6">Estado Clínico</th><th className="p-6 text-right">Gestión</th></thead>
            <tbody>
              {appointments.map((a: any) => (
                <tr key={a.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors text-xs text-gray-300">
                  <td className="p-6 font-bold text-white uppercase">{a.patientName} <span className="block font-mono text-[9px] text-gray-500 mt-1.5">{a.patientDni}</span></td>
                  <td className="p-6"><span className="bg-white/5 px-2 py-1 rounded border border-white/5">{a.date}</span> <span className="text-emerald-500 font-bold ml-2 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">{a.time}</span></td>
                  <td className="p-6 font-medium text-gray-300">{a.service}</td>
                  <td className="p-6 flex items-center gap-2 h-full py-8"><Badge status={a.urgency}>{a.urgency}</Badge> <Badge status={a.status}>{a.status}</Badge></td>
                  <td className="p-6 text-right space-x-2">
                    {profile.role === 'admin' && (<><button onClick={() => onReprogram(a)} className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl border border-blue-500/20 hover:bg-blue-500/20 transition-colors"><Edit size={14} /></button><button onClick={() => onDelete(a.id)} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-colors"><Trash2 size={14} /></button></>)}
                    {profile.role === 'medico' && <button onClick={() => onAddRecipe(a)} className={cn("px-4 py-2.5 rounded-xl font-black uppercase text-[9px] transition-colors border", a.notes ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-white/5 text-white border-white/10 hover:bg-white/10")}><FileText size={12} className="inline mr-1.5" /> Receta</button>}
                    {profile.role !== 'patient' && a.status === 'PAID' && <button onClick={() => onComplete(a)} className="p-2.5 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"><CheckCircle2 size={16} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {appointments.length === 0 && <p className="text-gray-500 italic p-12 text-center">Bandeja de citas limpia.</p>}
        </div>
      )}
    </div>
  );
}

function HistorialPacienteView({ appointments }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-3"><History className="text-blue-500" /> Mi Historial Clínico</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {appointments.map((a: any) => (
          <div key={a.id} className="p-8 bg-[#141414] border border-white/5 rounded-[32px] relative overflow-hidden group">
            <div className="flex justify-between items-start mb-6"><h4 className="font-black text-xl text-white uppercase">{a.service}</h4><Badge status="COMPLETED">Atendido</Badge></div>
            <p className="text-xs text-gray-400 mb-2"><Calendar className="inline mr-2 text-emerald-500" size={14} />{a.date}</p>
            <p className="text-xs text-gray-400 mb-6"><Stethoscope className="inline mr-2 text-emerald-500" size={14} />Dr. {a.medicoNameAttended}</p>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-[9px] text-blue-400 font-black uppercase tracking-widest mb-2 flex items-center gap-2"><FileText size={12} /> Diagnóstico / Receta</p>
              <p className="text-sm text-gray-300 italic">"{a.notes || 'No se registraron notas en esta consulta.'}"</p>
            </div>
          </div>
        ))}
        {appointments.length === 0 && <p className="col-span-full text-center p-12 border border-dashed border-white/10 rounded-[32px] text-gray-500 italic">No tienes un historial clínico registrado aún.</p>}
      </div>
    </div>
  );
}

function HistorialGlobalView({ appointments, onDelete }: any) {
  const history = appointments.filter((a: any) => a.status === 'CANCELLED' || a.status === 'COMPLETED');
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-3"><Archive className="text-emerald-500" /> Registro Histórico BD</h2>
      <div className="bg-[#141414] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-white/[0.02] text-[9px] uppercase font-black text-gray-500 tracking-widest border-b border-white/5"><th className="p-6">Paciente</th><th className="p-6">Estado</th><th className="p-6">Detalle Operación</th><th className="p-6 text-right">Manejo BD</th></thead>
          <tbody>
            {history.map((a: any) => (
              <tr key={a.id} className="border-b border-white/5 text-xs text-gray-300 hover:bg-white/[0.02]">
                <td className="p-6 font-bold text-white uppercase">{a.patientName}</td><td className="p-6"><Badge status={a.status}>{a.status}</Badge></td>
                <td className="p-6 italic text-[10px] text-gray-400 bg-black/20 my-4 inline-block px-3 py-1.5 rounded-lg border border-white/5">{a.status === 'COMPLETED' ? `Atendido por: Dr. ${a.medicoNameAttended}` : `Motivo: ${a.cancelReason}`}</td>
                <td className="p-6 text-right"><button onClick={() => onDelete(a.id)} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-colors"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length === 0 && <p className="text-gray-500 italic p-12 text-center border-t border-white/5">Historial sin registros.</p>}
      </div>
    </div>
  );
}

function ATCAdminView({ messages, onReply }: any) {
  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-3"><MessageCircle className="text-blue-500" /> Gestión de Reclamos ATC</h2>
      {messages.map((m: any) => (
        <div key={m.id} className="p-8 bg-[#141414] border border-white/5 rounded-[32px] shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5"><MessageCircle size={48} /></div>
          <p className="text-xs text-emerald-500 font-black mb-4 tracking-widest uppercase">{m.senderName} <span className="text-gray-500 font-mono font-normal">({m.senderDni})</span></p>
          <p className="text-sm text-white mb-6 leading-relaxed relative z-10">"{m.content}"</p>
          {m.reply ? <div className="p-4 bg-emerald-500/10 text-emerald-400 text-xs rounded-2xl border border-emerald-500/20 relative z-10"><span className="font-black uppercase text-[9px] block mb-1">Tu Respuesta:</span> {m.reply}</div> : (
            <div className="flex gap-4 relative z-10">
              <input id={`r-${m.id}`} type="text" className="flex-1 bg-[#0a0a0a] p-4 rounded-xl text-sm text-white outline-none border border-white/10 focus:border-emerald-500/50 shadow-inner" placeholder="Escribe la respuesta oficial..." />
              <button onClick={() => { const i = document.getElementById(`r-${m.id}`) as HTMLInputElement; if (i.value) { onReply(m.id, i.value); i.value = ''; } }} className="bg-emerald-500 text-black px-8 font-black tracking-widest text-[10px] uppercase rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors">Enviar</button>
            </div>
          )}
        </div>
      ))}
      {messages.length === 0 && <div className="p-20 text-center border border-dashed border-white/10 rounded-[32px]"><CheckCircle2 size={40} className="mx-auto text-emerald-500/50 mb-4" /><p className="text-gray-500 italic">Bandeja limpia.</p></div>}
    </div>
  );
}

function ATCPatientView({ profile, messages, onSend }: any) {
  const [msg, setMsg] = useState('');
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <h2 className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-3"><MessageCircle className="text-blue-500" /> Soporte Técnico ATC</h2>
      <div className="p-8 bg-[#141414] border border-white/5 rounded-[32px] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />
        <textarea value={msg} onChange={e => setMsg(e.target.value)} className="w-full bg-[#0a0a0a] p-5 rounded-2xl text-white outline-none border border-white/10 h-32 mb-6 resize-none text-sm focus:border-blue-500/50 transition-colors relative z-10 shadow-inner" placeholder="Detalla aquí tu problema o reclamo..." />
        <button onClick={() => { if (msg) { onSend({ name: profile.name, dni: profile.dni, content: msg }); setMsg(''); } }} className="w-full bg-blue-500 text-white font-black uppercase tracking-widest text-[10px] py-5 rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-400 transition-colors relative z-10">Enviar Ticket a Sistemas</button>
      </div>
      <div className="space-y-4">
        {messages.filter((m: any) => m.senderDni === profile.dni).map((m: any) => (
          <div key={m.id} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl text-sm"><p className="text-gray-300 mb-4">"{m.content}"</p>{m.reply ? <p className="text-emerald-400 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl"><strong className="text-[9px] uppercase font-black tracking-widest block mb-1">Respuesta ATC:</strong> {m.reply}</p> : <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">En Revisión</span>}</div>
        ))}
      </div>
    </div>
  );
}

function PagosPendientesView({ appointments, onPay, onViewVoucher }: any) {
  return (
    <div className="space-y-12">
      <div>
        <h3 className="text-white font-black uppercase tracking-widest text-sm mb-6 flex items-center gap-3 border-b border-white/5 pb-4"><AlertCircle className="text-amber-500" /> Pendientes de Pago</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appointments.filter((a: any) => a.paymentStatus === 'PENDING' && a.status !== 'CANCELLED').map((a: any) => (
            <div key={a.id} className="p-8 bg-[#141414] border border-amber-500/20 rounded-[32px] shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 transition-transform group-hover:scale-110"><CreditCard size={64} /></div>
              <h4 className="text-white font-black uppercase text-xl mb-6 relative z-10">{a.service}</h4>
              <p className="text-3xl font-black text-white mb-8 italic relative z-10">S/ {a.amount.toFixed(2)}</p>
              <button onClick={() => onPay(a)} className="w-full bg-amber-500 text-black font-black text-[10px] uppercase tracking-widest py-4 rounded-xl shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-colors relative z-10">Abonar Factura</button>
            </div>
          ))}
          {appointments.filter((a: any) => a.paymentStatus === 'PENDING' && a.status !== 'CANCELLED').length === 0 && <p className="col-span-full text-center p-10 border border-dashed border-white/10 rounded-[32px] text-gray-500 italic">No tienes facturas pendientes.</p>}
        </div>
      </div>
      <div>
        <h3 className="text-white font-black uppercase tracking-widest text-sm mb-6 flex items-center gap-3 border-b border-white/5 pb-4"><CheckCircle2 className="text-emerald-500" /> Vouchers Electrónicos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appointments.filter((a: any) => a.paymentStatus === 'PAID').map((a: any) => (
            <div key={a.id} className="p-8 bg-[#141414] border border-white/5 rounded-[32px] hover:border-emerald-500/30 transition-colors">
              <h4 className="text-white font-black uppercase text-lg mb-6">{a.service}</h4>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 inline-block px-3 py-1.5 rounded-lg border border-emerald-500/20 mb-8">PAGADO VÍA {a.paymentMethod}</p>
              <button onClick={() => onViewVoucher(a)} className="w-full border border-white/10 text-white font-black text-[10px] tracking-widest uppercase py-4 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-center gap-2"><FileText size={14} /> Abrir Voucher</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InformacionView({ profile, onUpdate }: any) {
  const [d, setD] = useState({ phone: profile.phone || '', email: profile.email || '' });
  return (
    <div className="max-w-2xl mx-auto p-12 bg-[#141414] border border-white/5 rounded-[40px] shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none" />
      <div className="flex items-center gap-6 mb-12 border-b border-white/5 pb-8 relative z-10">
        <div className="w-24 h-24 bg-white/5 rounded-[32px] flex items-center justify-center text-4xl font-black text-white border border-white/10">{profile.name.charAt(0)}</div>
        <div>
          <h2 className="text-3xl text-white font-black italic uppercase tracking-tight">{profile.name}</h2>
          <span className="inline-block mt-3 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-mono text-gray-400">DNI OFICIAL: {profile.dni}</span>
        </div>
      </div>
      <div className="space-y-6 relative z-10">
        <InputGroup label="Móvil de Contacto" type="tel" value={d.phone} onChange={(e: any) => setD({ ...d, phone: e.target.value })} placeholder="Ej: 987654321" />
        <InputGroup label="Correo de Notificaciones" type="email" value={d.email} onChange={(e: any) => setD({ ...d, email: e.target.value })} placeholder="correo@ejemplo.com" />
        <button onClick={() => onUpdate(d)} className="w-full bg-emerald-500 text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] mt-4 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors">Guardar Preferencias</button>
      </div>
    </div>
  );
}

function UsuariosView({ users, onCreate, onDelete }: any) {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center border-b border-white/5 pb-6">
        <h2 className="text-xl text-white font-black italic uppercase tracking-widest flex items-center gap-3"><Users className="text-blue-500" /> Personal y Pacientes</h2>
        <button onClick={onCreate} className="bg-emerald-500 text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors flex items-center gap-2"><UserPlus size={16} /> Alta de Usuario</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {users.map((u: any) => (
          <div key={u.id} className="p-8 bg-[#141414] border border-white/5 rounded-[32px] shadow-lg relative overflow-hidden group hover:border-white/10 transition-colors">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center font-black text-white border border-white/10">{u.name.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-bold uppercase truncate text-sm">{u.name}</h4>
                <span className={cn("inline-block mt-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border", u.role === 'admin' ? 'bg-red-500/10 text-red-400 border-red-500/20' : u.role === 'medico' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20')}>{u.role}</span>
              </div>
            </div>
            <div className="p-4 bg-[#0a0a0a] rounded-xl border border-white/5 mb-6 text-[10px] text-gray-500 font-mono flex flex-col gap-1.5">
              <span>ID: {u.dni || u.username}</span>
            </div>
            {u.role !== 'admin' && <button onClick={() => onDelete(u.id)} className="w-full text-[9px] uppercase font-black tracking-widest text-red-500 border border-red-500/20 py-3 rounded-xl bg-red-500/5 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"><Trash2 size={12} /> Dar de Baja</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function HorariosView({ schedules, setSchedules, profile, onAdd }: any) {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center border-b border-white/5 pb-6">
        <h2 className="text-xl text-white font-black italic uppercase tracking-widest flex items-center gap-3"><Clock className="text-emerald-500" /> Planificador de Turnos</h2>
        {profile?.role === 'medico' && <button onClick={onAdd} className="bg-emerald-500 text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors flex items-center gap-2"><Plus size={16} /> Bloque Horario</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {schedules.map((s: any) => (
          <div key={s.id} className={cn("p-8 rounded-[32px] border relative shadow-lg overflow-hidden", s.type === 'DESCANSO' ? "bg-red-500/5 border-red-500/20" : "bg-[#141414] border-white/5")}>
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
              <p className="text-emerald-500 font-black text-[10px] uppercase tracking-widest">{s.day}</p>
              <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase border", s.type === 'DESCANSO' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')}>{s.type}</span>
            </div>
            <h4 className={cn("font-black text-2xl mb-2 tracking-tighter", s.type === 'DESCANSO' ? 'text-red-300' : 'text-white')}>{s.type === 'DESCANSO' ? 'LIBRE' : `${s.startTime} - ${s.endTime}`}</h4>
            <p className="text-[10px] text-gray-500 uppercase font-bold mt-4">Dr. {s.medicoName}</p>
            {s.specialty && s.type !== 'DESCANSO' && <p className="text-[9px] text-blue-400 uppercase tracking-widest mt-1.5">{s.specialty}</p>}

            {/* AQUÍ ESTÁ LA CORRECCIÓN DEL BOTÓN DE ELIMINAR TURNO PARA EL MÉDICO */}
            {(profile?.role === 'admin' || profile?.id === s.medicoId) && (
              <button onClick={() => setSchedules(schedules.filter((x: any) => x.id !== s.id))} className="mt-8 w-full py-3 bg-red-500/10 border border-red-500/20 text-[9px] text-red-500 font-black uppercase tracking-widest rounded-xl hover:bg-red-500/20 transition-colors">
                Eliminar Turno
              </button>
            )}
          </div>
        ))}
        {schedules.length === 0 && <p className="col-span-full text-center p-12 border border-dashed border-white/10 rounded-[32px] text-gray-500 italic">No hay asignaciones horarias en la base de datos.</p>}
      </div>
    </div>
  );
}

// --- Modals Base ---
function Modal({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-[#141414] border border-white/10 rounded-[40px] w-full max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500" />
        <div className="p-10">
          <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
            <h3 className="text-white font-black italic uppercase tracking-tight text-xl">{title}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white bg-white/5 p-2.5 rounded-full hover:bg-white/10 transition-colors"><XCircle size={20} /></button>
          </div>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

// --- Implementación de Modales Premium ---

function CreateUserModal({ onClose, onConfirm }: any) {
  const [d, setD] = useState({ name: '', dni: '', role: 'patient' as Role, username: '', password: '' });
  return (
    <Modal title="Registro de Nuevo Usuario" onClose={onClose}>
      <div className="space-y-6">
        <div className="bg-[#0a0a0a] p-1.5 rounded-2xl flex gap-1 border border-white/5">
          {[
            { id: 'admin', icon: <ShieldCheck size={14} />, label: 'Admin' },
            { id: 'medico', icon: <Stethoscope size={14} />, label: 'Médico' },
            { id: 'patient', icon: <UserIcon size={14} />, label: 'Paciente' }
          ].map(r => (
            <button key={r.id} onClick={() => setD({ ...d, role: r.id as Role })} className={cn("flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2 text-[9px] font-black tracking-widest uppercase transition-all", d.role === r.id ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-gray-500 hover:text-white hover:bg-white/5")}>
              {r.icon} <span className="hidden sm:inline">{r.label}</span>
            </button>
          ))}
        </div>

        <InputGroup label="Nombre y Apellidos Completos" type="text" placeholder="Ej. Juan Pérez" value={d.name} onChange={(e: any) => setD({ ...d, name: e.target.value })} />

        <AnimatePresence mode="wait">
          {d.role === 'patient' ? (
            <motion.div key="pat" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <InputGroup label="Documento de Identidad (DNI/CE)" type="text" maxLength={15} placeholder="Número de documento" value={d.dni} onChange={(e: any) => setD({ ...d, dni: e.target.value })} />
            </motion.div>
          ) : (
            <motion.div key="staff" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-2 gap-4">
              <InputGroup label="Usuario de Acceso" type="text" placeholder="Ej. admin_01" value={d.username} onChange={(e: any) => setD({ ...d, username: e.target.value })} />
              <InputGroup label="Contraseña" type="password" placeholder="••••••••" value={d.password} onChange={(e: any) => setD({ ...d, password: e.target.value })} />
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={() => onConfirm(d)} disabled={!d.name || (d.role === 'patient' ? !d.dni : (!d.username || !d.password))} className="w-full bg-emerald-500 text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 mt-6">
          Registrar en Base de Datos
        </button>
      </div>
    </Modal>
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
    <Modal title="Motor Triaje IA" onClose={onClose}>
      {!res ? (
        <div className="space-y-6">
          <div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex gap-4">
            <Activity size={24} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-200/80 leading-relaxed font-medium">Describe tus síntomas detalladamente. Nuestra Inteligencia Artificial asignará la especialidad médica adecuada en milisegundos.</p>
          </div>
          <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} placeholder="Ej: Dolor agudo en el pecho..." className="w-full bg-[#0a0a0a] border border-white/10 p-5 rounded-2xl text-white text-sm h-36 resize-none outline-none focus:border-emerald-500/50 shadow-inner" />
          <button onClick={triage} disabled={loading || !symptoms} className="w-full bg-emerald-500 text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50 transition-all flex justify-center items-center gap-2">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Activity size={16} />}
            {loading ? 'Procesando IA...' : 'Ejecutar Diagnóstico Automático'}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          <div className={cn("text-center p-8 border rounded-3xl relative overflow-hidden", res.urgency === 'ALTA' ? 'bg-red-500/5 border-red-500/30' : 'bg-[#0a0a0a] border-white/10')}>
            {res.urgency === 'ALTA' && <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />}
            <p className={cn("font-black text-[10px] uppercase tracking-widest mb-3 relative z-10", res.urgency === 'ALTA' ? 'text-red-500' : 'text-emerald-500')}>Prioridad: {res.urgency}</p>
            <h4 className="text-white font-black text-3xl relative z-10 tracking-tight">{res.specialization}</h4>
            {res.urgency === 'ALTA' && d.date && <p className="text-[9px] text-red-400 font-bold uppercase mt-4 bg-red-500/10 py-1.5 px-3 rounded-lg inline-block border border-red-500/20 relative z-10">Turno Emergencia Pre-asignado</p>}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <InputGroup label="Fecha Asignada" type="date" value={d.date} onChange={(e: any) => setD({ ...d, date: e.target.value })} />
            <InputGroup label="Bloque Horario" type="time" value={d.time} onChange={(e: any) => setD({ ...d, time: e.target.value })} />
          </div>
          <div className="flex gap-4 pt-2">
            <button onClick={() => onConfirm({ name: profile.name, dni: profile.dni, service: res.specialization, urgency: res.urgency, symptoms, ...d }, true)} className="flex-1 bg-emerald-500 text-black py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors">Abonar S/{SPECIALIZATION_PRICES[res.specialization] || DEFAULT_PRICE}</button>
            <button onClick={() => onConfirm({ name: profile.name, dni: profile.dni, service: res.specialization, urgency: res.urgency, symptoms, ...d }, false)} className="flex-1 border border-white/20 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors">Pago en Clínica</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function PaymentModal({ appt, onClose, onConfirm }: any) {
  const [ref, setRef] = useState('');
  const [method, setMethod] = useState<'YAPE' | 'PLIN' | 'CARD'>('YAPE');
  return (
    <Modal title="Pasarela de Pagos" onClose={onClose}>
      <div className="space-y-8">
        <div className="grid grid-cols-3 gap-3">
          {['YAPE', 'PLIN', 'CARD'].map((m: any) => (
            <button key={m} onClick={() => setMethod(m)} className={cn("py-4 rounded-xl text-[10px] font-black tracking-widest transition-all border", method === m ? "bg-emerald-500 text-black border-emerald-500 shadow-lg shadow-emerald-500/20 scale-105" : "bg-[#0a0a0a] text-gray-500 border-white/10 hover:bg-white/5")}>{m}</button>
          ))}
        </div>
        <InputGroup label="Código de Operación (Hash)" type="text" value={ref} onChange={(e: any) => setRef(e.target.value)} placeholder="Ej. TRX-12345678" />
        <button onClick={() => onConfirm(appt.id, method, ref)} className="w-full bg-emerald-500 text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors mt-2">Autorizar Cargo de S/{appt.amount.toFixed(2)}</button>
      </div>
    </Modal>
  );
}

function VoucherModal({ appt, onClose }: any) {
  return (
    <Modal title="Comprobante Digital" onClose={onClose}>
      <div className="bg-gray-50 text-gray-900 p-8 rounded-[32px] font-mono text-sm space-y-4 mb-8 relative overflow-hidden shadow-inner border border-gray-200">
        <div className="absolute top-0 right-0 w-full h-4 bg-emerald-500" />
        <h4 className="text-center font-black italic text-3xl border-b border-gray-300 pb-6 mb-6 tracking-tighter">MEDIAGENDAK</h4>
        <div className="space-y-3 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <p className="flex justify-between"><span className="text-gray-400">PACIENTE:</span><span className="font-bold uppercase">{appt.patientName}</span></p>
          <p className="flex justify-between"><span className="text-gray-400">DNI:</span><span className="font-bold">{appt.patientDni}</span></p>
          <p className="flex justify-between"><span className="text-gray-400">FECHA:</span><span className="font-bold">{appt.date}</span></p>
          <p className="flex justify-between"><span className="text-gray-400">MÉTODO:</span><span className="font-bold bg-gray-100 px-2 py-0.5 rounded">{appt.paymentMethod}</span></p>
        </div>
        <div className="pt-4 border-t-2 border-dashed border-gray-300 mt-6">
          <p className="flex justify-between mb-2"><span className="text-gray-500 font-black">SERVICIO:</span><span className="font-black text-emerald-600 uppercase">{appt.service}</span></p>
          <p className="flex justify-between items-center text-2xl pt-2"><span className="font-black text-gray-900">TOTAL:</span><span className="font-black text-emerald-500">S/{appt.amount.toFixed(2)}</span></p>
        </div>
      </div>
      <button onClick={() => window.print()} className="w-full bg-white/5 text-white border border-white/20 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-colors flex items-center justify-center gap-2"><Archive size={16} /> Guardar e Imprimir</button>
    </Modal>
  );
}

function CompleteApptModal({ appt, profile, onClose, onConfirm }: any) {
  const [n, setN] = useState(profile.role === 'medico' ? profile.name : '');
  return (
    <Modal title="Cierre Clínico" onClose={onClose}>
      <div className="space-y-6">
        <p className="text-xs text-gray-400 mb-6">Confirma el médico a cargo para sellar el historial del paciente.</p>
        <InputGroup label="Firma de Médico Tratante" type="text" value={n} onChange={(e: any) => setN(e.target.value)} placeholder="Ej. Dr. Apellido" />
        <button onClick={() => onConfirm(appt.id, n)} disabled={!n} className="w-full bg-emerald-500 text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] mt-4 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors disabled:opacity-50">Finalizar Atención y Guardar</button>
      </div>
    </Modal>
  );
}

function CancelModal({ appt, onClose, onConfirm }: any) {
  const [r, setR] = useState('');
  return (
    <Modal title="Proceso de Anulación" onClose={onClose}>
      <div className="space-y-6">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-red-200 leading-relaxed">Esta acción es irreversible. El sistema liberará el turno para otros pacientes de la lista de espera.</p>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Motivo de Anulación</label>
          <textarea value={r} onChange={e => setR(e.target.value)} placeholder="Especifica el motivo..." className="w-full bg-[#0a0a0a] border border-white/10 p-5 rounded-2xl text-white outline-none h-32 resize-none text-sm focus:border-red-500/50 shadow-inner" />
        </div>
        <button onClick={() => onConfirm(appt.id, r)} disabled={!r} className="w-full bg-red-500/10 border border-red-500/20 text-red-500 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500/20 transition-colors disabled:opacity-50 mt-2">Confirmar Anulación Definitiva</button>
      </div>
    </Modal>
  );
}

function ReprogramModal({ appt, onClose, onConfirm }: any) {
  const [d, setD] = useState({ date: appt.date, time: appt.time });
  return (
    <Modal title="Reprogramación de Turno" onClose={onClose}>
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-6">
          <InputGroup label="Nueva Fecha" type="date" value={d.date} onChange={(e: any) => setD({ ...d, date: e.target.value })} />
          <InputGroup label="Nuevo Horario" type="time" value={d.time} onChange={(e: any) => setD({ ...d, time: e.target.value })} />
        </div>
        <button onClick={() => onConfirm(appt.id, d.date, d.time)} className="w-full bg-blue-500 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/20 hover:bg-blue-400 transition-colors mt-4">Actualizar en BD</button>
      </div>
    </Modal>
  );
}

function RecipeModal({ appt, onClose, onConfirm }: any) {
  const [n, setN] = useState(appt.notes || '');
  return (
    <Modal title="Historia Clínica (Receta)" onClose={onClose}>
      <div className="space-y-6">
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl mb-6 shadow-inner">
          <p className="text-[9px] text-gray-500 uppercase font-black mb-1">Paciente en consulta:</p>
          <p className="text-white font-bold text-sm mb-3">{appt.patientName}</p>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest flex items-center gap-2"><Stethoscope size={14} /> Indicaciones Médicas</label>
          <textarea value={n} onChange={e => setN(e.target.value)} placeholder="Prescripciones, medicinas o notas de la consulta..." className="w-full bg-[#0a0a0a] border border-white/10 p-5 rounded-2xl text-white outline-none h-48 resize-none text-sm focus:border-emerald-500/50 shadow-inner" />
        </div>
        <button onClick={() => onConfirm(appt.id, n)} className="w-full bg-emerald-500 text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors mt-2">Firmar y Guardar Cambios</button>
      </div>
    </Modal>
  );
}

function ScheduleModal({ onClose, onConfirm }: any) {
  const [d, setD] = useState({ days: [] as string[], type: 'DISPONIBLE', startTime: '08:00', endTime: '16:00', specialty: 'Medicina General' });
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  return (
    <Modal title="Módulo de Planificación" onClose={onClose}>
      <div className="space-y-8">
        <div className="flex gap-3 bg-white/5 p-2 rounded-2xl border border-white/5">
          <button onClick={() => setD({ ...d, type: 'DISPONIBLE' })} className={cn("flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", d.type === 'DISPONIBLE' ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 scale-[1.02]" : "text-gray-500 hover:text-white")}>Disponible (Activo)</button>
          <button onClick={() => setD({ ...d, type: 'DESCANSO' })} className={cn("flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", d.type === 'DESCANSO' ? "bg-red-500 text-white shadow-lg shadow-red-500/20 scale-[1.02]" : "text-gray-500 hover:text-white")}>Día Libre (Off)</button>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Selección Multidía</label>
          <div className="flex flex-wrap gap-2.5">
            {days.map(x => <button key={x} onClick={() => setD({ ...d, days: d.days.includes(x) ? d.days.filter(y => y !== x) : [...d.days, x] })} className={cn("px-4 py-2.5 rounded-xl text-[10px] font-bold border transition-colors shadow-sm", d.days.includes(x) ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-[#0a0a0a] border-white/10 text-gray-500 hover:bg-white/5")}>{x}</button>)}
          </div>
        </div>

        {d.type === 'DISPONIBLE' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-6 pt-6 border-t border-white/5">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Especialidad a Ejercer</label>
              <select value={d.specialty} onChange={e => setD({ ...d, specialty: e.target.value })} className="w-full bg-[#0a0a0a] border border-white/10 py-4 px-5 rounded-2xl text-white outline-none text-sm focus:border-emerald-500/50 shadow-inner">
                {Object.keys(SPECIALIZATION_PRICES).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <InputGroup label="Entrada" type="time" value={d.startTime} onChange={(e: any) => setD({ ...d, startTime: e.target.value })} />
              <InputGroup label="Salida" type="time" value={d.endTime} onChange={(e: any) => setD({ ...d, endTime: e.target.value })} />
            </div>
          </motion.div>
        )}
        <button onClick={() => onConfirm(d)} disabled={d.days.length === 0} className="w-full bg-emerald-500 text-black py-5 rounded-2xl font-black uppercase tracking-widest text-xs disabled:opacity-50 hover:opacity-90 transition-opacity shadow-[0_10px_20px_rgba(16,185,129,0.2)] mt-6">Confirmar Inserción</button>
      </div>
    </Modal>
  );
}