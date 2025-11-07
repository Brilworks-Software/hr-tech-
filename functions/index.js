const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().email.user,
    pass: functions.config().email.password,
  },
});

exports.sendInterviewEmail = functions.https.onCall(async (data, context) => {
  const {
    to,
    candidateName,
    jobTitle,
    interviewDate,
    interviewTime,
    interviewLink,
    duration,
    instructions,
  } = data;

  if (!to || !candidateName || !jobTitle || !interviewLink) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required fields'
    );
  }

  const emailHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
        }
        .header {
          background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
          padding: 30px;
          text-align: center;
          color: white;
        }
        .content {
          padding: 30px;
          background: #f8fafc;
        }
        .card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          margin: 20px 0;
        }
        .info-row {
          padding: 10px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .info-label {
          font-weight: bold;
          color: #64748b;
        }
        .footer {
          padding: 20px;
          text-align: center;
          color: #64748b;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎥 Interview Invitation</h1>
        <p>HireTech AI Recruitment Platform</p>
      </div>

      <div class="content">
        <h2>Hello ${candidateName},</h2>

        <p>
          Congratulations! We are pleased to invite you for an interview for the position of
          <strong>${jobTitle}</strong>.
        </p>

        <div class="card">
          <h3 style="margin-top: 0;">Interview Details</h3>

          <div class="info-row">
            <span class="info-label">📅 Date:</span> ${interviewDate}
          </div>

          <div class="info-row">
            <span class="info-label">🕐 Time:</span> ${interviewTime}
          </div>

          <div class="info-row">
            <span class="info-label">⏱️ Duration:</span> ${duration} minutes
          </div>

          ${instructions ? `
          <div class="info-row" style="border-bottom: none;">
            <span class="info-label">📝 Instructions:</span>
            <p style="margin: 10px 0 0 0;">${instructions}</p>
          </div>
          ` : ''}
        </div>

        <div style="text-align: center;">
          <a href="${interviewLink}" class="button">
            Join Video Interview
          </a>
        </div>

        <div class="card" style="background: #eff6ff; border-left: 4px solid #2563eb;">
          <h4 style="margin-top: 0; color: #1e40af;">AI-Powered Interview Experience</h4>
          <p style="margin-bottom: 0;">
            This interview uses advanced AI technology to analyze and evaluate:
          </p>
          <ul>
            <li>Communication skills and confidence</li>
            <li>Technical knowledge and problem-solving</li>
            <li>Professional demeanor and attitude</li>
          </ul>
        </div>

        <div class="card">
          <h4 style="margin-top: 0;">Before the Interview:</h4>
          <ul style="margin-bottom: 0;">
            <li>Test your camera and microphone</li>
            <li>Find a quiet, well-lit location</li>
            <li>Ensure stable internet connection</li>
            <li>Have your resume and relevant documents ready</li>
            <li>Join 5 minutes early</li>
          </ul>
        </div>

        <p>
          If you have any questions or need to reschedule, please contact us as soon as possible.
        </p>

        <p>
          We look forward to speaking with you!
        </p>

        <p>
          Best regards,<br>
          <strong>The Recruitment Team</strong><br>
          HireTech AI
        </p>
      </div>

      <div class="footer">
        <p>
          This is an automated email from HireTech AI.<br>
          Please do not reply directly to this email.
        </p>
        <p>
          © ${new Date().getFullYear()} HireTech AI. All rights reserved.
        </p>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"HireTech AI" <${functions.config().email.user}>`,
    to: to,
    subject: `Interview Invitation - ${jobTitle}`,
    html: emailHTML,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to:', to);
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to send email',
      error.message
    );
  }
});

exports.onInterviewCompleted = functions.firestore
  .document('interviews/{interviewId}')
  .onUpdate(async (change, context) => {
    const newValue = change.after.data();
    const previousValue = change.before.data();

    if (newValue.status === 'completed' && previousValue.status !== 'completed') {
      console.log('Interview completed:', context.params.interviewId);
    }

    return null;
  });

/**
 * Get TURN/STUN server credentials for WebRTC
 * This helps establish connections when both peers are behind NATs/firewalls
 */
exports.getWebRTCConfig = functions.https.onCall(async (data, context) => {
  // You can integrate with paid TURN services here (Twilio, Metered, etc.)
  // For now, we'll use free public TURN servers and STUN servers
  
  const iceServers = [
    // STUN servers (free)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    
    // Free public TURN servers (may have usage limits)
    // Note: These are free services and may not be reliable for production
    // For production, consider using paid services like Twilio, Metered, or Xirsys
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];

  return {
    iceServers,
    iceCandidatePoolSize: 10,
  };
});
