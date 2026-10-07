const nodemailer = require('nodemailer');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const transporter =
  env.smtp.host && env.smtp.user
    ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    })
    : null;

async function sendOtp(to, code) {
  if (!transporter) {
    if (env.nodeEnv === 'production') throw new AppError(500, 'Email service is not configured');
    console.log(`[DEV ONLY] password-reset code for ${to}: ${code}`); // so you can test without an email account
    return;
  }
  await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject: 'Your Netra password reset code',
    text: `Your verification code is ${code}. It expires in 2 minutes. If you did not request this, ignore this email.`,
  });
}

module.exports = { sendOtp };
