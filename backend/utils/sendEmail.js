import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export const sendEmail = async (options) => {
  try {
    // Env değişkenlerini kontrol et
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('EMAIL_USER veya EMAIL_PASS .env dosyasında eksik');
    }

    // 1. Postacıyı (Transporter) oluştur - Gmail için doğru konfigürasyon
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // TLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Gmail App Password kullanmalısınız!
      },
    });

    // 2. E-posta içeriğini ayarla
    const mailOptions = {
      from: `"FinanceApp Destek" <${process.env.EMAIL_USER}>`,
      to: options.email,
      subject: options.subject,
      html: options.message,
    };

    // 3. E-postayı gönder
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ E-posta başarıyla gönderildi:', result.messageId);
    return result;
  } catch (error) {
    console.error('❌ E-posta gönderim hatası:', error.message);
    throw error;
  }
};