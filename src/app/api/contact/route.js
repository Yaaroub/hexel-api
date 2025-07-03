import nodemailer from 'nodemailer';

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  const { name, email, message } = await req.json();

  // Validierung
  if (
    !name || name.length < 2 ||
    !email || !email.match(/\S+@\S+\.\S+/) ||
    !message || message.length < 10
  ) {
    return new Response(
      JSON.stringify({ message: 'Ungültige Eingaben.' }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Transporter erstellen
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"HEXEL Kontaktformular" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: `Neue Nachricht von ${name}`,
      text: `Name: ${name}\nE-Mail: ${email}\n\n${message}`,
      replyTo: email,
    });

    return new Response(
      JSON.stringify({ message: 'Nachricht erfolgreich gesendet.' }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error('Mailer-Fehler:', err);
    return new Response(
      JSON.stringify({ message: 'Fehler beim Senden der Nachricht.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// CORS-Header erlauben z. B. IONOS oder alles
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hexel-tech.de', // Oder z. B. 'https://hexel-tech.de'
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
