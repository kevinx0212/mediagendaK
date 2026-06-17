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

const DEMO_APPOINTMENTS: Appointment[] = [
  { id: 'a1', patientName: 'CARLOS MENDOZA', patientDni: '11223344', date: today, time: '08:30', service: 'Cardiología', paymentStatus: 'PENDING', status: 'PENDING', amount: 120, userId: 'p1', urgency: 'ALTA', symptoms: 'Dolor intenso en el pecho y dificultad para respirar.' },
  { id: 'a2', patientName: 'ANA TORRES', patientDni: '22334455', date: today, time: '09:00', service: 'Neurología', paymentStatus: 'PAID', status: 'PAID', amount: 130, userId: 'p2', urgency: 'ALTA', symptoms: 'Pérdida repentina de visión y mareos severos.', paymentMethod: 'YAPE', reference: 'TRX-9981' },
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

function smartLocalTriage(symptoms: string): { urgency: Urgency; specialization: string; reason: string } {
  const s = symptoms.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const altaKeywords = [
    'cuchillo', 'arma', 'blanca', 'bala', 'disparo', 'penetrante', 'apuñalo', 'cuchillada', 'traspaso',
    'sangre mucha', 'desangrando', 'sangrado masivo', 'hemorragia', 'perdi sangre', 'sangrando mucho',
    'infarto', 'pecho', 'corazon', 'paro', 'respirar', 'asfixia', 'ahogo', 'aire', 
    'desmayo', 'inconsciente', 'perdi el conocimiento', 'amputa', 'morir', 'morirse'
  ];

  const mediaKeywords = [
    'fractura', 'roto', 'tobillo', 'hueso', 'esguince', 'torcedura', 'doble', 'dedo', 'mano', 'pie',
    'fiebre alta', 'vomito', 'quemadura', 'dolor fuerte', 'corte', 'herida', 'embarazo', 'gineco',
    'infeccion', 'gripe', 'tos severa'
  ];

  let urgency: Urgency = 'BAJA';
  let reason = "Los síntomas descritos parecen de baja complejidad bajo el protocolo local. Se deriva a revisión general.";
  let specialization = 'Medicina General';

  if (altaKeywords.some(k => s.includes(k))) {
    urgency = 'ALTA';
    reason = "¡CRÍTICO (LOCAL)! Sospecha de trauma grave por penetración, hemorragia masiva o compromiso cardiorrespiratorio inminente.";
    if (s.includes('pierna') || s.includes('brazo') || s.includes('hueso') || s.includes('cuchillo')) {
      specialization = 'Traumatología';
    } else if (s.includes('corazon') || s.includes('pecho') || s.includes('infarto')) {
      specialization = 'Cardiología';
    } else if (s.includes('ojo') || s.includes('vista')) {
      specialization = 'Oftalmología';
    } else {
      specialization = 'Neurología';
    }
  } else if (mediaKeywords.some(k => s.includes(k))) {
    urgency = 'MEDIA';
    reason = "Urgencia moderada local. Se identifican lesiones corporales estables o cuadros agudos dolorosos.";
    if (s.includes('hueso') || s.includes('fractura') || s.includes('tobillo') || s.includes('esguince')) {
      specialization = 'Traumatología';
    } else if (s.includes('embarazo') || s.includes('gineco')) {
      specialization = 'Ginecología';
    } else if (s.includes('piel') || s.includes('mancha')) {
      specialization = 'Dermatología';
    } else if (s.includes('nino') || s.includes('bebe') || s.includes('pediatra')) {
      specialization = 'Pediatría';
    }
  }

  return { urgency, specialization, reason };
}

async function callGeminiTriage(symptoms: string, apiKey: string): Promise<{ urgency: Urgency; specialization: string; reason: string }> {
  const systemPrompt = `Actúa como un médico experto de guardia en el triaje de emergencias de una clínica hospitalaria.
Analiza con estricto criterio médico la descripción de los síntomas que te dará el paciente.

Clasifica la urgencia en uno de estos tres niveles obligatorios:
- ALTA: Amenaza inminente para la vida o pérdida de un miembro/órgano. INCLUYE SIEMPRE: heridas por armas blancas (cuchillos), objetos que atraviesan la carne o extremidades (piernas, brazos), heridas de bala, dolores de pecho opresivos (infartos), pérdidas de conocimiento o asfixias.
- MEDIA: Fracturas estables, dolores severos controlados, fiebres elevadas sin convulsiones, cortes superficiales estables.
- BAJA: Resfriados, síntomas leves, controles de rutina, curaciones menores.

Selecciona la especialidad de esta lista cerrada: 'Cardiología', 'Traumatología', 'Pediatría', 'Dermatología', 'Medicina General', 'Neurología', 'Ginecología', 'Oftalmología'.
*Nota: Todo objeto punzocortante que penetre piernas, brazos o espalda debe asignarse inmediatamente a 'Traumatología' con urgencia 'ALTA'.*

Responde ÚNICAMENTE con un objeto JSON plano, sin bloques de código ni texto markdown:
{
  "urgency": "ALTA" | "MEDIA" | "BAJA",
  "specialization": "Especialidad sugerida",
  "reason": "Explicación breve de la decisión médica tomada"
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: `Síntomas: "${symptoms}"` }] }],
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

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return JSON.parse(text);
    } catch (err) {
      lastError = err;
      await delay(Math.pow(2, attempt) * 1000);
    }
  }
  throw lastError || new Error("Fallo de conexión.");
}

const UrgencyBadge = ({ u }: { u?: Urgency }) => {
  if (!u) return null;
  const s = { ALTA: 'bg-red-500/10 text-red-400 border-red-500/20', MEDIA: 'bg-amber-500/10 text-amber-400 border-amber-500/20', BAJA: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  return <span className={cn('px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border', s[u])}>{u}</span>;
};

const StatusBadge = ({ s }: { s: ApptStatus }) => {
  const styles = { PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20', PAID: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20', COMPLETED: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
  return <span className={cn('px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border', styles[s])}>{s}</span>;
};

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

  const [authTab, setAuthTab] = useState<Role>('admin');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formDni, setFormDni] = useState('');
  const [authError, setAuthError] = useState('');

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

  useEffect(() => {
    if (loading) return;
    localStorage.setItem('mg_users', JSON.stringify(users));
    localStorage.setItem('mg_appts', JSON.stringify(appointments));
    localStorage.setItem('mg_schedules', JSON.stringify(schedules));
    localStorage.setItem('mg_messages', JSON.stringify(messages));
  }, [users, appointments, schedules, messages, loading]);

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

  const createAppointment = async (data: any, payNow: boolean) => {
    setLoading(true);
    let finalUrgency: Urgency = 'BAJA';
    let finalService = data.service || 'Medicina General';
    let finalReason = "Evaluación médica estándar programada de forma directa.";

    const keyAI = import.meta.env.VITE_GEMINI_API_KEY || "";

    if (data.symptoms && data.symptoms.trim() !== "") {
      try {
        const resAI = await callGeminiTriage(data.symptoms, keyAI);
        finalUrgency = resAI.urgency;
        finalService = resAI.specialization;
        finalReason = resAI.reason;
      } catch (error) {
        console.warn("Fallo en la IA, usando motor local de respaldo:", error);
        const resLocal = smartLocalTriage(data.symptoms);
        finalUrgency = resLocal.urgency;
        finalService = resLocal.specialization;
        finalReason = resLocal.reason;
      }
    }

    const finalPrice = SPECIALIZATION_PRICES[finalService] || DEFAULT_PRICE;

    const na: Appointment = {
      id: `a${Date.now()}`,
      patientName: data.patientName.toUpperCase(),
      patientDni: data.patientDni,
      date: data.date,
      time: data.time,
      service: finalService,
      paymentStatus: 'PENDING',
      status: 'PENDING',
      amount: finalPrice,
      userId: data.userId || 'guest',
      urgency: finalUrgency,
      symptoms: data.symptoms,
      notes: `Diagnóstico IA: ${finalReason}`
    };

    setAppointments(p => [na, ...p]);
    setLoading(false);
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

  const addSchedule = (data: any) => {
    const news = data.days.map((day: string) => ({ id: `s${Date.now()}${day}`, medicoId: profile?.id, medicoName: profile?.name, day, startTime: data.startTime, endTime: data.endTime, type: data.type, specialty: data.specialty }));
    setSchedules(p => [...p, ...news]);
    setScheduleDlg(false);
  };

  const deleteSchedule = (id: string) => { if (profile?.role !== 'admin') return; setSchedules(p => p.filter(s => s.id !== id)); };

  const sendMessage = (d: any) => {
    setMessages(p => [{ id: `m${Date.now()}`, senderName: d.name, senderDni: d.dni, content: d.content, date: new Date().toISOString(), isRead: false }, ...p]);
  };

  const replyMessage = (id: string, reply: string) => {
    setMessages(p => p.map(m => m.id === id ? { ...m, reply, isRead: true } : m));
  };

  const activeAppts = appointments.filter(a => a.status !== 'CANCELLED' && a.status !== 'COMPLETED');
  const myAppts = profile?.role === 'patient' ? appointments.filter(a => a.userId === profile.id) : activeAppts;

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060606] flex flex-col items-center justify-center font-sans text-gray-400">
        <RefreshCw size={36} className="animate-spin text-emerald-500 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Procesando Diagnóstico Clínico vía IA...</p>
      </div>
    );
  }

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
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

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
              <span className="text-[8px] text-emerald-500 font-black uppercase tracking-widest">Pro AI</span>
            </div>
          </div>
          <nav className="space-y-1">
            {profile.role === 'patient' && <>
              <SideItem id="citas" icon={<Calendar size={16} />} label="Mis Citas" view={currentView} setView={setCurrentView} />
              <SideItem id="historial-paciente" icon={<History size={16} />} label="Mi Historial" view={currentView} setView={setCurrentView} />
              <SideItem id="pagos" icon={<CreditCard size={16} />} label="Pagos y Vouchers" view={currentView} setView={setCurrentView} />
            </>}
            {profile.role !== 'patient' && <>
              <SideItem id="dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" view={currentView} setView={setCurrentView} />
              <SideItem id="citas" icon={<Activity size={16} />} label="Citas Activas" view={currentView} setView={setCurrentView} />
              {profile.role === 'admin' && <>
                <SideItem id="historial" icon={<Archive size={16} />} label="Historial Global" view={currentView} setView={setCurrentView} />
                <SideItem id="usuarios" icon={<Users size={16} />} label="Usuarios" view={currentView} setView={setCurrentView} />
              </>}
            </>}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-white/5">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-red-400 text-[10px] font-bold py-2.5 bg-white/[0.03] hover:bg-red-500/10 rounded-lg border border-white/5 hover:border-red-500/20 transition-all uppercase tracking-widest">
            <LogOut size={14} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-40">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white">{currentView.replace('-', ' ')}</h2>
          <button onClick={() => setCreateApptDlg(true)} className="bg-emerald-500 text-black px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors">
            <Plus size={13} /> Nueva Cita de Triaje
          </button>
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
          </div>
        </div>
      </main>

      <AnimatePresence>
        {createApptDlg && <CreateApptModal profile={profile} users={users} onClose={() => setCreateApptDlg(false)} onConfirm={createAppointment} />}
        {payDlg && <PaymentModal appt={payDlg} onClose={() => setPayDlg(null)} onConfirm={processPayment} />}
      </AnimatePresence>
    </div>
  );
}

function SideItem({ id, icon, label, view, setView }: any) {
  const active = view === id;
  return (
    <button onClick={() => setView(id)}
      className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold transition-all relative', active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' : 'text-gray-500 hover:bg-white/[0.03] hover:text-gray-300 border border-transparent')}>
      <span className={active ? 'text-emerald-400' : 'text-gray-600'}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
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

// Visualizaciones internas simplificadas
function DashboardView({ appointments }: any) {
  const paid = appointments.filter((a: any) => a.paymentStatus === 'PAID');
  const totalIncome = paid.reduce((s: number, a: any) => s + a.amount, 0);
  const pending = appointments.filter((a: any) => a.status === 'PENDING').length;
  const alta = appointments.filter((a: any) => a.urgency === 'ALTA' && a.status !== 'CANCELLED').length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-5">
        <StatCard label="Ingresos Verificados" value={`S/ ${totalIncome.toFixed(2)}`} color="text-emerald-400" />
        <StatCard label="Citas Pendientes" value={pending} color="text-amber-400" />
        <StatCard label="Urgencias Críticas (IA)" value={alta} color="text-red-400" />
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

function CitasView({ appointments, searchTerm, setSearchTerm }: any) {
  return (
    <div className="space-y-4 bg-[#111] p-6 border border-white/5 rounded-2xl">
      <div className="flex items-center gap-4">
        <Search size={16} className="text-gray-500" />
        <input type="text" placeholder="Buscar paciente por nombre o DNI..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none text-sm outline-none w-full text-white" />
      </div>
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-[9px] uppercase font-black text-gray-500 tracking-wider">
              <th className="py-3">Paciente</th>
              <th className="py-3">Especialidad Recomendada</th>
              <th className="py-3">Severidad Triage</th>
              <th className="py-3">Estado</th>
              <th className="py-3">Detalle del Diagnóstico</th>
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-white/5">
            {appointments.map((a: any) => (
              <tr key={a.id} className="hover:bg-white/[0.01]">
                <td className="py-4 font-bold text-white">{a.patientName}</td>
                <td className="py-4 text-gray-400">{a.service}</td>
                <td className="py-4"><UrgencyBadge u={a.urgency} /></td>
                <td className="py-4"><StatusBadge s={a.status} /></td>
                <td className="py-4 text-[11px] italic text-emerald-400/90 max-w-xs truncate">{a.notes || a.symptoms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateApptModal({ onClose, onConfirm, profile }: any) {
  const [symptoms, setSymptoms] = useState('');
  const [name, setName] = useState(profile?.role === 'patient' ? profile.name : '');
  const [dni, setDni] = useState(profile?.role === 'patient' ? profile.dni : '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({ patientName: name, patientDni: dni, symptoms, date: today, time: "12:00", userId: profile?.id }, false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/5 p-8 rounded-3xl w-full max-w-md space-y-4">
        <h3 className="text-sm font-black uppercase text-white tracking-widest">Ingreso de Paciente — Triaje IA</h3>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nombre del Paciente" value={name} onChange={(e: any) => setName(e.target.value)} required />
          <Field label="DNI del Paciente" value={dni} onChange={(e: any) => setDni(e.target.value)} required />
          <div className="space-y-1.5">
            <label className="text-[9px] text-gray-500 uppercase font-black tracking-[0.2em]">Sintomatología Actual</label>
            <textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} required placeholder="Ej: Me traspasó un cuchillo la pierna y pierdo mucha sangre..." className="w-full bg-[#0a0a0a] border border-white/8 h-28 p-4 rounded-xl text-white text-sm outline-none focus:border-emerald-500/40" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase text-gray-400 tracking-wider">Cancelar</button>
            <button type="submit" className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20">Ejecutar Triaje</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PaymentModal({ appt, onClose }: any) { return null; }
