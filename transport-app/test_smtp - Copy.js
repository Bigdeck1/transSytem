// Quick SMTP test script
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

console.log('=== SMTP Test ===');
console.log('User:', user);
console.log('Pass length:', pass ? pass.length : 0);
console.log('Pass value:', pass);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user, pass }
});

transporter.verify()
  .then(() => console.log(' SMTP connection successful!'))
  .catch(err => console.error(' SMTP error:', err.message));
