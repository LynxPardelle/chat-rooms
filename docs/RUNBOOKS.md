# Operational Runbooks

## Overview

This document contains operational procedures for deploying, monitoring, and maintaining the Chat Rooms Application in production environments.

## Deployment Runbooks

### Blue-Green Deployment

#### Prerequisites

- Kubernetes cluster with sufficient resources
- Docker images built and pushed to registry
- Database migrations completed
- Configuration secrets updated

#### Deployment Procedure

```bash
# 1. Verify current production state
kubectl get deployments -n production
kubectl get services -n production
kubectl get ingress -n production

# 2. Deploy to green environment
kubectl apply -f k8s/green-deployment.yaml
kubectl apply -f k8s/green-service.yaml

# 3. Wait for green deployment to be ready
kubectl rollout status deployment/chat-rooms-api-green -n production
kubectl rollout status deployment/chat-rooms-frontend-green -n production

# 4. Run health checks on green environment
curl -f http://green.internal.example.com/api/health
curl -f http://green.internal.example.com/

# 5. Run smoke tests
npm run test:smoke -- --target=green

# 6. Switch traffic to green (update ingress)
kubectl patch ingress chat-rooms-ingress -n production -p '{"spec":{"rules":[{"host":"api.example.com","http":{"paths":[{"backend":{"service":{"name":"chat-rooms-api-green","port":{"number":3000}}}}]}}]}}'

# 7. Monitor application metrics for 10 minutes
# Check Grafana dashboard: Production - Application Health

# 8. If successful, scale down blue environment
kubectl scale deployment chat-rooms-api-blue --replicas=0 -n production
kubectl scale deployment chat-rooms-frontend-blue --replicas=0 -n production

# 9. Update deployment labels for next iteration
kubectl label deployment chat-rooms-api-green current=true -n production
kubectl label deployment chat-rooms-api-blue current=false -n production
```

#### Rollback Procedure

```bash
# 1. Immediate rollback (switch ingress back to blue)
kubectl patch ingress chat-rooms-ingress -n production -p '{"spec":{"rules":[{"host":"api.example.com","http":{"paths":[{"backend":{"service":{"name":"chat-rooms-api-blue","port":{"number":3000}}}}]}}]}}'

# 2. Scale up blue environment if needed
kubectl scale deployment chat-rooms-api-blue --replicas=3 -n production
kubectl scale deployment chat-rooms-frontend-blue --replicas=2 -n production

# 3. Scale down green environment
kubectl scale deployment chat-rooms-api-green --replicas=0 -n production
kubectl scale deployment chat-rooms-frontend-green --replicas=0 -n production

# 4. Verify rollback successful
curl -f http://api.example.com/api/health
```

### Canary Deployment

#### Canary Deployment Procedure

```bash
# 1. Deploy canary version (10% traffic)
kubectl apply -f k8s/canary-deployment.yaml

# 2. Configure traffic splitting
kubectl apply -f k8s/canary-ingress.yaml

# 3. Monitor canary metrics for 30 minutes
# Key metrics to watch:
# - Error rate < 1%
# - Response time < 500ms p95
# - WebSocket connection success rate > 99%

# 4. Gradually increase canary traffic
# 10% -> 25% -> 50% -> 100%
kubectl patch ingress chat-rooms-canary -n production -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary-weight":"25"}}}'

# 5. Monitor each step for 15 minutes before proceeding

# 6. Complete canary deployment
kubectl apply -f k8s/production-deployment.yaml
kubectl delete -f k8s/canary-deployment.yaml
```

### Rolling Deployment

#### Rolling Update Procedure

```bash
# 1. Update deployment with new image
kubectl set image deployment/chat-rooms-api chat-rooms-api=your-registry/chat-rooms-api:v1.2.3 -n production

# 2. Monitor rollout
kubectl rollout status deployment/chat-rooms-api -n production

# 3. Verify deployment
kubectl get pods -n production -l app=chat-rooms-api

# 4. Run health checks
for pod in $(kubectl get pods -n production -l app=chat-rooms-api -o name); do
  kubectl exec $pod -n production -- curl -f http://localhost:3001/api/health
done
```

## Monitoring Runbooks

### System Health Monitoring

#### Daily Health Check

```bash
#!/bin/bash
# daily-health-check.sh

echo "=== Daily System Health Check ==="
echo "Date: $(date)"

# Check API health
echo "Checking API health..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://api.example.com/api/health)
if [ $response -eq 200 ]; then
    echo "✅ API is healthy"
else
    echo "❌ API health check failed (HTTP $response)"
fi

# Check database connectivity
echo "Checking database connectivity..."
kubectl exec -n production deployment/chat-rooms-api -- npm run health:db
if [ $? -eq 0 ]; then
    echo "✅ Database is accessible"
else
    echo "❌ Database connection failed"
fi

# Check Redis connectivity
echo "Checking Redis connectivity..."
kubectl exec -n production deployment/chat-rooms-api -- npm run health:redis
if [ $? -eq 0 ]; then
    echo "✅ Redis is accessible"
else
    echo "❌ Redis connection failed"
fi

# Check WebSocket functionality
echo "Checking WebSocket functionality..."
node scripts/test-websocket-connection.js
if [ $? -eq 0 ]; then
    echo "✅ WebSocket is working"
else
    echo "❌ WebSocket connection failed"
fi

# Check disk usage
echo "Checking disk usage..."
kubectl exec -n production deployment/chat-rooms-api -- df -h
```

#### Performance Monitoring

##### Key Metrics to Monitor

| Metric | Threshold | Action |
|--------|-----------|--------|
| API Response Time (p95) | > 1000ms | Investigate slow queries |
| Error Rate | > 5% | Check application logs |
| CPU Usage | > 80% | Scale up pods |
| Memory Usage | > 85% | Check for memory leaks |
| WebSocket Connections | > 10,000 | Scale WebSocket pods |
| Database Connections | > 80% of pool | Optimize connection usage |

##### Grafana Dashboard Queries

```promql
# API Response Time (p95)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error Rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# WebSocket Active Connections
websocket_connections_active

# Database Query Duration
mongodb_query_duration_seconds

# Memory Usage
container_memory_usage_bytes / container_spec_memory_limit_bytes
```

### Alert Response Procedures

#### High Error Rate Alert

```bash
# 1. Check current error rate
curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~\"5..\"}[5m])/rate(http_requests_total[5m])"

# 2. Check application logs
kubectl logs -n production deployment/chat-rooms-api --tail=100 | grep ERROR

# 3. Check for recent deployments
kubectl rollout history deployment/chat-rooms-api -n production

# 4. If deployment-related, rollback
kubectl rollout undo deployment/chat-rooms-api -n production

# 5. Check database connectivity
kubectl exec -n production deployment/chat-rooms-api -- npm run health:db

# 6. Scale up if needed
kubectl scale deployment chat-rooms-api --replicas=5 -n production
```

#### High Memory Usage Alert

```bash
# 1. Check memory usage per pod
kubectl top pods -n production -l app=chat-rooms-api

# 2. Check for memory leaks
kubectl exec -n production deployment/chat-rooms-api -- node --expose-gc -e "global.gc(); console.log(process.memoryUsage())"

# 3. Restart high-memory pods
kubectl delete pod -n production -l app=chat-rooms-api --field-selector='metadata.name=high-memory-pod-name'

# 4. Scale up deployment
kubectl scale deployment chat-rooms-api --replicas=5 -n production

# 5. Monitor memory patterns
# Check Grafana dashboard: Production - Memory Usage
```

#### Database Connection Issues

```bash
# 1. Check MongoDB status
kubectl exec -n production deployment/mongodb -- mongo --eval "db.runCommand('ping')"

# 2. Check connection pool status
kubectl logs -n production deployment/chat-rooms-api | grep "connection pool"

# 3. Restart API pods to reset connections
kubectl rollout restart deployment/chat-rooms-api -n production

# 4. Check MongoDB logs
kubectl logs -n production deployment/mongodb --tail=200

# 5. If MongoDB is down, check replica set status
kubectl exec -n production deployment/mongodb -- mongo --eval "rs.status()"
```

## Disaster Recovery Runbooks

### Database Backup and Restore

#### Automated Backup Process

```bash
#!/bin/bash
# mongodb-backup.sh

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="/backups/mongodb_$BACKUP_DATE"
S3_BUCKET="your-backup-bucket"

# Create backup
kubectl exec -n production deployment/mongodb -- mongodump --out /tmp/backup_$BACKUP_DATE

# Copy backup from pod
kubectl cp production/mongodb-pod:/tmp/backup_$BACKUP_DATE $BACKUP_PATH

# Compress backup
tar -czf "$BACKUP_PATH.tar.gz" -C "$BACKUP_PATH" .

# Upload to S3
aws s3 cp "$BACKUP_PATH.tar.gz" "s3://$S3_BUCKET/mongodb/"

# Cleanup local files
rm -rf "$BACKUP_PATH" "$BACKUP_PATH.tar.gz"

# Retain only last 30 days of backups in S3
aws s3 ls "s3://$S3_BUCKET/mongodb/" | head -n -30 | awk '{print $4}' | xargs -I {} aws s3 rm "s3://$S3_BUCKET/mongodb/{}"
```

#### Restore Procedure

```bash
#!/bin/bash
# mongodb-restore.sh

BACKUP_FILE=$1
RESTORE_PATH="/tmp/restore_$(date +%Y%m%d_%H%M%S)"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file.tar.gz>"
    exit 1
fi

# Download backup from S3
aws s3 cp "s3://your-backup-bucket/mongodb/$BACKUP_FILE" /tmp/

# Extract backup
tar -xzf "/tmp/$BACKUP_FILE" -C "$RESTORE_PATH"

# Copy to MongoDB pod
kubectl cp "$RESTORE_PATH" production/mongodb-pod:/tmp/restore

# Restore database
kubectl exec -n production deployment/mongodb -- mongorestore --drop /tmp/restore

# Cleanup
rm -rf "/tmp/$BACKUP_FILE" "$RESTORE_PATH"
kubectl exec -n production deployment/mongodb -- rm -rf /tmp/restore
```

### Application Recovery

#### Complete System Recovery

```bash
#!/bin/bash
# complete-system-recovery.sh

echo "Starting complete system recovery..."

# 1. Restore infrastructure (if needed)
cd terraform/
terraform plan -out recovery.plan
terraform apply recovery.plan

# 2. Deploy Kubernetes infrastructure
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmaps.yaml

# 3. Deploy database
kubectl apply -f k8s/mongodb-deployment.yaml
kubectl wait --for=condition=ready pod -l app=mongodb -n production --timeout=300s

# 4. Restore database from backup
./scripts/mongodb-restore.sh latest_backup.tar.gz

# 5. Deploy Redis
kubectl apply -f k8s/redis-deployment.yaml
kubectl wait --for=condition=ready pod -l app=redis -n production --timeout=180s

# 6. Deploy application
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# 7. Wait for deployments
kubectl wait --for=condition=ready pod -l app=chat-rooms-api -n production --timeout=300s
kubectl wait --for=condition=ready pod -l app=chat-rooms-frontend -n production --timeout=300s

# 8. Deploy services and ingress
kubectl apply -f k8s/services.yaml
kubectl apply -f k8s/ingress.yaml

# 9. Run health checks
sleep 30
curl -f http://api.example.com/api/health

echo "System recovery completed"
```

## Troubleshooting Guides

### Common Issues

#### WebSocket Connection Failures

**Symptoms:**
- Users unable to send/receive real-time messages
- WebSocket connection errors in browser console
- High number of connection timeouts

**Diagnosis:**
```bash
# Check WebSocket pod status
kubectl get pods -n production -l app=websocket-gateway

# Check ingress configuration
kubectl describe ingress chat-rooms-ingress -n production

# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" http://api.example.com/socket.io/

# Check application logs
kubectl logs -n production deployment/chat-rooms-api | grep -i websocket
```

**Resolution:**
```bash
# 1. Restart WebSocket pods
kubectl rollout restart deployment/chat-rooms-api -n production

# 2. Check ingress websocket annotations
kubectl patch ingress chat-rooms-ingress -n production -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/proxy-read-timeout":"3600","nginx.ingress.kubernetes.io/proxy-send-timeout":"3600"}}}'

# 3. Scale up if needed
kubectl scale deployment chat-rooms-api --replicas=5 -n production
```

#### Database Performance Issues

**Symptoms:**
- Slow API responses
- High database CPU usage
- Query timeouts

**Diagnosis:**
```bash
# Check MongoDB performance
kubectl exec -n production deployment/mongodb -- mongo --eval "db.currentOp()"

# Check slow queries
kubectl exec -n production deployment/mongodb -- mongo --eval "db.getProfilingStatus()"

# Check database metrics
kubectl exec -n production deployment/mongodb -- mongostat --host localhost:27017
```

**Resolution:**
```bash
# 1. Add missing indexes
kubectl exec -n production deployment/mongodb -- mongo chat-rooms --eval "
db.messages.createIndex({roomId: 1, createdAt: -1});
db.messages.createIndex({userId: 1, createdAt: -1});
db.users.createIndex({username: 1}, {unique: true});
"

# 2. Scale MongoDB (if replica set)
kubectl scale statefulset mongodb --replicas=3 -n production

# 3. Enable query profiling temporarily
kubectl exec -n production deployment/mongodb -- mongo chat-rooms --eval "db.setProfilingLevel(2, {slowms: 100})"
```

#### Memory Leaks

**Symptoms:**
- Gradually increasing memory usage
- Pods being killed by OOM killer
- Application slowdown over time

**Diagnosis:**
```bash
# Check memory usage trends
kubectl top pods -n production -l app=chat-rooms-api

# Generate heap dump
kubectl exec -n production deployment/chat-rooms-api -- node --inspect --heapsnapshot-signal=SIGUSR2 &
kubectl exec -n production deployment/chat-rooms-api -- kill -SIGUSR2 1

# Copy heap dump for analysis
kubectl cp production/chat-rooms-api-pod:/app/Heap.*.heapsnapshot ./heap-dump.heapsnapshot
```

**Resolution:**
```bash
# 1. Restart affected pods
kubectl delete pod -n production -l app=chat-rooms-api

# 2. Implement pod rotation
kubectl rollout restart deployment/chat-rooms-api -n production

# 3. Set memory limits
kubectl patch deployment chat-rooms-api -n production -p '{"spec":{"template":{"spec":{"containers":[{"name":"chat-rooms-api","resources":{"limits":{"memory":"512Mi"},"requests":{"memory":"256Mi"}}}]}}}}'
```

### Emergency Contacts

| Role | Contact | Phone | Email |
|------|---------|-------|-------|
| DevOps Lead | John Doe | +1-555-0123 | john.doe@company.com |
| Backend Lead | Jane Smith | +1-555-0124 | jane.smith@company.com |
| Database Admin | Bob Johnson | +1-555-0125 | bob.johnson@company.com |
| Security Lead | Alice Brown | +1-555-0126 | alice.brown@company.com |

### Escalation Procedures

1. **P1 (Critical)**: System completely down
   - Immediate notification to DevOps Lead
   - Activate incident response team
   - Begin recovery procedures

2. **P2 (High)**: Significant functionality impaired
   - Notify team leads within 30 minutes
   - Begin investigation and mitigation
   - Prepare rollback if needed

3. **P3 (Medium)**: Minor functionality issues
   - Create ticket and assign to appropriate team
   - Monitor for escalation

4. **P4 (Low)**: Cosmetic or minor issues
   - Create ticket for next sprint planning

This runbook should be updated regularly as the system evolves and new issues are discovered.
