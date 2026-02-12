# Kubernetes Deployment Script for Inventory Platform (PowerShell)
# This script builds Docker images and deploys to Kubernetes

param(
    [string]$ImageTag = "latest"
)

$ErrorActionPreference = "Stop"

$Namespace = "inventory-platform"
$ImageName = "inventory-platform-app"

Write-Host "🚀 Starting Kubernetes deployment for Inventory Platform..." -ForegroundColor Green

# Check if kubectl is installed
try {
    kubectl version --client --short | Out-Null
} catch {
    Write-Host "❌ kubectl is not installed. Please install it first." -ForegroundColor Red
    exit 1
}

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Docker is not running. Please start Docker first." -ForegroundColor Red
    exit 1
}

# Step 1: Build Docker image
Write-Host "📦 Building Docker image..." -ForegroundColor Cyan
docker build -t "${ImageName}:${ImageTag}" -f Dockerfile .

# Step 2: Create namespace if it doesn't exist
Write-Host "📁 Creating namespace..." -ForegroundColor Cyan
kubectl create namespace $Namespace --dry-run=client -o yaml | kubectl apply -f -

# Step 3: Check if secrets exist
Write-Host "🔐 Checking secrets..." -ForegroundColor Cyan
$secretExists = kubectl get secret app-secrets -n $Namespace 2>$null
if (-not $secretExists) {
    Write-Host "⚠️  Secret 'app-secrets' not found!" -ForegroundColor Yellow
    Write-Host "📝 Please create secrets first:" -ForegroundColor Yellow
    Write-Host "   kubectl apply -f k8s\secrets.yaml" -ForegroundColor Yellow
    Write-Host "   OR" -ForegroundColor Yellow
    Write-Host "   kubectl create secret generic app-secrets --from-env-file=.env -n $Namespace" -ForegroundColor Yellow
    $response = Read-Host "Continue anyway? (y/n)"
    if ($response -ne "y" -and $response -ne "Y") {
        exit 1
    }
}

# Step 4: Apply ConfigMap
Write-Host "⚙️  Applying ConfigMap..." -ForegroundColor Cyan
kubectl apply -f k8s\configmap.yaml

# Step 5: Apply Redis PVC
Write-Host "💾 Creating Redis persistent volume..." -ForegroundColor Cyan
kubectl apply -f k8s\redis-pvc.yaml

# Step 6: Deploy Redis
Write-Host "🔴 Deploying Redis..." -ForegroundColor Cyan
kubectl apply -f k8s\redis-deployment.yaml

# Step 7: Wait for Redis to be ready
Write-Host "⏳ Waiting for Redis to be ready..." -ForegroundColor Cyan
kubectl wait --for=condition=ready pod -l app=redis -n $Namespace --timeout=120s

# Step 8: Deploy Application
Write-Host "🚀 Deploying Application..." -ForegroundColor Cyan
kubectl apply -f k8s\app-deployment.yaml

# Step 9: Deploy Nginx
Write-Host "🌐 Deploying Nginx..." -ForegroundColor Cyan
kubectl apply -f k8s\nginx-deployment.yaml

# Step 10: Wait for pods to be ready
Write-Host "⏳ Waiting for pods to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
kubectl wait --for=condition=ready pod -l app=inventory-platform -n $Namespace --timeout=180s 2>$null
kubectl wait --for=condition=ready pod -l app=nginx -n $Namespace --timeout=120s 2>$null

# Step 11: Show deployment status
Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Pod Status:" -ForegroundColor Cyan
kubectl get pods -n $Namespace

Write-Host ""
Write-Host "🌐 Services:" -ForegroundColor Cyan
kubectl get svc -n $Namespace

Write-Host ""
Write-Host "📝 To view logs:" -ForegroundColor Yellow
Write-Host "   kubectl logs -f deployment/app -n $Namespace" -ForegroundColor Yellow
Write-Host "   kubectl logs -f deployment/nginx -n $Namespace" -ForegroundColor Yellow
Write-Host "   kubectl logs -f deployment/redis -n $Namespace" -ForegroundColor Yellow
Write-Host ""

