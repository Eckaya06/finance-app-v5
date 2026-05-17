/**
 * Admin Panel Middleware
 * 
 * Admin erişimini .env'deki ADMIN_SECRET ile kontrol eder.
 * Bearer token formatında gönderilir: "Bearer <ADMIN_SECRET>"
 * 
 * Sunucuya aktardığınızda .env'deki ADMIN_SECRET değerini
 * güçlü, benzersiz bir değer ile değiştirmeniz yeterlidir.
 */

export const adminProtect = (req, res, next) => {
  const authHeader = req.headers['x-admin-key'];
  
  if (!authHeader) {
    return res.status(401).json({ message: 'Admin key required.' });
  }

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return res.status(500).json({ message: 'Admin secret is not configured on server.' });
  }

  if (authHeader !== adminSecret) {
    return res.status(403).json({ message: 'Invalid admin key.' });
  }

  next();
};
