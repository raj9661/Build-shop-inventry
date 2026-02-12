# Quick Start: Kubernetes Setup Complete! ✅

Your Kubernetes cluster has been successfully created using **Kind** (Kubernetes in Docker).

## 🎉 What's Set Up

- ✅ **Kind** installed and configured
- ✅ **kubectl** installed and configured  
- ✅ **Kubernetes cluster** created: `inventory-platform`
- ✅ **Cluster context** set: `kind-inventory-platform`

## 📋 Cluster Information

**Cluster Name:** `inventory-platform`  
**Context:** `kind-inventory-platform`  
**Node Image:** `kindest/node:v1.27.3`

## 🚀 Quick Commands

### Check Cluster Status
```powershell
kubectl get nodes
kubectl cluster-info --context kind-inventory-platform
```

### View All Clusters
```powershell
kind get clusters
```

### Delete Cluster (if needed)
```powershell
kind delete cluster --name inventory-platform
```

## 📝 Next Steps to Deploy Your Application

### Step 1: Build Docker Image
```powershell
docker build -t inventory-platform-app:latest -f Dockerfile .
```

### Step 2: Load Image into Kind
```powershell
kind load docker-image inventory-platform-app:latest --name inventory-platform
```

**Verify image is loaded:**
```powershell
docker exec -it inventory-platform-control-plane crictl images | Select-String "inventory-platform"
```

### Step 3: Create Secrets
```powershell
# Copy example secrets
Copy-Item k8s\secrets.yaml.example k8s\secrets.yaml

# Edit with your actual secrets (IMPORTANT!)
notepad k8s\secrets.yaml
```

**Update these values in `k8s\secrets.yaml`:**
- DATABASE_URL
- JWT_SECRET
- JWT_REFRESH_SECRET
- STRIPE_SECRET_KEY
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- NEXTAUTH_SECRET
- Other secrets as needed

### Step 4: Deploy to Kubernetes

**Option A: Use Deployment Script**
```powershell
.\k8s\deploy.ps1
```

**Option B: Manual Deployment**
```powershell
# 1. Create namespace
kubectl create namespace inventory-platform

# 2. Apply secrets
kubectl apply -f k8s\secrets.yaml

# 3. Apply ConfigMap
kubectl apply -f k8s\configmap.yaml

# 4. Create Redis storage
kubectl apply -f k8s\redis-pvc.yaml

# 5. Deploy Redis
kubectl apply -f k8s\redis-deployment.yaml

# 6. Wait for Redis to be ready
kubectl wait --for=condition=ready pod -l app=redis -n inventory-platform --timeout=120s

# 7. Deploy Application
kubectl apply -f k8s\app-deployment.yaml

# 8. Deploy Nginx
kubectl apply -f k8s\nginx-deployment.yaml
```

### Step 5: Verify Deployment
```powershell
# View all resources
kubectl get all -n inventory-platform

# Check pod status
kubectl get pods -n inventory-platform

# View services
kubectl get svc -n inventory-platform
```

### Step 6: Access Your Application

**Port Forward (Recommended):**
```powershell
# Forward Nginx service
kubectl port-forward svc/nginx-service 8080:80 -n inventory-platform

# Access at: http://localhost:8080
```

**Or forward app service directly:**
```powershell
kubectl port-forward svc/app-service 3000:3000 -n inventory-platform

# Access at: http://localhost:3000
```

## 🔍 Useful Commands

### View Resources
```powershell
# All resources in namespace
kubectl get all -n inventory-platform

# Pods
kubectl get pods -n inventory-platform

# Services
kubectl get svc -n inventory-platform

# Deployments
kubectl get deployments -n inventory-platform
```

### View Logs
```powershell
# Application logs
kubectl logs -f deployment/app -n inventory-platform

# Redis logs
kubectl logs -f deployment/redis -n inventory-platform

# Nginx logs
kubectl logs -f deployment/nginx -n inventory-platform

# Specific pod logs
kubectl logs -f <pod-name> -n inventory-platform
```

### Troubleshooting
```powershell
# Describe pod (get detailed info)
kubectl describe pod <pod-name> -n inventory-platform

# Check pod events
kubectl get events -n inventory-platform --sort-by='.lastTimestamp'

# Execute command in pod
kubectl exec -it <pod-name> -n inventory-platform -- /bin/sh
```

### Scale Application
```powershell
# Scale app to 3 replicas
kubectl scale deployment app --replicas=3 -n inventory-platform

# Scale nginx to 2 replicas
kubectl scale deployment nginx --replicas=2 -n inventory-platform
```

### Update Application
```powershell
# 1. Rebuild image
docker build -t inventory-platform-app:v1.1 -f Dockerfile .

# 2. Load new image
kind load docker-image inventory-platform-app:v1.1 --name inventory-platform

# 3. Update deployment
kubectl set image deployment/app app=inventory-platform-app:v1.1 -n inventory-platform

# 4. Check rollout status
kubectl rollout status deployment/app -n inventory-platform
```

## 🛠️ Troubleshooting

### Cluster Not Ready
```powershell
# Wait for cluster to be ready (may take a minute)
kubectl get nodes --watch

# Check cluster status
kubectl cluster-info
```

### Image Not Found
```powershell
# Verify image exists locally
docker images | Select-String "inventory-platform"

# Load image into Kind
kind load docker-image inventory-platform-app:latest --name inventory-platform

# Verify in cluster
docker exec -it inventory-platform-control-plane crictl images
```

### Pods Not Starting
```powershell
# Check pod status
kubectl get pods -n inventory-platform

# Describe pod for details
kubectl describe pod <pod-name> -n inventory-platform

# Check logs
kubectl logs <pod-name> -n inventory-platform
```

## 📚 Documentation Files

- **`KUBERNETES_CLI_SETUP.md`** - Complete Kubernetes CLI setup guide
- **`DOCKER_KUBERNETES_TUTORIAL.md`** - Full Docker and Kubernetes tutorial
- **`k8s/README.md`** - Kubernetes deployment detailed guide

## 🎯 Current Status

✅ **Docker Services:** Running (App: localhost:3001, Redis: localhost:6379)  
✅ **Kubernetes Cluster:** Created and ready  
⏳ **Application Deployment:** Pending (follow steps above)

## 🚀 You're Ready!

Your Kubernetes cluster is ready for deployment! Follow the "Next Steps" above to deploy your application.

---

**Need help?** Check the troubleshooting section or see the detailed guides listed above.

Happy Deploying! 🎉

