import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // CORS erlauben (für IONOS-Frontend)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end(); // Preflight
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }

  const { name, email, message } = req.body;

  if (
    !name || name.length < 2 ||
    !email || !email.match(/\S+@\S+\.\S+/) ||
    !message || message.length < 10
  ) {
    return res.status(400).json({ message: 'Ungültige Eingaben' });
  }

  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Kontaktformular" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: `Neue Nachricht von ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      replyTo: email,
    });

    return res.status(200).json({ message: 'Nachricht erfolgreich gesendet.' });
  } catch (error) {
    console.error('Mailer-Fehler:', error);
    return res.status(500).json({ message: 'Fehler beim Senden der Nachricht.' });
  }
}
