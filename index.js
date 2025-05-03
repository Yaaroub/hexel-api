import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();

// CORS-Konfiguration
const allowedOrigins = [
  'http://localhost:3001',
  'https://hexel-tech.de',
  'https://hexel-api.onrender.com'
];

app.use(cors({
  origin: allowedOrigins,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

// Preflight-Handler
app.options('*', cors());

// Middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Rate Limiting
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Zu viele Anfragen von dieser IP, bitte später erneut versuchen'
});

// SMTP-Transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.ionos.com',
    port: parseInt(process.env.EMAIL_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    logger: process.env.NODE_ENV === 'development',
    debug: process.env.NODE_ENV === 'development'
  });
};

// Validation Middleware
const validateContactRequest = (req, res, next) => {
  const { name, email, message } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).json({ 
      success: false,
      message: 'Bitte alle Felder ausfüllen' 
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ 
      success: false,
      message: 'Ungültige Email-Adresse' 
    });
  }

  next();
};

// Kontakt-Route
app.post('/api/contact', contactLimiter, validateContactRequest, async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Kontaktformular" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      replyTo: `"${name}" <${email}>`,
      subject: `Neue Nachricht von ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nNachricht:\n${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2 style="color: #333;">Neue Kontaktanfrage</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Nachricht:</strong></p>
          <div style="background: #f5f5f5; padding: 10px; border-radius: 5px;">
            ${message.replace(/\n/g, '<br>')}
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    res.status(200).json({
      success: true,
      message: 'Nachricht erfolgreich gesendet! Wir melden uns bald.'
    });

  } catch (error) {
    console.error('Mail Error:', error);
    const statusCode = error.responseCode || 500;
    const errorMessage = error.code === 'EAUTH' 
      ? 'Authentifizierungsfehler' 
      : 'Serverfehler beim Versenden der Nachricht';

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Error Handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Interner Serverfehler'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
  console.log(`Umgebung: ${process.env.NODE_ENV || 'development'}`);
});