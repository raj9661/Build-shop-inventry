# Kubernetes Setup Guide

Kubernetes manifests have been created alongside your Docker setup. You can now deploy to Kubernetes!

## Quick Start

### Option 1: Using Deployment Scripts (Recommended)

**Windows (PowerShell):**
```powershell
.\k8s\deploy.ps1
```

**Linux/Mac:**
```bash
chmod +x k8s/deploy.sh
./k8s/deploy.sh
```

### Option 2: Manual Deployment

1. **Create secrets first:**
   ```powershell
   # Copy example file
   Copy-Item k8s\secrets.yaml.example k8s\secrets.yaml
   
   # Edit secrets.yaml with your actual values
   # Then apply:
   kubectl apply -f k8s\secrets.yaml
   ```

2. **Build and load Docker image (for local clusters):**
   ```powershell
   docker build -t inventory-platform-app:latest -f Dockerfile .
   
   # For minikube:
   minikube image load inventory-platform-app:latest
   
   # For kind:
   kind load docker-image inventory-platform-app:latest --name <cluster-name>
   ```

3. **Deploy all services:**
   ```powershell
   kubectl apply -f k8s\namespace.yaml
   kubectl apply -f k8s\configmap.yaml
   kubectl apply -f k8s\redis-pvc.yaml
   kubectl apply -f k8s\redis-deployment.yaml
   kubectl apply -f k8s\app-deployment.yaml
   kubectl apply -f k8s\nginx-deployment.yaml
   ```

## What's Included

✅ **Namespace**: Isolated namespace `inventory-platform`

✅ **ConfigMap**: Non-sensitive configuration

✅ **Secrets**: Template for sensitive data (copy `secrets.yaml.example` to `secrets.yaml`)

✅ **Redis**: 
   - Deployment with persistent storage (PVC)
   - ClusterIP service on port 6379

✅ **Application**: 
   - Next.js app deployment (2 replicas, scalable)
   - ClusterIP service on port 3000
   - Health checks configured

✅ **Nginx**: 
   - Reverse proxy deployment (2 replicas)
   - LoadBalancer service on port 80
   - Configuration from ConfigMap

✅ **Ingress** (optional): External access with SSL support

## Architecture

```
Internet
   ↓
Ingress (optional)
   ↓
Nginx Service (LoadBalancer:80)
   ↓
App Service (ClusterIP:3000) ← 2 replicas
   ↓
Redis Service (ClusterIP:6379) ← 1 replica (with PVC)
```

## Local Access

For local Kubernetes clusters (minikube/kind), use port forwarding:

```powershell
# Forward Nginx service
kubectl port-forward svc/nginx-service 8080:80 -n inventory-platform

# Access at http://localhost:8080
```

Or get the external IP:

```powershell
kubectl get svc nginx-service -n inventory-platform
```

## Monitoring Commands

```powershell
# View all pods
kubectl get pods -n inventory-platform

# View all services
kubectl get svc -n inventory-platform

# View logs
kubectl logs -f deployment/app -n inventory-platform
kubectl logs -f deployment/nginx -n inventory-platform
kubectl logs -f deployment/redis -n inventory-platform

# Describe pod (for troubleshooting)
kubectl describe pod <pod-name> -n inventory-platform
```

## Scaling

```powershell
# Scale app to 3 replicas
kubectl scale deployment app --replicas=3 -n inventory-platform

# Scale nginx to 3 replicas
kubectl scale deployment nginx --replicas=3 -n inventory-platform
```

## Cleanup

```powershell
# Remove everything
kubectl delete namespace inventory-platform

# Or remove individual resources
kubectl delete -f k8s\
```

## Files Created

- `k8s/namespace.yaml` - Namespace definition
- `k8s/configmap.yaml` - Non-sensitive config
- `k8s/secrets.yaml.example` - Secrets template (⚠️ copy and edit!)
- `k8s/secrets.yaml` - Your actual secrets (⚠️ DO NOT COMMIT!)
- `k8s/redis-pvc.yaml` - Persistent volume for Redis
- `k8s/redis-deployment.yaml` - Redis deployment & service
- `k8s/app-deployment.yaml` - App deployment & service
- `k8s/nginx-deployment.yaml` - Nginx deployment, service & config
- `k8s/ingress.yaml` - Ingress for external access
- `k8s/kustomization.yaml` - Kustomize config (optional)
- `k8s/deploy.sh` - Deployment script (Linux/Mac)
- `k8s/deploy.ps1` - Deployment script (Windows)
- `k8s/README.md` - Detailed documentation

## Prerequisites

- Kubernetes cluster (minikube, kind, or cloud)
- kubectl installed
- Docker installed and running
- Secrets configured (see `k8s/secrets.yaml.example`)

## Production Notes

1. **Image Registry**: Update `app-deployment.yaml` with your registry URL
2. **SSL/TLS**: Configure Ingress with cert-manager
3. **Monitoring**: Add Prometheus/Grafana
4. **Backup**: Configure Redis PVC backups
5. **High Availability**: Consider Redis Sentinel or StatefulSet

For detailed information, see `k8s/README.md`.

