import { db } from "../lib/firebase";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";

export interface Appointment {
  id?: string;
  uid: string;
  patientName: string;
  patientEmail: string;
  date: string;
  service: string;
  amount: number;
  paymentMethod: "YAPE" | "PLIN" | "CARD" | "CASH";
  paymentStatus: "PENDING" | "PAID";
  reference?: string;
}

export const firebaseService = {
  // Guarda una nueva cita médica en la colección 'appointments'
  async createAppointment(appointment: Appointment) {
    return await addDoc(collection(db, "appointments"), appointment);
  },

  // Obtiene el historial de citas de un paciente específico
  async getAppointmentsByUser(uid: string) {
    const q = query(collection(db, "appointments"), where("uid", "==", uid));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Appointment[];
  }
};