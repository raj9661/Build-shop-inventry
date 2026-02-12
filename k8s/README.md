# Kubernetes Deployment Guide

This directory contains Kubernetes manifests for deploying the Inventory Platform.

## Prerequisites

1. **Kubernetes Cluster**: You need a running Kubernetes cluster. Options:
   - [Minikube](https://minikube.sigs.k8s.io/docs/start/) (local development)
   - [Kind](https://kind.sigs.k8s.io/) (local development)
   - Cloud Kubernetes services (GKE, EKS, AKS)

2. **kubectl**: Kubernetes command-line tool
   - Install: https://kubernetes.io/docs/tasks/tools/

3. **Docker**: For building container images

4. **Docker image registry** (optional for production):
   - Docker Hub
   - Google Container Registry
   - AWS ECR
   - Azure Container Registry

## Quick Start

### 1. Set Up Secrets

Create your secrets file from the example:

```bash
# Copy the example file
cp k8s/secrets.yaml.example k8s/secrets.yaml

# Edit with your actual secrets
# Use your preferred editor to update k8s/secrets.yaml
```

Or create secrets directly:

```bash
kubectl create secret generic app-secrets \
  --from-literal=DATABASE_URL='your-db-url' \
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

Or from a `.env` file:

```bash
kubectl create secret generic app-secrets \
  --from-env-file=.env \
  --namespace=inventory-platform
```

### 2. Deploy Using Scripts

**Linux/Mac:**
```bash
chmod +x k8s/deploy.sh
./k8s/deploy.sh
```

**Windows (PowerShell):**
```powershell
.\k8s\deploy.ps1
```

### 3. Manual Deployment

If you prefer to deploy manually:

```bash
# 1. Create namespace
kubectl apply -f k8s/namespace.yaml

# 2. Create ConfigMap
kubectl apply -f k8s/configmap.yaml

# 3. Create Secrets (update secrets.yaml first!)
kubectl apply -f k8s/secrets.yaml

# 4. Create Redis PVC
kubectl apply -f k8s/redis-pvc.yaml

# 5. Deploy Redis
kubectl apply -f k8s/redis-deployment.yaml

# 6. Build and load Docker image (for local clusters)
docker build -t inventory-platform-app:latest -f Dockerfile .
minikube image load inventory-platform-app:latest  # For minikube
# OR kind load docker-image inventory-platform-app:latest  # For kind

# 7. Deploy Application
kubectl apply -f k8s/app-deployment.yaml

# 8. Deploy Nginx
kubectl apply -f k8s/nginx-deployment.yaml

# 9. Optional: Deploy Ingress
kubectl apply -f k8s/ingress.yaml
```

## Architecture

The deployment consists of:

1. **Namespace**: `inventory-platform` - Isolates all resources
2. **ConfigMap**: Non-sensitive configuration
3. **Secrets**: Sensitive data (database, API keys, etc.)
4. **Redis**: Caching layer with persistent storage
5. **Application**: Next.js application (2 replicas)
6. **Nginx**: Reverse proxy and load balancer
7. **Ingress** (optional): External access with SSL

## Configuration

### Environment Variables

Update `k8s/configmap.yaml` for non-sensitive configuration:
- NODE_ENV
- NEXTAUTH_URL
- Redis connection settings (host, port, db)

Update `k8s/secrets.yaml` for sensitive data:
- DATABASE_URL
- JWT secrets
- Payment gateway keys
- Email configuration

### Scaling

To scale the application:

```bash
kubectl scale deployment app --replicas=3 -n inventory-platform
kubectl scale deployment nginx --replicas=2 -n inventory-platform
```

### Resource Limits

Default resource limits:
- **App**: 2 CPU, 2Gi memory (requests: 1 CPU, 1Gi memory)
- **Redis**: 1 CPU, 1Gi memory (requests: 0.5 CPU, 512Mi memory)
- **Nginx**: 0.5 CPU, 512Mi memory (requests: 0.25 CPU, 256Mi memory)

Adjust in the respective deployment YAML files.

## Monitoring

### View Pods

```bash
kubectl get pods -n inventory-platform
```

### View Logs

```bash
# Application logs
kubectl logs -f deployment/app -n inventory-platform

# Nginx logs
kubectl logs -f deployment/nginx -n inventory-platform

# Redis logs
kubectl logs -f deployment/redis -n inventory-platform

# All logs
kubectl logs -f -l app=inventory-platform -n inventory-platform
```

### View Services

```bash
kubectl get svc -n inventory-platform
```

### Port Forwarding (Local Access)

```bash
# Forward Nginx service
kubectl port-forward svc/nginx-service 8080:80 -n inventory-platform

# Access at http://localhost:8080
```

### Get Service External IP

```bash
kubectl get svc nginx-service -n inventory-platform
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n inventory-platform

# Check events
kubectl get events -n inventory-platform --sort-by='.lastTimestamp'
```

### Image Pull Errors

For local clusters (minikube/kind), ensure the image is loaded:

```bash
# Minikube
minikube image load inventory-platform-app:latest

# Kind
kind load docker-image inventory-platform-app:latest --name <cluster-name>
```

### Database Connection Issues

Verify secrets are correctly set:

```bash
kubectl get secret app-secrets -n inventory-platform -o yaml
```

### Redis Connection Issues

Check Redis service:

```bash
kubectl get svc redis-service -n inventory-platform
kubectl exec -it deployment/redis -n inventory-platform -- redis-cli ping
```

## Production Considerations

1. **Use Image Registry**: Push images to a container registry
   - Update `app-deployment.yaml` with your registry URL
   - Set `imagePullPolicy: Always`

2. **SSL/TLS**: Configure Ingress with cert-manager for SSL certificates

3. **Monitoring**: Add Prometheus and Grafana for monitoring

4. **Logging**: Set up centralized logging (ELK stack, Loki, etc.)

5. **Backup**: Configure backups for Redis persistent volume

6. **High Availability**: Use StatefulSet for Redis with replication

7. **Security**:
   - Use RBAC for service accounts
   - Enable network policies
   - Regular security scanning of images

## Cleanup

To remove all resources:

```bash
kubectl delete namespace inventory-platform
```

Or delete individual resources:

```bash
kubectl delete -f k8s/
```

## Files Overview

- `namespace.yaml`: Kubernetes namespace
- `configmap.yaml`: Non-sensitive configuration
- `secrets.yaml.example`: Template for secrets (copy to secrets.yaml)
- `redis-pvc.yaml`: Persistent volume for Redis data
- `redis-deployment.yaml`: Redis deployment and service
- `app-deployment.yaml`: Application deployment and service
- `nginx-deployment.yaml`: Nginx deployment, service, and config
- `ingress.yaml`: Ingress resource for external access
- `kustomization.yaml`: Kustomize configuration (optional)
- `deploy.sh`: Deployment script for Linux/Mac
- `deploy.ps1`: Deployment script for Windows

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

