# Kubernetes Setup via CLI with Docker (Kind)

This guide shows you how to set up Kubernetes using **Kind** (Kubernetes in Docker) entirely through the command line.

---

## 🎯 What is Kind?

**Kind** (Kubernetes in Docker) is a tool for running local Kubernetes clusters using Docker containers. It's perfect for development and testing.

**Benefits:**
- ✅ Runs Kubernetes in Docker (no VM needed)
- ✅ Fast setup and tear down
- ✅ Perfect for local development
- ✅ Works on Windows, Mac, and Linux

---

## 📦 Prerequisites

1. **Docker Desktop** - Must be installed and running
2. **PowerShell** - For running scripts
3. **Internet connection** - For downloading Kind

---

## 🚀 Quick Setup (Automated Script)

### Option 1: Use the Setup Script

```powershell
.\setup-kubernetes.ps1
```

This script will:
- ✅ Check if Docker is running
- ✅ Install Kind (if needed)
- ✅ Install kubectl (if needed)
- ✅ Create a Kubernetes cluster
- ✅ Configure everything automatically

---

## 📋 Manual Setup (Step by Step)

### Step 1: Install Kind

**Option A: Using Chocolatey (if installed)**
```powershell
choco install kind -y
```

**Option B: Using winget (Windows Package Manager)**
```powershell
winget install kubernetes-kind
```

**Option C: Manual Download**
```powershell
# Download Kind for Windows
# Visit: https://github.com/kubernetes-sigs/kind/releases
# Download: kind-windows-amd64.exe
# Rename to: kind.exe
# Add to PATH or place in your project directory
```

**Option D: Using Go (if you have Go installed)**
```powershell
go install sigs.k8s.io/kind@v0.20.0
```

### Step 2: Install kubectl

**Option A: Using Chocolatey**
```powershell
choco install kubernetes-cli -y
```

**Option B: Using winget**
```powershell
winget install Kubernetes.kubectl
```

**Option C: Download manually**
```powershell
# Download from: https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/
# Or use: curl.exe -LO "https://dl.k8s.io/release/v1.28.0/bin/windows/amd64/kubectl.exe"
```

### Step 3: Verify Docker is Running

```powershell
docker info
```

If you see Docker info, you're good to go!

### Step 4: Create Kubernetes Cluster

**Basic cluster:**
```powershell
kind create cluster --name inventory-platform
```

**Advanced cluster with port mappings (recommended):**
```powershell
# Create cluster configuration file
@"
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: inventory-platform
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
- role: worker
- role: worker
"@ | Out-File -FilePath kind-config.yaml -Encoding UTF8

# Create cluster with configuration
kind create cluster --name inventory-platform --config kind-config.yaml
```

### Step 5: Verify Cluster

```powershell
# Check cluster info
kubectl cluster-info --context kind-inventory-platform

# List nodes
kubectl get nodes

# Check cluster status
kind get clusters
```

---

## 🔧 Common Kind Commands

```powershell
# List all clusters
kind get clusters

# Get cluster info
kind get kubeconfig --name inventory-platform

# Delete cluster
kind delete cluster --name inventory-platform

# Load Docker image into cluster
kind load docker-image inventory-platform-app:latest --name inventory-platform

# Load multiple images
kind load docker-image image1:tag image2:tag --name inventory-platform

# Export cluster logs (for debugging)
kind export logs ./kind-logs --name inventory-platform
```

---

## 🚀 Deploy Your Application

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
docker exec -it inventory-platform-control-plane crictl images
```

### Step 3: Prepare Secrets

```powershell
# Copy example secrets
Copy-Item k8s\secrets.yaml.example k8s\secrets.yaml

# Edit with your actual secrets
notepad k8s\secrets.yaml
```

### Step 4: Deploy to Kubernetes

```powershell
# Create namespace
kubectl create namespace inventory-platform

# Apply secrets
kubectl apply -f k8s\secrets.yaml

# Apply all resources
kubectl apply -f k8s\namespace.yaml
kubectl apply -f k8s\configmap.yaml
kubectl apply -f k8s\redis-pvc.yaml
kubectl apply -f k8s\redis-deployment.yaml
kubectl apply -f k8s\app-deployment.yaml
kubectl apply -f k8s\nginx-deployment.yaml
```

Or use the deployment script:
```powershell
.\k8s\deploy.ps1
```

### Step 5: Verify Deployment

```powershell
# View all resources
kubectl get all -n inventory-platform

# Check pod status
kubectl get pods -n inventory-platform

# View logs
kubectl logs -f deployment/app -n inventory-platform
```

### Step 6: Access Application

```powershell
# Port forward to access locally
kubectl port-forward svc/nginx-service 8080:80 -n inventory-platform

# Access at: http://localhost:8080
```

---

## 🛠️ Troubleshooting

### Docker Not Running

```powershell
# Check Docker status
docker info

# Start Docker Desktop if needed
```

### Kind Installation Failed

```powershell
# Verify Kind installation
kind version

# Check PATH
$env:PATH -split ';' | Select-String "kind"

# Reinstall if needed
choco uninstall kind -y
choco install kind -y
```

### Cluster Creation Failed

```powershell
# Check Docker resources
docker system df

# Clean up if needed
docker system prune -a

# Check existing clusters
kind get clusters

# Delete and recreate
kind delete cluster --name inventory-platform
kind create cluster --name inventory-platform
```

### Image Not Found in Cluster

```powershell
# Verify image exists locally
docker images | Select-String "inventory-platform"

# Load image into cluster
kind load docker-image inventory-platform-app:latest --name inventory-platform

# Verify image in cluster
docker exec -it inventory-platform-control-plane crictl images
```

### Pods Stuck in Pending

```powershell
# Check pod events
kubectl describe pod <pod-name> -n inventory-platform

# Check node resources
kubectl top nodes

# Check pod resource requests
kubectl describe pod <pod-name> -n inventory-platform
```

---

## 📊 Useful Commands

### View Cluster Information

```powershell
# Cluster info
kubectl cluster-info

# Get kubeconfig
kind get kubeconfig --name inventory-platform

# List all resources
kubectl get all -A
```

### Manage Images

```powershell
# Build image
docker build -t inventory-platform-app:latest -f Dockerfile .

# Load into Kind
kind load docker-image inventory-platform-app:latest --name inventory-platform

# List images in cluster
docker exec -it inventory-platform-control-plane crictl images
```

### Clean Up

```powershell
# Delete specific cluster
kind delete cluster --name inventory-platform

# Delete all Kind clusters
kind get clusters | ForEach-Object { kind delete cluster --name $_ }

# Clean up Docker
docker system prune -a
```

---

## 🔄 Updating Your Application

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

---

## 🌐 Accessing Services

### Port Forwarding (Local Access)

```powershell
# Forward Nginx service
kubectl port-forward svc/nginx-service 8080:80 -n inventory-platform

# Access at http://localhost:8080
```

### NodePort (If configured)

```powershell
# Check service
kubectl get svc nginx-service -n inventory-platform

# Access via NodePort if configured
# http://localhost:<NodePort>
```

---

## 📝 Quick Reference

| Task | Command |
|------|---------|
| Create cluster | `kind create cluster --name inventory-platform` |
| Delete cluster | `kind delete cluster --name inventory-platform` |
| List clusters | `kind get clusters` |
| Load image | `kind load docker-image <image> --name inventory-platform` |
| View nodes | `kubectl get nodes` |
| View pods | `kubectl get pods -n inventory-platform` |
| View logs | `kubectl logs -f deployment/app -n inventory-platform` |
| Port forward | `kubectl port-forward svc/nginx-service 8080:80 -n inventory-platform` |

---

## 🎓 Next Steps

1. **Deploy your application** using the Kubernetes manifests
2. **Set up Ingress** for external access
3. **Configure monitoring** with Prometheus and Grafana
4. **Set up logging** with centralized logging solution
5. **Implement CI/CD** for automated deployments

---

## 🔗 Additional Resources

- **Kind Documentation**: https://kind.sigs.k8s.io/
- **Kubernetes Documentation**: https://kubernetes.io/docs/
- **kubectl Cheat Sheet**: https://kubernetes.io/docs/reference/kubectl/cheatsheet/

---

Happy Deploying! 🚀

