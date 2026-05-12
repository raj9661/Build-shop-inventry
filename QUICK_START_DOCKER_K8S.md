# Quick Start: Docker & Kubernetes

## 🐳 Docker Services - Currently Running ✅

Your Docker services are already running:

**Development Mode (Port 3001):**
- ✅ Application: http://localhost:3001
- ✅ Redis: localhost:6379

**Check Status:**
```powershell
docker compose -f docker-compose.dev.yml ps
```

**View Logs:**
```powershell
docker compose -f docker-compose.dev.yml logs -f
```

**Stop Services:**
```powershell
docker compose -f docker-compose.dev.yml down
```

**Restart Services:**
```powershell
docker compose -f docker-compose.dev.yml restart
```

---

## ☸️ Setting Up Kubernetes (First Time)

### Option 1: Docker Desktop Kubernetes (Easiest - Recommended)

1. **Open Docker Desktop**
2. **Go to Settings** (gear icon)
3. **Click "Kubernetes"** in the left sidebar
4. **Check "Enable Kubernetes"**
5. **Click "Apply & Restart"**
6. **Wait for Kubernetes to start** (green icon appears)

**Verify:**
```powershell
kubectl cluster-info
kubectl get nodes
```

You should see a node named `docker-desktop`.

### Option 2: Install Minikube (Alternative)

1. **Install Minikube:**
   ```powershell
   # Using Chocolatey (if you have it)
   choco install minikube
   
   # Or download from: https://minikube.sigs.k8s.io/docs/start/
   ```

2. **Start Minikube:**
   ```powershell
   minikube start
   ```

3. **Verify:**
   ```powershell
   kubectl get nodes
   minikube status
   ```

---

## 🚀 Deploying to Kubernetes

### Step 1: Prepare Secrets

Create your secrets file:

```powershell
# Copy the example
Copy-Item k8s\secrets.yaml.example k8s\secrets.yaml

# Edit with your actual secrets
notepad k8s\secrets.yaml
```

**Important:** Update all the values in `k8s/secrets.yaml` with your actual secrets!

### Step 2: Build Docker Image

```powershell
# Build the image
docker build -t inventory-platform-app:latest -f Dockerfile .

# For Minikube: Load image
minikube image load inventory-platform-app:latest

# For Docker Desktop: Image is already available
```

### Step 3: Deploy Using Script

**Windows (PowerShell):**
```powershell
.\k8s\deploy.ps1
```

**Or manually:**
```powershell
# 1. Create namespace
kubectl apply -f k8s\namespace.yaml

# 2. Create secrets (DO THIS FIRST - update secrets.yaml first!)
kubectl apply -f k8s\secrets.yaml

# 3. Create ConfigMap
kubectl apply -f k8s\configmap.yaml

# 4. Create Redis storage
kubectl apply -f k8s\redis-pvc.yaml

# 5. Deploy Redis
kubectl apply -f k8s\redis-deployment.yaml

# 6. Wait for Redis (optional but recommended)
kubectl wait --for=condition=ready pod -l app=redis -n inventory-platform --timeout=120s

# 7. Deploy Application
kubectl apply -f k8s\app-deployment.yaml

# 8. Deploy Nginx
kubectl apply -f k8s\nginx-deployment.yaml
```

### Step 4: Verify Deployment

```powershell
# View all resources
kubectl get all -n inventory-platform

# View pods status
kubectl get pods -n inventory-platform

# View services
kubectl get svc -n inventory-platform
```

### Step 5: Access the Application

**Port Forward (Recommended for Local Access):**
```powershell
# Forward Nginx service
kubectl port-forward svc/nginx-service 8080:80 -n inventory-platform

# Access at: http://localhost:8080
```

**Or use NodePort/LoadBalancer:**
```powershell
# Check service external IP
kubectl get svc nginx-service -n inventory-platform
```

---

## 📋 Common Commands

### View Status
```powershell
# All resources
kubectl get all -n inventory-platform

# Pods
kubectl get pods -n inventory-platform

# Services
kubectl get svc -n inventory-platform
```

### View Logs
```powershell
# Application logs
kubectl logs -f deployment/app -n inventory-platform

# Redis logs
kubectl logs -f deployment/redis -n inventory-platform

# Nginx logs
kubectl logs -f deployment/nginx -n inventory-platform
```

### Scale Application
```powershell
# Scale app to 3 replicas
kubectl scale deployment app --replicas=3 -n inventory-platform
```

### Update Application
```powershell
# Rebuild image
docker build -t inventory-platform-app:v1.1 -f Dockerfile .

# For Minikube: Reload image
minikube image load inventory-platform-app:v1.1

# Update deployment
kubectl set image deployment/app app=inventory-platform-app:v1.1 -n inventory-platform
```

### Cleanup
```powershell
# Delete entire namespace (removes everything)
kubectl delete namespace inventory-platform

# Or delete individual resources
kubectl delete -f k8s\
```

---

## 🔍 Troubleshooting

### Pods Not Starting

```powershell
# Check pod status
kubectl get pods -n inventory-platform

# Describe pod (get detailed info)
kubectl describe pod <pod-name> -n inventory-platform

# Check events
kubectl get events -n inventory-platform --sort-by='.lastTimestamp'
```

### View Pod Logs

```powershell
# Application logs
kubectl logs <pod-name> -n inventory-platform

# Previous container logs (if crashed)
kubectl logs <pod-name> -n inventory-platform --previous
```

### Secrets Issues

```powershell
# Verify secret exists
kubectl get secret app-secrets -n inventory-platform

# Check if secrets are configured (shows keys, not values)
kubectl describe secret app-secrets -n inventory-platform
```

### Image Pull Errors (Minikube)

```powershell
# Verify image is loaded
minikube image ls

# Reload image
minikube image load inventory-platform-app:latest
```

---

## 📖 Full Tutorial

For detailed information, see:
- **`DOCKER_KUBERNETES_TUTORIAL.md`** - Complete tutorial with all commands
- **`KUBERNETES_SETUP.md`** - Kubernetes setup guide
- **`k8s/README.md`** - Detailed Kubernetes deployment guide

---

## ✅ Quick Checklist

- [ ] Docker Desktop installed and running
- [ ] Kubernetes enabled in Docker Desktop (or Minikube installed)
- [ ] `k8s/secrets.yaml` created and configured with your actual secrets
- [ ] Docker image built: `docker build -t inventory-platform-app:latest -f Dockerfile .`
- [ ] Services deployed: `.\k8s\deploy.ps1`
- [ ] Pods running: `kubectl get pods -n inventory-platform`
- [ ] Application accessible via port-forward

---

Happy Deploying! 🚀


