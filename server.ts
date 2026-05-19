import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Mock Payment Processing Endpoint
  app.post("/api/payments", async (req, res) => {
    const { appointmentId, paymentMethod, amount } = req.body;
    
    if (!appointmentId || !paymentMethod || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // In a real app, we would verify the appointment in Firestore here
    // and process the payment via a gateway (Stripe, etc.)
    
    console.log(`Processing payment for appointment ${appointmentId} via ${paymentMethod} for amount ${amount}`);
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    res.json({ 
      success: true, 
      reference: `REF-${Math.random().toString(36).substring(7).toUpperCase()}`,
      status: "PAID"
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
