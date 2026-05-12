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

// Email templates
const emailTemplates = {
  passwordChangeOTP: (otp: string, userName: string) => ({
    subject: 'Password Change Request - Shop Inventory System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #333; margin-bottom: 10px;">Shop Inventory System</h2>
          <p style="color: #666; margin: 0;">Password Change Request</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <h3 style="color: #333; margin-top: 0;">Hello ${userName},</h3>
          <p style="color: #555; line-height: 1.6;">
            We received a request to change your password for the Shop Inventory System. 
            To proceed with the password change, please use the following One-Time Password (OTP):
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #007bff; color: white; padding: 15px 30px; border-radius: 6px; display: inline-block; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
              ${otp}
            </div>
          </div>
          
          <p style="color: #555; line-height: 1.6;">
            <strong>Important:</strong>
          </p>
          <ul style="color: #555; line-height: 1.6;">
            <li>This OTP is valid for 10 minutes only</li>
            <li>Do not share this OTP with anyone</li>
            <li>If you didn't request this password change, please ignore this email</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="color: #999; font-size: 14px; margin: 0;">
            This is an automated message from Shop Inventory System.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `
  }),

  shopDeletionOTP: (otp: string, userName: string, shopName: string) => ({
    subject: 'Shop Deletion Verification - Shop Inventory System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #333; margin-bottom: 10px;">Shop Inventory System</h2>
          <p style="color: #666; margin: 0;">Shop Deletion Verification</p>
        </div>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
          <h3 style="color: #856404; margin-top: 0;">⚠️ Important Security Alert</h3>
          <p style="color: #856404; line-height: 1.6;">
            A request has been made to delete the shop: <strong>${shopName}</strong>
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <h3 style="color: #333; margin-top: 0;">Hello ${userName},</h3>
          <p style="color: #555; line-height: 1.6;">
            We received a request to delete a shop from the Shop Inventory System. 
            To proceed with the shop deletion, please use the following One-Time Password (OTP):
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #dc3545; color: white; padding: 15px 30px; border-radius: 6px; display: inline-block; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
              ${otp}
            </div>
          </div>
          
          <p style="color: #555; line-height: 1.6;">
            <strong>Warning:</strong>
          </p>
          <ul style="color: #555; line-height: 1.6;">
            <li>This action will permanently delete the shop and all associated data</li>
            <li>This OTP is valid for 10 minutes only</li>
            <li>Do not share this OTP with anyone</li>
            <li>If you didn't request this shop deletion, please ignore this email and contact support immediately</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="color: #999; font-size: 14px; margin: 0;">
            This is an automated message from Shop Inventory System.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `
  }),

  loginOTP: (otp: string, userName: string) => ({
    subject: 'Two-Factor Authentication - Shop Inventory System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #333; margin-bottom: 10px;">Shop Inventory System</h2>
          <p style="color: #666; margin: 0;">Two-Factor Authentication</p>
        </div>
        
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #28a745;">
          <h3 style="color: #155724; margin-top: 0;">🔐 Security Verification</h3>
          <p style="color: #155724; line-height: 1.6;">
            A login attempt has been made to your SUPER_DUPER_ADMIN account.
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <h3 style="color: #333; margin-top: 0;">Hello ${userName},</h3>
          <p style="color: #555; line-height: 1.6;">
            To complete your login to the Shop Inventory System, please use the following Two-Factor Authentication code:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #28a745; color: white; padding: 15px 30px; border-radius: 6px; display: inline-block; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
              ${otp}
            </div>
          </div>
          
          <p style="color: #555; line-height: 1.6;">
            <strong>Security Information:</strong>
          </p>
          <ul style="color: #555; line-height: 1.6;">
            <li>This code is valid for 10 minutes only</li>
            <li>Do not share this code with anyone</li>
            <li>If you didn't attempt to login, please change your password immediately</li>
            <li>This is required for all SUPER_DUPER_ADMIN logins</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="color: #999; font-size: 14px; margin: 0;">
            This is an automated message from Shop Inventory System.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `
  }),

  passwordResetLink: (resetUrl: string, userName: string) => ({
    subject: 'Password Reset Request - Shop Inventory System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #333; margin-bottom: 10px;">Shop Inventory System</h2>
          <p style="color: #666; margin: 0;">Password Reset Request</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <h3 style="color: #333; margin-top: 0;">Hello ${userName},</h3>
          <p style="color: #555; line-height: 1.6;">
            We received a request to reset your password. You can reset your password by clicking the secure link below:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 15px 30px; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: bold; text-decoration: none;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #555; line-height: 1.6;">
            <strong>Important:</strong>
          </p>
          <ul style="color: #555; line-height: 1.6;">
            <li>This link will expire in 30 minutes.</li>
            <li>If you did not request this password reset, no further action is required and your password will remain the same.</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="color: #999; font-size: 14px; margin: 0;">
            This is an automated message from Shop Inventory System.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `
  }),

  // New notification templates
  testNotification: (shopName: string) => ({
    subject: `Test Notification - ${shopName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #333; margin-bottom: 10px;">Shop Inventory System</h2>
          <p style="color: #666; margin: 0;">Test Notification</p>
        </div>
        
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #28a745;">
          <h3 style="color: #155724; margin-top: 0;">✅ Test Notification Successful</h3>
          <p style="color: #155724; line-height: 1.6;">
            This is a test notification from <strong>${shopName}</strong>
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <h3 style="color: #333; margin-top: 0;">Notification System Status</h3>
          <p style="color: #555; line-height: 1.6;">
            Your notification system is working correctly! You will now receive email notifications for:
          </p>
          
          <ul style="color: #555; line-height: 1.6;">
            <li>Low stock alerts</li>
            <li>Sales reports</li>
            <li>Critical system alerts</li>
            <li>Daily, weekly, and monthly reports</li>
            <li>Shop-specific notifications</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="color: #999; font-size: 14px; margin: 0;">
            This is an automated test message from Shop Inventory System.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `
  }),

  lowStockAlert: (shopName: string, products: any[]) => ({
    subject: `Low Stock Alert - ${shopName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #333; margin-bottom: 10px;">Shop Inventory System</h2>
          <p style="color: #666; margin: 0;">Low Stock Alert</p>
        </div>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
          <h3 style="color: #856404; margin-top: 0;">⚠️ Low Stock Alert</h3>
          <p style="color: #856404; line-height: 1.6;">
            The following products in <strong>${shopName}</strong> are running low on stock:
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #e9ecef;">
                <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Product</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Current Stock</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Min Stock</th>
              </tr>
            </thead>
            <tbody>
              ${products.map(product => `
                <tr>
                  <td style="padding: 10px; border: 1px solid #dee2e6;">${product.name}</td>
                  <td style="padding: 10px; border: 1px solid #dee2e6; color: #dc3545; font-weight: bold;">${product.currentStock}</td>
                  <td style="padding: 10px; border: 1px solid #dee2e6;">${product.minStock}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="color: #999; font-size: 14px; margin: 0;">
            This is an automated alert from Shop Inventory System.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `
  }),

  salesReport: (shopName: string, reportData: any, reportType: string) => ({
    subject: `${reportType} Sales Report - ${shopName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #333; margin-bottom: 10px;">Shop Inventory System</h2>
          <p style="color: #666; margin: 0;">${reportType} Sales Report</p>
        </div>
        
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #28a745;">
          <h3 style="color: #155724; margin-top: 0;">📊 ${reportType} Sales Report</h3>
          <p style="color: #155724; line-height: 1.6;">
            Sales report for <strong>${shopName}</strong> - ${reportData.period}
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div style="text-align: center; padding: 15px; background-color: white; border-radius: 6px;">
              <h4 style="margin: 0 0 10px 0; color: #333;">Total Sales</h4>
              <p style="font-size: 24px; font-weight: bold; color: #28a745; margin: 0;">₹${reportData.totalSales.toLocaleString()}</p>
            </div>
            <div style="text-align: center; padding: 15px; background-color: white; border-radius: 6px;">
              <h4 style="margin: 0 0 10px 0; color: #333;">Total Orders</h4>
              <p style="font-size: 24px; font-weight: bold; color: #007bff; margin: 0;">${reportData.totalOrders}</p>
            </div>
            <div style="text-align: center; padding: 15px; background-color: white; border-radius: 6px;">
              <h4 style="margin: 0 0 10px 0; color: #333;">Products Sold</h4>
              <p style="font-size: 24px; font-weight: bold; color: #ffc107; margin: 0;">${reportData.productsSold}</p>
            </div>
            <div style="text-align: center; padding: 15px; background-color: white; border-radius: 6px;">
              <h4 style="margin: 0 0 10px 0; color: #333;">Average Order Value</h4>
              <p style="font-size: 24px; font-weight: bold; color: #6f42c1; margin: 0;">₹${reportData.averageOrderValue.toLocaleString()}</p>
            </div>
          </div>
          
          ${reportData.topProducts ? `
            <h4 style="color: #333; margin-bottom: 15px;">Top Selling Products</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #e9ecef;">
                  <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Product</th>
                  <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Quantity Sold</th>
                  <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.topProducts.map((product: any) => `
                  <tr>
                    <td style="padding: 10px; border: 1px solid #dee2e6;">${product.name}</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6;">${product.quantity}</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6;">₹${product.revenue.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="color: #999; font-size: 14px; margin: 0;">
            This is an automated report from Shop Inventory System.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `
  }),

  criticalAlert: (shopName: string, alertType: string, details: string) => ({
    subject: `Critical Alert - ${shopName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #333; margin-bottom: 10px;">Shop Inventory System</h2>
          <p style="color: #666; margin: 0;">Critical Alert</p>
        </div>
        
        <div style="background-color: #f8d7da; padding: 20px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #dc3545;">
          <h3 style="color: #721c24; margin-top: 0;">🚨 Critical Alert</h3>
          <p style="color: #721c24; line-height: 1.6;">
            A critical issue has been detected in <strong>${shopName}</strong>
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <h3 style="color: #333; margin-top: 0;">Alert Details</h3>
          <p style="color: #555; line-height: 1.6;">
            <strong>Alert Type:</strong> ${alertType}<br>
            <strong>Shop:</strong> ${shopName}<br>
            <strong>Time:</strong> ${new Date().toLocaleString()}
          </p>
          
          <div style="background-color: white; padding: 15px; border-radius: 6px; margin-top: 15px;">
            <p style="color: #555; line-height: 1.6; margin: 0;">
              ${details}
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="color: #999; font-size: 14px; margin: 0;">
            This is an automated critical alert from Shop Inventory System.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `
  })
};

// Email service functions
export const emailService = {
  // Send OTP for password change
  async sendPasswordChangeOTP(email: string, otp: string, userName: string): Promise<boolean> {
    try {
      const template = emailTemplates.passwordChangeOTP(otp, userName);

      const mailOptions = {
        from: `"Shop Inventory System" <${emailConfig.auth.user}>`,
        to: email,
        subject: template.subject,
        html: template.html
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Password change OTP email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send password change OTP email:', error);
      return false;
    }
  },

  // Send OTP for shop deletion
  async sendShopDeletionOTP(email: string, otp: string, userName: string, shopName: string): Promise<boolean> {
    try {
      const template = emailTemplates.shopDeletionOTP(otp, userName, shopName);

      const mailOptions = {
        from: `"Shop Inventory System" <${emailConfig.auth.user}>`,
        to: email,
        subject: template.subject,
        html: template.html
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Shop deletion OTP email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send shop deletion OTP email:', error);
      return false;
    }
  },

  // Send OTP for login 2FA
  async sendLoginOTP(email: string, otp: string, userName: string): Promise<boolean> {
    try {
      const template = emailTemplates.loginOTP(otp, userName);

      const mailOptions = {
        from: `"Shop Inventory System" <${emailConfig.auth.user}>`,
        to: email,
        subject: template.subject,
        html: template.html
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Login 2FA OTP email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send login 2FA OTP email:', error);
      return false;
    }
  },

  // Verify email configuration
  async verifyConnection(): Promise<boolean> {
    try {
      await transporter.verify();
      console.log('Email service connection verified successfully');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  },

  // Send test notification
  async sendTestNotification(email: string, shopName: string): Promise<boolean> {
    try {
      const template = emailTemplates.testNotification(shopName);

      const mailOptions = {
        from: `"Shop Inventory System" <${emailConfig.auth.user}>`,
        to: email,
        subject: template.subject,
        html: template.html
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Test notification email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send test notification email:', error);
      return false;
    }
  },

  // Send low stock alert
  async sendLowStockAlert(email: string, shopName: string, products: any[]): Promise<boolean> {
    try {
      const template = emailTemplates.lowStockAlert(shopName, products);

      const mailOptions = {
        from: `"Shop Inventory System" <${emailConfig.auth.user}>`,
        to: email,
        subject: template.subject,
        html: template.html
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Low stock alert email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send low stock alert email:', error);
      return false;
    }
  },

  // Send sales report
  async sendSalesReport(email: string, shopName: string, reportData: any, reportType: string): Promise<boolean> {
    try {
      const template = emailTemplates.salesReport(shopName, reportData, reportType);

      const mailOptions = {
        from: `"Shop Inventory System" <${emailConfig.auth.user}>`,
        to: email,
        subject: template.subject,
        html: template.html
      };

      const result = await transporter.sendMail(mailOptions);
      console.log(`${reportType} sales report email sent successfully:`, result.messageId);
      return true;
    } catch (error) {
      console.error(`Failed to send ${reportType} sales report email:`, error);
      return false;
    }
  },

  // Send critical alert
  async sendCriticalAlert(email: string, shopName: string, alertType: string, details: string): Promise<boolean> {
    try {
      const template = emailTemplates.criticalAlert(shopName, alertType, details);

      const mailOptions = {
        from: `"Shop Inventory System" <${emailConfig.auth.user}>`,
        to: email,
        subject: template.subject,
        html: template.html
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Critical alert email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send critical alert email:', error);
      return false;
    }
  },

  // Send Password Reset Link
  async sendPasswordResetLink(email: string, resetUrl: string, userName: string): Promise<boolean> {
    try {
      const template = emailTemplates.passwordResetLink(resetUrl, userName);

      const mailOptions = {
        from: `"Shop Inventory System" <${emailConfig.auth.user}>`,
        to: email,
        subject: template.subject,
        html: template.html
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Password reset link email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send password reset link email:', error);
      return false;
    }
  }
};

export default emailService; 