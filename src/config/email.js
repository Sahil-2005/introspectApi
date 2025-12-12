const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,          // e.g. "smtp.gmail.com"
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,                        // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,        // your email / smtp user
    pass: process.env.SMTP_PASS,        // your email password / app password
  },
});

async function sendEmail({ to, subject, html }) {
  const info = await transporter.sendMail({
    from: process.env.FROM_EMAIL || '"Admin Panel" <no-reply@example.com>',
    to,
    subject,
    html,
  });

  console.log("Email sent:", info.messageId);
  return info;
}

module.exports = { transporter, sendEmail };
