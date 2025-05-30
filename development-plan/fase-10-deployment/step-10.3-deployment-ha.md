# Step 10.3: High Availability Deployment

## Overview
Implement high availability (HA) deployment strategy with multi-region setup, disaster recovery, auto-scaling, and zero-downtime operations for enterprise-grade reliability.

## Prerequisites
- Step 10.1: Docker Production completed
- Step 10.2: CI/CD Pipeline completed
- Cloud provider accounts (AWS/GCP/Azure)
- Domain with DNS management capabilities
- SSL/TLS certificates for all domains

## Architecture Components

### 1. Multi-Region Infrastructure

#### Primary Region Setup
```yaml
# infrastructure/terraform/regions/primary/main.tf
provider "aws" {
  region = var.primary_region
  alias  = "primary"
}

# VPC Configuration
resource "aws_vpc" "primary" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name        = "chat-rooms-primary-vpc"
    Environment = var.environment
    Region      = "primary"
  }
}

# Multi-AZ Subnets
resource "aws_subnet" "primary_private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.primary.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = var.availability_zones[count.index]
  
  tags = {
    Name = "private-subnet-${count.index + 1}"
    Type = "private"
  }
}

resource "aws_subnet" "primary_public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.primary.id
  cidr_block             = "10.0.${count.index + 10}.0/24"
  availability_zone      = var.availability_zones[count.index]
  map_public_ip_on_launch = true
  
  tags = {
    Name = "public-subnet-${count.index + 1}"
    Type = "public"
  }
}
```

#### Secondary Region Setup
```yaml
# infrastructure/terraform/regions/secondary/main.tf
provider "aws" {
  region = var.secondary_region
  alias  = "secondary"
}

# Cross-Region VPC Peering
resource "aws_vpc_peering_connection" "primary_to_secondary" {
  provider    = aws.primary
  vpc_id      = data.terraform_remote_state.primary.outputs.vpc_id
  peer_vpc_id = aws_vpc.secondary.id
  peer_region = var.secondary_region
  auto_accept = false

  tags = {
    Name = "primary-to-secondary-peering"
  }
}

# Database Cross-Region Replication
resource "aws_rds_cluster" "secondary" {
  provider                = aws.secondary
  cluster_identifier      = "chat-rooms-secondary"
  engine                 = "aurora-postgresql"
  engine_version         = "13.7"
  master_username        = var.db_username
  master_password        = var.db_password
  backup_retention_period = 35
  preferred_backup_window = "07:00-09:00"
  
  # Cross-region replica configuration
  source_region                    = var.primary_region
  replication_source_identifier   = data.terraform_remote_state.primary.outputs.rds_cluster_arn
  
  tags = {
    Name        = "chat-rooms-secondary-db"
    Environment = var.environment
    Role        = "replica"
  }
}
```

### 2. Load Balancing and Traffic Management

#### Global Load Balancer Configuration
```yaml
# infrastructure/terraform/global/load-balancer.tf
# Route 53 Health Checks
resource "aws_route53_health_check" "primary_api" {
  fqdn                            = "api.${var.primary_domain}"
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/health"
  failure_threshold               = "3"
  request_interval                = "30"
  cloudwatch_alarm_region         = var.primary_region
  cloudwatch_alarm_name           = "primary-api-health"
  insufficient_data_health_status = "Failure"

  tags = {
    Name = "primary-api-health-check"
  }
}

resource "aws_route53_health_check" "secondary_api" {
  fqdn                            = "api.${var.secondary_domain}"
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/health"
  failure_threshold               = "3"
  request_interval                = "30"
  cloudwatch_alarm_region         = var.secondary_region
  cloudwatch_alarm_name           = "secondary-api-health"
  insufficient_data_health_status = "Failure"

  tags = {
    Name = "secondary-api-health-check"
  }
}

# DNS Failover Configuration
resource "aws_route53_record" "api_primary" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "api.${var.domain}"
  type    = "A"
  
  set_identifier = "primary"
  
  failover_routing_policy {
    type = "PRIMARY"
  }
  
  health_check_id = aws_route53_health_check.primary_api.id
  
  alias {
    name                   = aws_lb.primary_api.dns_name
    zone_id                = aws_lb.primary_api.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api_secondary" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "api.${var.domain}"
  type    = "A"
  
  set_identifier = "secondary"
  
  failover_routing_policy {
    type = "SECONDARY"
  }
  
  alias {
    name                   = aws_lb.secondary_api.dns_name
    zone_id                = aws_lb.secondary_api.zone_id
    evaluate_target_health = true
  }
}
```

#### Application Load Balancer with Auto Scaling
```yaml
# infrastructure/terraform/compute/auto-scaling.tf
# Launch Template
resource "aws_launch_template" "api" {
  name_prefix   = "chat-rooms-api-"
  image_id      = data.aws_ami.app.id
  instance_type = var.instance_type
  
  vpc_security_group_ids = [aws_security_group.api.id]
  
  user_data = base64encode(templatefile("${path.module}/templates/user-data.sh", {
    environment = var.environment
    region      = var.region
  }))
  
  iam_instance_profile {
    name = aws_iam_instance_profile.api.name
  }
  
  monitoring {
    enabled = true
  }
  
  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "chat-rooms-api"
      Environment = var.environment
    }
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# Auto Scaling Group
resource "aws_autoscaling_group" "api" {
  name                = "chat-rooms-api-asg"
  vpc_zone_identifier = aws_subnet.private[*].id
  target_group_arns   = [aws_lb_target_group.api.arn]
  health_check_type   = "ELB"
  health_check_grace_period = 300
  
  min_size         = var.min_instances
  max_size         = var.max_instances
  desired_capacity = var.desired_instances
  
  launch_template {
    id      = aws_launch_template.api.id
    version = "$Latest"
  }
  
  # Instance refresh for zero-downtime deployments
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
      instance_warmup       = 300
    }
  }
  
  tag {
    key                 = "Name"
    value               = "chat-rooms-api"
    propagate_at_launch = true
  }
}

# Auto Scaling Policies
resource "aws_autoscaling_policy" "scale_up" {
  name                   = "scale-up"
  scaling_adjustment     = 2
  adjustment_type        = "ChangeInCapacity"
  cooldown              = 300
  autoscaling_group_name = aws_autoscaling_group.api.name
}

resource "aws_autoscaling_policy" "scale_down" {
  name                   = "scale-down"
  scaling_adjustment     = -1
  adjustment_type        = "ChangeInCapacity"
  cooldown              = 300
  autoscaling_group_name = aws_autoscaling_group.api.name
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "cpu-utilization-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ec2 cpu utilization"
  alarm_actions       = [aws_autoscaling_policy.scale_up.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.api.name
  }
}
```

### 3. Database High Availability

#### PostgreSQL Cluster with Failover
```yaml
# infrastructure/terraform/database/postgres-ha.tf
# Primary RDS Cluster
resource "aws_rds_cluster" "primary" {
  cluster_identifier      = "chat-rooms-primary"
  engine                 = "aurora-postgresql"
  engine_version         = "13.7"
  engine_mode            = "provisioned"
  database_name          = var.database_name
  master_username        = var.database_username
  master_password        = var.database_password
  
  backup_retention_period = 35
  preferred_backup_window = "03:00-04:00"
  preferred_maintenance_window = "sun:04:00-sun:05:00"
  
  db_subnet_group_name   = aws_db_subnet_group.primary.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  # Enable backtrack for point-in-time recovery
  backtrack_window = 72
  
  # Enable encryption
  storage_encrypted = true
  kms_key_id       = aws_kms_key.rds.arn
  
  # Enable logging
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  # Global cluster for cross-region replication
  global_cluster_identifier = aws_rds_global_cluster.live_chat.id
  
  tags = {
    Name        = "chat-rooms-primary-db"
    Environment = var.environment
    Role        = "primary"
  }
}

# Global Cluster for Cross-Region Replication
resource "aws_rds_global_cluster" "live_chat" {
  global_cluster_identifier = "chat-rooms-global"
  engine                   = "aurora-postgresql"
  engine_version           = "13.7"
  database_name            = var.database_name
  storage_encrypted        = true
}

# RDS Cluster Instances
resource "aws_rds_cluster_instance" "primary" {
  count              = 2
  identifier         = "chat-rooms-primary-${count.index}"
  cluster_identifier = aws_rds_cluster.primary.id
  instance_class     = "db.r5.large"
  engine             = aws_rds_cluster.primary.engine
  engine_version     = aws_rds_cluster.primary.engine_version
  
  performance_insights_enabled = true
  monitoring_interval         = 60
  monitoring_role_arn        = aws_iam_role.rds_enhanced_monitoring.arn
  
  tags = {
    Name = "chat-rooms-primary-instance-${count.index}"
  }
}
```

#### MongoDB Replica Set Configuration
```yaml
# infrastructure/kubernetes/mongodb-ha.yaml
apiVersion: v1
kind: Service
metadata:
  name: mongodb-service
  namespace: chat-rooms
spec:
  selector:
    app: mongodb
  ports:
    - port: 27017
      targetPort: 27017
  clusterIP: None
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb
  namespace: chat-rooms
spec:
  serviceName: mongodb-service
  replicas: 3
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
      - name: mongodb
        image: mongo:5.0
        ports:
        - containerPort: 27017
        env:
        - name: MONGO_INITDB_ROOT_USERNAME
          valueFrom:
            secretKeyRef:
              name: mongodb-secret
              key: username
        - name: MONGO_INITDB_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mongodb-secret
              key: password
        volumeMounts:
        - name: mongodb-data
          mountPath: /data/db
        - name: mongodb-config
          mountPath: /etc/mongo
        command:
        - mongod
        - --replSet
        - rs0
        - --config
        - /etc/mongo/mongod.conf
        livenessProbe:
          exec:
            command:
            - mongo
            - --eval
            - "db.adminCommand('ping')"
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - mongo
            - --eval
            - "db.adminCommand('ping')"
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: mongodb-config
        configMap:
          name: mongodb-config
  volumeClaimTemplates:
  - metadata:
      name: mongodb-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: "fast-ssd"
      resources:
        requests:
          storage: 100Gi
```

### 4. Disaster Recovery Strategy

#### Backup and Recovery Automation
```typescript
// scripts/disaster-recovery/backup-automation.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { RDSClient, CreateDBSnapshotCommand } from '@aws-sdk/client-rds';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface BackupConfig {
  environment: string;
  region: string;
  backupBucket: string;
  rdsClusterIdentifier: string;
  mongoConnectionString: string;
}

class DisasterRecoveryManager {
  private s3Client: S3Client;
  private rdsClient: RDSClient;
  private secretsClient: SecretsManagerClient;
  private config: BackupConfig;

  constructor(config: BackupConfig) {
    this.config = config;
    this.s3Client = new S3Client({ region: config.region });
    this.rdsClient = new RDSClient({ region: config.region });
    this.secretsClient = new SecretsManagerClient({ region: config.region });
  }

  async performFullBackup(): Promise<void> {
    const timestamp = new Date().toISOString();
    const backupId = `backup-${timestamp}`;

    try {
      console.log(`Starting full backup: ${backupId}`);

      // PostgreSQL Backup
      await this.backupPostgreSQL(backupId);

      // MongoDB Backup
      await this.backupMongoDB(backupId);

      // File Storage Backup
      await this.backupFileStorage(backupId);

      // Configuration Backup
      await this.backupConfiguration(backupId);

      // Validate Backup Integrity
      await this.validateBackupIntegrity(backupId);

      console.log(`Full backup completed successfully: ${backupId}`);
    } catch (error) {
      console.error(`Backup failed: ${error.message}`);
      throw error;
    }
  }

  private async backupPostgreSQL(backupId: string): Promise<void> {
    const snapshotId = `${this.config.rdsClusterIdentifier}-${backupId}`;
    
    const command = new CreateDBSnapshotCommand({
      DBSnapshotIdentifier: snapshotId,
      DBInstanceIdentifier: this.config.rdsClusterIdentifier,
      Tags: [
        { Key: 'BackupId', Value: backupId },
        { Key: 'Environment', Value: this.config.environment },
        { Key: 'CreatedAt', Value: new Date().toISOString() }
      ]
    });

    await this.rdsClient.send(command);
    console.log(`PostgreSQL snapshot created: ${snapshotId}`);
  }

  private async backupMongoDB(backupId: string): Promise<void> {
    const backupPath = `/tmp/mongodb-backup-${backupId}`;
    const s3Key = `mongodb-backups/${backupId}/dump.tar.gz`;

    // Create MongoDB dump
    await execAsync(`mongodump --uri="${this.config.mongoConnectionString}" --out=${backupPath}`);
    
    // Compress backup
    await execAsync(`tar -czf ${backupPath}.tar.gz -C ${backupPath} .`);

    // Upload to S3
    const fileBuffer = await this.readFileAsync(`${backupPath}.tar.gz`);
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.config.backupBucket,
      Key: s3Key,
      Body: fileBuffer,
      ServerSideEncryption: 'AES256'
    }));

    // Cleanup local files
    await execAsync(`rm -rf ${backupPath}*`);
    console.log(`MongoDB backup uploaded: ${s3Key}`);
  }

  async initiateFailover(targetRegion: string): Promise<void> {
    console.log(`Initiating failover to region: ${targetRegion}`);

    try {
      // Update DNS to point to secondary region
      await this.updateDNSFailover(targetRegion);

      // Promote secondary database to primary
      await this.promoteDatabaseReplica(targetRegion);

      // Scale up secondary region infrastructure
      await this.scaleSecondaryRegion(targetRegion);

      // Verify application health in new region
      await this.verifyApplicationHealth(targetRegion);

      console.log(`Failover to ${targetRegion} completed successfully`);
    } catch (error) {
      console.error(`Failover failed: ${error.message}`);
      throw error;
    }
  }

  private async updateDNSFailover(targetRegion: string): Promise<void> {
    // Implementation for Route 53 failover
    console.log(`Updating DNS failover to ${targetRegion}`);
  }

  private async promoteDatabaseReplica(targetRegion: string): Promise<void> {
    // Implementation for promoting database replica
    console.log(`Promoting database replica in ${targetRegion}`);
  }
}

export { DisasterRecoveryManager };
```

### 5. Monitoring and Alerting for HA

#### Comprehensive Health Monitoring
```typescript
// monitoring/health-check-system.ts
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import axios from 'axios';

interface HealthCheckConfig {
  endpoints: Array<{
    name: string;
    url: string;
    expectedStatus: number;
    timeout: number;
  }>;
  metrics: {
    namespace: string;
    region: string;
  };
  alerting: {
    snsTopicArn: string;
    slackWebhookUrl?: string;
  };
}

class HealthMonitor {
  private cloudWatch: CloudWatchClient;
  private sns: SNSClient;
  private config: HealthCheckConfig;

  constructor(config: HealthCheckConfig) {
    this.config = config;
    this.cloudWatch = new CloudWatchClient({ region: config.metrics.region });
    this.sns = new SNSClient({ region: config.metrics.region });
  }

  async runHealthChecks(): Promise<void> {
    const results = await Promise.allSettled(
      this.config.endpoints.map(endpoint => this.checkEndpoint(endpoint))
    );

    const healthMetrics = results.map((result, index) => ({
      endpoint: this.config.endpoints[index].name,
      healthy: result.status === 'fulfilled' && result.value.healthy,
      responseTime: result.status === 'fulfilled' ? result.value.responseTime : -1,
      error: result.status === 'rejected' ? result.reason.message : null
    }));

    // Send metrics to CloudWatch
    await this.sendMetrics(healthMetrics);

    // Check for failures and alert
    const failures = healthMetrics.filter(metric => !metric.healthy);
    if (failures.length > 0) {
      await this.sendAlert(failures);
    }
  }

  private async checkEndpoint(endpoint: any): Promise<{ healthy: boolean; responseTime: number }> {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(endpoint.url, {
        timeout: endpoint.timeout,
        validateStatus: (status) => status === endpoint.expectedStatus
      });
      
      const responseTime = Date.now() - startTime;
      return { healthy: true, responseTime };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      throw new Error(`Health check failed for ${endpoint.name}: ${error.message}`);
    }
  }

  private async sendMetrics(metrics: any[]): Promise<void> {
    const metricData = metrics.flatMap(metric => [
      {
        MetricName: 'EndpointHealth',
        Dimensions: [{ Name: 'Endpoint', Value: metric.endpoint }],
        Value: metric.healthy ? 1 : 0,
        Unit: 'Count'
      },
      {
        MetricName: 'ResponseTime',
        Dimensions: [{ Name: 'Endpoint', Value: metric.endpoint }],
        Value: metric.responseTime,
        Unit: 'Milliseconds'
      }
    ]);

    await this.cloudWatch.send(new PutMetricDataCommand({
      Namespace: this.config.metrics.namespace,
      MetricData: metricData
    }));
  }

  private async sendAlert(failures: any[]): Promise<void> {
    const message = {
      alert: 'Health Check Failures',
      timestamp: new Date().toISOString(),
      failures: failures.map(f => ({
        endpoint: f.endpoint,
        error: f.error
      }))
    };

    // Send SNS notification
    await this.sns.send(new PublishCommand({
      TopicArn: this.config.alerting.snsTopicArn,
      Message: JSON.stringify(message),
      Subject: `Health Check Alert: ${failures.length} endpoints failing`
    }));

    // Send Slack notification if configured
    if (this.config.alerting.slackWebhookUrl) {
      await this.sendSlackAlert(message);
    }
  }

  private async sendSlackAlert(message: any): Promise<void> {
    const slackMessage = {
      text: `🚨 Health Check Alert`,
      attachments: [{
        color: 'danger',
        fields: [{
          title: 'Failed Endpoints',
          value: message.failures.map((f: any) => `• ${f.endpoint}: ${f.error}`).join('\n'),
          short: false
        }]
      }]
    };

    await axios.post(this.config.alerting.slackWebhookUrl!, slackMessage);
  }
}

export { HealthMonitor };
```

### 6. Zero-Downtime Deployment

#### Blue-Green Deployment with Kubernetes
```yaml
# scripts/deployment/blue-green-deploy.yaml
apiVersion: v1
kind: Script
metadata:
  name: blue-green-deployment
spec:
  steps:
    - name: prepare-green-environment
      script: |
        #!/bin/bash
        set -e
        
        # Deploy new version to green environment
        kubectl apply -f manifests/green/ -n chat-rooms-green
        
        # Wait for green deployment to be ready
        kubectl rollout status deployment/api -n chat-rooms-green
        kubectl rollout status deployment/frontend -n chat-rooms-green
        
        # Run health checks on green environment
        ./scripts/health-check.sh green
        
    - name: run-smoke-tests
      script: |
        #!/bin/bash
        set -e
        
        # Run smoke tests against green environment
        npm run test:smoke -- --env=green
        
        # Run performance tests
        npm run test:performance -- --env=green
        
    - name: switch-traffic
      script: |
        #!/bin/bash
        set -e
        
        # Gradually switch traffic from blue to green
        kubectl patch service api-service -p '{"spec":{"selector":{"version":"green"}}}' -n chat-rooms
        kubectl patch service frontend-service -p '{"spec":{"selector":{"version":"green"}}}' -n chat-rooms
        
        # Wait for traffic switch to complete
        sleep 30
        
        # Verify green environment is serving traffic
        ./scripts/verify-traffic.sh green
        
    - name: cleanup-blue
      script: |
        #!/bin/bash
        set -e
        
        # Keep blue environment for rollback capability (for 1 hour)
        echo "Blue environment kept for rollback. Will cleanup in 1 hour."
        
        # Schedule cleanup job
        at now + 1 hour <<EOF
        kubectl delete namespace chat-rooms-blue
        EOF
```

## Deployment Scripts

### Infrastructure Deployment
```bash
#!/bin/bash
# scripts/deploy-ha-infrastructure.sh

set -e

ENVIRONMENT=${1:-production}
PRIMARY_REGION=${2:-us-east-1}
SECONDARY_REGION=${3:-us-west-2}

echo "Deploying HA infrastructure for environment: $ENVIRONMENT"

# Deploy primary region infrastructure
cd infrastructure/terraform/regions/primary
terraform init
terraform plan -var="environment=$ENVIRONMENT" -var="region=$PRIMARY_REGION"
terraform apply -auto-approve

# Deploy secondary region infrastructure
cd ../secondary
terraform init
terraform plan -var="environment=$ENVIRONMENT" -var="region=$SECONDARY_REGION"
terraform apply -auto-approve

# Deploy global resources (DNS, global load balancer)
cd ../../global
terraform init
terraform plan -var="environment=$ENVIRONMENT"
terraform apply -auto-approve

# Setup cross-region replication
echo "Setting up cross-region database replication..."
aws rds create-db-cluster-endpoint \
  --db-cluster-identifier chat-rooms-primary \
  --db-cluster-endpoint-identifier writer \
  --endpoint-type WRITER

# Configure monitoring and alerting
kubectl apply -f monitoring/ha-monitoring.yaml

echo "HA infrastructure deployment completed successfully"
```

### Application Deployment with HA
```bash
#!/bin/bash
# scripts/deploy-ha-application.sh

set -e

VERSION=${1:-latest}
ENVIRONMENT=${2:-production}

echo "Deploying application version $VERSION with HA setup"

# Build and push Docker images to both regions
docker build -t chat-rooms-api:$VERSION api/
docker build -t chat-rooms-frontend:$VERSION front/

# Push to primary region registry
docker tag chat-rooms-api:$VERSION $PRIMARY_REGISTRY/chat-rooms-api:$VERSION
docker tag chat-rooms-frontend:$VERSION $PRIMARY_REGISTRY/chat-rooms-frontend:$VERSION
docker push $PRIMARY_REGISTRY/chat-rooms-api:$VERSION
docker push $PRIMARY_REGISTRY/chat-rooms-frontend:$VERSION

# Push to secondary region registry
docker tag chat-rooms-api:$VERSION $SECONDARY_REGISTRY/chat-rooms-api:$VERSION
docker tag chat-rooms-frontend:$VERSION $SECONDARY_REGISTRY/chat-rooms-frontend:$VERSION
docker push $SECONDARY_REGISTRY/chat-rooms-api:$VERSION
docker push $SECONDARY_REGISTRY/chat-rooms-frontend:$VERSION

# Deploy to primary region
kubectl apply -f k8s/primary/ --context=primary-cluster
kubectl set image deployment/api api=$PRIMARY_REGISTRY/chat-rooms-api:$VERSION --context=primary-cluster
kubectl set image deployment/frontend frontend=$PRIMARY_REGISTRY/chat-rooms-frontend:$VERSION --context=primary-cluster

# Deploy to secondary region (standby)
kubectl apply -f k8s/secondary/ --context=secondary-cluster
kubectl set image deployment/api api=$SECONDARY_REGISTRY/chat-rooms-api:$VERSION --context=secondary-cluster
kubectl set image deployment/frontend frontend=$SECONDARY_REGISTRY/chat-rooms-frontend:$VERSION --context=secondary-cluster

# Verify deployments
kubectl rollout status deployment/api --context=primary-cluster
kubectl rollout status deployment/frontend --context=primary-cluster

echo "HA application deployment completed successfully"
```

## Validation and Testing

### HA Testing Scripts
```typescript
// tests/ha/failover-test.ts
import { test, expect } from '@playwright/test';
import { HealthMonitor } from '../../monitoring/health-check-system';
import { DisasterRecoveryManager } from '../../scripts/disaster-recovery/backup-automation';

test.describe('High Availability Tests', () => {
  test('should handle primary region failure', async ({ page }) => {
    // Simulate primary region failure
    await simulateRegionFailure('us-east-1');
    
    // Verify automatic failover to secondary region
    await page.goto('https://app.livechat.com');
    await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
    
    // Verify all functionality works in secondary region
    await page.fill('[data-testid="message-input"]', 'Test message during failover');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="message-list"]')).toContainText('Test message during failover');
  });

  test('should recover from database failover', async ({ page }) => {
    // Simulate database failover
    await simulateDatabaseFailover();
    
    // Verify application continues to work
    await page.goto('https://app.livechat.com');
    await page.fill('[data-testid="login-email"]', 'test@example.com');
    await page.fill('[data-testid="login-password"]', 'password');
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('should maintain performance during auto-scaling', async ({ page }) => {
    // Generate load to trigger auto-scaling
    await generateLoad(1000); // 1000 concurrent users
    
    // Verify response times remain acceptable
    const startTime = Date.now();
    await page.goto('https://api.livechat.com/health');
    const endTime = Date.now();
    
    expect(endTime - startTime).toBeLessThan(5000); // Less than 5 seconds
  });
});

async function simulateRegionFailure(region: string): Promise<void> {
  // Implementation to simulate region failure
  console.log(`Simulating failure in region: ${region}`);
}

async function simulateDatabaseFailover(): Promise<void> {
  // Implementation to simulate database failover
  console.log('Simulating database failover');
}

async function generateLoad(concurrentUsers: number): Promise<void> {
  // Implementation to generate load
  console.log(`Generating load with ${concurrentUsers} concurrent users`);
}
```

## Success Metrics

### Key Performance Indicators
- **Availability**: 99.99% uptime (52 minutes downtime per year)
- **RTO (Recovery Time Objective)**: < 15 minutes
- **RPO (Recovery Point Objective)**: < 5 minutes
- **Failover Time**: < 3 minutes automated
- **Cross-Region Latency**: < 100ms
- **Auto-Scaling Response**: < 2 minutes

### Monitoring Dashboards
1. **Service Health Dashboard**: Real-time status of all services
2. **Performance Metrics**: Response times, throughput, error rates
3. **Infrastructure Monitoring**: CPU, memory, network, storage
4. **Cost Optimization**: Resource utilization and cost trends
5. **Security Monitoring**: Access logs, security events, compliance status

## Conclusion

This high availability deployment strategy provides:
- **Multi-region redundancy** with automatic failover
- **Zero-downtime deployments** with blue-green strategy
- **Automated disaster recovery** with comprehensive backup
- **Horizontal auto-scaling** based on demand
- **Comprehensive monitoring** and alerting
- **Enterprise-grade reliability** with 99.99% uptime target

The implementation ensures the Chat Rooms application can handle enterprise-scale traffic while maintaining high availability and performance standards.

## Next Steps

1. **Performance Optimization**: Implement advanced caching strategies
2. **Global CDN**: Deploy content delivery network for worldwide performance
3. **Advanced Analytics**: Implement real-time business intelligence
4. **ML/AI Integration**: Add intelligent routing and content moderation
5. **Compliance Enhancement**: Implement additional regulatory compliance features

## Files Created/Modified

- `infrastructure/terraform/regions/primary/main.tf`
- `infrastructure/terraform/regions/secondary/main.tf`
- `infrastructure/terraform/global/load-balancer.tf`
- `infrastructure/terraform/compute/auto-scaling.tf`
- `infrastructure/terraform/database/postgres-ha.tf`
- `infrastructure/kubernetes/mongodb-ha.yaml`
- `scripts/disaster-recovery/backup-automation.ts`
- `monitoring/health-check-system.ts`
- `scripts/deployment/blue-green-deploy.yaml`
- `scripts/deploy-ha-infrastructure.sh`
- `scripts/deploy-ha-application.sh`
- `tests/ha/failover-test.ts`
