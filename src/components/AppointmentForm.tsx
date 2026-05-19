import React, { useState } from "react";
import { firebaseService, Appointment } from "../services/firebaseService";

interface AppointmentFormProps {
    onAppointmentCreated: () => void;
}

export default function AppointmentForm({ onAppointmentCreated }: AppointmentFormProps) {
    const [service, setService] = useState("Consulta General");
    const [date, setDate] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"YAPE" | "PLIN" | "CARD" | "CASH">("YAPE");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date) return alert("Por favor, selecciona una fecha y hora.");

        setLoading(true);
        try {
            const appointmentData: Appointment = {
                uid: "usr_kelvin_2026", // ID de prueba para entorno local
                patientName: "Kelvin Cardoza",
                patientEmail: "cardozabrunokelvin@gmail.com",
                date: date,
                service: service,
                amount: service === "Consulta General" ? 50 : 120, // Precios fijos en Soles
                paymentMethod: paymentMethod,
                paymentStatus: "PENDING"
            };

            // 1. Guardar la información base en Firestore
            const docRef = await firebaseService.createAppointment(appointmentData);

            // 2. Enviar los datos al backend local (server.ts) para simular el pago
            const response = await fetch("/api/payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    appointmentId: docRef.id,
                    paymentMethod: paymentMethod,
                    amount: appointmentData.amount
                })
            });

            const paymentResult = await response.json();

            if (paymentResult.success) {
                alert(`¡Cita Registrada Exitosamente!\n\nID Cita: ${docRef.id}\nReferencia Pago: ${paymentResult.reference}\nEstado: ${paymentResult.status}`);
                setDate("");
                onAppointmentCreated();
            } else {
                alert("El registro falló al procesar el pago simulado.");
            }
        } catch (error) {
            console.error("Error completo del proceso:", error);
            alert("Hubo un error al intentar guardar la cita.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full bg-white rounded-2xl shadow-xl p-6 space-y-5 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Nueva Cita Médica</h2>

            <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Especialidad / Servicio</label>
                <select
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 p-3 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-gray-700"
                >
                    <option value="Consulta General">Consulta General (S/. 50.00)</option>
                    <option value="Odontología - Limpieza">Odontología - Limpieza (S/. 120.00)</option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Fecha y Hora de Atención</label>
                <input
                    type="datetime-local"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 p-3 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-700"
                />
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Medio de Pago</label>
                <div className="grid grid-cols-2 gap-3">
                    {(["YAPE", "PLIN", "CARD", "CASH"] as const).map((method) => (
                        <label
                            key={method}
                            className={`flex items-center space-x-2 border p-3 rounded-xl cursor-pointer transition-all ${paymentMethod === method
                                    ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                                    : "border-gray-200 hover:bg-gray-50 text-gray-600"
                                }`}
                        >
                            <input
                                type="radio"
                                name="payment"
                                checked={paymentMethod === method}
                                onChange={() => setPaymentMethod(method)}
                                className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-bold">{method}</span>
                        </label>
                    ))}
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white p-3.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md disabled:bg-gray-400 cursor-pointer text-center"
            >
                {loading ? "Procesando Registro..." : "Confirmar Cita Médica"}
            </button>
        </form>
    );
}