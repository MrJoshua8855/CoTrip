# Authentication System Implementation Guide

## Overview
Implement a secure authentication system using NextAuth.js with support for credentials-based login and OAuth providers (Google, GitHub).

## Step-by-Step Implementation

### Step 1: Install Dependencies
```bash
npm install next-auth @auth/prisma-adapter bcryptjs
npm install --save-dev @types/bcryptjs
```

### Step 2: Create Authentication Configuration

#### File: `src/lib/auth.ts`
```typescript
import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/login',
    signUp: '/auth/register',
    error: '/auth/error',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user || !user.passwordHash) {
          throw new Error('User not found');
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          throw new Error('Invalid password');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          image: user.avatarUrl,
        };
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
};
```

### Step 3: Create NextAuth Route Handler

#### File: `src/app/api/auth/[...nextauth]/route.ts`
```typescript
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

### Step 4: Create Registration API Route

#### File: `src/app/api/auth/register/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  password: z.string().min(8),
  fullName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = registerSchema.parse(body);

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: validated.email },
          { username: validated.username }
        ]
      }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validated.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        username: validated.username,
        passwordHash,
        fullName: validated.fullName,
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
      }
    });

    return NextResponse.json(
      { message: 'User created successfully', user },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Step 5: Create Authentication Pages

#### File: `src/app/auth/login/page.tsx`
```typescript
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        router.push('/trips');
        router.refresh();
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-md mx-auto mt-20">
      <h1 className="text-3xl font-bold mb-6">Sign In</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block mb-2">Email</label>
          <input
            type="email"
            {...register('email')}
            className="w-full p-2 border rounded"
            disabled={isLoading}
          />
          {errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block mb-2">Password</label>
          <input
            type="password"
            {...register('password')}
            className="w-full p-2 border rounded"
            disabled={isLoading}
          />
          {errors.password && (
            <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
          )}
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white">Or continue with</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => signIn('google', { callbackUrl: '/trips' })}
            className="border p-2 rounded hover:bg-gray-50"
          >
            Google
          </button>
          <button
            onClick={() => signIn('github', { callbackUrl: '/trips' })}
            className="border p-2 rounded hover:bg-gray-50"
          >
            GitHub
          </button>
        </div>
      </div>

      <p className="mt-6 text-center">
        Don't have an account?{' '}
        <Link href="/auth/register" className="text-blue-500 hover:underline">
          Sign Up
        </Link>
      </p>
    </div>
  );
}
```

#### File: `src/app/auth/register/page.tsx`
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn } from 'next-auth/react';

const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  fullName: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          username: data.username,
          password: data.password,
          fullName: data.fullName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setError(error.error || 'Registration failed');
        return;
      }

      // Auto-login after registration
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.ok) {
        router.push('/trips');
        router.refresh();
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-md mx-auto mt-20">
      <h1 className="text-3xl font-bold mb-6">Create Account</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Form fields similar to login page */}
        {/* Add all registration fields here */}
      </form>
    </div>
  );
}
```

### Step 6: Create Authentication Middleware

#### File: `src/middleware.ts`
```typescript
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // Additional middleware logic if needed
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        // Routes that require authentication
        const protectedPaths = ['/trips', '/profile', '/api/trips'];
        const pathname = req.nextUrl.pathname;

        const isProtected = protectedPaths.some(path =>
          pathname.startsWith(path)
        );

        if (isProtected && !token) {
          return false;
        }

        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    '/trips/:path*',
    '/profile/:path*',
    '/api/trips/:path*',
    '/api/expenses/:path*',
    '/api/proposals/:path*',
  ],
};
```

### Step 7: Create Session Provider

#### File: `src/app/providers.tsx`
```typescript
'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}
```

### Step 8: Update Root Layout

#### File: `src/app/layout.tsx`
```typescript
import { Providers } from './providers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Step 9: Create Authentication Hooks

#### File: `src/hooks/useAuth.ts`
```typescript
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const login = async (email: string, password: string) => {
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.ok) {
      router.push('/trips');
      router.refresh();
    }

    return result;
  };

  const logout = async () => {
    await signOut({ redirect: false });
    router.push('/');
  };

  return {
    user: session?.user,
    isAuthenticated: !!session,
    isLoading: status === 'loading',
    login,
    logout,
  };
}
```

### Step 10: Create Protected Route Component

#### File: `src/components/auth/ProtectedRoute.tsx`
```typescript
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/login');
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (!session) {
    return null;
  }

  return <>{children}</>;
}
```

## Security Considerations

1. **Password Requirements**
   - Minimum 8 characters
   - Recommend including complexity requirements
   - Consider implementing password strength meter

2. **Session Security**
   - Use secure, httpOnly cookies
   - Implement session timeout
   - Rotate session tokens

3. **Rate Limiting**
   - Implement rate limiting on login attempts
   - Use captcha after multiple failed attempts

4. **Email Verification**
   - Send verification email on registration
   - Require email verification before login

5. **Two-Factor Authentication (Optional)**
   - Implement TOTP-based 2FA
   - Use libraries like speakeasy

## Testing Checklist

- [ ] User can register with valid credentials
- [ ] Registration fails with existing email/username
- [ ] User can login with correct credentials
- [ ] Login fails with incorrect credentials
- [ ] OAuth login works (Google, GitHub)
- [ ] Protected routes redirect to login
- [ ] Session persists across page refreshes
- [ ] Logout clears session properly
- [ ] Password reset flow works
- [ ] Email verification works

## Common Issues & Solutions

### Issue: OAuth redirect URL mismatch
**Solution**: Ensure callback URLs in provider settings match your app URLs

### Issue: Session not persisting
**Solution**: Check NextAuth secret and session strategy configuration

### Issue: Prisma adapter errors
**Solution**: Ensure database schema matches NextAuth requirements

### Issue: CSRF token mismatch
**Solution**: Ensure NEXTAUTH_URL is set correctly in environment variables

## Additional Features to Consider

1. **Password Reset Flow**
   - Generate reset tokens
   - Send reset email
   - Create reset page

2. **Email Verification**
   - Generate verification tokens
   - Send verification email
   - Block unverified users

3. **Social Login Enhancement**
   - Add more providers (Facebook, Apple)
   - Handle account linking
   - Profile data sync

4. **Security Enhancements**
   - Implement 2FA
   - Add login history
   - Device management
   - Suspicious activity detection