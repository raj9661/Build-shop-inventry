# Building Materials Inventory Management System - Backend

A secure, role-based access control system for managing building materials inventory with comprehensive audit trails and security features.

## 🔐 Role-Based Access Control System

### User Roles Hierarchy

```
SUPER_DUPER_ADMIN (Level 4) - Highest privileges
    ↓
SUPER_ADMIN (Level 3) - Cannot manage SUPER_DUPER_ADMIN users
    ↓
ADMIN (Level 2) - Limited management capabilities
    ↓
STAFF (Level 1) - Basic entry operations only
```

### Access Control Matrix

| Resource | Action | SUPER_DUPER_ADMIN | SUPER_ADMIN | ADMIN | STAFF |
|----------|--------|-------------------|-------------|-------|-------|
| **Users** | Create | ✅ | ✅ | ❌ | ❌ |
| | Read | ✅ | ✅ | ❌ | ❌ |
| | Update | ✅ | ✅ | ❌ | ❌ |
| | Delete | ✅ | ❌ | ❌ | ❌ |
| **Shops** | Create | ✅ | ✅ | ❌ | ❌ |
| | Read | ✅ | ✅ | ✅ | ❌ |
| | Update | ✅ | ✅ | ❌ | ❌ |
| | Delete | ✅ | ❌ | ❌ | ❌ |
| **Products** | Create | ✅ | ✅ | ✅ | ❌ |
| | Read | ✅ | ✅ | ✅ | ✅ |
| | Update | ✅ | ✅ | ✅ | ❌ |
| | Delete | ✅ | ✅ | ❌ | ❌ |
| **Sales** | Create | ✅ | ✅ | ✅ | ✅ |
| | Read | ✅ | ✅ | ✅ | ❌ |
| | Update | ✅ | ✅ | ✅ | ❌ |
| | Delete | ✅ | ✅ | ❌ | ❌ |
| **Customers** | Create | ✅ | ✅ | ✅ | ❌ |
| | Read | ✅ | ✅ | ✅ | ❌ |
| | Update | ✅ | ✅ | ✅ | ❌ |
| | Delete | ✅ | ✅ | ❌ | ❌ |
| **Analytics** | Read | ✅ | ✅ | ✅ | ❌ |
| | Export | ✅ | ✅ | ❌ | ❌ |
| **Logs** | Read | ✅ | ✅ | ❌ | ❌ |
| | Export | ✅ | ❌ | ❌ | ❌ |

### Special Restrictions

- **SUPER_ADMIN** cannot:
  - Create or modify SUPER_DUPER_ADMIN users
  - View SUPER_DUPER_ADMIN data
  - Access SUPER_DUPER_ADMIN activity logs
  - Export system logs

- **ADMIN** can only:
  - Enter sales
  - View customer balances
  - Add expenses
  - Manage products and stock

- **STAFF** can only:
  - Access basic entry forms (sale, delivery)
  - Cannot access reports, customers, or payments

## 🛡️ Security Features

### Authentication & Authorization

- **JWT-based session management** with refresh tokens
- **OTP verification** for unrecognized devices
- **Device fingerprinting** and trusted device management
- **IP tracking** and device information logging
- **Auto logout** after inactivity
- **Brute force protection** with IP blocking

### Audit Trail

- **Complete activity logging** for all sensitive operations
- **User action tracking** with IP and device information
- **Request/response logging** for sensitive operations
- **Security alert system** for suspicious activities
- **Audit trail** for all data modifications

### Data Protection

- **Password hashing** with bcrypt (12 rounds)
- **Input validation** with express-validator
- **SQL injection protection** via Prisma ORM
- **XSS protection** with helmet middleware
- **Rate limiting** to prevent abuse
- **CORS configuration** for secure cross-origin requests

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your database and JWT secrets
   ```

4. **Database setup**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   
   # Seed initial data
   npm run db:seed
   ```

5. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 📋 Default Login Credentials

After running the seed script, you can login with these default credentials:

| Role | Email | Password |
|------|-------|----------|
| SUPER_DUPER_ADMIN | superduperadmin@example.com | SuperDuperAdmin@123 |
| SUPER_ADMIN | superadmin@example.com | SuperAdmin@123 |
| ADMIN | admin@example.com | Admin@123 |
| STAFF | staff@example.com | Staff@123 |

⚠️ **IMPORTANT**: Change these passwords in production!

## 🔧 API Usage

### Authentication

```javascript
// Login
POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "Admin@123"
}

// Response includes access token and refresh token
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "jwt_token_here",
    "refreshToken": "refresh_token_here"
  }
}
```

### Role-Based Route Protection

```javascript
// Using predefined middleware
const { requireAdmin, requireSuperAdmin } = require('../middleware/roleAuth');

// Admin only route
router.get('/admin-only', requireAdmin, (req, res) => {
  // Only ADMIN and above can access
});

// Super Admin only route
router.get('/super-admin-only', requireSuperAdmin, (req, res) => {
  // Only SUPER_ADMIN and above can access
});

// Custom role requirements
router.get('/custom', authorizeRoles(['ADMIN', 'SUPER_ADMIN']), (req, res) => {
  // Only specified roles can access
});
```

### Resource-Specific Authorization

```javascript
// Check specific resource access
const { canManageUsers, canCreateSales } = require('../middleware/roleAuth');

// User management routes
router.get('/users', canManageUsers, (req, res) => {
  // Only users with user read permissions
});

router.post('/sales', canCreateSales, (req, res) => {
  // Only users with sales create permissions
});
```

## 📊 Activity Monitoring

### View User Activity

```javascript
GET /api/users/:id/activity?page=1&limit=20&from_date=2024-01-01
```

### System Activity Summary

```javascript
GET /api/analytics/activity?from_date=2024-01-01&to_date=2024-01-31
```