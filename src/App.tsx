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
  AlertCircle
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
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
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
  notes?: string; // Doctor's prescription/notes
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

interface DoctorSchedule {
  id: string;
  medicoId: string;
  medicoName: string;
  day: string; // Monday, Tuesday...
  startTime: string;
  endTime: string;
}

// --- Components ---

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

// --- Main App ---

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
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
  const [showCreateApptDialog, setShowCreateApptDialog] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  // Auth Form State
  const [authTab, setAuthTab] = useState<Role>('admin');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPatientName, setFormPatientName] = useState('');
  const [formPatientDni, setFormPatientDni] = useState('');
  const [authError, setAuthError] = useState('');

  // Load Initial Data
  useEffect(() => {
    const savedProfile = localStorage.getItem('clinica_profile');
    const savedUsers = localStorage.getItem('clinica_users');
    const savedAppointments = localStorage.getItem('clinica_appointments');
    const savedSchedules = localStorage.getItem('clinica_schedules');

    if (savedProfile) {
      const p = JSON.parse(savedProfile);
      setProfile(p);
      if (p.role === 'patient') setCurrentView('citas');
    }
    if (savedUsers) setUsers(JSON.parse(savedUsers));
    else {
      // Default Users
      const defaultAdmin: UserProfile = { id: 'admin-1', name: 'ADMINISTRADOR', username: 'usuario', password: '123456', role: 'admin' };
      const defaultMedico: UserProfile = { id: 'medico-1', name: 'DR. EJEMPLO', username: 'medico', password: '123456', role: 'medico' };
      const defaultPatients: UserProfile[] = [
        { id: 'p-1', name: 'JUAN PEREZ', dni: '77665544', role: 'patient', phone: '987654321', email: 'juan@example.com' },
        { id: 'p-2', name: 'MARIA GARCIA', dni: '12121212', role: 'patient' },
        { id: 'p-3', name: 'CARLOS MENDOZA', dni: '11223344', role: 'patient', phone: '900111222', email: 'carlos@mendoza.com' },
        { id: 'p-4', name: 'ELENA RIVAS', dni: '22334455', role: 'patient', phone: '900333444' },
        { id: 'p-5', name: 'ROBERTO GOMEZ', dni: '33445566', role: 'patient' },
        { id: 'p-6', name: 'SOFIA CASTRO', dni: '44556677', role: 'patient', email: 'sofia@castro.com' },
        { id: 'p-7', name: 'RICARDO SILVA', dni: '55667788', role: 'patient' },
        { id: 'p-8', name: 'ANA PAREDES', dni: '66778899', role: 'patient', phone: '911222333' },
        { id: 'p-9', name: 'LUIS VALDIVIA', dni: '77889900', role: 'patient' },
        { id: 'p-10', name: 'CARMEN ORTIZ', dni: '88990011', role: 'patient' },
        { id: 'p-11', name: 'MIGUEL ANGEL', dni: '99001122', role: 'patient', email: 'miguel@angel.com' },
        { id: 'p-12', name: 'PATRICIA LUJAN', dni: '00112233', role: 'patient' },
        { id: 'p-13', name: 'FERNANDO CRUZ', dni: '12345678', role: 'patient' },
        { id: 'p-14', name: 'BEATRIZ LUNA', dni: '23456789', role: 'patient' },
        { id: 'p-15', name: 'JORGE HERRERA', dni: '34567890', role: 'patient' }
      ];
      setUsers([defaultAdmin, defaultMedico, ...defaultPatients]);
    }

    if (savedAppointments) setAppointments(JSON.parse(savedAppointments));
    else {
      // Default Appointments
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const exampleAppts: Appointment[] = [
        {
          id: 'a-1',
          patientName: 'JUAN PEREZ',
          patientDni: '77665544',
          date: today,
          time: '10:00',
          service: 'Cardiología',
          paymentStatus: 'PAID',
          status: 'PAID',
          amount: 120.00,
          userId: 'p-1',
          urgency: 'MEDIA',
          paymentMethod: 'YAPE',
          reference: 'TRX-99881',
          symptoms: 'Dolor leve en el pecho al caminar rápido.'
        },
        {
          id: 'a-2',
          patientName: 'MARIA GARCIA',
          patientDni: '12121212',
          date: today,
          time: '11:30',
          service: 'Medicina General',
          paymentStatus: 'PENDING',
          status: 'PENDING',
          amount: 50.00,
          userId: 'p-2',
          urgency: 'BAJA',
          symptoms: 'Fiebre persistente desde hace dos días.'
        },
        {
          id: 'a-3',
          patientName: 'CARLOS MENDOZA',
          patientDni: '11223344',
          date: yesterday,
          time: '09:00',
          service: 'Traumatología',
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          amount: 100.00,
          userId: 'p-3',
          urgency: 'ALTA',
          notes: 'Reposo absoluto por 1 semana y Ibuprofeno 400mg cada 8 horas.',
          symptoms: 'Posible fractura en tobillo derecho.'
        },
        {
          id: 'a-4',
          patientName: 'ELENA RIVAS',
          patientDni: '22334455',
          date: yesterday,
          time: '15:00',
          service: 'Dermatología',
          paymentStatus: 'PAID',
          status: 'CANCELLED',
          cancelReason: 'Paciente no pudo asistir por temas laborales.',
          amount: 90.00,
          userId: 'p-4'
        },
        {
          id: 'a-5',
          patientName: 'ROBERTO GOMEZ',
          patientDni: '33445566',
          date: tomorrow,
          time: '08:30',
          service: 'Neurología',
          paymentStatus: 'PENDING',
          status: 'PENDING',
          amount: 130.00,
          userId: 'p-5',
          urgency: 'MEDIA',
          symptoms: 'Migrañas constantes y visión borrosa.'
        },
        {
          id: 'a-6',
          patientName: 'SOFIA CASTRO',
          patientDni: '44556677',
          date: today,
          time: '16:45',
          service: 'Pediatría',
          paymentStatus: 'PAID',
          status: 'PAID',
          amount: 80.00,
          userId: 'p-6',
          urgency: 'BAJA',
          symptoms: 'Control de niño sano - 6 meses.'
        },
        {
          id: 'a-7',
          patientName: 'RICARDO SILVA',
          patientDni: '55667788',
          date: yesterday,
          time: '14:00',
          service: 'Oftalmología',
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          amount: 95.00,
          userId: 'p-7',
          notes: 'Uso de lentes de descanso frente a pantallas.',
          symptoms: 'Fatiga ocular excesiva.'
        },
        {
          id: 'a-8',
          patientName: 'ANA PAREDES',
          patientDni: '66778899',
          date: tomorrow,
          time: '10:00',
          service: 'Ginecología',
          paymentStatus: 'PENDING',
          status: 'PENDING',
          amount: 110.00,
          userId: 'p-8',
          urgency: 'MEDIA'
        },
        {
          id: 'a-9',
          patientName: 'LUIS VALDIVIA',
          patientDni: '77889900',
          date: today,
          time: '17:30',
          service: 'Medicina General',
          paymentStatus: 'PENDING',
          status: 'PENDING',
          amount: 50.00,
          userId: 'p-9'
        },
        {
          id: 'a-10',
          patientName: 'CARMEN ORTIZ',
          patientDni: '88990011',
          date: tomorrow,
          time: '12:00',
          service: 'Cardiología',
          paymentStatus: 'PAID',
          status: 'PAID',
          amount: 120.00,
          userId: 'p-10',
          reference: 'PLIN-12345'
        },
        {
          id: 'a-11',
          patientName: 'MIGUEL ANGEL',
          patientDni: '99001122',
          date: yesterday,
          time: '11:00',
          service: 'Neurología',
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          amount: 130.00,
          userId: 'p-11',
          notes: 'Continuar tratamiento previo.'
        },
        {
          id: 'a-12',
          patientName: 'PATRICIA LUJAN',
          patientDni: '00112233',
          date: today,
          time: '09:15',
          service: 'Dermatología',
          paymentStatus: 'PENDING',
          status: 'PENDING',
          amount: 90.00,
          userId: 'p-12'
        },
        {
          id: 'a-13',
          patientName: 'FERNANDO CRUZ',
          patientDni: '12345678',
          date: yesterday,
          time: '16:00',
          service: 'Traumatología',
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          amount: 100.00,
          userId: 'p-13'
        },
        {
          id: 'a-14',
          patientName: 'BEATRIZ LUNA',
          patientDni: '23456789',
          date: tomorrow,
          time: '14:30',
          service: 'Pediatría',
          paymentStatus: 'PENDING',
          status: 'PENDING',
          amount: 80.00,
          userId: 'p-14'
        },
        {
          id: 'a-15',
          patientName: 'JORGE HERRERA',
          patientDni: '34567890',
          date: today,
          time: '10:45',
          service: 'Oftalmología',
          paymentStatus: 'PAID',
          status: 'PAID',
          amount: 95.00,
          userId: 'p-15'
        }
      ];
      setAppointments(exampleAppts);
    }
    if (savedSchedules) setSchedules(JSON.parse(savedSchedules));

    setLoading(false);
  }, []);

  // Persistence
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('clinica_users', JSON.stringify(users));
      localStorage.setItem('clinica_appointments', JSON.stringify(appointments));
      localStorage.setItem('clinica_schedules', JSON.stringify(schedules));
    }
  }, [users, appointments, schedules, loading]);


  const handleLogout = () => {
    setProfile(null);
    setIsMobileMenuOpen(false);
    localStorage.removeItem('clinica_profile');
  };

  const updateProfile = (data: Partial<UserProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...data };
    setProfile(updated);
    setUsers(users.map(u => u.id === profile.id ? updated : u));
    localStorage.setItem('clinica_profile', JSON.stringify(updated));
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    let user;
    if (authTab === 'patient') {
      user = users.find(u => u.role === 'patient' && u.dni === formPatientDni);
    } else {
      user = users.find(u => u.role === authTab && u.username === formUsername && u.password === formPassword);
    }

    if (user) {
      setProfile(user);
      setCurrentView(user.role === 'patient' ? 'citas' : 'dashboard');
      localStorage.setItem('clinica_profile', JSON.stringify(user));
    } else {
      setAuthError('Credenciales incorrectas o usuario no encontrado.');
    }
  };

  // --- Appointment Actions ---

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
      ...newSchedule
    };
    setSchedules([...schedules, schedule]);
    setShowScheduleForm(false);
  };

  const deleteSchedule = (id: string) => {
    setSchedules(schedules.filter(s => s.id !== id));
  };

  // --- Admin Actions ---

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

  // --- Filters ---

  const filteredAppointments = appointments.filter(a => {
    const matchesSearch = a.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || a.patientDni.includes(searchTerm);

    // Strict visibility: Patients only see their own. Medicos and Admins see all.
    const matchesRole = profile?.role === 'patient' ? a.userId === profile.id : true;

    let matchesStatus = true;
    if (filterStatus === 'TODAY') matchesStatus = a.date === today;
    else if (filterStatus !== 'ALL') matchesStatus = a.status === filterStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) return null;

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
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Nombre y Apellido</label>
                    <input required type="text" value={formPatientName} onChange={(e) => setFormPatientName(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" placeholder="Juan Pérez" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">DNI o CE</label>
                    <input required type="text" value={formPatientDni} onChange={(e) => setFormPatientDni(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" placeholder="77665544" />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Usuario de Personal</label>
                    <input required type="text" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" placeholder="usuario" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Contraseña</label>
                    <input required type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" placeholder="••••••••" />
                  </div>
                </>
              )}

              {authError && <p className="text-red-400 text-[10px] font-bold bg-red-400/10 p-4 rounded-xl border border-red-400/20">{authError}</p>}

              <button type="submit" className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 uppercase tracking-widest text-xs">
                {authTab === 'patient' ? 'Ingreso Libre' : 'Entrar al Sistema'}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {authTab === 'patient' ? "Gestión de salud instantánea" : "Solo personal autorizado"}
              </p>
            </div>
          </div>
        </motion.div >
      </div >
    );
  }

  return (
    <div className={cn("min-h-screen flex font-sans transition-colors duration-300 overflow-hidden", isDarkMode ? "bg-[#0a0a0a] text-gray-300" : "bg-gray-50 text-gray-900")}>
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] lg:hidden"
          >
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              onClick={e => e.stopPropagation()}
              className="w-72 h-full bg-[#0f0f0f] border-r border-white/5 p-8"
            >
              <div className="flex items-center gap-3 mb-10">
                <Wallet className="text-emerald-500" size={24} />
                <span className="text-white font-black text-xl italic uppercase">MEDIAGENDAK</span>
              </div>
              <nav className="space-y-2">
                <SideNav profile={profile} currentView={currentView} setView={(v: any) => { setCurrentView(v); setIsMobileMenuOpen(false); }} isDarkMode={isDarkMode} />
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar (Desktop) */}
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
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className={cn("lg:hidden p-2 hover:text-emerald-500", isDarkMode ? "text-gray-400" : "text-gray-500")}
            >
              <Filter size={24} />
            </button>
            <h2 className={cn("text-xs font-black uppercase tracking-[0.2em] hidden sm:block", isDarkMode ? "text-white" : "text-gray-900")}>{currentView}</h2>
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
                className="bg-emerald-500 text-black text-[9px] sm:text-[10px] font-black uppercase tracking-widest py-2.5 px-4 sm:px-6 rounded-xl hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/10"
              >
                <Plus size={16} /> <span className="hidden xs:inline">Cita</span>
              </button>
            )}

            <button
              onClick={handleLogout}
              className="lg:hidden p-2.5 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all"
              title="Cerrar Sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className={cn("flex-1 overflow-y-auto p-6 lg:p-10", isDarkMode ? "bg-[#0a0a0a]" : "bg-white")}>
          <div className="max-w-7xl mx-auto">
            {currentView === 'dashboard' && profile.role !== 'patient' && <DashboardView profile={profile} appointments={appointments} isDarkMode={isDarkMode} />}
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
            {currentView === 'usuarios' && profile.role === 'admin' && <UsuariosView users={users} isDarkMode={isDarkMode} onCreate={() => setShowCreateUserDialog(true)} />}
            {currentView === 'horarios' && (
              <HorariosView
                schedules={schedules}
                profile={profile}
                isDarkMode={isDarkMode}
                onAdd={() => setShowScheduleForm(true)}
                onDelete={deleteSchedule}
              />
            )}
            {currentView === 'ajustes' && <AjustesView profile={profile} isDarkMode={isDarkMode} toggleTheme={() => setIsDarkMode(!isDarkMode)} />}
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
          <ReprogramModal appt={showReprogramDialog} schedules={schedules} onClose={() => setShowReprogramDialog(null)} onConfirm={reprogramAppointment} />
        )}
        {showRecipeDialog && (
          <RecipeModal appt={showRecipeDialog} profile={profile!} onClose={() => setShowRecipeDialog(null)} onConfirm={addRecipe} />
        )}
        {showCreateUserDialog && (
          <CreateUserModal onClose={() => setShowCreateUserDialog(false)} onConfirm={createUser} />
        )}
        {showCreateApptDialog && (
          <CreateApptModal profile={profile!} schedules={schedules} onClose={() => setShowCreateApptDialog(false)} onConfirm={createAppointment} />
        )}
        {showScheduleForm && (
          <ScheduleModal onClose={() => setShowScheduleForm(false)} onConfirm={addSchedule} />
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
        <NavItem active={currentView === 'pagos'} icon={<CreditCard size={20} />} label="Pagos Pendientes" onClick={() => setView('pagos')} isDarkMode={isDarkMode} />
        <NavItem active={currentView === 'informacion'} icon={<UserIcon size={20} />} label="Mi Información" onClick={() => setView('informacion')} isDarkMode={isDarkMode} />
        <NavItem active={currentView === 'ajustes'} icon={<Settings size={20} />} label="Ajustes" onClick={() => setView('ajustes')} isDarkMode={isDarkMode} />
      </>
    );
  }

  return (
    <>
      <NavItem active={currentView === 'dashboard'} icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={() => setView('dashboard')} isDarkMode={isDarkMode} />
      <NavItem active={currentView === 'citas'} icon={<Calendar size={20} />} label="Citas Médicas" onClick={() => setView('citas')} isDarkMode={isDarkMode} />
      <NavItem active={currentView === 'horarios'} icon={<Clock size={20} />} label={profile.role === 'medico' ? "Mi Horario" : "Horarios Médicos"} onClick={() => setView('horarios')} isDarkMode={isDarkMode} />
      {profile.role === 'admin' && (
        <NavItem active={currentView === 'usuarios'} icon={<Users size={20} />} label="Usuarios" onClick={() => setView('usuarios')} isDarkMode={isDarkMode} />
      )}
      <NavItem active={currentView === 'ajustes'} icon={<Settings size={20} />} label="Configuración" onClick={() => setView('ajustes')} isDarkMode={isDarkMode} />
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
            : "text-gray-400 hover:bg-emerald-500/5 hover:text-emerald-600"
      )}
    >
      <span className={cn("transition-transform group-hover:scale-110", active ? "text-black" : "text-emerald-500")}>{icon}</span>
      {label}
    </button>
  );
}

function DashboardView({ profile, appointments, isDarkMode }: any) {
  const stats = [
    { label: 'Citas Totales', value: appointments.length, color: isDarkMode ? 'text-white' : 'text-gray-900' },
    { label: 'Pendientes', value: appointments.filter((a: any) => a.status === 'PENDING').length, color: 'text-amber-500' },
    { label: 'Completadas', value: appointments.filter((a: any) => a.status === 'COMPLETED').length, color: 'text-blue-500' },
    { label: 'Ingresos', value: `S/ ${appointments.filter((a: any) => a.paymentStatus === 'PAID').reduce((acc: number, curr: any) => acc + curr.amount, 0).toFixed(2)}`, color: 'text-emerald-500' },
  ];

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <div key={i} className={cn(
            "border p-8 rounded-3xl shadow-xl transition-colors",
            isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100"
          )}>
            <p className="text-[10px] uppercase font-black tracking-widest text-gray-500 mb-2">{s.label}</p>
            <h3 className={cn("text-4xl font-black tracking-tighter", s.color)}>{s.value}</h3>
          </div>
        ))}
      </div>

      <div className={cn(
        "border rounded-[40px] p-12 text-center relative overflow-hidden transition-colors",
        isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100"
      )}>
        <div className="absolute top-0 left-0 w-full h-full bg-emerald-500/5 pointer-events-none" />
        <LayoutDashboard className="mx-auto text-emerald-500/20 mb-6" size={80} />
        <h2 className={cn("text-3xl font-black mb-4 tracking-tight uppercase italic", isDarkMode ? "text-white" : "text-gray-900")}>Bienvenido, {profile.name}</h2>
        <p className="text-gray-500 text-sm max-w-xl mx-auto leading-relaxed">
          Has accedido al panel de control de MEDIAGENDAK. Gestiona tus citas, revisa historiales y mantén el control total de tu salud o de tu clínica desde un solo lugar.
        </p>
      </div>

      {(profile.role === 'admin' || profile.role === 'medico') && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className={cn("text-sm font-black uppercase tracking-widest flex items-center gap-2", isDarkMode ? "text-white" : "text-gray-900")}>
              <Calendar size={18} className="text-emerald-500" /> Citas para Hoy
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {appointments.filter((a: any) => a.date === today && a.status !== 'CANCELLED').length === 0 ? (
              <p className={cn("text-xs italic p-6 rounded-2xl border", isDarkMode ? "text-gray-500 bg-white/[0.02] border-white/5" : "text-gray-400 bg-gray-50 border-gray-100")}>No hay citas programadas para hoy.</p>
            ) : (
              appointments
                .filter((a: any) => a.date === today && a.status !== 'CANCELLED')
                .map((a: any) => (
                  <div key={a.id} className={cn(
                    "p-5 rounded-2xl flex items-center justify-between group transition-all border",
                    isDarkMode ? "bg-white/[0.02] border-white/5 hover:border-emerald-500/30" : "bg-white border-gray-100 hover:border-emerald-500/30 shadow-sm"
                  )}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold">
                        {a.time}
                      </div>
                      <div>
                        <p className={cn("font-bold text-sm uppercase", isDarkMode ? "text-white" : "text-gray-900")}>{a.patientName}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">{a.service}</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-gray-700 group-hover:text-emerald-500 transition-colors" />
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CitasView({ profile, appointments, searchTerm, setSearchTerm, filterStatus, setFilterStatus, onPay, onCancel, onReprogram, onComplete, onAddRecipe, isDarkMode }: any) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre o DNI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#141414] border border-white/5 py-4 pl-12 pr-6 rounded-2xl text-sm text-white outline-none focus:border-emerald-500/30 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {(['ALL', 'TODAY', 'PENDING', 'PAID', 'COMPLETED', 'CANCELLED'] as any[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
                filterStatus === s ? "bg-emerald-500 text-black border-emerald-500" : "bg-white/5 text-gray-500 border-white/5 hover:border-white/10"
              )}
            >
              {s === 'ALL' ? 'Todas' : s === 'TODAY' ? 'Hoy' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {appointments.map((appt: any) => (
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            key={appt.id}
            className={cn(
              "border rounded-3xl p-8 transition-all group relative overflow-hidden",
              isDarkMode
                ? "bg-[#141414] border-white/5 hover:border-emerald-500/20"
                : "bg-white border-gray-100 shadow-sm hover:border-emerald-500/20"
            )}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h4 className={cn("font-black text-lg mb-1 uppercase tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>{appt.patientName}</h4>
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">DNI: {appt.patientDni}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge status={appt.status}>{appt.status}</Badge>
                {appt.urgency && (
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[8px] font-black border",
                    appt.urgency === 'ALTA' ? "border-red-500 text-red-500 bg-red-500/5" :
                      appt.urgency === 'MEDIA' ? "border-amber-500 text-amber-500 bg-amber-500/5" :
                        "border-emerald-500 text-emerald-500 bg-emerald-500/5"
                  )}>
                    URGENCIA {appt.urgency}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-4 mb-8">
              {appt.symptoms && (
                <div className={cn("p-3 rounded-xl border", isDarkMode ? "bg-white/[0.02] border-white/5" : "bg-gray-50 border-gray-100")}>
                  <p className="text-[8px] text-gray-500 uppercase font-black mb-1">Síntomas reportados:</p>
                  <p className={cn("text-[10px] italic line-clamp-2", isDarkMode ? "text-gray-300" : "text-gray-600")}>"{appt.symptoms}"</p>
                </div>
              )}
              {appt.notes && (
                <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
                  <p className="text-[8px] text-blue-400 uppercase font-black mb-1">Receta / Notas Médicas:</p>
                  <p className={cn("text-[10px]", isDarkMode ? "text-gray-300" : "text-gray-700")}>{appt.notes}</p>
                </div>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <Calendar size={14} className="text-emerald-500" />
                <span>{appt.date}</span>
                <div className="w-1 h-1 rounded-full bg-white/10" />
                <Clock size={14} className="text-emerald-500" />
                <span>{appt.time}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <Stethoscope size={14} className="text-emerald-500" />
                <span>{appt.service}</span>
              </div>
              <div className={cn("flex items-center gap-3 text-xs font-black", isDarkMode ? "text-white" : "text-gray-900")}>
                <Wallet size={14} className="text-emerald-500" />
                <span>S/ {appt.amount.toFixed(2)}</span>
                {appt.paymentStatus === 'PAID' && <CheckCircle2 size={14} className="text-emerald-500 ml-auto" />}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-6 border-t border-white/5">
              {appt.status === 'PENDING' && (profile.role !== 'medico') && (
                <button onClick={() => onPay(appt)} className="flex-1 bg-emerald-500 text-black text-[10px] font-black uppercase py-3 rounded-xl hover:bg-emerald-400 transition-all">Pagar</button>
              )}

              {/* Doctor specific */}
              {profile.role === 'medico' && appt.status !== 'CANCELLED' && (
                <button onClick={() => onAddRecipe(appt)} className="flex-1 bg-blue-500 text-white text-[10px] font-black uppercase py-3 rounded-xl hover:bg-blue-400 transition-all">
                  {appt.notes ? 'Editar Receta' : 'Agregar Receta'}
                </button>
              )}

              {/* Reprogram/Cancel available for Admin and Patient (if pending) */}
              {(profile.role === 'admin' || (profile.role === 'patient' && appt.status === 'PENDING')) && (
                <>
                  <button onClick={() => onReprogram(appt)} className="flex-1 bg-white/5 text-white text-[10px] font-black uppercase py-3 rounded-xl hover:bg-white/10 transition-all">Reprogramar</button>
                  <button onClick={() => onCancel(appt)} className="flex-1 bg-red-500/10 text-red-500 text-[10px] font-black uppercase py-3 rounded-xl hover:bg-red-500/20 transition-all">Cancelar</button>
                </>
              )}

              {/* Complete available for Doctor and Admin */}
              {appt.status === 'PAID' && (profile.role !== 'patient') && (
                <button onClick={() => onComplete(appt.id)} className="w-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase py-3 rounded-xl hover:bg-emerald-500/20 transition-all">Atender / Completar</button>
              )}

              {appt.status === 'CANCELLED' && (
                <div className="w-full p-3 bg-red-500/5 rounded-xl border border-red-500/10 text-center">
                  <p className="text-[9px] text-red-400 uppercase font-black mb-1">Motivo de Cancelación</p>
                  <p className="text-[10px] text-gray-500 italic">"{appt.cancelReason}"</p>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function UsuariosView({ users, onCreate, isDarkMode }: any) {
  const staff = users.filter((u: any) => u.role !== 'patient');
  const patients = users.filter((u: any) => u.role === 'patient');

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-center">
        <h2 className={cn("text-2xl font-black italic uppercase tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>Gestión de Usuarios</h2>
        <button onClick={onCreate} className="bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest py-3 px-6 rounded-xl hover:bg-emerald-400 transition-all flex items-center gap-2">
          <UserPlus size={16} /> Crear Usuario
        </button>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-emerald-500" size={20} />
          <h3 className={cn("text-sm font-black uppercase tracking-widest", isDarkMode ? "text-white" : "text-gray-900")}>Personal Administrativo y Médico</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {staff.map((u: any) => (
            <UserCard key={u.id} user={u} isDarkMode={isDarkMode} />
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Users className="text-blue-500" size={20} />
          <h3 className={cn("text-sm font-black uppercase tracking-widest", isDarkMode ? "text-white" : "text-gray-900")}>Pacientes Registrados</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {patients.map((u: any) => (
            <UserCard key={u.id} user={u} isDarkMode={isDarkMode} />
          ))}
        </div>
      </div>
    </div>
  );
}

function UserCard({ user, isDarkMode }: any) {
  return (
    <div className={cn(
      "p-8 rounded-3xl relative overflow-hidden group border",
      isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100 shadow-xl"
    )}>
      <div className="absolute top-0 right-0 p-4 opacity-10">
        {user.role === 'admin' ? <ShieldCheck size={40} /> : user.role === 'medico' ? <Stethoscope size={40} /> : <UserIcon size={40} />}
      </div>
      <div className="flex items-center gap-4 mb-6 relative z-10">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl border",
          isDarkMode ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-100",
          user.role === 'admin' ? "text-red-500" : user.role === 'medico' ? "text-emerald-500" : "text-blue-500"
        )}>
          {user.name.charAt(0)}
        </div>
        <div>
          <h4 className={cn("font-bold text-sm uppercase", isDarkMode ? "text-white" : "text-gray-900")}>{user.name}</h4>
          <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{user.role}</p>
        </div>
      </div>
      <div className="space-y-2 text-xs text-gray-500 relative z-10">
        <p>ID: <span className={cn("font-mono", isDarkMode ? "text-white" : "text-gray-900")}>{user.id}</span></p>
        {user.dni && <p>DNI: <span className={cn("font-mono", isDarkMode ? "text-white" : "text-gray-900")}>{user.dni}</span></p>}
        {user.username && <p>User: <span className={cn("font-mono", isDarkMode ? "text-white" : "text-gray-900")}>{user.username}</span></p>}
        {user.password && <p>Pass: <span className={cn("font-mono", isDarkMode ? "text-white" : "text-gray-900")}>******</span></p>}
      </div>
    </div>
  );
}

function HorariosView({ schedules, profile, onAdd, onDelete, isDarkMode }: any) {
  const mySchedules = profile?.role === 'admin' ? schedules : schedules.filter((s: any) => s.medicoId === profile?.id);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className={cn("text-2xl font-black italic uppercase tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>Horarios Disponibles</h2>
        {profile?.role === 'medico' && (
          <button onClick={onAdd} className="bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest py-3 px-6 rounded-xl hover:bg-emerald-400 transition-all flex items-center gap-2">
            <Plus size={16} /> Gestionar Mi Turno
          </button>
        )}
      </div>

      {mySchedules.length === 0 ? (
        <div className={cn("border rounded-3xl p-12 text-center", isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100 shadow-sm")}>
          <Clock className="mx-auto text-emerald-500/20 mb-4" size={48} />
          <p className="text-gray-500 text-sm italic">No hay horarios registrados{profile?.role === 'medico' ? ' para ti' : ''}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mySchedules.map((s: any) => (
            <div key={s.id} className={cn(
              "p-8 rounded-3xl flex justify-between items-center border",
              isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100 shadow-sm"
            )}>
              <div>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">{s.day}</p>
                <h4 className={cn("font-bold text-lg mb-2", isDarkMode ? "text-white" : "text-gray-900")}>{s.startTime} - {s.endTime}</h4>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-tight">{s.medicoName}</p>
              </div>
              {profile?.role === 'medico' && (
                <button onClick={() => onDelete(s.id)} className="text-red-400/50 hover:text-red-400 transition-colors">
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AjustesView({ profile, isDarkMode, toggleTheme }: any) {
  return (
    <div className="p-8">
      <h2 className={cn("text-2xl font-black mb-6", isDarkMode ? "text-white" : "text-gray-900")}>Configuración</h2>
      <button
        onClick={toggleTheme}
        className="px-4 py-2 bg-emerald-500 text-black rounded-lg font-bold"
      >
        Cambiar a {isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
      </button>
      <div className="mt-8 p-6 bg-white/5 rounded-xl border border-white/10">
        <p className="text-gray-400">Usuario: {profile.name}</p>
        <p className="text-gray-400">Rol: {profile.role}</p>
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
          <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Referencia de Operación</label>
          <input type="text" value={ref} onChange={(e) => setRef(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" placeholder="#TRX-88221" />
        </div>
        <button onClick={() => onConfirm(appt.id, method, ref)} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-widest text-xs">Confirmar Pago S/ {appt.amount.toFixed(2)}</button>
      </div>
    </Modal>
  );
}

function VoucherModal({ appt, onClose }: any) {
  return (
    <Modal title="Voucher de Pago Digital" onClose={onClose}>
      <div className="p-8 bg-white text-black rounded-3xl space-y-8 font-mono relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-2 bg-emerald-500" />
        <div className="text-center space-y-2 border-b border-black/10 pb-6">
          <h3 className="font-black text-2xl italic">MEDIAGENDAK</h3>
          <p className="text-[10px] text-gray-500 uppercase">Comprobante de Pago Electrónico</p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">FECHA/HORA:</span>
            <span className="font-bold">{new Date().toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">MÉTODO:</span>
            <span className="font-bold">{appt.paymentMethod}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">REFERENCIA:</span>
            <span className="font-bold">{appt.reference}</span>
          </div>
          <div className="pt-4 border-t border-black/5 flex justify-between items-center">
            <span className="text-gray-500 font-bold uppercase">SERVICIO:</span>
            <span className="font-black uppercase">{appt.service}</span>
          </div>
          <div className="flex justify-between items-center text-xl pt-4 border-t-2 border-dashed border-black/10">
            <span className="font-black">TOTAL:</span>
            <span className="font-black">S/ {appt.amount.toFixed(2)}</span>
          </div>
        </div>

        <div className="text-center pt-4">
          <div className="mx-auto w-32 h-32 bg-gray-100 flex items-center justify-center rounded-xl mb-4">
            <CheckCircle2 size={64} className="text-emerald-500" />
          </div>
          <p className="text-[8px] text-gray-400 leading-relaxed italic">
            Gracias por confiar en nuestra red médica. Conserve este comprobante para cualquier reclamo o duda.
          </p>
        </div>
      </div>
      <button onClick={() => window.print()} className="w-full mt-6 bg-emerald-500 text-black font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2">
        Imprimir Voucher
      </button>
    </Modal>
  );
}

function CancelModal({ appt, onClose, onConfirm }: any) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Cancelar Cita" onClose={onClose}>
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">¿Por qué deseas cancelar?</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-red-500/50 transition-all text-sm h-32 resize-none" placeholder="Escribe el motivo aquí..." />
        </div>
        <button onClick={() => onConfirm(appt.id, reason)} className="w-full bg-red-500 text-white font-black py-5 rounded-2xl hover:bg-red-400 transition-all uppercase tracking-widest text-xs">Confirmar Cancelación</button>
      </div>
    </Modal>
  );
}

function ReprogramModal({ appt, schedules, onClose, onConfirm }: any) {
  const [date, setDate] = useState(appt.date);
  const [time, setTime] = useState(appt.time);
  const dayOfWeek = date ? new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(date)) : '';

  const availableSlots = schedules.filter((s: any) => s.day === dayOfWeek);

  return (
    <Modal title="Reprogramar Cita" onClose={onClose}>
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Nueva Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Nueva Hora</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm" />
          </div>

          {availableSlots.length > 0 && (
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
              <p className="text-[9px] text-emerald-500 font-black uppercase mb-2">Turnos médicos ese día:</p>
              {availableSlots.map((s: any) => (
                <p key={s.id} className="text-[10px] text-gray-300">
                  • {s.medicoName}: {s.startTime} - {s.endTime}
                </p>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => onConfirm(appt.id, date, time)} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-widest text-xs">Actualizar Cita</button>
      </div>
    </Modal>
  );
}

function RecipeModal({ appt, profile, onClose, onConfirm }: any) {
  const [notes, setNotes] = useState(appt.notes || '');
  const isDoctor = profile.role === 'medico' || profile.role === 'admin';

  return (
    <Modal title={isDoctor ? "Emitir Receta Médica" : "Ver Receta"} onClose={onClose}>
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Indicaciones y Medicamentos</label>
          <textarea
            readOnly={!isDoctor}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none focus:border-blue-500/50 transition-all text-sm h-48 resize-none"
            placeholder={isDoctor ? "Prescribe medicamentos o indica reposo..." : "No hay receta emitida aún."}
          />
        </div>
        {isDoctor && (
          <button onClick={() => onConfirm(appt.id, notes)} className="w-full bg-blue-500 text-white font-black py-5 rounded-2xl hover:bg-blue-400 transition-all uppercase tracking-widest text-xs">Guardar Receta</button>
        )}
      </div>
    </Modal>
  );
}

function ScheduleModal({ onClose, onConfirm }: any) {
  const [data, setData] = useState({ day: 'Monday', startTime: '09:00', endTime: '18:00' });
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <Modal title="Establecer Mi Horario" onClose={onClose}>
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Día de la semana</label>
          <select value={data.day} onChange={e => setData({ ...data, day: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm">
            {days.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Desde</label>
            <input type="time" value={data.startTime} onChange={e => setData({ ...data, startTime: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Hasta</label>
            <input type="time" value={data.endTime} onChange={e => setData({ ...data, endTime: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm" />
          </div>
        </div>
        <button onClick={() => onConfirm(data)} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-xs">Publicar Horario</button>
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
          <input type="text" placeholder="DNI" onChange={e => setData({ ...data, dni: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm" />
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

  const dayOfWeek = data.date ? new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(data.date)) : '';
  const doctorAvail = schedules.filter((s: any) => s.day === dayOfWeek);

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
            properties: {
              urgency: { type: Type.STRING },
              specialization: { type: Type.STRING }
            },
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
      console.error("Triage failed", error);
      setTriageResult({ urgency: 'MEDIA', specialization: 'Medicina General' });
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Agendar Cita con Triaje IA" onClose={onClose}>
      <div className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">Describe tus síntomas para que nuestra IA determine la urgencia y especialidad adecuada.</p>
            <textarea
              value={symptoms}
              onChange={e => setSymptoms(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm h-32 resize-none focus:border-emerald-500/50 transition-all"
              placeholder="Ej: Me duele mucho la rodilla después de una caída..."
            />
            <button
              onClick={runTriage}
              disabled={loading || !symptoms}
              className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
            >
              {loading ? "Analizando con IA..." : "Iniciar Triaje IA"}
            </button>
          </div>
        )}

        {step === 2 && triageResult && (
          <div className="space-y-6">
            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Urgencia Detectada</span>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                  triageResult.urgency === 'ALTA' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                    triageResult.urgency === 'MEDIA' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                      "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                )}>
                  {triageResult.urgency}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Especialidad</span>
                <span className="text-white font-bold text-sm tracking-tight">{triageResult.specialization}</span>
              </div>
              <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                <span className="text-[10px] uppercase font-black text-emerald-500 tracking-widest">Costo de Consulta</span>
                <span className="text-emerald-500 font-black text-lg">S/ {data.amount.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Fecha Sugerida</label>
                <input type="date" value={data.date} onChange={e => setData({ ...data, date: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm focus:border-emerald-500/50 transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Hora</label>
                <input type="time" value={data.time} onChange={e => setData({ ...data, time: e.target.value })} className="w-full bg-white/[0.03] border border-white/5 py-4 px-5 rounded-2xl text-white outline-none text-sm focus:border-emerald-500/50 transition-all" />
              </div>
            </div>

            {data.date && doctorAvail.length > 0 && (
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                <p className="text-[9px] text-emerald-500 font-black uppercase mb-1 flex items-center gap-2"><Clock size={12} /> Médicos Disponibles el {dayOfWeek}:</p>
                {doctorAvail.map((s: any) => (
                  <p key={s.id} className="text-[10px] text-gray-400 truncate tracking-tight">{s.medicoName} está de {s.startTime} a {s.endTime}</p>
                ))}
              </div>
            )}

            <button
              onClick={() => onConfirm({ ...data, symptoms, urgency: triageResult.urgency, specialization: triageResult.specialization, userId: profile.id })}
              className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20"
            >
              Agendar y Pagar Después
            </button>
            <button onClick={() => setStep(1)} className="w-full text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors">Modificar Síntomas</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PagosPendientesView({ appointments, onPay, onViewVoucher, isDarkMode }: any) {
  const pending = appointments.filter((a: any) => a.paymentStatus === 'PENDING' && a.status !== 'CANCELLED');
  const paid = appointments.filter((a: any) => a.paymentStatus === 'PAID');

  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <h3 className={cn("text-sm font-black uppercase tracking-widest flex items-center gap-2", isDarkMode ? "text-white" : "text-gray-900")}>
          <AlertCircle size={18} className="text-amber-500" /> Pendientes de Pago
        </h3>
        {pending.length === 0 ? (
          <p className={cn("text-xs italic p-8 rounded-2xl border", isDarkMode ? "text-gray-500 bg-white/[0.02] border-white/5" : "text-gray-400 bg-gray-50 border-gray-200")}>No tienes pagos pendientes.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pending.map((a: any) => (
              <div key={a.id} className={cn(
                "p-8 rounded-3xl relative overflow-hidden group border",
                isDarkMode ? "bg-[#141414] border-amber-500/20" : "bg-white border-amber-500/20 shadow-sm"
              )}>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <CreditCard size={40} className={isDarkMode ? "" : "text-amber-500"} />
                </div>
                <h4 className={cn("font-bold text-lg mb-2 uppercase", isDarkMode ? "text-white" : "text-gray-900")}>{a.service}</h4>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-6">{a.date} • {a.time}</p>
                <div className="flex items-center justify-between mb-8">
                  <span className={cn("text-2xl font-black italic", isDarkMode ? "text-white" : "text-gray-900")}>S/ {a.amount.toFixed(2)}</span>
                </div>
                <button onClick={() => onPay(a)} className="w-full bg-emerald-500 text-black text-[10px] font-black uppercase py-4 rounded-xl hover:bg-emerald-400 transition-all">
                  Pagar Ahora
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <h3 className={cn("text-sm font-black uppercase tracking-widest flex items-center gap-2", isDarkMode ? "text-white" : "text-gray-900")}>
          <CheckCircle2 size={18} className="text-emerald-500" /> Historial de Pagos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paid.map((a: any) => (
            <div key={a.id} className={cn(
              "p-8 rounded-3xl relative overflow-hidden group border",
              isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100 shadow-sm"
            )}>
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <CheckCircle2 size={40} className="text-emerald-500" />
              </div>
              <h4 className={cn("font-bold text-lg mb-1 uppercase", isDarkMode ? "text-white" : "text-gray-900")}>{a.service}</h4>
              <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-black mb-6">PAGADO • {a.paymentMethod}</p>
              <div className="flex items-center justify-between mb-8">
                <span className={cn("text-xl font-black italic", isDarkMode ? "text-white" : "text-gray-900")}>S/ {a.amount.toFixed(2)}</span>
              </div>
              <button
                onClick={() => onViewVoucher(a)}
                className={cn(
                  "w-full text-[10px] font-black uppercase py-4 rounded-xl transition-all flex items-center justify-center gap-2 border",
                  isDarkMode ? "bg-white/5 text-white border-white/5 hover:bg-white/10" : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                )}
              >
                <RefreshCw size={14} /> Ver Voucher Digital
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InformacionView({ profile, onUpdate, isDarkMode }: any) {
  const [data, setData] = useState({
    phone: profile.phone || '',
    email: profile.email || ''
  });

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className={cn(
        "border rounded-[40px] p-12 relative overflow-hidden transition-colors",
        isDarkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100 shadow-xl"
      )}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] -mr-32 -mt-32" />
        <div className="relative z-10 space-y-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-[30px] bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-3xl font-black border border-emerald-500/20">
              {profile.name.charAt(0)}
            </div>
            <div>
              <h2 className={cn("text-2xl font-black uppercase tracking-tight italic", isDarkMode ? "text-white" : "text-gray-900")}>{profile.name}</h2>
              <p className="text-xs text-gray-500 font-mono">DNI: {profile.dni || 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Número de Teléfono</label>
              <input
                type="tel"
                value={data.phone}
                onChange={e => setData({ ...data, phone: e.target.value })}
                className={cn(
                  "w-full border py-4 px-5 rounded-2xl outline-none focus:border-emerald-500/50 transition-all text-sm",
                  isDarkMode ? "bg-white/[0.03] border-white/5 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                )}
                placeholder="Ej: 987654321"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Correo Electrónico</label>
              <input
                type="email"
                value={data.email}
                onChange={e => setData({ ...data, email: e.target.value })}
                className={cn(
                  "w-full border py-4 px-5 rounded-2xl outline-none focus:border-emerald-500/50 transition-all text-sm",
                  isDarkMode ? "bg-white/[0.03] border-white/5 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                )}
                placeholder="correo@ejemplo.com"
              />
            </div>
          </div>

          <button
            onClick={() => onUpdate(data)}
            className={cn(
              "w-full font-black py-5 rounded-2xl transition-all uppercase tracking-widest text-xs",
              isDarkMode ? "bg-white text-black hover:bg-gray-200" : "bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
            )}
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
