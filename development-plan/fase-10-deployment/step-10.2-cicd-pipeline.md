# Step 10.2: CI/CD Pipeline Implementation

## Overview

Implement a comprehensive CI/CD pipeline using GitHub Actions to automate testing, building, security scanning, and deployment of the Chat Rooms application across multiple environments.

## CI/CD Architecture

### 1. GitHub Actions Workflow Structure

#### Main CI/CD Pipeline

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  release:
    types: [created]

env:
  REGISTRY: ghcr.io
  API_IMAGE_NAME: chat-rooms/api
  FRONTEND_IMAGE_NAME: chat-rooms/frontend

jobs:
  # Job 1: Code Quality and Testing
  quality-check:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci
          cd api && npm ci
          cd ../front && npm ci

      - name: Lint code
        run: |
          npm run lint
          cd api && npm run lint
          cd ../front && npm run lint

      - name: Type check
        run: |
          cd api && npm run type-check
          cd ../front && npm run type-check

      - name: Run tests
        run: |
          cd api && npm run test:ci
          cd ../front && npm run test:ci

      - name: Generate coverage report
        run: |
          cd api && npm run test:coverage
          cd ../front && npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./api/coverage/lcov.info,./front/coverage/lcov.info
          flags: unittests
          name: codecov-umbrella

  # Job 2: Security Scanning
  security-scan:
    runs-on: ubuntu-latest
    needs: quality-check
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: |
          cd api && npm ci
          cd ../front && npm ci

      - name: Run Snyk Security Scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: Run Semgrep Security Scan
        uses: semgrep/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/secrets
            p/owasp-top-ten
            p/docker

      - name: Upload SARIF file
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: semgrep.sarif

      - name: Audit npm dependencies
        run: |
          cd api && npm audit --audit-level=moderate
          cd ../front && npm audit --audit-level=moderate

  # Job 3: Build and Push Docker Images
  build-images:
    runs-on: ubuntu-latest
    needs: [quality-check, security-scan]
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop' || github.event_name == 'release'
    
    outputs:
      api-image: ${{ steps.meta-api.outputs.tags }}
      frontend-image: ${{ steps.meta-frontend.outputs.tags }}
      api-digest: ${{ steps.build-api.outputs.digest }}
      frontend-digest: ${{ steps.build-frontend.outputs.digest }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata for API
        id: meta-api
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.API_IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=sha,prefix={{branch}}-

      - name: Extract metadata for Frontend
        id: meta-frontend
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.FRONTEND_IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=sha,prefix={{branch}}-

      - name: Build and push API image
        id: build-api
        uses: docker/build-push-action@v5
        with:
          context: ./api
          file: ./api/Dockerfile.prod
          push: true
          tags: ${{ steps.meta-api.outputs.tags }}
          labels: ${{ steps.meta-api.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64

      - name: Build and push Frontend image
        id: build-frontend
        uses: docker/build-push-action@v5
        with:
          context: ./front
          file: ./front/Dockerfile.prod
          push: true
          tags: ${{ steps.meta-frontend.outputs.tags }}
          labels: ${{ steps.meta-frontend.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64

  # Job 4: Container Security Scanning
  container-security:
    runs-on: ubuntu-latest
    needs: build-images
    
    steps:
      - name: Run Trivy vulnerability scanner for API
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ needs.build-images.outputs.api-image }}
          format: 'sarif'
          output: 'trivy-api-results.sarif'

      - name: Run Trivy vulnerability scanner for Frontend
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ needs.build-images.outputs.frontend-image }}
          format: 'sarif'
          output: 'trivy-frontend-results.sarif'

      - name: Upload Trivy scan results to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-api-results.sarif,trivy-frontend-results.sarif'

  # Job 5: Deploy to Staging
  deploy-staging:
    runs-on: ubuntu-latest
    needs: [build-images, container-security]
    if: github.ref == 'refs/heads/develop'
    environment: staging
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'latest'

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --region ${{ secrets.AWS_REGION }} --name ${{ secrets.EKS_CLUSTER_NAME_STAGING }}

      - name: Deploy to staging
        run: |
          envsubst < k8s/staging/deployment.yaml | kubectl apply -f -
          kubectl set image deployment/api-deployment api=${{ needs.build-images.outputs.api-image }} -n staging
          kubectl set image deployment/frontend-deployment frontend=${{ needs.build-images.outputs.frontend-image }} -n staging
          kubectl rollout status deployment/api-deployment -n staging --timeout=300s
          kubectl rollout status deployment/frontend-deployment -n staging --timeout=300s

      - name: Run smoke tests
        run: |
          ./scripts/smoke-tests.sh ${{ secrets.STAGING_URL }}

      - name: Notify deployment status
        uses: 8398a7/action-slack@v3
        if: always()
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

  # Job 6: Integration Tests
  integration-tests:
    runs-on: ubuntu-latest
    needs: deploy-staging
    if: github.ref == 'refs/heads/develop'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install test dependencies
        run: |
          cd tests && npm ci

      - name: Run integration tests
        env:
          TEST_URL: ${{ secrets.STAGING_URL }}
          TEST_API_KEY: ${{ secrets.STAGING_API_KEY }}
        run: |
          cd tests && npm run test:integration

      - name: Run E2E tests
        env:
          TEST_URL: ${{ secrets.STAGING_URL }}
        run: |
          cd tests && npm run test:e2e

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: tests/results/

  # Job 7: Deploy to Production
  deploy-production:
    runs-on: ubuntu-latest
    needs: [build-images, container-security]
    if: github.event_name == 'release'
    environment: production
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'latest'

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --region ${{ secrets.AWS_REGION }} --name ${{ secrets.EKS_CLUSTER_NAME_PROD }}

      - name: Blue-Green Deployment
        run: |
          ./scripts/blue-green-deploy.sh \
            ${{ needs.build-images.outputs.api-image }} \
            ${{ needs.build-images.outputs.frontend-image }}

      - name: Run production smoke tests
        run: |
          ./scripts/smoke-tests.sh ${{ secrets.PRODUCTION_URL }}

      - name: Create GitHub release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          draft: false
          prerelease: false
```

### 2. Environment-Specific Workflows

#### Staging Deployment Workflow

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [develop]
  workflow_dispatch:

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy with Terraform
        run: |
          cd infrastructure/terraform/staging
          terraform init
          terraform plan -var-file="staging.tfvars"
          terraform apply -auto-approve -var-file="staging.tfvars"

      - name: Deploy application
        run: |
          ./scripts/deploy-staging.sh

      - name: Run health checks
        run: |
          ./scripts/health-check.sh https://staging.livechat.example.com

      - name: Notify team
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

#### Production Deployment Workflow

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  release:
    types: [created]
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to deploy'
        required: true
        type: string

jobs:
  deploy-production:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.version || github.ref }}

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Create database backup
        run: |
          ./scripts/backup-database.sh production

      - name: Deploy with zero downtime
        run: |
          ./scripts/blue-green-deploy.sh production ${{ github.event.inputs.version || github.ref }}

      - name: Run comprehensive tests
        run: |
          ./scripts/production-tests.sh

      - name: Monitor deployment
        run: |
          ./scripts/monitor-deployment.sh 300 # Monitor for 5 minutes

      - name: Rollback on failure
        if: failure()
        run: |
          ./scripts/rollback.sh production

      - name: Update status page
        if: success()
        run: |
          curl -X POST "${{ secrets.STATUS_PAGE_WEBHOOK }}" \
            -H "Content-Type: application/json" \
            -d '{"status": "deployed", "version": "${{ github.ref }}"}'
```

### 3. Quality Gates and Automation

#### Performance Testing Workflow

```yaml
# .github/workflows/performance-tests.yml
name: Performance Tests

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
  workflow_dispatch:

jobs:
  performance-tests:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run load tests
        env:
          TARGET_URL: ${{ secrets.STAGING_URL }}
        run: |
          cd load-tests
          k6 run --out json=results.json load-test.js

      - name: Analyze results
        run: |
          cd load-tests
          node analyze-results.js results.json

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: performance-results
          path: load-tests/results.json

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('load-tests/results.json', 'utf8'));
            
            const comment = `
            ## Performance Test Results
            
            | Metric | Value | Threshold | Status |
            |--------|-------|-----------|--------|
            | Avg Response Time | ${results.avg_response_time}ms | <500ms | ${results.avg_response_time < 500 ? '✅' : '❌'} |
            | 95th Percentile | ${results.p95_response_time}ms | <1000ms | ${results.p95_response_time < 1000 ? '✅' : '❌'} |
            | Error Rate | ${results.error_rate}% | <1% | ${results.error_rate < 1 ? '✅' : '❌'} |
            | Throughput | ${results.throughput} req/s | >100 req/s | ${results.throughput > 100 ? '✅' : '❌'} |
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

#### Security Compliance Workflow

```yaml
# .github/workflows/security-compliance.yml
name: Security Compliance Check

on:
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday
  workflow_dispatch:

jobs:
  compliance-check:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: OWASP ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.10.0
        with:
          target: ${{ secrets.STAGING_URL }}
          rules_file_name: '.zap/rules.conf'

      - name: Run CIS Docker Benchmark
        run: |
          docker run --rm \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v /usr/local/bin/docker:/usr/local/bin/docker \
            docker/docker-bench-security

      - name: Generate compliance report
        run: |
          ./scripts/generate-compliance-report.sh

      - name: Upload compliance artifacts
        uses: actions/upload-artifact@v4
        with:
          name: compliance-report
          path: compliance-report/

      - name: Notify security team
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          channel: '#security'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### 4. Deployment Scripts

#### Blue-Green Deployment Script

```bash
#!/bin/bash
# scripts/blue-green-deploy.sh

set -e

ENVIRONMENT=$1
API_IMAGE=$2
FRONTEND_IMAGE=$3

echo "Starting blue-green deployment to $ENVIRONMENT"

# Get current active environment
CURRENT_ENV=$(kubectl get service app-service -o jsonpath='{.spec.selector.version}' -n $ENVIRONMENT)
echo "Current active environment: $CURRENT_ENV"

# Determine new environment
if [ "$CURRENT_ENV" = "blue" ]; then
    NEW_ENV="green"
else
    NEW_ENV="blue"
fi

echo "Deploying to: $NEW_ENV"

# Update deployment with new images
kubectl set image deployment/api-deployment-$NEW_ENV api=$API_IMAGE -n $ENVIRONMENT
kubectl set image deployment/frontend-deployment-$NEW_ENV frontend=$FRONTEND_IMAGE -n $ENVIRONMENT

# Wait for rollout to complete
echo "Waiting for $NEW_ENV deployment to be ready..."
kubectl rollout status deployment/api-deployment-$NEW_ENV -n $ENVIRONMENT --timeout=600s
kubectl rollout status deployment/frontend-deployment-$NEW_ENV -n $ENVIRONMENT --timeout=600s

# Run health checks
echo "Running health checks..."
NEW_ENV_URL="https://$NEW_ENV.$ENVIRONMENT.livechat.example.com"

for i in {1..5}; do
    if curl -f "$NEW_ENV_URL/health" > /dev/null 2>&1; then
        echo "Health check passed"
        break
    else
        echo "Health check failed, attempt $i/5"
        if [ $i -eq 5 ]; then
            echo "Health checks failed, rolling back"
            exit 1
        fi
        sleep 10
    fi
done

# Switch traffic to new environment
echo "Switching traffic to $NEW_ENV"
kubectl patch service app-service -p '{"spec":{"selector":{"version":"'$NEW_ENV'"}}}' -n $ENVIRONMENT

# Wait for traffic switch
sleep 30

# Final health check
echo "Final health check..."
if ! curl -f "https://$ENVIRONMENT.livechat.example.com/health" > /dev/null 2>&1; then
    echo "Final health check failed, rolling back"
    kubectl patch service app-service -p '{"spec":{"selector":{"version":"'$CURRENT_ENV'"}}}' -n $ENVIRONMENT
    exit 1
fi

echo "Deployment successful! Traffic switched to $NEW_ENV"

# Scale down old environment (optional)
read -p "Scale down $CURRENT_ENV environment? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl scale deployment api-deployment-$CURRENT_ENV --replicas=0 -n $ENVIRONMENT
    kubectl scale deployment frontend-deployment-$CURRENT_ENV --replicas=0 -n $ENVIRONMENT
    echo "Scaled down $CURRENT_ENV environment"
fi
```

#### Rollback Script

```bash
#!/bin/bash
# scripts/rollback.sh

set -e

ENVIRONMENT=$1
VERSION=${2:-"previous"}

echo "Rolling back $ENVIRONMENT to $VERSION"

if [ "$VERSION" = "previous" ]; then
    # Get previous version from deployment annotations
    PREVIOUS_VERSION=$(kubectl get deployment api-deployment -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}' -n $ENVIRONMENT)
    ROLLBACK_REVISION=$((PREVIOUS_VERSION - 1))
    
    echo "Rolling back to revision $ROLLBACK_REVISION"
    kubectl rollout undo deployment/api-deployment --to-revision=$ROLLBACK_REVISION -n $ENVIRONMENT
    kubectl rollout undo deployment/frontend-deployment --to-revision=$ROLLBACK_REVISION -n $ENVIRONMENT
else
    # Rollback to specific version
    kubectl set image deployment/api-deployment api=ghcr.io/chat-rooms/api:$VERSION -n $ENVIRONMENT
    kubectl set image deployment/frontend-deployment frontend=ghcr.io/chat-rooms/frontend:$VERSION -n $ENVIRONMENT
fi

# Wait for rollback to complete
kubectl rollout status deployment/api-deployment -n $ENVIRONMENT --timeout=300s
kubectl rollout status deployment/frontend-deployment -n $ENVIRONMENT --timeout=300s

# Verify rollback
echo "Verifying rollback..."
if curl -f "https://$ENVIRONMENT.livechat.example.com/health" > /dev/null 2>&1; then
    echo "Rollback successful"
else
    echo "Rollback verification failed"
    exit 1
fi

# Notify team
curl -X POST "$SLACK_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"🔄 Rollback completed for $ENVIRONMENT environment\"}"
```

## Implementation Tasks

### Phase 1: Basic CI/CD Setup (Week 1)

- [ ] Create GitHub Actions workflows for CI/CD
- [ ] Set up automated testing and code quality checks
- [ ] Configure Docker image building and pushing
- [ ] Implement basic deployment automation

### Phase 2: Security and Quality Gates (Week 2)

- [ ] Integrate security scanning tools
- [ ] Set up container vulnerability scanning
- [ ] Implement performance testing automation
- [ ] Create compliance checking workflows

### Phase 3: Advanced Deployment Strategies (Week 3)

- [ ] Implement blue-green deployment
- [ ] Create rollback automation
- [ ] Set up environment-specific workflows
- [ ] Configure monitoring and alerting integration

### Phase 4: Optimization and Monitoring (Week 4)

- [ ] Optimize build and deployment times
- [ ] Implement deployment monitoring
- [ ] Create automated incident response
- [ ] Set up comprehensive reporting and notifications

## Success Criteria

1. **Automation**: 100% automated deployment pipeline from code to production
2. **Security**: All code and containers scanned for vulnerabilities before deployment
3. **Quality**: Automated quality gates prevent low-quality code from reaching production
4. **Speed**: Complete CI/CD pipeline execution under 15 minutes
5. **Reliability**: Deployment success rate over 95%
6. **Recovery**: Automated rollback capability with RTO under 5 minutes

## CI/CD Best Practices

- [ ] Automated testing at multiple levels (unit, integration, E2E)
- [ ] Security scanning integrated into pipeline
- [ ] Infrastructure as Code for consistent environments
- [ ] Blue-green deployments for zero-downtime updates
- [ ] Automated rollback on deployment failures
- [ ] Comprehensive monitoring and alerting
- [ ] Audit trail for all deployments
- [ ] Environment parity between staging and production

This comprehensive CI/CD implementation ensures reliable, secure, and automated deployment of the Chat Rooms application with enterprise-grade DevOps practices.
