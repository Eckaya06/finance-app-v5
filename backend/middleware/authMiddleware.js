import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Token geçerli olsa bile kullanıcının doğrulanmış olduğundan emin ol.
    // Eski sistemden kalma, doğrulanmamış kullanıcıların erişimini engeller.
    const dbUser = await User.findById(decoded.id).select('isVerified displayName email');
    if (!dbUser) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!dbUser.isVerified) {
      return res.status(403).json({ message: 'Please verify your email address before continuing.' });
    }

    req.user = {
      uid: decoded.id,
      email: dbUser.email,
      displayName: dbUser.displayName,
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
