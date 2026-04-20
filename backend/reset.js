import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const resetDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB bağlantısı başarılı');

    const result = await User.deleteMany({});
    console.log(`✅ ${result.deletedCount} user silindi`);

    const remaining = await User.countDocuments();
    console.log(`✅ Kalan user sayısı: ${remaining}`);
    console.log('✅ Database tamamen sıfırlandı!');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  }
};

resetDB();
