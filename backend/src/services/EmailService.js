import fs from 'fs';
import path from 'path';
import { ProjectConfigService } from './project-config.service.js';
import * as nodemailer from 'nodemailer';

/**
 * 邮件服务类 - 负责发送审查结果邮件给项目管理员
 */
export class EmailService {
  // 邮件配置缓存
  static #emailConfig = null;
  
  // 邮件配置文件路径
  static get EMAIL_CONFIG_PATH() {
    return path.resolve(process.cwd(), 'config', 'email-config.json');
  }
  
  // Nodemailer传输器
  static #transporter = null;
  
  /**
   * 初始化邮件配置
   */
  static async initialize() {
    if (EmailService.#emailConfig !== null) {
      return;
    }
    
    try {
      const fileExists = fs.existsSync(EmailService.EMAIL_CONFIG_PATH);
      if (fileExists) {
        const content = fs.readFileSync(EmailService.EMAIL_CONFIG_PATH, 'utf-8');
        EmailService.#emailConfig = JSON.parse(content);
      } else {
        // 如果文件不存在，创建默认配置
        EmailService.#emailConfig = {
          version: '1.0',
          smtp: {
            host: 'smtp.example.com',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
              user: 'your-email@example.com',
              pass: 'your-email-password'
            }
          },
          from: 'Code Review Service <code-review@example.com>',
          templates: {
            subject: 'Code Review Results for {{projectName}}',
            body: `<!DOCTYPE html>
              <html lang="zh-CN">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Code Review Results</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
                        .container { max-width: 800px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
                        h1 { color: #333; }
                        .file-section { margin-bottom: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 4px; }
                        .file-name { font-weight: bold; color: #2c3e50; margin-bottom: 10px; }
                        .comment { background-color: #f8f9fa; padding: 10px; margin: 5px 0; border-left: 3px solid #3498db; border-radius: 0 3px 3px 0; }
                        .severity-info { border-left-color: #3498db; }
                        .severity-warning { border-left-color: #f39c12; }
                        .severity-error { border-left-color: #e74c3c; }
                        .no-comments { color: #7f8c8d; font-style: italic; }
                        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #7f8c8d; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Code Review Results</h1>
                        <p>Project: {{projectName}}</p>
                        <p>Review Date: {{reviewDate}}</p>
                        
                        {{fileSections}}
                        
                        <div class="footer">
                            <p>This email was generated automatically by the Code Review Service.</p>
                        </div>
                    </div>
                </body>
              </html>`
          }
        };
        await EmailService.saveEmailConfig();
      }
    } catch (error) {
      console.error('Failed to initialize email config:', error);
      // 使用默认配置
      EmailService.#emailConfig = {
        version: '1.0',
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          auth: {
            user: 'your-email@example.com',
            pass: 'your-email-password'
          }
        },
        from: 'Code Review Service <code-review@example.com>',
        templates: {
          subject: 'Code Review Results for {{projectName}}',
          body: 'Code review results for project {{projectName}} on {{reviewDate}}. Please check the attached file for details.'
        }
      };
    }
    
    // 初始化Nodemailer传输器
    EmailService.#initializeTransporter();
  }
  
  /**
   * 初始化Nodemailer传输器
   * @private
   */
  static #initializeTransporter() {
    if (!this.#emailConfig || !this.#emailConfig.smtp) {
      console.error('Email configuration not initialized');
      return;
    }
    
    this.#transporter = nodemailer.createTransport({
      host: this.#emailConfig.smtp.host,
      port: this.#emailConfig.smtp.port,
      secure: this.#emailConfig.smtp.secure,
      auth: this.#emailConfig.smtp.auth
    });
  }
  
  /**
   * 保存邮件配置到文件
   */
  static async saveEmailConfig() {
    try {
      // 确保配置目录存在
      const configDir = path.dirname(this.EMAIL_CONFIG_PATH);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(this.EMAIL_CONFIG_PATH, JSON.stringify(this.#emailConfig, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save email config:', error);
      throw new Error('Failed to save email configuration');
    }
  }
  
  /**
   * 更新邮件配置
   * @param {Object} config - 邮件配置对象
   */
  static async updateEmailConfig(config) {
    await this.initialize();
    this.#emailConfig = { ...this.#emailConfig, ...config };
    await this.saveEmailConfig();
    this.#initializeTransporter();
  }
  
  /**
   * 发送审查结果邮件
   * @param {string} projectId - 项目ID
   * @param {Object} reviewResults - 审查结果对象
   * @returns {Promise<boolean>} - 是否发送成功
   */
  static async sendReviewResultsEmail(projectId = 'default', reviewResults) {
    try {
      await this.initialize();
      
      // 检查项目是否启用了邮件通知
      const emailEnabled = await ProjectConfigService.isEmailEnabled(projectId);
      if (!emailEnabled) {
        console.log(`Email notifications are disabled for project ${projectId}`);
        return false;
      }
      
      // 获取项目配置
      const projectConfig = await ProjectConfigService.getProjectConfig(projectId);
      const projectName = projectConfig.name || projectId;
      
      // 获取管理员列表和邮箱
      const admins = await ProjectConfigService.getProjectAdmins(projectId);
      const adminEmails = admins.map(admin => admin.email).filter(email => email && email.trim());
      
      if (adminEmails.length === 0) {
        console.log(`No admin emails found for project ${projectId}`);
        return false;
      }
      
      // 检查传输器是否初始化
      if (!this.#transporter) {
        console.error('Email transporter not initialized');
        return false;
      }
      
      // 准备邮件内容
      const reviewDate = new Date().toLocaleString('zh-CN');
      const subject = this.#emailConfig.templates.subject
        .replace('{{projectName}}', projectName)
        .replace('{{reviewDate}}', reviewDate);
      
      // 生成文件部分的HTML
      let fileSections = '';
      for (const [file, result] of Object.entries(reviewResults)) {
        let commentsHtml = '';
        if (result.comments && result.comments.length > 0) {
          result.comments.forEach(comment => {
            const severityClass = comment.severity ? `severity-${comment.severity.toLowerCase()}` : '';
            commentsHtml += `<div class="comment ${severityClass}">
                <p><strong>Line ${comment.line}:</strong> ${comment.comment}</p>
              </div>`;
          });
        } else {
          commentsHtml = '<p class="no-comments">No issues found.</p>';
        }
        
        fileSections += `<div class="file-section">
            <div class="file-name">${file}</div>
            ${commentsHtml}
          </div>`;
      }
      
      // 生成邮件正文
      let body = this.#emailConfig.templates.body
        .replace('{{projectName}}', projectName)
        .replace('{{reviewDate}}', reviewDate)
        .replace('{{fileSections}}', fileSections);
      
      // 发送邮件
      const info = await this.#transporter.sendMail({
        from: this.#emailConfig.from,
        to: adminEmails.join(', '),
        subject: subject,
        html: body,
        text: this.#convertHtmlToText(body) // 纯文本版本
      });
      
      console.log(`Email sent for project ${projectId}: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error(`Failed to send review results email for project ${projectId}:`, error);
      return false;
    }
  }
  
  /**
   * 将HTML转换为纯文本
   * @private
   * @param {string} html - HTML内容
   * @returns {string} - 纯文本内容
   */
  static #convertHtmlToText(html) {
    // 简单的HTML到纯文本转换
    return html
      .replace(/<[^>]*>/g, '') // 移除HTML标签
      .replace(/\s+/g, ' ') // 替换多个空格为单个空格
      .replace(/&nbsp;/g, ' ') // 替换非断行空格
      .replace(/&lt;/g, '<') // 替换HTML实体
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  }
  
  /**
   * 测试邮件配置是否正确
   * @param {string} testEmail - 测试邮箱地址
   * @returns {Promise<boolean>} - 测试是否成功
   */
  static async testEmailConfiguration(testEmail) {
    try {
      await this.initialize();
      
      if (!this.#transporter) {
        console.error('Email transporter not initialized');
        return false;
      }
      
      // 验证SMTP连接
      await this.#transporter.verify();
      
      // 发送测试邮件
      const info = await this.#transporter.sendMail({
        from: this.#emailConfig.from,
        to: testEmail,
        subject: 'Code Review Service - Email Configuration Test',
        text: 'This is a test email to verify that your Code Review Service email configuration is working correctly.',
        html: '<p>This is a test email to verify that your Code Review Service email configuration is working correctly.</p>'
      });
      
      console.log(`Test email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error('Email configuration test failed:', error);
      return false;
    }
  }
  
  /**
   * 获取邮件配置状态
   * @returns {Promise<Object>} - 配置状态信息
   */
  static async getEmailConfigStatus() {
    await this.initialize();
    
    return {
      configured: !!this.#emailConfig.smtp.host && this.#emailConfig.smtp.host !== 'smtp.example.com',
      from: this.#emailConfig.from,
      smtpServer: this.#emailConfig.smtp.host,
      smtpPort: this.#emailConfig.smtp.port
    };
  }
}