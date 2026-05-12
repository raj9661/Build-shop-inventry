# Kubernetes Setup Script using Kind (Kubernetes in Docker)
# This script sets up a local Kubernetes cluster using Docker containers

Write-Host "Setting up Kubernetes with Docker (Kind)..." -ForegroundColor Green

# Check if Docker is running
Write-Host "`nChecking Docker..." -ForegroundColor Cyan
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if Kind is installed
Write-Host "`nChecking Kind installation..." -ForegroundColor Cyan
$kindInstalled = Get-Command kind -ErrorAction SilentlyContinue

if (-not $kindInstalled) {
    Write-Host "Kind is not installed. Installing..." -ForegroundColor Yellow
    
    # Check if Chocolatey or winget is available
    $chocoInstalled = Get-Command choco -ErrorAction SilentlyContinue
    $wingetInstalled = Get-Command winget -ErrorAction SilentlyContinue
    
    if ($chocoInstalled) {
        Write-Host "Installing Kind using Chocolatey..." -ForegroundColor Cyan
        choco install kind -y
    } elseif ($wingetInstalled) {
        Write-Host "Installing Kind using winget..." -ForegroundColor Cyan
        winget install Kubernetes.kind
    } else {
        Write-Host "`nKind is not installed and no package manager available." -ForegroundColor Red
        Write-Host "`nPlease install Kind manually:" -ForegroundColor Yellow
        Write-Host "1. Download from: https://kind.sigs.k8s.io/docs/user/quick-start/#installation" -ForegroundColor Yellow
        Write-Host "2. Or install Chocolatey first, then run: choco install kind" -ForegroundColor Yellow
        Write-Host "3. Or use: winget install kubernetes-kind" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "Kind is already installed" -ForegroundColor Green
    kind version
}

# Check if kubectl is installed
Write-Host "`nChecking kubectl installation..." -ForegroundColor Cyan
$kubectlInstalled = Get-Command kubectl -ErrorAction SilentlyContinue

if (-not $kubectlInstalled) {
    Write-Host "kubectl is not installed. Installing..." -ForegroundColor Yellow
    
    if ($chocoInstalled) {
        Write-Host "Installing kubectl using Chocolatey..." -ForegroundColor Cyan
        choco install kubernetes-cli -y
    } elseif ($wingetInstalled) {
        Write-Host "Installing kubectl using winget..." -ForegroundColor Cyan
        winget install Kubernetes.kubectl
    } else {
        Write-Host "`nkubectl is not installed." -ForegroundColor Red
        Write-Host "Please install kubectl manually:" -ForegroundColor Yellow
        Write-Host "1. Download from: https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/" -ForegroundColor Yellow
        Write-Host "2. Or use: winget install Kubernetes.kubectl" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "kubectl is already installed" -ForegroundColor Green
    kubectl version --client --short
}

# Check for existing cluster
Write-Host "`nChecking for existing cluster..." -ForegroundColor Cyan
$existingCluster = kind get clusters 2>$null | Select-String "inventory-platform"

if ($existingCluster) {
    Write-Host "Cluster 'inventory-platform' already exists." -ForegroundColor Yellow
    $response = Read-Host "Do you want to delete and recreate it? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host "Deleting existing cluster..." -ForegroundColor Cyan
        kind delete cluster --name inventory-platform
    } else {
        Write-Host "Using existing cluster" -ForegroundColor Green
        $skipCreate = $true
    }
}

if (-not $skipCreate) {
    # Create Kind cluster configuration
    Write-Host "`nCreating cluster configuration..." -ForegroundColor Cyan
    
    $kindConfigContent = @"
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
"@
    
    $kindConfigContent | Out-File -FilePath "kind-config.yaml" -Encoding UTF8 -NoNewline
    Write-Host "Created kind-config.yaml" -ForegroundColor Green
    
    # Create Kind cluster
    Write-Host "`nCreating Kubernetes cluster with Kind..." -ForegroundColor Cyan
    Write-Host "This may take a few minutes..." -ForegroundColor Yellow
    
    kind create cluster --name inventory-platform --config kind-config.yaml
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Cluster created successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to create cluster" -ForegroundColor Red
        exit 1
    }
}

# Set kubectl context
Write-Host "`nConfiguring kubectl..." -ForegroundColor Cyan
kubectl cluster-info --context kind-inventory-platform

# Verify cluster is ready
Write-Host "`nWaiting for cluster to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host "`nCluster Status:" -ForegroundColor Cyan
kubectl get nodes

Write-Host "`nKubernetes cluster is ready!" -ForegroundColor Green
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Build your Docker image: docker build -t inventory-platform-app:latest -f Dockerfile ." -ForegroundColor White
Write-Host "2. Load image into Kind: kind load docker-image inventory-platform-app:latest --name inventory-platform" -ForegroundColor White
Write-Host "3. Create secrets: Copy k8s\secrets.yaml.example to k8s\secrets.yaml and update with your values" -ForegroundColor White
Write-Host "4. Deploy: .\k8s\deploy.ps1" -ForegroundColor White
Write-Host "`nUseful commands:" -ForegroundColor Yellow
Write-Host "   kubectl get nodes              - View cluster nodes" -ForegroundColor White
Write-Host "   kubectl get all -n inventory-platform  - View all resources" -ForegroundColor White
Write-Host "   kind delete cluster --name inventory-platform  - Delete cluster" -ForegroundColor White
Write-Host ""

