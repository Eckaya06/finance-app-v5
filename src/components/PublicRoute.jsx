import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ProtectedRoute'un tersi: auth oturumu olan kullanıcılar Login/Signup
// sayfasına URL ile manuel gitmeye çalışırsa otomatik /home'a yönlendirilir.
// Bu sayede tarayıcı geçmişine dönüş veya manuel URL ile auth ekranlarına
// "geri kaçış" engellenir.
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        fontFamily: 'sans-serif'
      }}>
        Loading session...
      </div>
    );
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return children;
};

export default PublicRoute;
