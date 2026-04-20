import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api.js'; // Kendi api.js dosyanın doğru yolunu ayarla

const VerifyEmail = () => {
  const { token } = useParams(); // URL'deki token'ı yakalar
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('E-posta adresiniz doğrulanıyor, lütfen bekleyin...');
  
  // EKLENEN KISIM: React'ın useEffect'i iki kere çalıştırmasını (ve tokeni harcamasını) önleyen kilit.
  const hasFetched = useRef(false);

  useEffect(() => {
    const verifyUserEmail = async () => {
      try {
        // Backend'e token'ı gönderip doğrulama isteği atıyoruz
        const response = await api.get(`/auth/verify/${token}`);
        setStatus('success');
        setMessage(response.data.message || 'E-posta adresiniz başarıyla doğrulandı!');
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.message || 'Geçersiz veya süresi dolmuş link.');
      }
    };

    // EKLENEN KISIM: Eğer istek daha önce atıldıysa (hasFetched true ise) fonksiyonu durdur, ikinci kez atma.
    if (!hasFetched.current) {
      verifyUserEmail();
      hasFetched.current = true;
    }
    
  }, [token]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center' }}>
      {status === 'loading' && <h2>⏳ {message}</h2>}
      
      {status === 'success' && (
        <>
          <h2 style={{ color: 'green' }}>✅ Başarılı!</h2>
          <p>{message}</p>
          <Link to="/login" style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', textDecoration: 'none', borderRadius: '5px' }}>
            Giriş Yap
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <h2 style={{ color: 'red' }}>❌ Hata!</h2>
          <p>{message}</p>
          <Link to="/signup" style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#f44336', color: 'white', textDecoration: 'none', borderRadius: '5px' }}>
            Tekrar Kayıt Ol
          </Link>
        </>
      )}
    </div>
  );
};

export default VerifyEmail;