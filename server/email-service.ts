import sgMail from '@sendgrid/mail';
import { EmailSettings } from '@shared/schema';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  emailSettings: EmailSettings;
}

export async function sendEmail({ to, subject, html, emailSettings }: SendEmailParams): Promise<void> {
  if (!emailSettings.enabled) {
    console.log('📧 Email notifications disabled - skipping email send');
    return;
  }

  if (!emailSettings.sendgridApiKey) {
    console.error('❌ SendGrid API key not configured');
    throw new Error('SendGrid API key not configured');
  }

  if (!emailSettings.senderEmail) {
    console.error('❌ Sender email not configured');
    throw new Error('Sender email not configured');
  }

  try {
    sgMail.setApiKey(emailSettings.sendgridApiKey);

    const msg = {
      to,
      from: {
        email: emailSettings.senderEmail,
        name: emailSettings.senderName || 'Solvextra Support',
      },
      subject,
      html,
    };

    await sgMail.send(msg);
    console.log(`✅ Email sent successfully to ${to}`);
  } catch (error: any) {
    console.error('❌ SendGrid error:', error.response?.body || error.message);
    throw new Error(`Failed to send email: ${error.response?.body?.errors?.[0]?.message || error.message}`);
  }
}

export function generateTicketCreationEmail(
  customerName: string,
  ticketNumber: string,
  ticketTitle: string,
  issueDetails: string,
  tat: number
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9fafb; padding: 30px; }
        .ticket-info { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Support Ticket Created</h1>
        </div>
        <div class="content">
          <p>Hello ${customerName},</p>
          <p>We've received your support request and created a ticket to help you.</p>
          <div class="ticket-info">
            <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
            <p><strong>Title:</strong> ${ticketTitle}</p>
            <p><strong>Issue:</strong> ${issueDetails}</p>
            <p><strong>Expected Resolution Time:</strong> ${tat} minutes</p>
          </div>
          <p>Our support team will review your request and get back to you as soon as possible.</p>
          <p>You can reference your ticket number <strong>${ticketNumber}</strong> for any follow-up inquiries.</p>
          <p>Best regards,<br>Support Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateTicketResolutionEmail(
  customerName: string,
  ticketTitle: string,
  ticketId: string,
  csatSurveyUrl: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9fafb; padding: 30px; }
        .button { display: inline-block; background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Ticket Resolved</h1>
        </div>
        <div class="content">
          <p>Hello ${customerName},</p>
          <p>We're pleased to inform you that your support ticket <strong>"${ticketTitle}"</strong> has been resolved.</p>
          <p>Ticket ID: <strong>${ticketId}</strong></p>
          <p>We hope this resolution meets your expectations. Your feedback is important to us!</p>
          <div style="text-align: center;">
            <a href="${csatSurveyUrl}" class="button">Rate Your Experience</a>
          </div>
          <p>Thank you for using our support service.</p>
          <p>Best regards,<br>Support Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
