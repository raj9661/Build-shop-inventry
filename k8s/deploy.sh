#!/bin/bash

# Kubernetes Deployment Script for Inventory Platform
# This script builds Docker images and deploys to Kubernetes

set -e

NAMESPACE="inventory-platform"
IMAGE_NAME="inventory-platform-app"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "🚀 Starting Kubernetes deployment for Inventory Platform..."

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install it first."
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Step 1: Build Docker image
echo "📦 Building Docker image..."
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -f Dockerfile .

# Step 2: Load image into Kubernetes (for local clusters like minikube/kind)
# Uncomment the appropriate line for your local Kubernetes setup:
# minikube image load ${IMAGE_NAME}:${IMAGE_TAG}
# kind load docker-image ${IMAGE_NAME}:${IMAGE_TAG} --name <your-cluster-name>

# For production, push to a registry instead:
# docker tag ${IMAGE_NAME}:${IMAGE_TAG} your-registry.io/${IMAGE_NAME}:${IMAGE_TAG}
# docker push your-registry.io/${IMAGE_NAME}:${IMAGE_TAG}

# Step 3: Create namespace if it doesn't exist
echo "📁 Creating namespace..."
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Step 4: Check if secrets exist
echo "🔐 Checking secrets..."
if ! kubectl get secret app-secrets -n ${NAMESPACE} &> /dev/null; then
    echo "⚠️  Secret 'app-secrets' not found!"
    echo "📝 Please create secrets first:"
    echo "   kubectl apply -f k8s/secrets.yaml"
    echo "   OR"
    echo "   kubectl create secret generic app-secrets --from-env-file=.env -n ${NAMESPACE}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 5: Apply ConfigMap
echo "⚙️  Applying ConfigMap..."
kubectl apply -f k8s/configmap.yaml

# Step 6: Apply Redis PVC
echo "💾 Creating Redis persistent volume..."
kubectl apply -f k8s/redis-pvc.yaml

# Step 7: Deploy Redis
echo "🔴 Deploying Redis..."
kubectl apply -f k8s/redis-deployment.yaml

# Step 8: Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
kubectl wait --for=condition=ready pod -l app=redis -n ${NAMESPACE} --timeout=120s

# Step 9: Deploy Application
echo "🚀 Deploying Application..."
kubectl apply -f k8s/app-deployment.yaml

# Step 10: Deploy Nginx
echo "🌐 Deploying Nginx..."
kubectl apply -f k8s/nginx-deployment.yaml

# Step 11: Wait for pods to be ready
echo "⏳ Waiting for pods to be ready..."
kubectl wait --for=condition=ready pod -l app=inventory-platform -n ${NAMESPACE} --timeout=180s || true
kubectl wait --for=condition=ready pod -l app=nginx -n ${NAMESPACE} --timeout=120s || true

# Step 12: Show deployment status
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Pod Status:"
kubectl get pods -n ${NAMESPACE}

echo ""
echo "🌐 Services:"
kubectl get svc -n ${NAMESPACE}

echo ""
echo "📝 To view logs:"
echo "   kubectl logs -f deployment/app -n ${NAMESPACE}"
echo "   kubectl logs -f deployment/nginx -n ${NAMESPACE}"
echo "   kubectl logs -f deployment/redis -n ${NAMESPACE}"
echo ""
echo "🔍 To check service endpoints:"
echo "   kubectl get svc nginx-service -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}'"
echo ""

