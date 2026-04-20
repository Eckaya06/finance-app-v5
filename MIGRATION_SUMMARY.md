# Firebase to Node.js/MongoDB Migration Summary

## What Changed

### Frontend (React + Vite)

| Feature | Before (Firebase) | After (Node.js Backend) |
|---------|-------------------|------------------------|
| Authentication | Firebase Auth SDK | JWT + localStorage |
| User Creation | `createUserWithEmailAndPassword()` | `POST /api/auth/signup` |
| User Login | `signInWithEmailAndPassword()` | `POST /api/auth/login` |
| Session Check | `onAuthStateChanged()` listener | `GET /api/auth/me` on init |
| Logout | `signOut(auth)` | `POST /api/auth/logout` |
| Data Fetching | Real-time `onSnapshot()` listeners | `api.get()` calls |
| Data Creation | `addDoc(collection(...))` | `api.post()` |
| Data Update | `updateDoc(doc(...))` | `api.put()` |
| Data Deletion | `deleteDoc(doc(...))` | `api.delete()` |
| AI/Gemini API | Direct browser call (exposed key) | Backend proxy (secured) |
| Email Change | Firebase `updateEmail()` | `PUT /api/auth/change-email` |
| Password Change | Firebase `updatePassword()` | `PUT /api/auth/change-password` |

### Backend (New Node.js Express + MongoDB)

**Created Files:**
- `backend/server.js` - Express app entry point
- `backend/config/db.js` - MongoDB connection
- `backend/models/` - User, Transaction, Budget, Pot schemas
- `backend/controllers/` - All business logic (auth, transactions, budgets, pots, AI)
- `backend/routes/` - REST endpoints
- `backend/middleware/authMiddleware.js` - JWT verification
- `backend/.env` - Environment configuration

**Environment Variables:**
```
MONGO_URI=mongodb://localhost:27017/financeapp
JWT_SECRET=<your-secret>
GEMINI_API_KEY=<your-key>
CLIENT_URL=http://localhost:5173
PORT=5000
```

## UI Compatibility

✅ **All React components require zero UI changes**
- Function names unchanged (`addTransaction`, `updateBudget`, etc.)
- Component props and state remain the same
- Router/navigation untouched
- Styling fully preserved
- Only backend communication layer replaced

## Key Files Modified

### Frontend
1. **`src/context/AuthContext.jsx`** - JWT + localStorage instead of Firebase
2. **`src/context/TransactionContext.jsx`** - REST API calls instead of Firestore listeners
3. **`src/services/aiService.js`** - Backend proxy instead of direct Gemini API
4. **`src/api.js`** - New Axios instance with JWT interceptor
5. **`src/components/settings/ChangeEmailModal.jsx`** - Backend email change
6. **`src/components/settings/ChangePasswordModal.jsx`** - Backend password change
7. **`package.json`** - Removed `firebase`, added `axios`
8. **`vite.config.js`** - Added dev server proxy for `/api`

### Backend (All New)
- Complete Express.js server with Mongoose ORM
- All endpoints JWT-protected (except public `/api/health` and `/api/ai`)
- bcryptjs password hashing
- CORS configured for frontend URL
- Structured MVC pattern

## Data Flow

### Before (Firebase)
```
React Component 
  ↓
Firebase SDK (imports auth, db)
  ↓
Firebase Cloud (Firestore, Auth)
```

### After (Node.js Backend)
```
React Component
  ↓
api.js (Axios with JWT interceptor)
  ↓
Express Backend (http://localhost:5000)
  ↓
MongoDB (local or cloud)
  ↓
Gemini API (for AI, backend-secured)
```

## Authentication Flow

### Signup
```javascript
// Frontend
const { data } = await api.post('/auth/signup', { email, password });
localStorage.setItem('financeapp_token', data.token);
setUser(data.user);

// Backend
1. Hash password with bcryptjs
2. Create User in MongoDB
3. Return JWT token + user object
```

### Login
```javascript
// Frontend
const { data } = await api.post('/auth/login', { email, password });
localStorage.setItem('financeapp_token', data.token);
setUser(data.user);

// Backend
1. Find user by email
2. Compare password with bcrypt
3. Return JWT token + user object
```

### Session Persistence
```javascript
// Frontend (on app mount)
useEffect(() => {
  const token = localStorage.getItem('financeapp_token');
  if (token) {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
  }
}, []);

// Backend
Middleware verifies JWT, returns current user
```

## API Response Format

### Successful Response
```json
{
  "user": { "uid": "mongo-id", "email": "user@example.com" },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Error Response
```json
{
  "message": "Email already in use."
}
```

## Running the Stack

### Terminal 1: Backend
```bash
cd backend
npm install
# Create .env with values from .env.example
npm run dev
```

### Terminal 2: Frontend
```bash
npm install
npm run dev
```

**Access:** http://localhost:5173 → proxies `/api` to http://localhost:5000

## Database Schema

### User
```json
{
  "_id": "ObjectId",
  "email": "user@example.com",
  "passwordHash": "$2a$10$...",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Transaction
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId (ref User)",
  "name": "Coffee",
  "category": "Dining Out",
  "type": "expense",
  "amount": 5.50,
  "date": "2024-01-15T00:00:00Z",
  "createdAt": 1705276800000
}
```

### Budget
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId (ref User)",
  "category": "Entertainment",
  "limit": 100.00,
  "theme": "blue",
  "createdAt": 1705276800000
}
```

### Pot
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId (ref User)",
  "name": "Vacation Fund",
  "target": 1000.00,
  "saved": 250.00,
  "theme": "green",
  "createdAt": 1705276800000
}
```

## Security Improvements

1. **API Key Security**: Gemini key no longer exposed in browser
2. **Password Hashing**: bcryptjs 10-round salt vs. Firebase managed
3. **Token Expiry**: JWT tokens expire after 7 days (vs. Firebase indefinite)
4. **CORS**: Restricted to specific frontend URL
5. **Database**: MongoDB access controlled by backend server only

## Performance Considerations

| Aspect | Firebase | Node.js |
|--------|----------|---------|
| Real-time | ✅ Instant | ⚠️ Polling-based |
| Scalability | ✅ Auto-scaling | ⚠️ Manual scaling |
| Offline Sync | ✅ Built-in | ❌ Not implemented |
| Cost | 💰 Pay-per-use | 💰 Server hosting |
| Latency | ✅ CDN-distributed | ⚠️ Single server |

## Next Steps for Production

1. **MongoDB Atlas**: Replace local MongoDB with managed cloud database
   ```
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/financeapp
   ```

2. **Deploy Backend**: Use Heroku, Railway, or AWS
   ```bash
   # Example with Railway
   railway up
   ```

3. **Update Frontend**: Change `CLIENT_URL` and API base URL
   ```
   VITE_API_BASE_URL=https://your-backend.railway.app
   ```

4. **SSL/HTTPS**: Enable HTTPS for production

5. **Rate Limiting**: Add rate limiting middleware to backend

6. **Logging**: Implement structured logging (Winston, Pino)

7. **Monitoring**: Set up error tracking (Sentry, LogRocket)

## Testing Checklist

- [ ] Signup with new email
- [ ] Login with correct credentials
- [ ] Login fails with wrong password
- [ ] Create transaction
- [ ] Edit transaction
- [ ] Delete transaction
- [ ] Create budget
- [ ] Create pot
- [ ] Add money to pot
- [ ] Withdraw money from pot
- [ ] Ask AI assistant a question
- [ ] Change email in settings
- [ ] Change password in settings
- [ ] Logout and login again
- [ ] Data persists across sessions
