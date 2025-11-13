# Authentication System Testing Guide

## Prerequisites

1. **Database Setup**
   ```bash
   # Start PostgreSQL (if using Docker)
   docker run --name cotrip-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cotrip -p 5432:5432 -d postgres

   # Or use your existing PostgreSQL instance
   # Make sure DATABASE_URL in .env matches your setup
   ```

2. **Database Migration**
   ```bash
   # Push Prisma schema to database
   npx prisma db push

   # Verify tables were created
   npx prisma studio
   ```

3. **Install Dependencies** (if not already done)
   ```bash
   npm install
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## Testing Checklist

### 1. User Registration
- [ ] Navigate to http://localhost:3000/auth/register
- [ ] Fill in the registration form:
  - Email: test@example.com
  - Username: testuser
  - Password: password123
  - Full Name: Test User (optional)
- [ ] Click "Create account"
- [ ] Verify successful registration and auto-login
- [ ] Verify redirect to /trips page
- [ ] Check database: User should be created with hashed password

**Test Cases:**
- [ ] Try registering with the same email (should fail)
- [ ] Try registering with the same username (should fail)
- [ ] Try registering with password < 8 characters (should fail)
- [ ] Try registering with invalid email format (should fail)

### 2. User Login
- [ ] Navigate to http://localhost:3000/auth/login
- [ ] Enter valid credentials (from registration)
- [ ] Click "Sign in"
- [ ] Verify successful login
- [ ] Verify redirect to /trips page

**Test Cases:**
- [ ] Try login with wrong password (should fail)
- [ ] Try login with non-existent email (should fail)
- [ ] Verify loading state appears during login
- [ ] Verify error messages are user-friendly

### 3. Session Persistence
- [ ] Login successfully
- [ ] Refresh the page
- [ ] Verify user remains logged in
- [ ] Close browser tab and reopen
- [ ] Verify session persists

### 4. Route Protection
- [ ] Logout (if logged in)
- [ ] Try to access http://localhost:3000/trips (should redirect to login)
- [ ] Try to access http://localhost:3000/profile (should redirect to login)
- [ ] Login
- [ ] Verify you can now access protected routes

### 5. Navigation Bar
- [ ] Check navbar when not logged in:
  - [ ] Should show "Sign in" and "Sign up" buttons
  - [ ] Should show "CoTrip" logo
- [ ] Login
- [ ] Check navbar when logged in:
  - [ ] Should show user name/email
  - [ ] Should show "Sign out" button
  - [ ] Should show "My Trips" link

### 6. Logout
- [ ] Click "Sign out" button in navbar
- [ ] Verify redirect to home page
- [ ] Verify user is logged out
- [ ] Try accessing /trips (should redirect to login)

### 7. Landing Page
- [ ] Navigate to http://localhost:3000/
- [ ] Verify landing page loads
- [ ] Verify "Get Started" and "Sign In" buttons work
- [ ] Verify features section displays
- [ ] If logged in, verify automatic redirect to /trips

### 8. Error Handling
- [ ] Try navigating to http://localhost:3000/auth/error
- [ ] Verify error page displays correctly
- [ ] Try different error scenarios:
  ```
  /auth/error?error=CredentialsSignin
  /auth/error?error=Default
  ```

## API Testing

### Register Endpoint
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "api@example.com",
    "username": "apiuser",
    "password": "password123",
    "fullName": "API User"
  }'
```

**Expected Response (201):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "...",
    "email": "api@example.com",
    "username": "apiuser",
    "fullName": "API User"
  }
}
```

### Login via API
```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "api@example.com",
    "password": "password123"
  }'
```

## Database Verification

### Check User Table
```bash
npx prisma studio
```

1. Open Prisma Studio
2. Navigate to "User" table
3. Verify:
   - User record exists
   - Email is unique
   - Username is unique
   - Password is hashed (not plain text)
   - Full name is stored (if provided)

### Direct Database Query
```sql
-- Connect to PostgreSQL
psql -h localhost -U postgres -d cotrip

-- Check users table
SELECT id, email, username, full_name, created_at FROM users;

-- Verify password is hashed
SELECT password_hash FROM users WHERE email = 'test@example.com';
-- Should see a bcrypt hash like: $2a$10$...
```

## Common Issues

### Issue: Database connection error
**Solution:**
- Check DATABASE_URL in .env
- Verify PostgreSQL is running
- Run `npx prisma db push`

### Issue: "NEXTAUTH_SECRET" error
**Solution:**
- Check .env has NEXTAUTH_SECRET set
- Generate new secret: `openssl rand -base64 32`

### Issue: Session not persisting
**Solution:**
- Clear browser cookies
- Check NEXTAUTH_URL in .env matches your app URL
- Restart development server

### Issue: Redirect loop
**Solution:**
- Check middleware.ts configuration
- Verify public paths are correctly defined
- Clear browser cache

### Issue: "Invalid credentials" on valid login
**Solution:**
- Verify user exists in database
- Check password hash in database
- Try creating new user

## Security Verification

### Password Security
- [ ] Passwords are hashed with bcrypt
- [ ] Password hash starts with `$2a$10$`
- [ ] Plain passwords are never stored
- [ ] Minimum 8 characters enforced

### Session Security
- [ ] JWT tokens are used
- [ ] Session cookies are httpOnly (check browser DevTools)
- [ ] NEXTAUTH_SECRET is set
- [ ] Session expires appropriately

### Input Validation
- [ ] Email validation works
- [ ] Username validation works (3-20 chars)
- [ ] Password length validation works
- [ ] XSS protection (try entering `<script>alert('xss')</script>`)

## Performance Testing

### Load Time
- [ ] Registration page loads < 1s
- [ ] Login page loads < 1s
- [ ] Authentication completes < 2s

### UX Testing
- [ ] Loading states appear during async operations
- [ ] Error messages are clear and helpful
- [ ] Success feedback is provided
- [ ] Forms are intuitive to use

## Browser Testing

Test in multiple browsers:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

## Mobile Testing

Test responsive design:
- [ ] Navigation bar adapts to mobile
- [ ] Forms are usable on mobile
- [ ] Buttons are easily clickable
- [ ] Text is readable without zooming

## Next Steps After Testing

1. **If all tests pass:**
   - System is ready for other agents to build upon
   - Document any custom test users created
   - Commit changes to git

2. **If tests fail:**
   - Check error messages in browser console
   - Check server logs in terminal
   - Verify database connection
   - Review .env configuration
   - Check Next.js version compatibility

## Integration with Other Features

Once authentication is working:

### For Trip Management (Agent 2)
```typescript
import { useAuth } from '@/hooks/useAuth';

const { user, isAuthenticated } = useAuth();
// user.id can be used to create trips
// user.email for display
```

### For API Routes
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = session.user.id;
  // Use userId for database queries
}
```

### For Server Components
```typescript
import { cookies } from 'next/headers';

export default async function Page() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('next-auth.session-token');

  if (!sessionToken) {
    redirect('/auth/login');
  }

  // Render protected content
}
```

## Monitoring & Debugging

### Enable Debug Logging
Add to .env:
```env
NEXTAUTH_DEBUG=true
```

### Check Logs
```bash
# Watch server logs
npm run dev

# Check for authentication errors
# Should see NextAuth debug logs if enabled
```

### Browser DevTools
- Network tab: Check API calls to /api/auth/*
- Application tab: Check cookies for session token
- Console tab: Check for errors

## Success Criteria

Authentication system is working correctly when:
- ✅ New users can register
- ✅ Users can login with credentials
- ✅ Session persists across refreshes
- ✅ Protected routes redirect to login
- ✅ Logout works correctly
- ✅ Passwords are hashed in database
- ✅ Error handling works
- ✅ Loading states appear
- ✅ Navigation updates based on auth state

## Contact & Support

If issues persist:
1. Check `AGENT1_IMPLEMENTATION_SUMMARY.md` for implementation details
2. Review `docs/01-authentication.md` for specifications
3. Check Next.js and NextAuth documentation
4. Verify environment variables are correct
