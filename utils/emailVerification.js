const nodemailer = require('nodemailer');
const dotenv = require('dotenv').config();


async function sendVerificationEmail(userEmail, verificationCode) {
    // SMTP configuration
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.AUTH_USER,
            pass: process.env.AUTH_PASSWORD,
        }
    });

    // Email content
    const mailOptions = {
        from: process.env.AUTH_USER,
        to: userEmail,
        subject: 'Verification Code',
        html: `<h1>Email Verification</h1>
               <p>Your verification code is:</p>
               <h2 style="color: blue;">${verificationCode}</h2>
               <p>Please enter this code on the verification page to complete your registration process.</p>
               <p>If you did not request this, please ignore this email.</p>`
    };

    // Sending email
    try {
        await transporter.sendMail(mailOptions);
        console.log('Verification email sent successfully');
    } catch (error) {
        console.log('Email send failed with error:', error);
    }
}

module.exports = sendVerificationEmail;
