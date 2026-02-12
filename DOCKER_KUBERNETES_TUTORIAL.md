# Docker & Kubernetes Tutorial

A complete guide for running and managing your Inventory Platform with Docker and Kubernetes.

## 📚 Table of Contents

1. [Docker Basics](#docker-basics)
2. [Docker Commands](#docker-commands)
3. [Running with Docker Compose](#running-with-docker-compose)
4. [Kubernetes Basics](#kubernetes-basics)
5. [Setting Up Kubernetes](#setting-up-kubernetes)
6. [Deploying to Kubernetes](#deploying-to-kubernetes)
7. [Common Operations](#common-operations)
8. [Troubleshooting](#troubleshooting)

---

## 🐳 Docker Basics

### What is Docker?

Docker is a platform that packages applications and their dependencies into **containers**. Containers are lightweight, portable, and run consistently across different environments.

### Key Concepts

- **Container**: A running instance of an image
- **Image**: A read-only template for creating containers
- **Dockerfile**: Instructions to build an image
- **Docker Compose**: Tool for running multi-container applications

---

## 📦 Docker Commands

### Basic Commands

```powershell
# Check Docker version
docker --version

# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# View Docker images
docker images

# View Docker volumes
docker volume ls

# View Docker networks
docker network ls
```

### Container Management

```powershell
# Start a container
docker start <container-name>

# Stop a container
docker stop <container-name>

# Restart a container
docker restart <container-name>

# Remove a container
docker rm <container-name>

# View container logs
docker logs <container-name>

# Follow logs in real-time
docker logs -f <container-name>

# Execute command in running container
docker exec -it <container-name> /bin/sh
```

### Image Management

```powershell
# Build an image from Dockerfile
docker build -t <image-name>:<tag> -f Dockerfile .

# Pull an image from registry
docker pull <image-name>:<tag>

# Push an image to registry
docker push <image-name>:<tag>

# Remove an image
docker rmi <image-name>:<tag>
```

---

## 🚀 Running with Docker Compose

### Start Services

**Development mode:**
```powershell
docker compose -f docker-compose.dev.yml up -d
```

**Production mode:**
```powershell
docker compose up -d
```

The `-d` flag runs containers in **detached mode** (background).

### View Status

```powershell
# View running services
docker compose -f docker-compose.dev.yml ps

# View logs for all services
docker compose -f docker-compose.dev.yml logs

# View logs for specific service
docker compose -f docker-compose.dev.yml logs app
docker compose -f docker-compose.dev.yml logs redis

# Follow logs in real-time
docker compose -f docker-compose.dev.yml logs -f app
```

### Stop Services

```powershell
# Stop services (keeps containers)
docker compose -f docker-compose.dev.yml stop

# Stop and remove containers
docker compose -f docker-compose.dev.yml down

# Stop, remove containers, and volumes
docker compose -f docker-compose.dev.yml down -v
```

### Rebuild Services

```powershell
# Rebuild and restart services
docker compose -f docker-compose.dev.yml up -d --build

# Rebuild specific service
docker compose -f docker-compose.dev.yml up -d --build app
```

### Access Services

After starting services, access them at:
- **Application**: http://localhost:3001 (dev) or http://localhost:3000 (production)
- **Redis**: localhost:6379
- **Redis Commander** (if running): http://localhost:8081

---

## ☸️ Kubernetes Basics

### What is Kubernetes?

Kubernetes (K8s) is an open-source platform for automating deployment, scaling, and management of containerized applications.

### Key Concepts

- **Pod**: Smallest deployable unit (contains one or more containers)
- **Deployment**: Manages Pod replicas and updates
- **Service**: Exposes Pods to network traffic
- **Namespace**: Virtual cluster for resource isolation
- **ConfigMap**: Non-sensitive configuration data
- **Secret**: Sensitive configuration data (passwords, keys)
- **Volume**: Persistent storage for Pods

### Kubernetes Architecture

```
┌─────────────────────────────────────────┐
│           Kubernetes Cluster            │
│                                         │
│  ┌──────────────┐      ┌──────────────┐│
│  │   Control    │      │   Worker     ││
│  │    Plane     │──────▶   Nodes      ││
│  │              │      │  (Pods)      ││
│  └──────────────┘      └──────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │         API Server                   ││
│  │         etcd (storage)              ││
│  │         Scheduler                    ││
│  │         Controller Manager           ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

---

## 🔧 Setting Up Kubernetes

### Option 1: Docker Desktop (Easiest for Windows)

1. **Enable Kubernetes in Docker Desktop:**
   - Open Docker Desktop
   - Go to Settings → Kubernetes
   - Check "Enable Kubernetes"
   - Click "Apply & Restart"

2. **Verify installation:**
   ```powershell
   kubectl cluster-info
   kubectl get nodes
   ```

### Option 2: Minikube (Local Kubernetes)

1. **Install Minikube:**
   ```powershell
   # Using Chocolatey
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

### Option 3: Kind (Kubernetes in Docker)

1. **Install Kind:**
   ```powershell
   choco install kind
   ```

2. **Create cluster:**
   ```powershell
   kind create cluster --name inventory-platform
   ```

---

## 🚀 Deploying to Kubernetes

### Step 1: Build and Prepare Docker Image

```powershell
# Build the image
docker build -t inventory-platform-app:latest -f Dockerfile .

# For Minikube: Load image into Minikube
minikube image load inventory-platform-app:latest

# For Kind: Load image into Kind
kind load docker-image inventory-platform-app:latest --name inventory-platform
```

**For production (with registry):**
```powershell
# Tag image for your registry
docker tag inventory-platform-app:latest your-registry.io/inventory-platform-app:v1.0

# Push to registry
docker push your-registry.io/inventory-platform-app:v1.0
```

### Step 2: Create Secrets

**Method 1: From file**
```powershell
# Copy the example
Copy-Item k8s\secrets.yaml.example k8s\secrets.yaml

# Edit with your actual secrets (use any editor)
notepad k8s\secrets.yaml

# Apply secrets
kubectl apply -f k8s\secrets.yaml
```

**Method 2: From command line**
```powershell
kubectl create secret generic app-secrets \
  --from-literal=DATABASE_URL='your-database-url' \
  --from-literal=REDIS_URL='redis://redis-service:6379' \
  --from-literal=JWT_SECRET='your-jwt-secret' \
  --from-literal=JWT_REFRESH_SECRET='your-refresh-secret' \
  --from-literal=STRIPE_SECRET_KEY='your-stripe-key' \
  --from-literal=RAZORPAY_KEY_ID='your-razorpay-id' \
  --from-literal=RAZORPAY_KEY_SECRET='your-razorpay-secret' \
  --from-literal=NEXTAUTH_SECRET='your-nextauth-secret' \
  --from-literal=NEXTAUTH_URL='http://localhost:3000' \
  --namespace=inventory-platform
```

**Method 3: From .env file**
```powershell
kubectl create secret generic app-secrets \
  --from-env-file=.env \
  --namespace=inventory-platform
```

### Step 3: Deploy Using Script (Recommended)

**Windows (PowerShell):**
```powershell
.\k8s\deploy.ps1
```

**Linux/Mac:**
```bash
chmod +x k8s/deploy.sh
./k8s/deploy.sh
```

### Step 4: Manual Deployment

```powershell
# 1. Create namespace
kubectl apply -f k8s\namespace.yaml

# 2. Create ConfigMap
kubectl apply -f k8s\configmap.yaml

# 3. Create Redis PVC (Persistent Volume)
kubectl apply -f k8s\redis-pvc.yaml

# 4. Deploy Redis
kubectl apply -f k8s\redis-deployment.yaml

# 5. Wait for Redis to be ready
kubectl wait --for=condition=ready pod -l app=redis -n inventory-platform --timeout=120s

# 6. Deploy Application
kubectl apply -f k8s\app-deployment.yaml

# 7. Deploy Nginx
kubectl apply -f k8s\nginx-deployment.yaml

# 8. Optional: Deploy Ingress
kubectl apply -f k8s\ingress.yaml
```

---

## 🔍 Common Operations

### Viewing Resources

```powershell
# View all resources in namespace
kubectl get all -n inventory-platform

# View pods
kubectl get pods -n inventory-platform

# View services
kubectl get svc -n inventory-platform

# View deployments
kubectl get deployments -n inventory-platform

# View configmaps
kubectl get configmaps -n inventory-platform

# View secrets (names only, not values)
kubectl get secrets -n inventory-platform
```

### Viewing Logs

```powershell
# Application logs
kubectl logs -f deployment/app -n inventory-platform

# Redis logs
kubectl logs -f deployment/redis -n inventory-platform

# Nginx logs
kubectl logs -f deployment/nginx -n inventory-platform

# Specific pod logs
kubectl logs -f <pod-name> -n inventory-platform

# All pods matching label
kubectl logs -f -l app=inventory-platform -n inventory-platform
```

### Scaling Applications

```powershell
# Scale app to 3 replicas
kubectl scale deployment app --replicas=3 -n inventory-platform

# Scale nginx to 2 replicas
kubectl scale deployment nginx --replicas=2 -n inventory-platform

# Auto-scaling (requires metrics server)
kubectl autoscale deployment app --min=2 --max=5 --cpu-percent=80 -n inventory-platform
```

### Port Forwarding (Local Access)

```powershell
# Forward Nginx service to local port 8080
kubectl port-forward svc/nginx-service 8080:80 -n inventory-platform

# Forward app service directly
kubectl port-forward svc/app-service 3000:3000 -n inventory-platform

# Access at http://localhost:8080
```

### Updating Deployments

```powershell
# Update image (if using registry)
kubectl set image deployment/app app=inventory-platform-app:v1.1 -n inventory-platform

# Rollout status
kubectl rollout status deployment/app -n inventory-platform

# Rollback to previous version
kubectl rollout undo deployment/app -n inventory-platform

# View rollout history
kubectl rollout history deployment/app -n inventory-platform
```

### Accessing Pods

```powershell
# Execute command in pod
kubectl exec -it <pod-name> -n inventory-platform -- /bin/sh

# Redis CLI access
kubectl exec -it deployment/redis -n inventory-platform -- redis-cli

# Execute command without interactive shell
kubectl exec <pod-name> -n inventory-platform -- env
```

### Describing Resources

```powershell
# Get detailed info about pod
kubectl describe pod <pod-name> -n inventory-platform

# Get detailed info about service
kubectl describe svc app-service -n inventory-platform

# Get detailed info about deployment
kubectl describe deployment app -n inventory-platform
```

### Deleting Resources

```powershell
# Delete specific deployment
kubectl delete deployment app -n inventory-platform

# Delete service
kubectl delete svc app-service -n inventory-platform

# Delete entire namespace (removes everything)
kubectl delete namespace inventory-platform

# Delete all resources in namespace
kubectl delete all --all -n inventory-platform
```

---

## 🛠️ Troubleshooting

### Docker Issues

**Container won't start:**
```powershell
# Check logs
docker logs <container-name>

# Check container status
docker inspect <container-name>

# Restart container
docker restart <container-name>
```

**Port already in use:**
```powershell
# Find process using port
netstat -ano | findstr :3000

# Stop the process or change port in docker-compose.yml
```

**Out of disk space:**
```powershell
# Clean up unused resources
docker system prune -a

# Remove unused volumes
docker volume prune
```

### Kubernetes Issues

**Pod stuck in Pending:**
```powershell
# Check pod events
kubectl describe pod <pod-name> -n inventory-platform

# Check node resources
kubectl top nodes

# Check pod resource requests
kubectl describe pod <pod-name> -n inventory-platform | Select-String "Requests"
```

**Pod stuck in CrashLoopBackOff:**
```powershell
# Check pod logs
kubectl logs <pod-name> -n inventory-platform

# Check previous container logs
kubectl logs <pod-name> -n inventory-platform --previous

# Describe pod for events
kubectl describe pod <pod-name> -n inventory-platform
```

**Image pull errors:**
```powershell
# For Minikube: Ensure image is loaded
minikube image ls

# For Kind: Reload image
kind load docker-image inventory-platform-app:latest --name inventory-platform
```

**Service not accessible:**
```powershell
# Check service endpoints
kubectl get endpoints -n inventory-platform

# Check service selector matches pod labels
kubectl get svc app-service -n inventory-platform -o yaml
kubectl get pods -l app=inventory-platform -n inventory-platform
```

**Secrets not working:**
```powershell
# Verify secret exists
kubectl get secret app-secrets -n inventory-platform

# Check secret keys (not values)
kubectl describe secret app-secrets -n inventory-platform

# Verify secret is mounted in pod
kubectl describe pod <pod-name> -n inventory-platform | Select-String "Secret"
```

---

## 📊 Monitoring Commands

### Resource Usage

```powershell
# Node resource usage (requires metrics-server)
kubectl top nodes

# Pod resource usage
kubectl top pods -n inventory-platform

# All resources in namespace
kubectl top pods --all-namespaces
```

### Event Monitoring

```powershell
# View recent events
kubectl get events -n inventory-platform --sort-by='.lastTimestamp'

# Watch events in real-time
kubectl get events -n inventory-platform --watch
```

---

## 🎯 Quick Reference

### Docker Compose Cheat Sheet

```powershell
# Start services
docker compose -f docker-compose.dev.yml up -d

# Stop services
docker compose -f docker-compose.dev.yml down

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Rebuild
docker compose -f docker-compose.dev.yml up -d --build
```

### Kubernetes Cheat Sheet

```powershell
# Get all resources
kubectl get all -n inventory-platform

# View logs
kubectl logs -f deployment/app -n inventory-platform

# Port forward
kubectl port-forward svc/nginx-service 8080:80 -n inventory-platform

# Scale
kubectl scale deployment app --replicas=3 -n inventory-platform

# Delete everything
kubectl delete namespace inventory-platform
```

---

## 📝 Next Steps

1. **Set up CI/CD** - Automate Docker builds and Kubernetes deployments
2. **Configure Ingress** - Set up external access with SSL/TLS
3. **Add Monitoring** - Install Prometheus and Grafana
4. **Set up Logging** - Centralized logging with ELK or Loki
5. **Backup Strategy** - Configure backups for Redis persistent volumes
6. **Security** - Implement RBAC, network policies, and pod security policies

---

## 🔗 Useful Resources

- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)

---

## 💡 Tips

1. **Always use namespaces** to isolate resources
2. **Use ConfigMaps for config**, Secrets for sensitive data
3. **Set resource limits** to prevent resource exhaustion
4. **Use health checks** for better reliability
5. **Keep images small** using multi-stage builds
6. **Tag images properly** (use semantic versioning)
7. **Document your deployments** (keep manifests in version control)

---

Happy Deploying! 🚀

