/**
 * Email service for sending various types of emails
 * Including welcome emails, verification codes, and notifications
 */

import nodemailer from 'nodemailer';

// Email configuration
const emailConfig = {
  service: 'gmail',
  auth: {
    user: 'balajeetraders545@gmail.com',
    pass: 'gtko qaft nlob ogml' // App password for Gmail
  }
};

// Create transporter
const transporter = nodemailer.createTransport(emailConfig);

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface WelcomeEmailData {
  name: string;
  email: string;
  role: string;
  company: string;
  dashboardUrl: string;
}

export interface VerificationEmailData {
  name: string;
  email: string;
  code: string;
  expiresIn: number; // minutes
}

class EmailService {
  
  /**
   * Send welcome email to new SUPER_DUPER_ADMIN
   */
  async sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
    try {
      const template = this.generateWelcomeEmailTemplate(data);
      
      const mailOptions = {
        from: `"Building Materials Inventory System" <${emailConfig.auth.user}>`,
        to: data.email,
        subject: template.subject,
        html: template.html,
        text: template.text
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Welcome email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return false;
    }
  }

  /**
   * Send 2FA verification code
   */
  async sendVerificationCode(data: VerificationEmailData): Promise<boolean> {
    try {
      const template = this.generateVerificationEmailTemplate(data);
      
      const mailOptions = {
        from: `"Building Materials Inventory System" <${emailConfig.auth.user}>`,
        to: data.email,
        subject: template.subject,
        html: template.html,
        text: template.text
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Verification code email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Error sending verification code:', error);
      return false;
    }
  }

  /**
   * Generate welcome email template for SUPER_DUPER_ADMIN
   */
  private generateWelcomeEmailTemplate(data: WelcomeEmailData): EmailTemplate {
    const subject = `Welcome to Building Materials Inventory System - ${data.company}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Building Materials Inventory System</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .role-badge { display: inline-block; background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; margin: 10px 0; }
        .feature-list { list-style: none; padding: 0; }
        .feature-list li { padding: 8px 0; border-bottom: 1px solid #eee; }
        .feature-list li:before { content: "✅ "; color: #10b981; font-weight: bold; }
        .cta-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
        .security-notice { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏗️ Welcome to Building Materials Inventory System</h1>
            <p>Your comprehensive construction materials management platform</p>
        </div>
        
        <div class="content">
            <h2>Hello ${data.name}!</h2>
            
            <p>Welcome to the Building Materials Inventory System! We're excited to have <strong>${data.company}</strong> join our platform.</p>
            
            <div style="text-align: center;">
                <span class="role-badge">${data.role}</span>
            </div>
            
            <h3>🎯 Your Role & Capabilities</h3>
            <p>As a <strong>SUPER_DUPER_ADMIN</strong>, you have complete control over your business instance:</p>
            
            <ul class="feature-list">
                <li><strong>Shop Management:</strong> Create and manage multiple shops/locations</li>
                <li><strong>User Management:</strong> Add SUPER_ADMIN, ADMIN, and STAFF users</li>
                <li><strong>Inventory Control:</strong> Full access to all inventory management features</li>
                <li><strong>Analytics & Reports:</strong> Comprehensive business analytics and reporting</li>
                <li><strong>Customer Management:</strong> Manage customer relationships and transactions</li>
                <li><strong>Financial Tracking:</strong> Monitor sales, expenses, and profitability</li>
                <li><strong>Supplier Management:</strong> Track suppliers and purchase orders</li>
                <li><strong>Security Settings:</strong> Configure security policies and trusted devices</li>
            </ul>
            
            <h3>🚀 Getting Started</h3>
            <p>Here's what you can do right away:</p>
            <ol>
                <li><strong>Set up your first shop</strong> - Create your main business location</li>
                <li><strong>Add your team</strong> - Invite SUPER_ADMIN and ADMIN users</li>
                <li><strong>Configure inventory</strong> - Add your building materials and products</li>
                <li><strong>Import existing data</strong> - Use our import tools for quick setup</li>
                <li><strong>Customize settings</strong> - Configure your business preferences</li>
            </ol>
            
            <div style="text-align: center;">
                <a href="${data.dashboardUrl}" class="cta-button">Access Your Dashboard</a>
            </div>
            
            <div class="security-notice">
                <h4>🔒 Security Features</h4>
                <p>Your account includes advanced security features:</p>
                <ul>
                    <li><strong>Two-Factor Authentication (2FA):</strong> Enhanced login security</li>
                    <li><strong>Trusted Devices:</strong> Remember secure devices to skip 2FA</li>
                    <li><strong>Activity Logging:</strong> Track all user actions and changes</li>
                    <li><strong>Role-Based Access:</strong> Granular permissions for team members</li>
                </ul>
            </div>
            
            <h3>📞 Support & Resources</h3>
            <p>Need help getting started? We're here to support you:</p>
            <ul>
                <li><strong>Documentation:</strong> Comprehensive guides and tutorials</li>
                <li><strong>Video Tutorials:</strong> Step-by-step setup videos</li>
                <li><strong>Email Support:</strong> support@buildingmaterials.com</li>
                <li><strong>Live Chat:</strong> Available in your dashboard</li>
            </ul>
            
            <p>Thank you for choosing our platform. We're committed to helping ${data.company} streamline your building materials management!</p>
            
            <p>Best regards,<br>
            The Building Materials Inventory Team</p>
        </div>
        
        <div class="footer">
            <p>This email was sent to ${data.email} because you signed up for our service.</p>
            <p>If you have any questions, please contact our support team.</p>
        </div>
    </div>
</body>
</html>`;

    const text = `
Welcome to Building Materials Inventory System!

Hello ${data.name},

Welcome to the Building Materials Inventory System! We're excited to have ${data.company} join our platform.

Your Role: ${data.role}

As a SUPER_DUPER_ADMIN, you have complete control over your business instance:

✅ Shop Management: Create and manage multiple shops/locations
✅ User Management: Add SUPER_ADMIN, ADMIN, and STAFF users  
✅ Inventory Control: Full access to all inventory management features
✅ Analytics & Reports: Comprehensive business analytics and reporting
✅ Customer Management: Manage customer relationships and transactions
✅ Financial Tracking: Monitor sales, expenses, and profitability
✅ Supplier Management: Track suppliers and purchase orders
✅ Security Settings: Configure security policies and trusted devices

Getting Started:
1. Set up your first shop - Create your main business location
2. Add your team - Invite SUPER_ADMIN and ADMIN users
3. Configure inventory - Add your building materials and products
4. Import existing data - Use our import tools for quick setup
5. Customize settings - Configure your business preferences

Access Your Dashboard: ${data.dashboardUrl}

Security Features:
- Two-Factor Authentication (2FA): Enhanced login security
- Trusted Devices: Remember secure devices to skip 2FA
- Activity Logging: Track all user actions and changes
- Role-Based Access: Granular permissions for team members

Support & Resources:
- Documentation: Comprehensive guides and tutorials
- Video Tutorials: Step-by-step setup videos
- Email Support: support@buildingmaterials.com
- Live Chat: Available in your dashboard

Thank you for choosing our platform. We're committed to helping ${data.company} streamline your building materials management!

Best regards,
The Building Materials Inventory Team

---
This email was sent to ${data.email} because you signed up for our service.
If you have any questions, please contact our support team.
`;

    return { subject, html, text };
  }

  /**
   * Generate verification code email template
   */
  private generateVerificationEmailTemplate(data: VerificationEmailData): EmailTemplate {
    const subject = `Your 2FA Verification Code - Building Materials Inventory`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>2FA Verification Code</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 500px; margin: 0 auto; padding: 20px; }
        .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .code { font-size: 32px; font-weight: bold; color: #667eea; text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 20px 0; letter-spacing: 8px; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Two-Factor Authentication</h1>
            <p>Your verification code</p>
        </div>
        
        <div class="content">
            <h2>Hello ${data.name}!</h2>
            
            <p>You're signing in to your Building Materials Inventory account. Use the verification code below to complete your login:</p>
            
            <div class="code">${data.code}</div>
            
            <div class="warning">
                <h4>⚠️ Important Security Information:</h4>
                <ul>
                    <li>This code expires in ${data.expiresIn} minutes</li>
                    <li>Never share this code with anyone</li>
                    <li>Our team will never ask for your verification code</li>
                    <li>If you didn't request this code, please secure your account immediately</li>
                </ul>
            </div>
            
            <p>If you're having trouble signing in, please contact our support team.</p>
            
            <p>Best regards,<br>
            The Building Materials Inventory Team</p>
        </div>
        
        <div class="footer">
            <p>This email was sent to ${data.email} for security verification.</p>
            <p>If you didn't request this code, please contact support immediately.</p>
        </div>
    </div>
</body>
</html>`;

    const text = `
Two-Factor Authentication - Verification Code

Hello ${data.name},

You're signing in to your Building Materials Inventory account. Use the verification code below to complete your login:

VERIFICATION CODE: ${data.code}

Important Security Information:
- This code expires in ${data.expiresIn} minutes
- Never share this code with anyone
- Our team will never ask for your verification code
- If you didn't request this code, please secure your account immediately

If you're having trouble signing in, please contact our support team.

Best regards,
The Building Materials Inventory Team

---
This email was sent to ${data.email} for security verification.
If you didn't request this code, please contact support immediately.
`;

    return { subject, html, text };
  }
}

export const emailService = new EmailService();
export default emailService;
