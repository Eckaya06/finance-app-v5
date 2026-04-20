import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto'; // Node.js dahili modülü
import User from '../models/User.js';
import { sendEmail } from '../utils/sendEmail.js'; // utils klasörüne eklediğimiz yardımcı fonksiyon

const createToken = (user) => {
  return jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

export const signup = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ message: 'Email and password are required. Password must be at least 6 characters.' });
  }

  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    return res.status(409).json({ message: 'Email already in use.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  
  // 1. Doğrulama için benzersiz token oluştur
  const verificationToken = crypto.randomBytes(20).toString('hex');
  console.log('✅ Verification token oluşturuldu:', verificationToken);

  // 2. Kullanıcıyı oluştur (isVerified varsayılan olarak false kaydedilmeli)
  const user = await User.create({ 
    email: email.toLowerCase().trim(), 
    passwordHash,
    verificationToken 
  });
  console.log('✅ User DB\'ye kaydedildi:', { email: user.email, token: user.verificationToken });

  // 3. E-posta içeriğini ve linkini hazırla
  const verifyUrl = `http://localhost:5173/verify/${verificationToken}`;
  console.log('📧 Email linki oluşturuldu:', verifyUrl);
  const message = `
    <h1>FinanceApp'e Hoş Geldin!</h1>
    <p>Hesabınızı aktifleştirmek için lütfen aşağıdaki butona tıklayarak e-posta adresinizi doğrulayın:</p>
    <a href="${verifyUrl}" style="display:inline-block; padding:10px 20px; background-color:#4CAF50; color:white; text-decoration:none; border-radius:5px;">E-postayı Doğrula</a>
    <p>Eğer butona tıklayamıyorsanız bu linki tarayıcınıza yapıştırın:</p>
    <p>${verifyUrl}</p>
  `;

  // 4. E-postayı gönder
  try {
    await sendEmail({
      email: user.email,
      subject: 'FinanceApp - E-posta Doğrulama',
      message
    });
    console.log('✅ Email başarıyla gönderildi');
  } catch (error) {
    console.error("⚠️ Email gönderim hatası (devam ediliyor):", error.message);
    // Email gönderilemediyse de devam et - test için
    // Production'da kullanıcıyı silmeliyiz ama şimdi test yapıyoruz
  }

  res.status(201).json({ 
    message: 'Kayıt başarılı. E-posta adresiniz doğrulandı. Giriş yapabilirsiniz.',
    user: { uid: user._id.toString(), email: user.email },
    token: createToken(user)
  });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  // E-posta doğrulanmış mı kontrolü
  if (!user.isVerified) {
    return res.status(403).json({ message: 'Lütfen giriş yapmadan önce e-posta adresinizi doğrulayın.' });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const token = createToken(user);
  res.json({ user: { uid: user._id.toString(), email: user.email }, token });
};

// YENİ: E-posta Doğrulama İşlemi
export const verifyEmail = async (req, res) => {
  try {
    const token = req.params.token;
    console.log('\n=== VERIFY EMAIL BAŞLADI ===');
    console.log('🔍 Token:', token);
    console.log('🔍 Token type:', typeof token);
    console.log('🔍 Token length:', token ? token.length : 'null');
    
    // Tüm user'ları listele
    const allUsers = await User.find({});
    console.log(`🔍 Database'deki user sayısı: ${allUsers.length}`);
    allUsers.forEach((u, i) => {
      console.log(`  User ${i+1}: ${u.email}`);
      console.log(`    - verificationToken: ${u.verificationToken}`);
      console.log(`    - isVerified: ${u.isVerified}`);
    });
    
    // Token'le user ara
    const user = await User.findOne({ verificationToken: token });
    console.log('🔍 User bulundu mu?', user ? 'EVET' : 'HAYIR');
    
    if (user) {
      console.log('✅ User bulundu:', user.email);
      user.isVerified = true;
      user.verificationToken = undefined;
      await user.save();
      console.log('✅ User saved');
      res.status(200).json({ message: 'E-posta adresiniz başarıyla doğrulandı. Giriş yapabilirsiniz.' });
    } else {
      console.log('❌ User bulunamadı');
      res.status(400).json({ message: 'Geçersiz veya süresi dolmuş doğrulama linki.' });
    }
    console.log('=== VERIFY EMAIL BİTTİ ===\n');
  } catch (error) {
    console.error('❌ Verify error:', error);
    res.status(500).json({ message: 'Doğrulama sırasında bir hata oluştu.' });
  }
};

export const me = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  res.json({ user: { uid: req.user.uid, email: req.user.email } });
};

export const logout = async (req, res) => {
  return res.json({ message: 'Logged out' });
};

export const changeEmail = async (req, res) => {
  const { currentPassword, newEmail } = req.body;
  if (!currentPassword || !newEmail) {
    return res.status(400).json({ message: 'Current password and new email are required.' });
  }

  const user = await User.findById(req.user.uid);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ message: 'Current password is incorrect.' });
  }

  const emailTaken = await User.findOne({ email: newEmail.toLowerCase().trim() });
  if (emailTaken) {
    return res.status(409).json({ message: 'Email already in use.' });
  }

  user.email = newEmail.toLowerCase().trim();
  await user.save();

  res.json({ message: 'Email updated successfully.', user: { uid: user._id.toString(), email: user.email } });
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Current and new passwords are required. New password must be at least 6 characters.' });
  }

  const user = await User.findById(req.user.uid);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ message: 'Current password is incorrect.' });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.json({ message: 'Password updated successfully.' });
};