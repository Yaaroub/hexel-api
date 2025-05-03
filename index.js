import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Erlaubte Ursprünge für CORS
const allowedOrigins = [
  'http://localhost:3001',
  'https://hexel-tech.de'
];

// Erweiterte CORS-Konfiguration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS-Fehler: Herkunft nicht erlaubt'));
    }
  },
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}));

// Sicherheitsmiddleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request Validation Middleware
const validateContactRequest = (req, res, next) => {
  const { name, email, message } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).json({ 
      message: 'Bitte alle Felder ausfüllen' 
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ 
      message: 'Ungültige Email-Adresse' 
    });
  }

  next();
};

// Rate Limiting (optional)
import rateLimit from 'express-rate-limit';
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 5, // Maximal 5 Anfragen pro IP
  message: 'Zu viele Anfragen von dieser IP, bitte später erneut versuchen'
});

app.post('/api/contact', contactLimiter, validateContactRequest, async (req, res) => {
  const { name, email, message } = req.body;

  // Debug-Modus
  if (process.env.NODE_ENV === 'development') {
    console.log('Empfangene Daten:', { name, email, message });
  }

  // Mail Transporter konfigurieren (sicherere Version)
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.ionos.de',
    port: parseInt(process.env.EMAIL_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      minVersion: 'TLSv1.2', // Sicherere TLS-Version
      ciphers: 'HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA',
      rejectUnauthorized: true // Im Produktivbetrieb auf true setzen!
    },
    logger: process.env.NODE_ENV === 'development',
    debug: process.env.NODE_ENV === 'development'
  });

  const mailOptions = {
    from: `"Kontaktformular" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    replyTo: `${name} <${email}>`,
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
        <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
          Diese Nachricht wurde über das Kontaktformular gesendet.
        </p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Nachricht gesendet:', info.messageId);
      console.log('Vorschau-URL:', nodemailer.getTestMessageUrl(info));
    }
    
    res.status(200).json({ 
      success: true,
      message: 'Nachricht erfolgreich gesendet! Wir melden uns bald.'
    });
  } catch (error) {
    console.error('Fehler beim Mailversand:', error);
    
    let errorMessage = 'Fehler beim Senden der Nachricht';
    if (error.code === 'EAUTH') {
      errorMessage = 'Authentifizierungsfehler - bitte Email-Konfiguration prüfen';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Verbindung zum Email-Server fehlgeschlagen';
    }
    
    res.status(500).json({ 
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Interner Serverfehler' 
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`📨 HEXEL API läuft auf Port ${PORT}`);
  console.log(`Umgebung: ${process.env.NODE_ENV || 'development'}`);
});