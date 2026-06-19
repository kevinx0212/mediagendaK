
/**
 * MEDIAGENDAK v4 — Sistema de Gestión Médica (Triage Clínico Inteligente Dual)
 * @license SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import {
  Calendar, User as UserIcon, CreditCard, CheckCircle2, Plus, LogOut,
  LayoutDashboard, Settings, Wallet, Stethoscope, ShieldCheck, UserPlus,
  Trash2, Search, Clock, XCircle, RefreshCw, Filter, Users,
  AlertCircle, MessageSquare, Edit2, Archive, Activity, FileText,
  History, BarChart3, ChevronDown, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type Role = 'admin' | 'medico' | 'patient';
type ApptStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'COMPLETED';
type Urgency = 'BAJA' | 'MEDIA' | 'ALTA';

interface UserProfile {
  id: string; name: string; username?: string; dni?: string;
  role: Role; password?: string; phone?: string; email?: string;
  specialization?: string; restDays?: string[];
}

interface Appointment {
  id: string; patientName: string; patientDni: string; date: string;
  time: string; service: string; paymentMethod?: 'YAPE' | 'PLIN' | 'CARD';
  paymentStatus: 'PENDING' | 'PAID'; status: ApptStatus; amount: number;
  reference?: string; userId: string; cancelReason?: string;
  medicoId?: string; medicoName?: string; urgency?: Urgency;
  specialization?: string; symptoms?: string; notes?: string;
}

interface DoctorSchedule {
  id: string; medicoId: string; medicoName: string; day: string;
  startTime: string; endTime: string; type: 'DISPONIBLE' | 'DESCANSO';
  specialty?: string;
}

interface SupportMessage {
  id: string; senderName: string; senderDni: string; content: string;
  date: string; reply?: string; isRead: boolean;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const SPECIALIZATION_PRICES: Record<string, number> = {
  'Cardiología': 120.00, 'Traumatología': 100.00, 'Pediatría': 80.00,
  'Dermatología': 90.00, 'Medicina General': 50.00, 'Neurología': 130.00,
  'Ginecología': 110.00, 'Oftalmología': 95.00,
};
const DEFAULT_PRICE = 50.00;

// Demo appointments: 2 ALTA, 2 MEDIA, 2 BAJA
const DEMO_APPOINTMENTS: Appointment[] = [
  { id: 'a1', patientName: 'CARLOS MENDOZA', patientDni: '11223344', date: today, time: '08:30', service: 'Cardiología', paymentStatus: 'PENDING', status: 'PENDING', amount: 120, userId: 'p1', urgency: 'ALTA', symptoms: 'Dolor intenso en el pecho and dificultad para respirar.' },
  { id: 'a2', patientName: 'ANA TORRES', patientDni: '22334455', date: today, time: '09:00', service: 'Neurología', paymentStatus: 'PAID', status: 'PAID', amount: 130, userId: 'p2', urgency: 'ALTA', symptoms: 'Pérdida repentina de visión and mareos severos.', paymentMethod: 'YAPE', reference: 'TRX-9981' },
  { id: 'a3', patientName: 'ROBERTO SILVA', patientDni: '33445566', date: today, time: '10:00', service: 'Traumatología', paymentStatus: 'PENDING', status: 'PENDING', amount: 100, userId: 'p3', urgency: 'MEDIA', symptoms: 'Fractura probable en tobillo derecho luego de caída.' },
  { id: 'a4', patientName: 'LUCIA VARGAS', patientDni: '44556677', date: tomorrow, time: '11:30', service: 'Ginecología', paymentStatus: 'PAID', status: 'PAID', amount: 110, userId: 'p4', urgency: 'MEDIA', symptoms: 'Control prenatal mes 6.', paymentMethod: 'PLIN', reference: 'PLN-1234' },
  { id: 'a5', patientName: 'PEDRO RAMIREZ', patientDni: '55667788', date: tomorrow, time: '14:00', service: 'Dermatología', paymentStatus: 'PENDING', status: 'PENDING', amount: 90, userId: 'p5', urgency: 'BAJA', symptoms: 'Manchas leves en el antebrazo sin dolor.' },
  { id: 'a6', patientName: 'SOFIA CASTRO', patientDni: '66778899', date: tomorrow, time: '15:30', service: 'Pediatría', paymentStatus: 'PENDING', status: 'PENDING', amount: 80, userId: 'p6', urgency: 'BAJA', symptoms: 'Control de niño sano, vacunas al día.' },
];

const DEMO_USERS: UserProfile[] = [
  { id: 'admin-1', name: 'ADMINISTRADOR', username: 'usuario', password: '123456', role: 'admin' },
  { id: 'medico-1', name: 'DR. CARDOZA', username: 'medico', password: '123456', role: 'medico', specialization: 'Cardiología', restDays: ['Domingo'] },
  { id: 'p1', name: 'CARLOS MENDOZA', dni: '11223344', role: 'patient' },
  { id: 'p2', name: 'ANA TORRES', dni: '22334455', role: 'patient' },
  { id: 'p3', name: 'ROBERTO SILVA', dni: '33445566', role: 'patient' },
  { id: 'p4', name: 'LUCIA VARGAS', dni: '44556677', role: 'patient' },
  { id: 'p5', name: 'PEDRO RAMIREZ', dni: '55667788', role: 'patient' },
  { id: 'p6', name: 'SOFIA CASTRO', dni: '66778899', role: 'patient' },
];

// ─────────────────────────────────────────────────────────────
// TRIAGE CLÍNICO LOCAL INTELIGENTE (RESPALDO / OFFLINE)
// ─────────────────────────────────────────────────────────────
function smartLocalTriage(symptoms: string): { urgency: Urgency; specialization: string; reason: string } {
  const s = symptoms.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Palabras clave críticas de vida o muerte (ALTA)
  const altaKeywords = [
    'ojo', 'vista', 'vision', 'ciego', 'oftalmo', 'parti la cabeza', 'cabeza en dos', 'craneo',
    'cerebro', 'sangre mucha', 'sangrando', 'sangrado masivo', 'hemorragia', 'infarto', 'pecho',
    'corazon', 'paro', 'respirar', 'asfixia', 'ahogo', 'aire', 'desmayo', 'inconsciente',
    'perdi el conocimiento', 'amputa', 'morir', 'morirse', 'salio el ojo'
  ];

  // Palabras clave de urgencia intermedia (MEDIA)
  const mediaKeywords = [
    'fractura', 'roto', 'tobillo', 'hueso', 'esguince', 'torcedura', 'doble', 'dedo', 'mano', 'pie',
    'fiebre alta', 'vomito', 'quemadura', 'dolor fuerte', 'corte', 'herida', 'embarazo', 'gineco',
    'infeccion', 'bacteria', 'gripe', 'tos severa'
  ];

  let urgency: Urgency = 'BAJA';
  let reason = "Los síntomas descritos parecen de baja complejidad. Se recomienda consulta general preventiva.";

  if (altaKeywords.some(k => s.includes(k))) {
    urgency = 'ALTA';
    reason = "¡URGENCIA CRÍTICA DETECTADA! Los síntomas indican potencial compromiso ocular, neurológico, cardiovascular o trauma severo que requiere atención inmediata.";
  } else if (mediaKeywords.some(k => s.includes(k))) {
    urgency = 'MEDIA';
    reason = "Urgencia de complejidad moderada. Se identificaron síntomas inflamatorios, posibles lesiones óseas o dolores agudos estables que deben evaluarse pronto.";
  }

  // Direccionamiento Inteligente a Especialidades
  let specialization = 'Medicina General';
  if (s.includes('corazon') || s.includes('pecho') || s.includes('infarto') || s.includes('cardio')) {
    specialization = 'Cardiología';
  } else if (s.includes('hueso') || s.includes('fractura') || s.includes('tobillo') || s.includes('caida') || s.includes('esguince') || s.includes('dedo') || s.includes('roto')) {
    specialization = 'Traumatología';
  } else if (s.includes('cerebro') || s.includes('cabeza') || s.includes('craneo') || s.includes('neuro') || s.includes('mareo')) {
    specialization = 'Neurología';
  } else if (s.includes('embarazo') || s.includes('gineco') || s.includes('mujer') || s.includes('obstetra')) {
    specialization = 'Ginecología';
  } else if (s.includes('ojo') || s.includes('vision') || s.includes('vista') || s.includes('oftalmo') || s.includes('ciego')) {
    specialization = 'Oftalmología';
  } else if (s.includes('piel') || s.includes('mancha') || s.includes('roncha') || s.includes('derma') || s.includes('alergia')) {
    specialization = 'Dermatología';
  } else if (s.includes('nino') || s.includes('bebe') || s.includes('pediatra') || s.includes('hijo')) {
    specialization = 'Pediatría';
  }

  return { urgency, specialization, reason };
}

// ─────────────────────────────────────────────────────────────
// SERVICIO DE LLAMADA A GEMINI CON BACKOFF Y RETRY
// ─────────────────────────────────────────────────────────────
async function callGeminiTriage(symptoms: string, apiKey: string): Promise<{ urgency: Urgency; specialization: string; reason: string }> {
  const systemPrompt = `Actúa como un médico experto de guardia en el triaje de emergencias de una clínica hospitalaria.
Analiza con criterio médico real la descripción de los síntomas que te dará el paciente.
Clasifica de manera estricta la urgencia en uno de estos tres niveles:
- ALTA: Amenaza inminente para la vida o la pérdida de un miembro/órgano. Incluye infartos, traumas craneales, sangrados incontrolados, pérdida de visión, "ojos salidos", "cabeza partida" o asfixias.
- MEDIA: Fracturas sospechadas, dolor agudo, fiebres muy elevadas, cortes profundos pero estables, esguinces severos o embarazo bajo control con dolor.
- BAJA: Síntomas leves como resfriados comunes, revisiones, raspaduras de piel leves o controles médicos.

Asigna la especialidad correcta de entre esta lista exacta: 'Cardiología', 'Traumatología', 'Pediatría', 'Dermatología', 'Medicina General', 'Neurología', 'Ginecología', 'Oftalmología'.

Responde ÚNICAMENTE con un formato JSON plano, sin bloques de código ni markdown:
{
  "urgency": "ALTA" | "MEDIA" | "BAJA",
  "specialization": "Especialidad médica sugerida",
  "reason": "Explicación breve de por qué se tomó esta decisión clínica"
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: `Síntomas del paciente: "${symptoms}"` }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          urgency: { type: "STRING", enum: ["ALTA", "MEDIA", "BAJA"] },
          specialization: { type: "STRING" },
          reason: { type: "STRING" }
        },
        required: ["urgency", "specialization", "reason"]
      }
    }
  };

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
  let lastError: any = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return JSON.parse(text);
      }
      throw new Error("Respuesta vacía de Gemini.");
    } catch (err) {
      lastError = err;
      const waitTime = Math.pow(2, attempt) * 1000;
      await delay(waitTime);
    }
  }

  throw lastError || new Error("Incapaz de conectar con Gemini.");
}

// ─────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────
const UrgencyBadge = ({ u }: { u?: Urgency }) => {
  if (!u) return null;
  const s = { ALTA: 'bg-red-500/10 text-red-400 border-red-500/20', MEDIA: 'bg-amber-500/10 text-amber-400 border-amber-500/20', BAJA: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  return <span className={cn('px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border', s[u])}>{u}</span>;
};

const StatusBadge = ({ s }: { s: ApptStatus }) => {
  const styles = { PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20', PAID: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20', COMPLETED: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
  return <span className={cn('px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border', styles[s])}>{s}</span>;
};

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentView, setCurrentView] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modals
  const [payDlg, setPayDlg] = useState<Appointment | null>(null);
  const [cancelDlg, setCancelDlg] = useState<Appointment | null>(null);
  const [reprogramDlg, setReprogramDlg] = useState<Appointment | null>(null);
  const [recipeDlg, setRecipeDlg] = useState<Appointment | null>(null);
  const [completeDlg, setCompleteDlg] = useState<Appointment | null>(null);
  const [voucherDlg, setVoucherDlg] = useState<Appointment | null>(null);
  const [createUserDlg, setCreateUserDlg] = useState(false);
  const [createApptDlg, setCreateApptDlg] = useState(false);
  const [scheduleDlg, setScheduleDlg] = useState(false);
  const [editUserDlg, setEditUserDlg] = useState<UserProfile | null>(null);
  const [extSupportDlg, setExtSupportDlg] = useState(false);

  // Auth
  const [authTab, setAuthTab] = useState<Role>('admin');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formDni, setFormDni] = useState('');
  const [authError, setAuthError] = useState('');

  // ── INIT ──
  useEffect(() => {
    const savedProfile = sessionStorage.getItem('mg_profile');
    const savedUsers = localStorage.getItem('mg_users');
    const savedAppts = localStorage.getItem('mg_appts');
    const savedSched = localStorage.getItem('mg_schedules');
    const savedMsgs = localStorage.getItem('mg_messages');

    if (savedProfile) {
      const p = JSON.parse(savedProfile);
      setProfile(p);
      setCurrentView(p.role === 'patient' ? 'citas' : 'dashboard');
    }
    setUsers(savedUsers ? JSON.parse(savedUsers) : DEMO_USERS);
    setAppointments(savedAppts ? JSON.parse(savedAppts) : DEMO_APPOINTMENTS);
    setSchedules(savedSched ? JSON.parse(savedSched) : []);
    setMessages(savedMsgs ? JSON.parse(savedMsgs) : []);
    setLoading(false);
  }, []);

  // ── PERSIST ──
  useEffect(() => {
    if (loading) return;
    localStorage.setItem('mg_users', JSON.stringify(users));
    localStorage.setItem('mg_appts', JSON.stringify(appointments));
    localStorage.setItem('mg_schedules', JSON.stringify(schedules));
    localStorage.setItem('mg_messages', JSON.stringify(messages));
  }, [users, appointments, schedules, messages, loading]);

  // ── AUTH ──
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (authTab === 'patient') {
      const dniClean = formDni.trim();
      const namClean = formName.trim().toUpperCase();
      if (dniClean.length < 8 || dniClean.length > 15) { setAuthError('DNI debe tener 8 dígitos. CE entre 9 y 15.'); return; }
      const existing = users.find(u => u.role === 'patient' && u.dni === dniClean);
      if (existing) {
        if (existing.name.toUpperCase() !== namClean) { setAuthError('El nombre no coincide con el DNI/CE registrado.'); return; }
        doLogin(existing);
      } else {
        if (!namClean) { setAuthError('Ingresa tu nombre completo.'); return; }
        const np: UserProfile = { id: `p${Date.now()}`, name: namClean, dni: dniClean, role: 'patient' };
        setUsers(prev => [...prev, np]);
        doLogin(np);
      }
    } else {
      const u = users.find(u => u.role === authTab && u.username === formUsername && u.password === formPassword);
      if (u) doLogin(u); else setAuthError('Credenciales incorrectas.');
    }
  };
  const doLogin = (u: UserProfile) => {
    setProfile(u);
    setCurrentView(u.role === 'patient' ? 'citas' : 'dashboard');
    sessionStorage.setItem('mg_profile', JSON.stringify(u));
  };
  const handleLogout = () => { setProfile(null); sessionStorage.removeItem('mg_profile'); };

  // ── APPOINTMENT ACTIONS ──
  const createAppointment = (data: any, payNow: boolean) => {
    const price = SPECIALIZATION_PRICES[data.service] || DEFAULT_PRICE;
    const na: Appointment = {
      id: `a${Date.now()}`,
      patientName: data.patientName.toUpperCase(),
      patientDni: data.patientDni,
      date: data.date,
      time: data.time,
      service: data.service,
      paymentStatus: 'PENDING',
      status: 'PENDING',
      amount: price,
      userId: data.userId || 'guest',
      urgency: data.urgency,
      symptoms: data.symptoms
    };
    setAppointments(p => [na, ...p]);
    setCreateApptDlg(false);
    if (payNow) setPayDlg(na);
  };
  const processPayment = (id: string, method: 'YAPE' | 'PLIN' | 'CARD', ref: string) => {
    setAppointments(p => p.map(a => a.id === id ? { ...a, paymentStatus: 'PAID', paymentMethod: method, reference: ref, status: 'PAID' } : a));
    setPayDlg(null);
  };
  const cancelAppointment = (id: string, reason: string) => {
    setAppointments(p => p.map(a => a.id === id ? { ...a, status: 'CANCELLED', cancelReason: reason } : a));
    setCancelDlg(null);
  };
  const reprogramAppointment = (id: string, date: string, time: string) => {
    setAppointments(p => p.map(a => a.id === id ? { ...a, date, time } : a));
    setReprogramDlg(null);
  };
  const completeAppointment = (id: string, medicoName: string) => {
    setAppointments(p => p.map(a => a.id === id ? { ...a, status: 'COMPLETED', medicoName } : a));
    setCompleteDlg(null);
  };
  const deleteAppointment = (id: string) => setAppointments(p => p.filter(a => a.id !== id));
  const saveRecipe = (id: string, notes: string) => {
    setAppointments(p => p.map(a => a.id === id ? { ...a, notes } : a));
    setRecipeDlg(null);
  };

  // ── USER ACTIONS ──
  const createUser = (data: any) => {
    setUsers(p => [...p, { id: `u${Date.now()}`, ...data, name: data.name.toUpperCase() }]);
    setCreateUserDlg(false);
  };
  const editUser = (data: Partial<UserProfile>) => {
    if (!editUserDlg) return;
    const updated = { ...editUserDlg, ...data };
    setUsers(p => p.map(u => u.id === editUserDlg.id ? updated : u));
    if (profile?.id === editUserDlg.id) { setProfile(updated); sessionStorage.setItem('mg_profile', JSON.stringify(updated)); }
    setEditUserDlg(null);
  };
  const deleteUser = (id: string) => { if (id === 'admin-1') return; setUsers(p => p.filter(u => u.id !== id)); };

  // ── SCHEDULE ACTIONS ──
  const addSchedule = (data: any) => {
    const news = data.days.map((day: string) => ({ id: `s${Date.now()}${day}`, medicoId: profile?.id, medicoName: profile?.name, day, startTime: data.startTime, endTime: data.endTime, type: data.type, specialty: data.specialty }));
    setSchedules(p => [...p, ...news]);
    setScheduleDlg(false);
  };
  const deleteSchedule = (id: string) => { if (profile?.role !== 'admin') return; setSchedules(p => p.filter(s => s.id !== id)); };

  // ── MESSAGES ──
  const sendMessage = (d: any) => {
    setMessages(p => [{ id: `m${Date.now()}`, senderName: d.name, senderDni: d.dni, content: d.content, date: new Date().toISOString(), isRead: false }, ...p]);
  };
  const replyMessage = (id: string, reply: string) => {
    setMessages(p => p.map(m => m.id === id ? { ...m, reply, isRead: true } : m));
  };

  // ── FILTERS ──
  const activeAppts = appointments.filter(a => a.status !== 'CANCELLED' && a.status !== 'COMPLETED');
  const myAppts = profile?.role === 'patient' ? appointments.filter(a => a.userId === profile.id) : activeAppts;

  // CORRECCIÓN: tipado explícito del mapa w para resolver error de indexación en TypeScript
  const sortedAppts = [...myAppts].sort((a, b) => {
    const w: Record<Urgency, number> = { ALTA: 3, MEDIA: 2, BAJA: 1 };
    const priorityB = w[(b.urgency as Urgency) || 'BAJA'] || 0;
    const priorityA = w[(a.urgency as Urgency) || 'BAJA'] || 0;
    return priorityB - priorityA;
  });

  const filteredAppts = sortedAppts.filter(a => {
    const ms = a.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || a.patientDni.includes(searchTerm);
    if (filterStatus === 'ALL') return ms;
    if (filterStatus === 'TODAY') return ms && a.date === today;
    if (['PENDING', 'PAID'].includes(filterStatus)) return ms && a.status === filterStatus;
    if (['ALTA', 'MEDIA', 'BAJA'].includes(filterStatus)) return ms && a.urgency === filterStatus;
    return ms;
  });

  const unreadMsgs = messages.filter(m => !m.isRead).length;

  if (loading) return null;

  // ─────────────────────────────────────────────────────────
  // LOGIN SCREEN
  // ─────────────────────────────────────────────────────────
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#060606] flex items-center justify-center p-4 font-sans">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[420px]">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(16,185,129,0.12)]">
              <Activity className="text-emerald-500" size={28} />
            </div>
            <h1 className="text-[2.8rem] font-black text-white italic tracking-tighter leading-none">MEDIAGENDAK</h1>
            <p className="text-gray-600 text-[9px] uppercase tracking-[0.4em] font-black mt-2">Sistema de Gestión Médica</p>
          </div>

          <div className="bg-[#111] border border-white/5 rounded-[28px] overflow-hidden shadow-2xl">
            <div className="flex border-b border-white/5">
              {(['admin', 'medico', 'patient'] as Role[]).map(r => (
                <button key={r} onClick={() => { setAuthTab(r); setAuthError(''); }}
                  className={cn('flex-1 py-4 text-[9px] font-black tracking-[0.2em] uppercase relative transition-colors', authTab === r ? 'text-white' : 'text-gray-600 hover:text-gray-400')}>
                  {r === 'admin' ? 'Gestión' : r === 'medico' ? 'Personal' : 'Paciente'}
                  {authTab === r && <motion.div layoutId="auth-tab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500" />}
                </button>
              ))}
            </div>

            <form className="p-8 space-y-4" onSubmit={handleLogin}>
              {authTab === 'patient' ? (
                <>
                  <Field label="Nombre y Apellido" type="text" value={formName} onChange={(e: any) => setFormName(e.target.value)} placeholder="Juan Pérez" />
                  <Field label="DNI (8) o CE (9–15 dígitos)" type="text" maxLength={15} value={formDni} onChange={(e: any) => setFormDni(e.target.value)} placeholder="77665544" />
                </>
              ) : (
                <>
                  <Field label="Usuario" type="text" value={formUsername} onChange={(e: any) => setFormUsername(e.target.value)} placeholder="usuario" />
                  <Field label="Contraseña" type="password" value={formPassword} onChange={(e: any) => setFormPassword(e.target.value)} placeholder="••••••••" />
                </>
              )}
              {authError && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <AlertCircle size={14} className="text-red-400 shrink-0" />
                  <p className="text-red-400 text-[10px] font-bold">{authError}</p>
                </div>
              )}
              <button type="submit" className="w-full bg-emerald-500 text-black font-black py-4 rounded-2xl uppercase tracking-[0.15em] text-[10px] hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">
                {authTab === 'patient' ? 'Ingreso Libre' : 'Acceder al Sistema'}
              </button>
              {authTab === 'patient' && (
                <button type="button" onClick={() => setExtSupportDlg(true)} className="w-full text-[9px] text-gray-600 hover:text-gray-400 uppercase tracking-widest transition-colors pt-1">
                  ¿Problemas de acceso? → Soporte ATC
                </button>
              )}
            </form>

            <div className="px-8 pb-6 text-center border-t border-white/5 pt-4">
              {authTab === 'patient' ? (
                <a href="mailto:soportemediagendak@gmail.com" className="text-emerald-500 text-[10px] font-bold hover:underline">soportemediagendak@gmail.com</a>
              ) : (
                <p className="text-gray-600 text-[9px] uppercase tracking-widest">Solo personal authorized</p>
              )}
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {extSupportDlg && (
            <Modal title="Soporte ATC — Acceso Externo" onClose={() => setExtSupportDlg(false)}>
              <ExternalSupportForm onSend={(d: any) => { sendMessage(d); setExtSupportDlg(false); }} />
            </Modal>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // MAIN LAYOUT
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-[#060606] text-gray-300 font-sans">
      <aside className="w-[260px] border-r border-white/5 bg-[#0a0a0a] flex flex-col shrink-0 hidden lg:flex">
        <div className="p-7">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Activity size={18} className="text-black" />
            </div>
            <div>
              <span className="font-black text-lg italic text-white tracking-tight block leading-none">MEDIAGENDAK</span>
              <span className="text-[8px] text-emerald-500 font-black uppercase tracking-widest">Pro</span>
            </div>
          </div>
          <nav className="space-y-1">
            {profile.role === 'patient' && <>
              <SideItem id="citas" icon={<Calendar size={16} />} label="Mis Citas" view={currentView} setView={setCurrentView} />
              <SideItem id="historial-paciente" icon={<History size={16} />} label="Mi Historial" view={currentView} setView={setCurrentView} />
              <SideItem id="pagos" icon={<CreditCard size={16} />} label="Pagos y Vouchers" view={currentView} setView={setCurrentView} />
              <SideItem id="mensajes" icon={<MessageSquare size={16} />} label="Soporte ATC" view={currentView} setView={setCurrentView} />
              <div className="h-px bg-white/5 my-3" />
              <SideItem id="informacion" icon={<UserIcon size={16} />} label="Mi Perfil" view={currentView} setView={setCurrentView} />
            </>}
            {profile.role !== 'patient' && <>
              <SideItem id="dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" view={currentView} setView={setCurrentView} />
              <SideItem id="citas" icon={<Activity size={16} />} label="Citas Activas" view={currentView} setView={setCurrentView} />
              <div className="h-px bg-white/5 my-3" />
              {profile.role === 'admin' && <>
                <SideItem id="historial" icon={<Archive size={16} />} label="Historial Global" view={currentView} setView={setCurrentView} />
                <SideItem id="usuarios" icon={<Users size={16} />} label="Usuarios" view={currentView} setView={setCurrentView} />
                <SideItem id="horarios" icon={<Clock size={16} />} label="Horarios" view={currentView} setView={setCurrentView} />
                <SideItem id="atc" icon={<MessageSquare size={16} />} label={`ATC ${unreadMsgs > 0 ? `(${unreadMsgs})` : ''}`} view={currentView} setView={setCurrentView} badge={unreadMsgs} />
              </>}
              {profile.role === 'medico' && <>
                <SideItem id="horarios" icon={<Clock size={16} />} label="Mi Horario" view={currentView} setView={setCurrentView} />
              </>}
            </>}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-white/5">
          <div className="flex items-center gap-3 mb-4 p-3 bg-white/[0.03] rounded-xl border border-white/5">
            <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 font-black text-sm">{profile.name[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[11px] font-bold uppercase truncate">{profile.name}</p>
              <p className="text-gray-500 text-[9px] uppercase tracking-widest">{profile.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-red-400 text-[10px] font-bold py-2.5 bg-white/[0.03] hover:bg-red-500/10 rounded-lg border border-white/5 hover:border-red-500/20 transition-all uppercase tracking-widest">
            <LogOut size={14} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-40">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white">{currentView.replace('-', ' ')}</h2>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-white/[0.04] rounded-lg text-[9px] font-black uppercase text-emerald-400 border border-emerald-500/20 tracking-widest">{profile.role}</span>
            {profile.role !== 'medico' && (
              <button onClick={() => setCreateApptDlg(true)} className="bg-emerald-500 text-black px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors">
                <Plus size={13} /> Nueva Cita
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-0">
            {currentView === 'dashboard' && profile.role !== 'patient' && <DashboardView appointments={appointments} />}
            {currentView === 'citas' && (
              <CitasView
                profile={profile} appointments={filteredAppts}
                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                filterStatus={filterStatus} setFilterStatus={setFilterStatus}
                onPay={setPayDlg} onCancel={setCancelDlg}
                onReprogram={setReprogramDlg} onComplete={setCompleteDlg}
                onDelete={deleteAppointment} onRecipe={setRecipeDlg}
              />
            )}
            {currentView === 'historial-paciente' && profile.role === 'patient' && (
              <HistorialPacienteView appointments={appointments.filter(a => a.userId === profile.id && a.status === 'COMPLETED')} />
            )}
            {currentView === 'historial' && profile.role === 'admin' && (
              <HistorialGlobalView appointments={appointments} onDelete={deleteAppointment} />
            )}
            {currentView === 'usuarios' && profile.role === 'admin' && (
              <UsuariosView users={users} onCreate={() => setCreateUserDlg(true)} onEdit={setEditUserDlg} onDelete={deleteUser} />
            )}
            {currentView === 'horarios' && (
              <HorariosView schedules={schedules} profile={profile} onAdd={() => setScheduleDlg(true)} onDelete={deleteSchedule} />
            )}
            {currentView === 'atc' && profile.role === 'admin' && (
              <ATCAdminView messages={messages} onReply={replyMessage} />
            )}
            {currentView === 'mensajes' && profile.role === 'patient' && (
              <ATCPatientView profile={profile} messages={messages} onSend={sendMessage} />
            )}
            {currentView === 'pagos' && profile.role === 'patient' && (
              <PagosView appointments={appointments.filter(a => a.userId === profile.id)} onPay={setPayDlg} onVoucher={setVoucherDlg} />
            )}
            {currentView === 'informacion' && profile.role === 'patient' && (
              <InformacionView profile={profile} onUpdate={(d: any) => { const u = { ...profile, ...d }; setProfile(u); setUsers(prev => prev.map(x => x.id === profile.id ? u : x)); sessionStorage.setItem('mg_profile', JSON.stringify(u)); }} />
            )}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {payDlg && <PaymentModal appt={payDlg} onClose={() => setPayDlg(null)} onConfirm={processPayment} />}
        {voucherDlg && <VoucherModal appt={voucherDlg} onClose={() => setVoucherDlg(null)} />}
        {cancelDlg && <CancelModal appt={cancelDlg} onClose={() => setCancelDlg(null)} onConfirm={cancelAppointment} />}
        {reprogramDlg && <ReprogramModal appt={reprogramDlg} onClose={() => setReprogramDlg(null)} onConfirm={reprogramAppointment} />}
        {completeDlg && <CompleteModal appt={completeDlg} profile={profile} onClose={() => setCompleteDlg(null)} onConfirm={completeAppointment} />}
        {recipeDlg && <RecipeModal appt={recipeDlg} onClose={() => setRecipeDlg(null)} onConfirm={saveRecipe} />}
        {createUserDlg && <CreateUserModal onClose={() => setCreateUserDlg(false)} onConfirm={createUser} />}
        {editUserDlg && <EditUserModal user={editUserDlg} onClose={() => setEditUserDlg(null)} onConfirm={editUser} />}
        {createApptDlg && <CreateApptModal profile={profile} users={users} onClose={() => setCreateApptDlg(false)} onConfirm={createAppointment} />}
        {scheduleDlg && <ScheduleModal onClose={() => setScheduleDlg(false)} onConfirm={addSchedule} />}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LAYOUT HELPERS
// ─────────────────────────────────────────────────────────────
function SideItem({ id, icon, label, view, setView, badge }: any) {
  const active = view === id;
  return (
    <button onClick={() => setView(id)}
      className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold transition-all relative', active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' : 'text-gray-500 hover:bg-white/[0.03] hover:text-gray-300 border border-transparent')}>
      <span className={active ? 'text-emerald-400' : 'text-gray-600'}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge > 0 && !active && <span className="bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">{badge}</span>}
    </button>
  );
}

function Field({ label, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] text-gray-500 uppercase font-black tracking-[0.2em]">{label}</label>
      <input className="w-full bg-[#0a0a0a] border border-white/8 py-3.5 px-4 rounded-xl text-white text-sm outline-none focus:border-emerald-500/40 transition-colors" {...props} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VIEWS
// ─────────────────────────────────────────────────────────────
function DashboardView({ appointments }: any) {
  const paid = appointments.filter((a: any) => a.paymentStatus === 'PAID');
  const totalIncome = paid.reduce((s: number, a: any) => s + a.amount, 0);
  const pending = appointments.filter((a: any) => a.status === 'PENDING').length;
  const alta = appointments.filter((a: any) => a.urgency === 'ALTA' && a.status !== 'CANCELLED' && a.status !== 'COMPLETED').length;

  // CORRECCIÓN: tipado explícito del mapa w para evitar implicit any al ordenar
  const todayAppts = appointments.filter((a: any) => a.date === today && a.status !== 'CANCELLED').sort((x: any, y: any) => {
    const w: Record<Urgency, number> = { ALTA: 3, MEDIA: 2, BAJA: 1 };
    const priorityY = w[(y.urgency as Urgency) || 'BAJA'] || 0;
    const priorityX = w[(x.urgency as Urgency) || 'BAJA'] || 0;
    return priorityY - priorityX;
  });

  const incomeMap: Record<string, number> = {};
  paid.forEach((a: any) => { incomeMap[a.service] = (incomeMap[a.service] || 0) + a.amount; });
  const maxVal = Math.max(...Object.values(incomeMap) as number[], 1);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-5">
        <StatCard label="Ingresos Verificados" value={`S/ ${totalIncome.toFixed(2)}`} color="text-emerald-400" />
        <StatCard label="Citas Pendientes" value={pending} color="text-amber-400" />
        <StatCard label="Urgencias ALTA" value={alta} color="text-red-400" />
      </div>

      <div className="bg-[#111] border border-white/5 rounded-2xl p-8">
        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white mb-8 flex items-center gap-2">
          <BarChart3 size={14} className="text-emerald-500" /> Ingresos por Especialidad
        </h3>
        <div className="flex items-end gap-4 h-40">
          {Object.entries(incomeMap).map(([k, v]: any) => (
            <div key={k} className="flex-1 flex flex-col items-center justify-end h-full group">
              <span className="text-[9px] text-emerald-400 font-black mb-2 opacity-0 group-hover:opacity-100 transition-opacity">S/{v}</span>
              <div className="w-full bg-emerald-500/20 hover:bg-emerald-500/40 rounded-t border border-emerald-500/20 transition-all" style={{ height: `${Math.max((v / maxVal) * 100, 6)}%` }} />
              <span className="text-[8px] text-gray-500 mt-2 truncate w-full text-center">{k.split(' ')[0]}</span>
            </div>
          ))}
          {Object.keys(incomeMap).length === 0 && <p className="text-gray-600 text-xs italic w-full text-center">Sin ingresos aún.</p>}
        </div>
      </div>

      <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
          <Calendar size={13} className="text-emerald-500" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white">Agenda de Hoy — ordenada por Urgencia</h3>
        </div>
        {todayAppts.length === 0 ? (
          <p className="text-gray-600 text-xs italic p-8 text-center">Sin citas hoy.</p>
        ) : (
          <Table headers={['Hora', 'Paciente', 'Servicio', 'Urgencia', 'Estado']}>
            {todayAppts.map((a: any) => (
              <TR key={a.id} highlight={a.urgency === 'ALTA'}>
                <TD mono emerald>{a.time}</TD>
                <TD bold>{a.patientName}</TD>
                <TD muted>{a.service}</TD>
                <TD><UrgencyBadge u={a.urgency} /></TD>
                <TD><StatusBadge s={a.status} /></TD>
              </TR>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: any) {
  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl p-7">
      <p className="text-[9px] uppercase font-black tracking-[0.25em] text-gray-500 mb-3">{label}</p>
      <p className={cn('text-3xl font-black tracking-tight', color)}>{value}</p>
    </div>
  );
}

function CitasView({ profile, appointments, searchTerm, setSearchTerm, filterStatus, setFilterStatus, onPay, onCancel, onReprogram, onComplete, onDelete, onRecipe }: any) {
  const isStaff = profile.role !== 'patient';
  const filters = [{ id: 'ALL', l: 'Todas' }, { id: 'TODAY', l: 'Hoy' }, { id: 'PENDING', l: 'Pendientes' }, { id: 'PAID', l: 'Pagadas' }, { id: 'ALTA', l: '🔴 Alta' }, { id: 'MEDIA', l: '🟡 Media' }, { id: 'BAJA', l: '🟢 Baja' }];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center bg-[#111] border border-white/5 rounded-2xl p-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar paciente o DNI..."
            className="bg-[#0a0a0a] border border-white/8 py-2.5 pl-9 pr-4 rounded-lg text-xs text-white outline-none focus:border-emerald-500/40 w-56 transition-colors" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filters.map(f => (
            <button key={f.id} onClick={() => setFilterStatus(f.id)}
              className={cn('px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all', filterStatus === f.id ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.07] hover:text-white')}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {isStaff && (
        <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
          {appointments.length === 0 ? <p className="text-gray-600 text-xs italic p-10 text-center">Bandeja vacía.</p> : (
            <Table headers={['Paciente', 'DNI/CE', 'Fecha', 'Hora', 'Servicio', 'Monto', 'Urgencia', 'Estado', 'Acciones']}>
              {appointments.map((a: any) => (
                <TR key={a.id} highlight={a.urgency === 'ALTA' && a.date === today}>
                  <TD bold>{a.patientName}</TD>
                  <TD mono muted>{a.patientDni}</TD>
                  <TD muted>{a.date}</TD>
                  <TD mono emerald>{a.time}</TD>
                  <TD muted>{a.service}</TD>
                  <TD bold>S/ {a.amount?.toFixed(2)}</TD>
                  <TD><UrgencyBadge u={a.urgency} /></TD>
                  <TD><StatusBadge s={a.status} /></TD>
                  <TD>
                    <div className="flex items-center gap-1">
                      {a.status === 'PENDING' && <IconBtn icon={<CreditCard size={12} />} color="emerald" title="Pagar" onClick={() => onPay(a)} />}
                      {a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && <IconBtn icon={<RefreshCw size={12} />} color="blue" title="Reprogramar" onClick={() => onReprogram(a)} />}
                      {a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && <IconBtn icon={<XCircle size={12} />} color="red" title="Cancelar" onClick={() => onCancel(a)} />}
                      {a.status === 'PAID' && <IconBtn icon={<CheckCircle2 size={12} />} color="green" title="Completar" onClick={() => onComplete(a)} />}
                      {(profile.role === 'medico' || profile.role === 'admin') && <IconBtn icon={<FileText size={12} />} color="purple" title="Receta" onClick={() => onRecipe(a)} />}
                      {profile.role === 'admin' && <IconBtn icon={<Trash2 size={12} />} color="red" title="Eliminar" onClick={() => { if (confirm('¿Eliminar esta cita?')) onDelete(a.id); }} />}
                    </div>
                  </TD>
                </TR>
              ))}
            </Table>
          )}
        </div>
      )}

      {!isStaff && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {appointments.length === 0 && <p className="col-span-full text-gray-600 text-xs italic p-12 text-center border border-dashed border-white/8 rounded-2xl">No tienes citas activas.</p>}
          {appointments.map((a: any) => (
            <motion.div key={a.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className={cn('bg-[#111] border rounded-2xl p-7 relative overflow-hidden group transition-colors', a.urgency === 'ALTA' ? 'border-red-500/20' : 'border-white/5 hover:border-white/10')}>
              {a.urgency === 'ALTA' && <div className="absolute inset-0 bg-red-500/3 pointer-events-none" />}
              <div className="flex justify-between items-start mb-5 relative z-10">
                <div>
                  <h4 className="font-black text-white uppercase text-base tracking-tight">{a.service}</h4>
                  <p className="text-[9px] font-mono text-gray-600 mt-1">{a.patientDni}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge s={a.status} />
                  <UrgencyBadge u={a.urgency} />
                </div>
              </div>
              <div className="space-y-2.5 mb-6 text-xs text-gray-500 relative z-10">
                <p className="flex items-center gap-2"><Calendar size={12} className="text-emerald-500" />{a.date} — {a.time}</p>
                <p className="flex items-center gap-2"><Wallet size={12} className="text-emerald-500" />S/ {a.amount?.toFixed(2)}</p>
                {a.symptoms && <p className="text-[10px] italic text-gray-600 bg-white/[0.02] p-2 rounded-lg border border-white/5 line-clamp-2">"{a.symptoms}"</p>}
                {a.notes && <p className="text-[10px] text-blue-400 bg-blue-500/5 p-2 rounded-lg border border-blue-500/10">{a.notes}</p>}
              </div>
              <div className="flex gap-2 relative z-10">
                {a.status === 'PENDING' && <button onClick={() => onPay(a)} className="flex-1 bg-emerald-500 text-black font-black text-[9px] uppercase tracking-widest py-3 rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">Pagar</button>}
                {a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && <>
                  <button onClick={() => onReprogram(a)} className="flex-1 bg-white/[0.04] text-white font-black text-[9px] uppercase tracking-widest py-3 rounded-xl hover:bg-white/[0.07] transition-colors border border-white/5">Reprogramar</button>
                  <button onClick={() => onCancel(a)} className="flex-1 bg-red-500/10 text-red-400 font-black text-[9px] uppercase tracking-widest py-3 rounded-xl hover:bg-red-500/20 transition-colors border border-red-500/20">Cancelar</button>
                </>}
                {a.status === 'CANCELLED' && <p className="w-full text-[9px] italic text-red-400/70 text-center">"{a.cancelReason}"</p>}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistorialPacienteView({ appointments }: any) {
  return (
    <div className="space-y-5">
      <SectionHeader icon={<History size={14} className="text-blue-400" />} title="Mi Historial Clínico" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {appointments.length === 0 && <p className="col-span-full text-gray-600 text-xs italic p-12 text-center border border-dashed border-white/8 rounded-2xl">Sin historial clínico aún.</p>}
        {appointments.map((a: any) => (
          <div key={a.id} className="bg-[#111] border border-white/5 rounded-2xl p-7">
            <div className="flex justify-between items-start mb-4">
              <h4 className="font-black text-white uppercase">{a.service}</h4>
              <StatusBadge s="COMPLETED" />
            </div>
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-2"><Calendar size={11} className="text-emerald-500" />{a.date}</p>
            {a.medicoName && <p className="text-xs text-gray-500 mb-4 flex items-center gap-2"><Stethoscope size={11} className="text-emerald-500" />Dr. {a.medicoName}</p>}
            <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-xl">
              <p className="text-[9px] text-blue-400 font-black uppercase tracking-widest mb-1.5">Diagnóstico / Receta</p>
              <p className="text-xs text-gray-400 italic">"{a.notes || 'Sin notas registradas.'}"</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistorialGlobalView({ appointments, onDelete }: any) {
  const history = appointments.filter((a: any) => ['CANCELLED', 'COMPLETED'].includes(a.status));
  return (
    <div className="space-y-5">
      <SectionHeader icon={<Archive size={14} className="text-emerald-400" />} title={`Historial Global BD (${history.length} registros)`} />
      <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
        {history.length === 0 ? <p className="text-gray-600 text-xs italic p-10 text-center">Sin registros en historial.</p> : (
          <Table headers={['Paciente', 'DNI', 'Fecha', 'Servicio', 'Estado', 'Detalle', 'Acción']}>
            {history.map((a: any) => (
              <TR key={a.id}>
                <TD bold>{a.patientName}</TD>
                <TD mono muted>{a.patientDni}</TD>
                <TD muted>{a.date}</TD>
                <TD muted>{a.service}</TD>
                <TD><StatusBadge s={a.status} /></TD>
                <TD muted small>{a.status === 'COMPLETED' ? `Dr. ${a.medicoName || '—'}` : (a.cancelReason || '—')}</TD>
                <TD>
                  <IconBtn icon={<Trash2 size={12} />} color="red" title="Eliminar" onClick={() => { if (confirm('¿Eliminar registro?')) onDelete(a.id); }} />
                </TD>
              </TR>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TABLE HELPERS
// ─────────────────────────────────────────────────────────────
function Table({ headers, children }: any) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/5 bg-white/[0.015]">
            {headers.map((h: string) => <th key={h} className="text-left px-5 py-3.5 text-[9px] uppercase tracking-[0.2em] text-gray-500 font-black whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function TR({ children, highlight }: any) {
  return <tr className={cn('border-b border-white/[0.04] transition-colors', highlight ? 'bg-red-500/[0.04] border-l-2 border-l-red-500' : 'hover:bg-white/[0.02]')}>{children}</tr>;
}

// CORRECCIÓN: tipado correcto para las celdas de la tabla para evitar advertencias de tipado implícito en typescript
function TD({ children, bold, mono, muted, emerald, small }: any) {
  return (
    <td className={cn('px-5 py-3.5 whitespace-nowrap', bold ? 'font-bold text-white uppercase' : '', mono ? 'font-mono' : '', muted ? 'text-gray-500' : '', emerald ? 'text-emerald-400 font-bold' : '', small ? 'text-[9px]' : '')}>
      {children}
    </td>
  );
}

function IconBtn({ icon, color, title, onClick }: any) {
  const colors = { emerald: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20', blue: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20', red: 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20', purple: 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/20', green: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20' };
  return <button onClick={onClick} title={title} className={cn('p-1.5 rounded-lg border transition-colors', colors[color as keyof typeof colors] || colors.blue)}>{icon}</button>;
}

function SectionHeader({ icon, title }: any) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-white">{title}</h2>
    </div>
  );
}

function UsuariosView({ users, onCreate, onEdit, onDelete }: any) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader icon={<Users size={14} className="text-blue-400" />} title={`Usuarios (${users.length})`} />
        <button onClick={onCreate} className="bg-emerald-500 text-black px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors">
          <UserPlus size={13} /> Nuevo Usuario
        </button>
      </div>
      <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
        <Table headers={['Nombre', 'Rol', 'Usuario / DNI', 'Teléfono', 'Correo', 'Especialidad', 'Acciones']}>
          {users.map((u: any) => (
            <TR key={u.id}>
              <TD bold>{u.name}</TD>
              <TD>
                <span className={cn('px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border', u.role === 'admin' ? 'bg-red-500/10 text-red-400 border-red-500/20' : u.role === 'medico' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20')}>{u.role}</span>
              </TD>
              <TD mono muted>{u.username || u.dni || '—'}</TD>
              <TD muted>{u.phone || '—'}</TD>
              <TD muted>{u.email || '—'}</TD>
              <TD muted>{u.specialization || '—'}</TD>
              <TD>
                <div className="flex items-center gap-1">
                  <IconBtn icon={<Edit2 size={12} />} color="blue" title="Editar" onClick={() => onEdit(u)} />
                  {u.id !== 'admin-1' && <IconBtn icon={<Trash2 size={12} />} color="red" title="Eliminar" onClick={() => { if (confirm(`¿Eliminar a ${u.name}?`)) onDelete(u.id); }} />}
                </div>
              </TD>
            </TR>
          ))}
        </Table>
      </div>
    </div>
  );
}

function HorariosView({ schedules, profile, onAdd, onDelete }: any) {
  const mySchedules = profile.role === 'medico' ? schedules.filter((s: any) => s.medicoId === profile.id) : schedules;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader icon={<Clock size={14} className="text-emerald-400" />} title="Horarios Médicos" />
        {profile.role === 'medico' && (
          <button onClick={onAdd} className="bg-emerald-500 text-black px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors">
            <Plus size={13} /> Agregar Turno
          </button>
        )}
      </div>
      {profile.role === 'medico' && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={14} className="text-amber-400 shrink-0" />
          <p className="text-[10px] text-amber-300 font-bold">Solo el Administrador puede eliminar turnos ya registrados. Comunícate con administración para modificaciones.</p>
        </div>
      )}
      <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
        {mySchedules.length === 0 ? <p className="text-gray-600 text-xs italic p-10 text-center">Sin horarios registrados.</p> : (
          <Table headers={['Médico', 'Día', 'Horario', 'Tipo', 'Especialidad', ...(profile.role === 'admin' ? ['Eliminar'] : [])]}>
            {mySchedules.map((s: any) => (
              <TR key={s.id}>
                <TD bold>{s.medicoName}</TD>
                <TD muted>{s.day}</TD>
                <TD mono emerald>{s.type === 'DESCANSO' ? '— Día Libre —' : `${s.startTime} — ${s.endTime}`}</TD>
                <TD>
                  <span className={cn('px-2 py-0.5 rounded text-[8px] font-black uppercase border', s.type === 'DESCANSO' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')}>{s.type}</span>
                </TD>
                <TD muted>{s.specialty || '—'}</TD>
                {profile.role === 'admin' && (
                  <TD>
                    <IconBtn icon={<Trash2 size={12} />} color="red" title="Eliminar turno" onClick={() => { if (confirm('¿Eliminar este turno?')) onDelete(s.id); }} />
                  </TD>
                )}
              </TR>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}

function ATCAdminView({ messages, onReply }: any) {
  return (
    <div className="space-y-5">
      <SectionHeader icon={<MessageSquare size={14} className="text-blue-400" />} title={`Reclamos ATC (${messages.length})`} />
      {messages.length === 0 && <div className="text-gray-600 text-xs italic p-12 text-center border border-dashed border-white/8 rounded-2xl flex flex-col items-center gap-3"><CheckCircle2 size={32} className="text-emerald-500/30" />Bandeja limpia.</div>}
      <div className="space-y-4">
        {messages.map((m: any) => {
          const [reply, setReply] = React.useState('');
          return (
            <div key={m.id} className="bg-[#111] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white font-bold text-sm uppercase">{m.senderName}</p>
                  <p className="text-gray-500 text-[10px] font-mono">DNI/CE: {m.senderDni}</p>
                </div>
                <p className="text-gray-600 text-[9px]">{new Date(m.date).toLocaleString('es-PE')}</p>
              </div>
              <p className="text-sm text-gray-300 mb-5 bg-[#0a0a0a] p-4 rounded-xl border border-white/5 italic">"{m.content}"</p>
              {m.reply ? (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
                  <p className="text-[9px] text-emerald-400 font-black uppercase mb-1">Respuesta enviada:</p>
                  <p className="text-sm text-emerald-300">{m.reply}</p>
                </div>
              ) : (
                <div className="flex gap-3">
                  <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Escribe la respuesta oficial..."
                    className="flex-1 bg-[#0a0a0a] border border-white/8 py-3 px-4 rounded-xl text-sm text-white outline-none focus:border-emerald-500/40 transition-colors" />
                  <button onClick={() => { if (reply.trim()) { onReply(m.id, reply); } }} className="bg-emerald-500 text-black px-6 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">Enviar</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ATCPatientView({ profile, messages, onSend }: any) {
  const [msg, setMsg] = React.useState('');
  const myMsgs = messages.filter((m: any) => m.senderDni === profile.dni);
  return (
    <div className="space-y-5 max-w-2xl">
      <SectionHeader icon={<MessageSquare size={14} className="text-blue-400" />} title="Soporte ATC" />
      <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-4">Nuevo mensaje</p>
        <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Detalla tu problema o consulta..." rows={4}
          className="w-full bg-[#0a0a0a] border border-white/8 py-3 px-4 rounded-xl text-sm text-white outline-none focus:border-emerald-500/40 transition-colors resize-none mb-4" />
        <button onClick={() => { if (msg.trim()) { onSend({ name: profile.name, dni: profile.dni || '', content: msg }); setMsg(''); } }}
          className="bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest py-3 px-8 rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">
          Enviar Ticket
        </button>
      </div>
      {myMsgs.length > 0 && (
        <div className="space-y-3">
          {myMsgs.map((m: any) => (
            <div key={m.id} className="bg-[#111] border border-white/5 rounded-xl p-5">
              <p className="text-xs text-gray-300 mb-3 italic">"{m.content}"</p>
              {m.reply ? (
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-lg">
                  <p className="text-[9px] text-emerald-400 font-black uppercase mb-1">Respuesta ATC:</p>
                  <p className="text-xs text-emerald-300">{m.reply}</p>
                </div>
              ) : (
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded border border-amber-500/20">En revisión</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PagosView({ appointments, onPay, onVoucher }: any) {
  const pending = appointments.filter((a: any) => a.paymentStatus === 'PENDING' && a.status !== 'CANCELLED');
  const paid = appointments.filter((a: any) => a.paymentStatus === 'PAID');
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <SectionHeader icon={<AlertCircle size={14} className="text-amber-400" />} title={`Pendientes de Pago (${pending.length})`} />
        {pending.length === 0 ? <p className="text-gray-600 text-xs italic p-8 text-center border border-dashed border-white/8 rounded-2xl">Sin pagos pendientes.</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pending.map((a: any) => (
              <div key={a.id} className="bg-[#111] border border-amber-500/15 rounded-2xl p-6">
                <h4 className="font-black text-white uppercase mb-1">{a.service}</h4>
                <p className="text-gray-500 text-[10px] mb-4">{a.date} • {a.time}</p>
                <p className="text-2xl font-black text-white mb-5">S/ {a.amount.toFixed(2)}</p>
                <button onClick={() => onPay(a)} className="w-full bg-amber-500 text-black font-black text-[10px] uppercase tracking-widest py-3 rounded-xl hover:bg-amber-400 transition-colors shadow-lg shadow-emerald-500/20">Pagar Ahora</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-4">
        <SectionHeader icon={<CheckCircle2 size={14} className="text-emerald-400" />} title={`Historial de Pagos (${paid.length})`} />
        <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
          {paid.length === 0 ? <p className="text-gray-600 text-xs italic p-8 text-center">Sin pagos registrados.</p> : (
            <Table headers={['Servicio', 'Fecha', 'Monto', 'Método', 'Referencia', 'Voucher']}>
              {paid.map((a: any) => (
                <TR key={a.id}>
                  <TD bold>{a.service}</TD>
                  <TD muted>{a.date}</TD>
                  <TD bold>S/ {a.amount.toFixed(2)}</TD>
                  <TD muted>{a.paymentMethod || '—'}</TD>
                  <TD mono muted>{a.reference || '—'}</TD>
                  <TD><button onClick={() => onVoucher(a)} className="px-3 py-1.5 bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-colors">Ver</button></TD>
                </TR>
              ))}
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

function InformacionView({ profile, onUpdate }: any) {
  const [d, setD] = React.useState({ phone: profile.phone || '', email: profile.email || '' });
  return (
    <div className="max-w-lg space-y-5">
      <SectionHeader icon={<UserIcon size={14} className="text-gray-400" />} title="Mi Perfil" />
      <div className="bg-[#111] border border-white/5 rounded-2xl p-7 space-y-5">
        <div className="flex items-center gap-4 pb-5 border-b border-white/5">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 font-black text-xl">{profile.name[0]}</div>
          <div>
            <p className="text-white font-black uppercase">{profile.name}</p>
            <p className="text-gray-500 text-[10px] font-mono">DNI/CE: {profile.dni || '—'}</p>
          </div>
        </div>
        <Field label="Teléfono" type="tel" value={d.phone} onChange={(e: any) => setD({ ...d, phone: e.target.value })} placeholder="987654321" />
        <Field label="Correo Electrónico" type="email" value={d.email} onChange={(e: any) => setD({ ...d, email: e.target.value })} placeholder="correo@ejemplo.com" />
        <button onClick={() => onUpdate(d)} className="w-full bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest py-4 rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">
          Guardar Cambios
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL WRAPPER
// ─────────────────────────────────────────────────────────────
function Modal({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
        className="bg-[#141414] border border-white/8 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-white/5">
          <h3 className="text-white font-black uppercase tracking-[0.15em] text-sm italic">{title}</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-white bg-white/[0.04] rounded-lg p-1.5 transition-colors"><XCircle size={16} /></button>
        </div>
        <div className="p-7">{children}</div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODALS
// ─────────────────────────────────────────────────────────────
function ExternalSupportForm({ onSend }: any) {
  const [d, setD] = React.useState({ name: '', dni: '', content: '' });
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Completa el formulario. ATC te responderá a la brevedad.</p>
      <Field label="Nombre Completo" value={d.name} onChange={(e: any) => setD({ ...d, name: e.target.value })} placeholder="Juan Pérez" />
      <Field label="DNI o CE" value={d.dni} onChange={(e: any) => setD({ ...d, dni: e.target.value })} placeholder="77665544" />
      <div className="space-y-1.5">
        <label className="text-[9px] text-gray-500 uppercase font-black tracking-[0.2em]">Problema</label>
        <textarea value={d.content} onChange={e => setD({ ...d, content: e.target.value })} rows={4} placeholder="Describe el problema..."
          className="w-full bg-[#0a0a0a] border border-white/8 py-3 px-4 rounded-xl text-sm text-white outline-none focus:border-emerald-500/40 transition-colors resize-none" />
      </div>
      <button onClick={() => { if (d.name && d.dni && d.content) onSend(d); }}
        className="w-full bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest py-4 rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">
        Enviar a ATC
      </button>
    </div>
  );
}

function PaymentModal({ appt, onClose, onConfirm }: any) {
  const [method, setMethod] = React.useState<'YAPE' | 'PLIN' | 'CARD'>('YAPE');
  const [ref, setRef] = React.useState('');
  return (
    <Modal title="Procesar Pago" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-xs text-gray-500">Cita: <span className="text-white font-bold">{appt.patientName}</span> — S/ {appt.amount.toFixed(2)}</p>
        <div className="flex gap-2">
          {(['YAPE', 'PLIN', 'CARD'] as const).map(m => <button key={m} onClick={() => setMethod(m)} className={cn('flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all', method === m ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.07]')}>{m}</button>)}
        </div>
        <Field label="Referencia / Código" value={ref} onChange={(e: any) => setRef(e.target.value)} placeholder="TRX-12345" />
        <button onClick={() => onConfirm(appt.id, method, ref)} className="w-full bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest py-4 rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">
          Confirmar Pago S/ {appt.amount.toFixed(2)}
        </button>
      </div>
    </Modal>
  );
}

function VoucherModal({ appt, onClose }: any) {
  return (
    <Modal title="Comprobante Digital" onClose={onClose}>
      <div className="bg-white text-gray-900 rounded-2xl p-6 font-mono text-xs mb-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
        <h4 className="text-center font-black text-xl italic mb-4 pt-2 border-b border-gray-200 pb-4">MEDIAGENDAK</h4>
        <div className="space-y-2">
          <div className="flex justify-between"><span className="text-gray-400">Paciente:</span><span className="font-bold">{appt.patientName}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">DNI/CE:</span><span className="font-bold">{appt.patientDni}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Servicio:</span><span className="font-bold uppercase">{appt.service}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Fecha:</span><span className="font-bold">{appt.date}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Método:</span><span className="font-bold">{appt.paymentMethod}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Ref:</span><span className="font-bold">{appt.reference}</span></div>
          <div className="flex justify-between text-base pt-3 border-t border-gray-200 mt-3"><span className="font-black">TOTAL</span><span className="font-black text-emerald-600">S/ {appt.amount.toFixed(2)}</span></div>
        </div>
      </div>
      <button onClick={() => window.print()} className="w-full bg-white/[0.04] text-white font-black text-[10px] uppercase tracking-widest py-4 rounded-xl hover:bg-white/[0.07] transition-colors border border-white/8">
        Imprimir Voucher
      </button>
    </Modal>
  );
}

function CancelModal({ appt, onClose, onConfirm }: any) {
  const [reason, setReason] = React.useState('');
  return (
    <Modal title="Cancelar Cita" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex gap-3 bg-red-500/5 border border-red-500/15 rounded-xl p-4">
          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">Esta acción es irreversible y moverá la cita al historial de canceladas.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] text-gray-500 uppercase font-black tracking-[0.2em]">Motivo de cancelación</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Especifica el motivo..."
            className="w-full bg-[#0a0a0a] border border-white/8 py-3 px-4 rounded-xl text-sm text-white outline-none focus:border-red-500/40 transition-colors resize-none" />
        </div>
        <button onClick={() => onConfirm(appt.id, reason)} disabled={!reason.trim()}
          className="w-full bg-red-500/10 border border-red-500/20 text-red-400 font-black text-[10px] uppercase tracking-widest py-4 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-40">
          Confirmar Cancelación
        </button>
      </div>
    </Modal>
  );
}

function ReprogramModal({ appt, onClose, onConfirm }: any) {
  const [d, setD] = React.useState({ date: appt.date, time: appt.time });
  return (
    <Modal title="Reprogramar Cita" onClose={onClose}>
      <div className="space-y-5">
        <Field label="Nueva Fecha" type="date" value={d.date} onChange={(e: any) => setD({ ...d, date: e.target.value })} />
        <Field label="Nueva Hora" type="time" value={d.time} onChange={(e: any) => setD({ ...d, time: e.target.value })} />
        <button onClick={() => onConfirm(appt.id, d.date, d.time)}
          className="w-full bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest py-4 rounded-xl hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20">
          Actualizar Fecha
        </button>
      </div>
    </Modal>
  );
}

function CompleteModal({ appt, profile, onClose, onConfirm }: any) {
  const [medicoName, setMedicoName] = React.useState(profile.role === 'medico' ? profile.name : '');
  return (
    <Modal title="Completar Atención" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-xs text-gray-500">Paciente: <span className="text-white font-bold">{appt.patientName}</span></p>
        <Field label="Médico Tratante" value={medicoName} onChange={(e: any) => setMedicoName(e.target.value)} placeholder="Dr. Apellido" />
        <button onClick={() => onConfirm(appt.id, medicoName)} disabled={!medicoName.trim()}
          className="w-full bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest py-4 rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-40">
          Finalizar y Guardar en Historial
        </button>
      </div>
    </Modal>
  );
}

function RecipeModal({ appt, onClose, onConfirm }: any) {
  const [notes, setNotes] = React.useState(appt.notes || '');
  return (
    <Modal title="Receta Médica" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-xs text-gray-500">Paciente: <span className="text-white font-bold">{appt.patientName}</span></p>
        <div className="space-y-1.5">
          <label className="text-[9px] text-gray-500 uppercase font-black tracking-[0.2em]">Indicaciones / Receta</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} placeholder="Prescripciones, dosis, recomendaciones..."
            className="w-full bg-[#0a0a0a] border border-white/8 py-3 px-4 rounded-xl text-sm text-white outline-none focus:border-emerald-500/40 transition-colors resize-none" />
        </div>
        <button onClick={() => onConfirm(appt.id, notes)}
          className="w-full bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest py-4 rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">
          Guardar Receta
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// CREATE APPT MODAL (TRIAGE DUAL INTELIGENTE)
// ─────────────────────────────────────────────────────────────
function CreateApptModal({ profile, users, onClose, onConfirm }: any) {
  const [step, setStep] = React.useState(1);
  const [symptoms, setSymptoms] = React.useState('');
  const [triageResult, setTriageResult] = React.useState<{ urgency: Urgency; specialization: string; reason: string } | null>(null);
  const [triageSource, setTriageResultSource] = React.useState<'IA' | 'LOCAL'>('LOCAL');
  const [loading, setLoading] = React.useState(false);
  const [d, setD] = React.useState({ date: '', time: '' });
  const [selectedPatient, setSelectedPatient] = React.useState<any>(null);
  const [customPatientName, setCustomPatientName] = React.useState('');
  const [customPatientDni, setCustomPatientDni] = React.useState('');

  const isAdmin = profile.role === 'admin';

  const runTriage = async () => {
    if (!symptoms.trim()) return;
    setLoading(true);

    const envApiKey = import.meta.env.VITE_GEMINI_API_KEY|| "";

    try {
      if (envApiKey) {
        // Ejecutar Triaje mediante la IA de Google Gemini
        const aiResult = await callGeminiTriage(symptoms, envApiKey);
        setTriageResult({
          urgency: aiResult.urgency,
          specialization: aiResult.specialization,
          reason: aiResult.reason
        });
        setTriageResultSource('IA');
      } else {
        // Fallback inmediato al motor clínico local optimizado
        const localResult = smartLocalTriage(symptoms);
        setTriageResult(localResult);
        setTriageResultSource('LOCAL');
      }
      setStep(2);
    } catch (error) {
      console.warn("Fallo el triaje por IA, activando respaldo local...", error);
      const localResult = smartLocalTriage(symptoms);
      setTriageResult(localResult);
      setTriageResultSource('LOCAL');
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const price = triageResult ? (SPECIALIZATION_PRICES[triageResult.specialization] || DEFAULT_PRICE) : DEFAULT_PRICE;

  const getPatientData = () => {
    if (!isAdmin) {
      return { name: profile.name, dni: profile.dni || '', userId: profile.id };
    } else {
      if (selectedPatient) {
        return { name: selectedPatient.name, dni: selectedPatient.dni, userId: selectedPatient.id };
      } else {
        return { name: customPatientName.toUpperCase(), dni: customPatientDni, userId: `guest_${Date.now()}` };
      }
    }
  };

  return (
    <Modal title="Agendar Cita — Triaje Clínico" onClose={onClose}>
      <div className="space-y-5">
        {step === 1 && (
          <>
            {isAdmin && (
              <div className="space-y-3">
                <label className="text-[9px] text-gray-500 uppercase font-black tracking-[0.2em]">Seleccionar Paciente (opcional)</label>
                <select
                  className="w-full bg-[#0a0a0a] border border-white/8 py-3 px-4 rounded-xl text-sm text-white outline-none focus:border-emerald-500/40"
                  value={selectedPatient?.id || ''}
                  onChange={e => {
                    const id = e.target.value;
                    if (id === 'new') {
                      setSelectedPatient(null);
                    } else {
                      const patient = users.find((u: any) => u.id === id && u.role === 'patient');
                      setSelectedPatient(patient);
                    }
                  }}
                >
                  <option value="">-- Seleccionar paciente registrado --</option>
                  {users.filter((u: any) => u.role === 'patient').map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} (DNI: {p.dni})</option>
                  ))}
                  <option value="new">+ Nuevo paciente (ingresar manual)</option>
                </select>
                {!selectedPatient && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <Field label="Nombre y Apellido" value={customPatientName} onChange={(e: any) => setCustomPatientName(e.target.value)} placeholder="Juan Pérez" />
                    <Field label="DNI/CE" value={customPatientDni} onChange={(e: any) => setCustomPatientDni(e.target.value)} placeholder="77665544" />
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-3 bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
              <Activity size={14} className="text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-300/80 leading-relaxed">
                Describe con tus propias palabras qué sientes. El sistema determinará la especialidad idónea y la gravedad del caso de forma automática.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] text-gray-500 uppercase font-black tracking-[0.2em]">Síntomas y Dolencia</label>
              <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} rows={5} placeholder="Ej: Siento un dolor fuerte y punzante en el pecho que se me corre al brazo izquierdo, me cuesta mucho respirar..."
                className="w-full bg-[#0a0a0a] border border-white/8 py-3 px-4 rounded-xl text-sm text-white outline-none focus:border-emerald-500/40 transition-colors resize-none" />
            </div>
            <button onClick={runTriage} disabled={loading || !symptoms.trim()}
              className="w-full bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest py-4 rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer">
              {loading ? <><RefreshCw size={14} className="animate-spin" /> Procesando Triaje...</> : <><Activity size={14} /> Iniciar Triaje Médico</>}
            </button>
          </>
        )}

        {step === 2 && triageResult && (
          <>
            <div className={cn('p-6 rounded-xl border text-center', triageResult.urgency === 'ALTA' ? 'bg-red-500/5 border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.06)]' : triageResult.urgency === 'MEDIA' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20')}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[8px] uppercase tracking-widest text-gray-500">Origen: <strong className={triageSource === 'IA' ? 'text-blue-400' : 'text-emerald-400'}>{triageSource}</strong></span>
                <UrgencyBadge u={triageResult.urgency} />
              </div>
              <p className="text-[9px] uppercase font-black tracking-widest text-gray-500 mb-1">Especialidad Recomendada</p>
              <p className="text-white font-black text-xl">{triageResult.specialization}</p>
              <p className="text-emerald-400 font-black text-base mt-1.5">Costo: S/ {price.toFixed(2)}</p>

              <div className="mt-4 p-3 bg-white/[0.015] border border-white/5 rounded-lg text-left">
                <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Análisis Clínico:</span>
                <p className="text-[10px] text-gray-300 leading-relaxed italic">"{triageResult.reason}"</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha de Atención" type="date" value={d.date} onChange={(e: any) => setD(p => ({ ...p, date: e.target.value }))} />
              <Field label="Hora Solicitada" type="time" value={d.time} onChange={(e: any) => setD(p => ({ ...p, time: e.target.value }))} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => {
                if (!d.date || !d.time) return alert("Selecciona fecha y hora.");
                const patient = getPatientData();
                onConfirm({
                  patientName: patient.name,
                  patientDni: patient.dni,
                  userId: patient.userId,
                  service: triageResult.specialization,
                  urgency: triageResult.urgency,
                  symptoms,
                  ...d
                }, true);
              }}
                className="flex-1 bg-emerald-500 text-black font-black text-[9px] uppercase tracking-widest py-4 rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 cursor-pointer">
                Pagar S/ {price.toFixed(2)}
              </button>
              <button onClick={() => {
                if (!d.date || !d.time) return alert("Selecciona fecha y hora.");
                const patient = getPatientData();
                onConfirm({
                  patientName: patient.name,
                  patientDni: patient.dni,
                  userId: patient.userId,
                  service: triageResult.specialization,
                  urgency: triageResult.urgency,
                  symptoms,
                  ...d
                }, false);
              }}
                className="flex-1 border border-white/10 text-white font-black text-[9px] uppercase tracking-widest py-4 rounded-xl hover:bg-white/[0.05] transition-colors cursor-pointer">
                Pago en Caja
              </button>
            </div>
            <button onClick={() => setStep(1)} className="w-full text-[9px] text-gray-600 hover:text-gray-400 uppercase tracking-widest transition-colors">← Re-evaluar Síntomas</button>
          </>
        )}
      </div>
    </Modal>
  );
}

function CreateUserModal({ onClose, onConfirm }: any) {
  const [d, setD] = React.useState({ name: '', dni: '', username: '', password: '', role: 'patient' as Role, phone: '', email: '', specialization: '', restDays: [] as string[] });
  const toggleRest = (day: string) => setD(p => ({ ...p, restDays: p.restDays.includes(day) ? p.restDays.filter(x => x !== day) : [...p.restDays, day] }));
  return (
    <Modal title="Nuevo Usuario" onClose={onClose}>
      <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
        <div className="flex gap-1.5 bg-[#0a0a0a] p-1.5 rounded-xl border border-white/5">
          {(['admin', 'medico', 'patient'] as Role[]).map(r => (
            <button key={r} onClick={() => setD(p => ({ ...p, role: r }))}
              className={cn('flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase transition-all', d.role === r ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-gray-500 hover:text-white')}>
              {r}
            </button>
          ))}
        </div>
        <Field label="Nombre Completo" value={d.name} onChange={(e: any) => setD(p => ({ ...p, name: e.target.value }))} placeholder="Juan Pérez" />
        {d.role === 'patient' ? (
          <Field label="DNI o CE" value={d.dni} onChange={(e: any) => setD(p => ({ ...p, dni: e.target.value }))} placeholder="77665544" maxLength={15} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Usuario" value={d.username} onChange={(e: any) => setD(p => ({ ...p, username: e.target.value }))} placeholder="medico01" />
            <Field label="Contraseña" type="password" value={d.password} onChange={(e: any) => setD(p => ({ ...p, password: e.target.value }))} placeholder="••••••" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono" type="tel" value={d.phone} onChange={(e: any) => setD(p => ({ ...p, phone: e.target.value }))} placeholder="987654321" />
          <Field label="Correo" type="email" value={d.email} onChange={(e: any) => setD(p => ({ ...p, email: e.target.value }))} placeholder="correo@ejemplo.com" />
        </div>
        {d.role === 'medico' && (
          <>
            <div className="space-y-1.5">
              <label className="text-[9px] text-gray-500 uppercase font-black tracking-[0.2em]">Especialidad</label>
              <select value={d.specialization} onChange={e => setD(p => ({ ...p, specialization: e.target.value }))}
                className="w-full bg-[#0a0a0a] border border-white/8 py-3 px-4 rounded-xl text-white text-sm outline-none focus:border-emerald-500/40">
                <option value="">Seleccionar...</option>
                {Object.keys(SPECIALIZATION_PRICES).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] text-gray-500 uppercase font-black tracking-[0.2em]">Días de Descanso</label>
              <div className="flex flex-wrap gap-1.5">
                {DIAS_SEMANA.map(d2 => (
                  <button key={d2} type="button" onClick={() => toggleRest(d2)}
                    className={cn('px-3 py-1.5 rounded-lg text-[9px] font-bold border transition-all', d.restDays.includes(d2) ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-white/[0.03] text-gray-600 border-white/5 hover:border-white/10')}>
                    {d2}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <button onClick={() => onConfirm(d)}
          className="w-full bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest py-4 rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 mt-2">
          Crear Usuario
        </button>
      </div>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onConfirm }: any) {
  const [d, setD] = React.useState({ name: user.name, password: '', phone: user.phone || '', email: user.email || '', specialization: user.specialization || '', restDays: user.restDays || [] as string[] });
  const toggleRest = (day: string) => setD(p => ({ ...p, restDays: p.restDays.includes(day) ? p.restDays.filter((x: string) => x !== day) : [...p.restDays, day] }));
  return (
    <Modal title="Editar Usuario" onClose={onClose}>
      <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
        <p className="text-[9px] text-gray-500 uppercase font-black">Rol: <span className="text-emerald-400">{user.role}</span></p>
        <Field label="Nombre" value={d.name} onChange={(e: any) => setD(p => ({ ...p, name: e.target.value }))} />
        {user.role !== 'patient' && <Field label="Nueva Contraseña (dejar vacío para no cambiar)" type="password" value={d.password} onChange={(e: any) => setD(p => ({ ...p, password: e.target.value }))} placeholder="••••••" />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono" value={d.phone} onChange={(e: any) => setD(p => ({ ...p, phone: e.target.value }))} />
          <Field label="Correo" type="email" value={d.email} onChange={(e: any) => setD(p => ({ ...p, email: e.target.value }))} />
        </div>
        {user.role === 'medico' && (
          <>
            <div className="space-y-1.5">
              <label className="text-[9px] text-gray-500 uppercase font-black tracking-[0.2em]">Especialidad</label>
              <select value={d.specialization} onChange={e => setD(p => ({ ...p, specialization: e.target.value }))}
                className="w-full bg-[#0a0a0a] border border-white/8 py-3 px-4 rounded-xl text-white text-sm outline-none">
                <option value="">Seleccionar...</option>
                {Object.keys(SPECIALIZATION_PRICES).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] text-gray-500 uppercase font-black tracking-[0.2em]">Días de Descanso</label>
              <div className="flex flex-wrap gap-1.5">
                {DIAS_SEMANA.map(day => (
                  <button key={day} type="button" onClick={() => toggleRest(day)}
                    className={cn('px-3 py-1.5 rounded-lg text-[9px] font-bold border transition-all', d.restDays.includes(day) ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-white/[0.03] text-gray-600 border-white/5 hover:border-white/10')}>
                    {day}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <button onClick={() => { const data: any = { ...d, name: d.name.toUpperCase() }; if (!d.password.trim()) delete data.password; onConfirm(data); }}
          className="w-full bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest py-4 rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">
          Guardar Cambios
        </button>
      </div>
    </Modal>
  );
}

function ScheduleModal({ onClose, onConfirm }: any) {
  const [d, setD] = React.useState({ days: [] as string[], type: 'DISPONIBLE', startTime: '08:00', endTime: '16:00', specialty: 'Medicina General' });
  return (
    <Modal title="Agregar Turno / Descanso" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex gap-1.5 bg-[#0a0a0a] p-1.5 rounded-xl border border-white/5">
          {['DISPONIBLE', 'DESCANSO'].map(t => (
            <button key={t} onClick={() => setD(p => ({ ...p, type: t }))}
              className={cn('flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase transition-all', d.type === t ? t === 'DESCANSO' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-gray-500 hover:text-white')}>
              {t === 'DISPONIBLE' ? '✅ Disponible' : '🔴 Día Libre'}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <label className="text-[9px] text-gray-500 uppercase font-black tracking-[0.2em]">Días (selección múltiple)</label>
          <div className="flex flex-wrap gap-1.5">
            {DIAS_SEMANA.map(day => (
              <button key={day} type="button" onClick={() => setD(p => ({ ...p, days: p.days.includes(day) ? p.days.filter(x => x !== day) : [...p.days, day] }))}
                className={cn('px-3 py-1.5 rounded-lg text-[9px] font-bold border transition-all', d.days.includes(day) ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' : 'bg-white/[0.03] text-gray-600 border-white/5 hover:border-white/10')}>
                {day}
              </button>
            ))}
          </div>
        </div>
        {d.type === 'DISPONIBLE' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hora Inicio" type="time" value={d.startTime} onChange={(e: any) => setD(p => ({ ...p, startTime: e.target.value }))} />
              <Field label="Hora Fin" type="time" value={d.endTime} onChange={(e: any) => setD(p => ({ ...p, endTime: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] text-gray-500 uppercase font-black tracking-[0.2em]">Especialidad</label>
              <select value={d.specialty} onChange={e => setD(p => ({ ...p, specialty: e.target.value }))}
                className="w-full bg-[#0a0a0a] border border-white/8 py-3 px-4 rounded-xl text-white text-sm outline-none">
                {Object.keys(SPECIALIZATION_PRICES).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </>
        )}
        <button onClick={() => onConfirm(d)} disabled={d.days.length === 0}
          className="w-full bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest py-4 rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-40">
          Confirmar Turno{d.days.length > 1 ? `s (${d.days.length})` : ''}
        </button>
      </div>
    </Modal>
  );
}
