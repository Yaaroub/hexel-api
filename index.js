// index.js
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

app.use(cors({
  origin: (origin, callback) => {
    // origin kann undefined sein bei Postman oder Curl
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS-Fehler: Herkunft nicht erlaubt'));
    }
  }
}));

app.use(express.json());

app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;

  // Debug-Modus
  if (process.env.NODE_ENV === 'development') {
    console.log('Empfangene Daten:', { name, email, message });
    console.log('Umgebungsvariablen:', {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      user: process.env.EMAIL_USER,
      to: process.env.EMAIL_TO
    });
  }

  // Mail Transporter konfigurieren
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.ionos.de',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false,
    }
  });

  const mailOptions = {
    from: `"Kontaktformular" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    replyTo: email,
    subject: `Neue Nachricht von ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nNachricht:\n${message}`,
    html: `
      <h2>Neue Kontaktanfrage</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Nachricht:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Nachricht erfolgreich gesendet! Wir melden uns bald.' });
  } catch (error) {
    console.error('Fehler beim Mailversand:', error);
    res.status(500).json({ message: `Fehler beim Senden: ${error.message}` });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`📨 HEXEL API läuft auf Port ${PORT}`);
});
