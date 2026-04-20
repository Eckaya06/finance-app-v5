# Finance App Backend

Node.js/Express REST API for the Finance App, with MongoDB persistence and JWT authentication.

## 🏗️ Architecture

This is a standard Express.js application following the MVC pattern:
- **Models**: Mongoose schemas (User, Transaction, Budget, Pot)
- **Controllers**: Business logic (auth, CRUD operations)
- **Routes**: HTTP endpoint definitions
- **Middleware**: Authentication, error handling

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

Update `.env` with your values:
```
MONGO_URI=mongodb://localhost:27017/financeapp
JWT_SECRET=replace_with_a_strong_secret_key_at_least_32_chars
GEMINI_API_KEY=your_gemini_api_key
CLIENT_URL=http://localhost:5173
PORT=5000
```

### 3. Start Server
```bash
# Development (with nodemon)
npm run dev

# Production
npm start
```

Server will listen on http://localhost:5000

## 📡 API Endpoints

### Authentication

#### POST /api/auth/signup
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (201):**
```json
{
  "user": {
    "uid": "507f1f77bcf86cd799439011",
    "email": "user@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST /api/auth/login
Login existing user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "user": {
    "uid": "507f1f77bcf86cd799439011",
    "email": "user@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### GET /api/auth/me
Get current authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "user": {
    "uid": "507f1f77bcf86cd799439011",
    "email": "user@example.com"
  }
}
```

#### PUT /api/auth/change-email
Change user email.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "currentPassword": "password123",
  "newEmail": "newemail@example.com"
}
```

**Response (200):**
```json
{
  "message": "Email updated successfully.",
  "user": {
    "uid": "507f1f77bcf86cd799439011",
    "email": "newemail@example.com"
  }
}
```

#### PUT /api/auth/change-password
Change user password.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "currentPassword": "password123",
  "newPassword": "newpassword456"
}
```

**Response (200):**
```json
{
  "message": "Password updated successfully."
}
```

### Transactions

All endpoints require `Authorization: Bearer <token>` header.

#### GET /api/transactions
Get all transactions for current user.

**Response (200):**
```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "name": "Coffee",
    "category": "Dining Out",
    "type": "expense",
    "amount": 5.50,
    "date": "19/01/2024",
    "createdAt": 1705718400000
  },
  ...
]
```

#### POST /api/transactions
Create new transaction.

**Request:**
```json
{
  "name": "Grocery Shopping",
  "category": "Groceries",
  "type": "expense",
  "amount": 75.50,
  "date": "2024-01-19"
}
```

**Response (201):**
```json
{
  "id": "507f1f77bcf86cd799439012",
  "name": "Grocery Shopping",
  "category": "Groceries",
  "type": "expense",
  "amount": 75.50,
  "date": "19/01/2024",
  "createdAt": 1705718400000
}
```

#### PUT /api/transactions/:id
Update transaction.

**Request:**
```json
{
  "amount": 80.00,
  "category": "Shopping"
}
```

**Response (200):** Updated transaction object

#### DELETE /api/transactions/:id
Delete transaction.

**Response (200):**
```json
{
  "message": "Transaction deleted"
}
```

### Budgets

All endpoints require `Authorization: Bearer <token>` header.

#### GET /api/budgets
Get all budgets.

**Response (200):**
```json
[
  {
    "id": "507f1f77bcf86cd799439020",
    "category": "Entertainment",
    "limit": 100.00,
    "theme": "blue",
    "createdAt": 1705718400000
  },
  ...
]
```

#### POST /api/budgets
Create new budget.

**Request:**
```json
{
  "category": "Dining Out",
  "limit": 150.00,
  "theme": "orange"
}
```

**Response (201):** Created budget object

#### PUT /api/budgets/:id
Update budget.

**Request:**
```json
{
  "limit": 200.00,
  "theme": "red"
}
```

**Response (200):** Updated budget object

#### DELETE /api/budgets/:id
Delete budget.

**Response (200):**
```json
{
  "message": "Budget deleted"
}
```

### Pots

All endpoints require `Authorization: Bearer <token>` header.

#### GET /api/pots
Get all pots.

**Response (200):**
```json
[
  {
    "id": "507f1f77bcf86cd799439030",
    "name": "Vacation Fund",
    "target": 1000.00,
    "saved": 250.00,
    "theme": "cyan",
    "createdAt": 1705718400000
  },
  ...
]
```

#### POST /api/pots
Create new pot.

**Request:**
```json
{
  "name": "Emergency Fund",
  "target": 5000.00,
  "theme": "green"
}
```

**Response (201):** Created pot object

#### PUT /api/pots/:id
Update pot (amount, target, name, theme).

**Request:**
```json
{
  "saved": 300.00,
  "target": 1200.00
}
```

**Response (200):** Updated pot object

#### DELETE /api/pots/:id
Delete pot.

**Response (200):**
```json
{
  "message": "Pot deleted"
}
```

### AI Assistant

#### POST /api/ai
Get AI response about finances (no authentication required).

**Request:**
```json
{
  "prompt": "How much did I spend on dining this month?",
  "transactions": [
    {
      "id": "1",
      "category": "Dining Out",
      "amount": 50.00,
      "type": "expense",
      "date": "19/01/2024"
    }
  ]
}
```

**Response (200):**
```json
{
  "text": "Based on your transactions, you spent $50.00 on dining out this month. That's within your budget!"
}
```

## 📦 Database Schema

### User
```javascript
{
  _id: ObjectId,
  email: String (unique, lowercase),
  passwordHash: String,
  createdAt: Date
}
```

### Transaction
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref User),
  name: String,
  category: String,
  type: String (enum: 'income', 'expense'),
  amount: Number,
  date: Date,
  createdAt: Number (timestamp)
}
```

### Budget
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref User),
  category: String,
  limit: Number,
  theme: String,
  createdAt: Number (timestamp)
}
```

### Pot
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref User),
  name: String,
  target: Number,
  saved: Number (default: 0),
  theme: String,
  createdAt: Number (timestamp)
}
```

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### How It Works

1. User sends email/password to `/api/auth/signup` or `/api/auth/login`
2. Backend returns JWT token (7-day expiry)
3. Frontend stores token in localStorage
4. For protected routes, frontend sends: `Authorization: Bearer <token>`
5. Backend middleware verifies JWT and attaches user to request
6. If token is invalid/expired, returns 401 Unauthorized

### Token Structure
```
Header: { "alg": "HS256", "typ": "JWT" }
Payload: { "id": "user_id", "email": "user@example.com", "iat": ..., "exp": ... }
Signature: HMACSHA256(header.payload, JWT_SECRET)
```

## 🛡️ Error Handling

All errors follow this format:

```json
{
  "message": "Error description"
}
```

### Common Status Codes
- **200**: Success
- **201**: Created
- **400**: Bad Request (validation error)
- **401**: Unauthorized (invalid/missing token)
- **404**: Not Found
- **409**: Conflict (e.g., email already exists)
- **500**: Server Error

## 📊 Database Connection

### Local MongoDB
```
MONGO_URI=mongodb://localhost:27017/financeapp
```

### MongoDB Atlas (Cloud)
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/financeapp
```

Ensure MongoDB is running or accessible before starting server.

## 🔧 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| MONGO_URI | MongoDB connection string | mongodb://localhost:27017/financeapp |
| JWT_SECRET | Secret key for JWT signing | super_secret_key_min_32_chars |
| GEMINI_API_KEY | Google Gemini API key | AIzaSy... |
| CLIENT_URL | Frontend URL for CORS | http://localhost:5173 |
| PORT | Server port | 5000 |

## 📝 Logging & Debugging

Errors are logged to console with context:

```
Connected to MongoDB
Finance backend listening on port 5000
Error: Invalid email or password.
```

For development, use `npm run dev` to enable auto-restart on file changes.

## 🧪 Manual Testing

### Using cURL

**Signup:**
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Create Transaction (with token):**
```bash
curl -X POST http://localhost:5000/api/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name":"Coffee",
    "category":"Dining Out",
    "type":"expense",
    "amount":5.50,
    "date":"2024-01-19"
  }'
```

### Using Postman

1. Create collection "Finance App"
2. Set base URL: `{{baseUrl}}` = http://localhost:5000
3. Add Auth tab with Bearer Token: `{{token}}`
4. Create requests for each endpoint

## 🚀 Deployment Checklist

- [ ] Update `JWT_SECRET` to a secure random value
- [ ] Configure `MONGO_URI` for production database
- [ ] Set `CLIENT_URL` to production frontend URL
- [ ] Enable HTTPS
- [ ] Set up logging/monitoring
- [ ] Configure rate limiting
- [ ] Enable CORS for production domain only
- [ ] Set up backup strategy for MongoDB
- [ ] Test all API endpoints
- [ ] Monitor error logs

## 🐛 Troubleshooting

### "Cannot connect to MongoDB"
- Verify MongoDB is running: `mongosh`
- Check MONGO_URI is correct
- Verify MongoDB credentials if using Atlas

### "Invalid token" errors
- Verify JWT_SECRET is same on all instances
- Check token hasn't expired (7 days)
- Ensure Authorization header format is correct: `Bearer <token>`

### "Email already in use"
- Email must be unique per user
- Check if user already exists in database

### CORS errors
- Verify CLIENT_URL in .env matches frontend URL
- Check browser console for actual error message

## 📚 Additional Resources

- [Express.js Docs](https://expressjs.com/)
- [Mongoose Docs](https://mongoosejs.com/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc7519)
- [MongoDB Docs](https://docs.mongodb.com/)

## 📝 Notes

- All timestamps are in milliseconds (JavaScript epoch)
- Passwords are hashed with bcryptjs (10-round salt)
- All endpoints use CORS (configure for production)
- No request body size limit configured (add if needed for large uploads)

---

**Backend Server for Finance App | Made with ❤️**
