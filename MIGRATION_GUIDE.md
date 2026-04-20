# Finance App Backend Migration

This document guides you through setting up the new Node.js/Express backend with MongoDB.

## ✅ Completed Migrations

### 1. **Authentication (Firebase → JWT/Node)**
- Firebase Auth removed from frontend
- New JWT-based authentication in `backend/controllers/authController.js`
- AuthContext now uses `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`
- Tokens stored in `localStorage` with key `financeapp_token`

### 2. **Database (Firestore → MongoDB)**
- User, Transaction, Budget, Pot collections → MongoDB schemas
- `backend/models/` directory contains all Mongoose models
- User passwords hashed with bcryptjs
- Database queries use `/api/transactions`, `/api/budgets`, `/api/pots` endpoints

### 3. **Real-time Data (Firestore snapshots → REST APIs)**
- Removed `onSnapshot` listeners from TransactionContext
- Now uses polling with `api.get()` on user login/data changes
- All CRUD operations maintain same function signatures for UI compatibility

### 4. **AI Service (Client-side Gemini → Backend-secured)**
- Gemini API key moved to backend `.env`
- New `/api/ai` endpoint proxies all AI requests
- `src/services/aiService.js` calls backend instead of direct API
- Prevents API key exposure in browser

### 5. **Account Management (Firebase → Backend)**
- `ChangeEmailModal.jsx` now calls `/api/auth/change-email`
- `ChangePasswordModal.jsx` now calls `/api/auth/change-password`
- Both require password verification before execution

## 🚀 Setup Instructions

### 1. Install Backend Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Create a `backend/.env` file (copy from `.env.example`):
```
MONGO_URI=mongodb://localhost:27017/financeapp
JWT_SECRET=your_super_secret_jwt_key_replace_this
GEMINI_API_KEY=your_gemini_api_key
CLIENT_URL=http://localhost:5173
PORT=5000
```

### 3. Start MongoDB
Make sure MongoDB is running locally on port 27017, or update `MONGO_URI` in `.env`.

### 4. Start Backend Server
```bash
cd backend
npm start
# or for development with hot reload:
npm run dev
```

The backend will listen on `http://localhost:5000`.

### 5. Update Frontend .env (Optional)
If running backend on a different host/port, create `src/.env`:
```
VITE_API_BASE_URL=http://localhost:5000
```

### 6. Install Frontend Dependencies
```bash
npm install
```

### 7. Start Frontend Development Server
```bash
npm run dev
```

Frontend will run on `http://localhost:5173` and proxy `/api/*` requests to the backend.

## 📡 API Endpoints Reference

### Auth
- `POST /api/auth/signup` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires JWT)
- `POST /api/auth/logout` - Logout (clears token client-side)
- `PUT /api/auth/change-email` - Change email (requires JWT)
- `PUT /api/auth/change-password` - Change password (requires JWT)

### Transactions
- `GET /api/transactions` - Get all transactions (requires JWT)
- `POST /api/transactions` - Create transaction (requires JWT)
- `PUT /api/transactions/:id` - Update transaction (requires JWT)
- `DELETE /api/transactions/:id` - Delete transaction (requires JWT)

### Budgets
- `GET /api/budgets` - Get all budgets (requires JWT)
- `POST /api/budgets` - Create budget (requires JWT)
- `PUT /api/budgets/:id` - Update budget (requires JWT)
- `DELETE /api/budgets/:id` - Delete budget (requires JWT)

### Pots
- `GET /api/pots` - Get all pots (requires JWT)
- `POST /api/pots` - Create pot (requires JWT)
- `PUT /api/pots/:id` - Update pot (requires JWT)
- `DELETE /api/pots/:id` - Delete pot (requires JWT)

### AI
- `POST /api/ai` - Get AI response (no auth required, but can send transactions)

## 🔒 Security Notes

1. **JWT Tokens**: Stored in localStorage, sent via `Authorization: Bearer <token>` header
2. **API Key**: Gemini API key is in backend `.env` only (not exposed to frontend)
3. **Password Hashing**: Uses bcryptjs with 10 salt rounds
4. **CORS**: Frontend URL configured in backend (set `CLIENT_URL` in `.env`)

## 📝 Notes

- All frontend function names (addTransaction, updateBudget, etc.) remain unchanged
- UI components require **no modifications** beyond Firebase import removal
- Backend handles all data persistence and validation
- Frontend remains a pure presentation layer

## 🧪 Testing

1. Sign up a new user at `http://localhost:5173/signup`
2. Create a transaction, budget, and pot
3. Ask the AI assistant a question
4. Update your email/password in settings

## ⚠️ Known Limitations

- Currently uses polling instead of WebSockets for real-time data
- No support for offline-first synchronization (Firebase sync advantage)
- Email verification not yet implemented (use `POST` for now)
- File uploads not yet implemented

## 🆘 Troubleshooting

### "Cannot connect to backend"
- Ensure backend is running on port 5000
- Check `CLIENT_URL` in backend `.env` matches your frontend URL
- Verify CORS is not blocking requests

### "Invalid token"
- Clear localStorage and log in again
- Check `JWT_SECRET` is consistent on backend
- Tokens expire after 7 days

### "Gemini API key missing"
- Ensure `GEMINI_API_KEY` is set in `backend/.env`
- Backend will return 500 error if key is not configured

## 📚 File Structure

```
backend/
  ├── config/
  │   └── db.js                    # MongoDB connection
  ├── models/
  │   ├── User.js
  │   ├── Transaction.js
  │   ├── Budget.js
  │   └── Pot.js
  ├── controllers/
  │   ├── authController.js
  │   ├── transactionController.js
  │   ├── budgetController.js
  │   ├── potController.js
  │   └── aiController.js
  ├── routes/
  │   ├── authRoutes.js
  │   ├── transactionRoutes.js
  │   ├── budgetRoutes.js
  │   ├── potRoutes.js
  │   └── aiRoutes.js
  ├── middleware/
  │   └── authMiddleware.js
  ├── server.js
  ├── .env
  └── package.json

src/
  ├── api.js                       # Axios instance with interceptors
  ├── context/
  │   ├── AuthContext.jsx          # JWT-based
  │   └── TransactionContext.jsx   # REST API calls
  ├── services/
  │   └── aiService.js             # Calls backend /api/ai
  ├── components/
  │   └── settings/
  │       ├── ChangeEmailModal.jsx
  │       └── ChangePasswordModal.jsx
```

## ✨ What Was Removed

- ❌ `src/firebase.js` - Firebase config file
- ❌ `firebase` npm package
- ❌ Client-side Firestore listeners and operations
- ❌ Client-side Gemini API calls
- ❌ Firebase Auth SDK

## 🎉 What Was Added

- ✅ `backend/` directory with full Node/Express/MongoDB stack
- ✅ `src/api.js` - Axios client with JWT auth interceptor
- ✅ `axios` npm package (replaces firebase)
- ✅ Vite proxy configuration for `/api/*` routes
- ✅ All auth/data operations now go through REST APIs
