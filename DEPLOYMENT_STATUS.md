# Deployment Status

## ✅ Vercel Deployment (Recommended)

Your application is ready for Vercel, but **Docker and Redis do NOT run there.** Vercel only hosts the Next.js app.

### 🛑 Action Required: Connect External Databases
You must set these **Environment Variables** in Vercel:

1.  **Database (PostgreSQL)**:
    -   Connect a provider like **Neon**, **Supabase**, or **Vercel Postgres**.
    -   Variable: `DATABASE_URL`

2.  **Redis (Caching & Queues)**:
    -   Connect a provider like **Upstash** or **Redis Cloud**.
    -   Variable: `REDIS_URL` or `KV_URL`

> **Note:** Without these variables, your deployed app will crash or fail to feature like login/signup.

---

## ⚠️ Kubernetes / Docker Deployment (Self-Hosted)

If you prefer to run everything (App + Redis + DB) yourself using Docker, follow these steps locally or on a VPS (DigitalOcean, AWS EC2).

### 1. Build Docker Image
```powershell
docker build -t inventory-platform-app:latest -f Dockerfile .
```

### 2. Run with Docker Compose
```powershell
docker-compose up -d
```
This *will* run Redis and Postgres automatically.

---

## ✅ Build Fixes Log

1.  **Fixed Lockfile**: Regenerated `pnpm-lock.yaml`.
2.  **Fixed Redis**: Enabled `lazyConnect` to prevent build crashes.
3.  **Fixed Security**: Updated Next.js to v16.1.6.


**Build Error:**
```
useSearchParams() should be wrapped in a suspense boundary at page "/login"
```

### How to Fix

The login page needs to wrap `useSearchParams()` in a Suspense boundary. This is a Next.js 13+ requirement.

**Fix needed in:** `app/login/page.tsx`

Wrap the component using `useSearchParams()` like this:
```tsx
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginContent() {
  const searchParams = useSearchParams();
  // ... rest of your component
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
```

### After Fixing

1. **Rebuild Docker image:**
   ```powershell
   docker build -t inventory-platform-app:latest -f Dockerfile .
   ```

2. **Load image into Kind:**
   ```powershell
   kind load docker-image inventory-platform-app:latest --name inventory-platform
   ```

3. **Deploy application:**
   ```powershell
   kubectl apply -f k8s\app-deployment.yaml
   ```

## Current Status

```powershell
# View all resources
kubectl get all -n inventory-platform

# View pods
kubectl get pods -n inventory-platform

# View services
kubectl get svc -n inventory-platform
```

## Access Services

### Redis (Ready)
```powershell
# Port forward to access Redis
kubectl port-forward svc/redis-service 6379:6379 -n inventory-platform
```

### Nginx (Ready - waiting for app)
```powershell
# Port forward Nginx
kubectl port-forward svc/nginx-service 8080:80 -n inventory-platform

# Access at: http://localhost:8080
# (Will show backend unavailable until app is deployed)
```

### Application (Pending build fix)
Once the build issue is fixed and the app is deployed:
```powershell
# Port forward app service directly
kubectl port-forward svc/app-service 3000:3000 -n inventory-platform
```

## Next Steps

1. ✅ Redis is running
2. ✅ Nginx is deployed
3. ⏳ Fix Next.js build issue (useSearchParams Suspense)
4. ⏳ Build Docker image
5. ⏳ Load image into Kind
6. ⏳ Deploy application

## Troubleshooting

### Check Pod Logs
```powershell
# Redis logs
kubectl logs -f deployment/redis -n inventory-platform

# Nginx logs
kubectl logs -f deployment/nginx -n inventory-platform

# App logs (once deployed)
kubectl logs -f deployment/app -n inventory-platform
```

### Check Pod Status
```powershell
kubectl describe pod <pod-name> -n inventory-platform
```

### Restart Deployments
```powershell
kubectl rollout restart deployment/redis -n inventory-platform
kubectl rollout restart deployment/nginx -n inventory-platform
```

---

**Status Summary:**
- ✅ Infrastructure: Ready (Redis, Nginx)
- ⏳ Application: Waiting for build fix

