const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  } 
});

async function sendOtpMail(email, otp) {
  const mailOptions = {
    from: process.env.MAIL_USER,
    to: email,
    subject: "Your OTP for Login",
    html: `
      <p>Your OTP for login is:</p>
      <h2>${otp}</h2>
      <p>OTP is valid for 5 minutes.</p>
    `
  };

  return transporter.sendMail(mailOptions);
}

module.exports = sendOtpMail;
