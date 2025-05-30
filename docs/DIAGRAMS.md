# Chat Rooms Application - Architecture Diagrams

This document contains comprehensive diagrams illustrating the architecture, data flow, and interactions of the Chat Rooms application.

## 1. System Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        UI[Vue 3 Frontend]
        Mobile[Mobile App - Future]
    end
    
    subgraph "Load Balancer & CDN"
        LB[Global Load Balancer]
        CDN[Content Delivery Network]
    end
    
    subgraph "Application Layer"
        API[NestJS API Server]
        WS[WebSocket Gateway]
        FileAPI[File Management API]
    end
    
    subgraph "Business Logic"
        Auth[Authentication Service]
        Chat[Chat Service]
        User[User Service]
        File[File Storage Service]
        Notification[Notification Service]
        Analytics[Analytics Service]
        Moderation[Moderation Service]
    end
    
    subgraph "Data Layer"
        Postgres[(PostgreSQL)]
        Mongo[(MongoDB)]
        Redis[(Redis Cache)]
        S3[(File Storage)]
    end
    
    subgraph "External Services"
        Email[Email Service]
        Push[Push Notifications]
        AI[AI Moderation]
        Monitoring[Monitoring Stack]
    end
    
    UI --> LB
    Mobile --> LB
    LB --> CDN
    CDN --> API
    CDN --> WS
    CDN --> FileAPI
    
    API --> Auth
    API --> Chat
    API --> User
    WS --> Chat
    WS --> Notification
    FileAPI --> File
    
    Auth --> Postgres
    Chat --> Mongo
    User --> Postgres
    File --> S3
    Notification --> Redis
    Analytics --> Postgres
    Moderation --> AI
    
    Chat --> Notification
    Chat --> Analytics
    Chat --> Moderation
    
    Notification --> Email
    Notification --> Push
    Analytics --> Monitoring
```

## 2. Hexagonal Architecture Detail

```mermaid
graph LR
    subgraph "External Actors"
        Web[Web UI]
        API_Client[API Client]
        Admin[Admin Panel]
        Mobile[Mobile App]
    end
    
    subgraph "Ports (Interfaces)"
        HTTP[HTTP Port]
        WS_Port[WebSocket Port]
        CLI[CLI Port]
        Event[Event Port]
    end
    
    subgraph "Application Core"
        subgraph "Domain"
            User_Entity[User Entity]
            Message_Entity[Message Entity]
            Room_Entity[Room Entity]
            Attachment_Entity[Attachment Entity]
        end
        
        subgraph "Use Cases"
            Auth_UC[Authentication]
            Chat_UC[Chat Management]
            File_UC[File Management]
            User_UC[User Management]
        end
        
        subgraph "Application Services"
            Auth_Service[Auth Service]
            Chat_Service[Chat Service]
            File_Service[File Service]
            Notification_Service[Notification Service]
        end
    end
    
    subgraph "Adapters (Infrastructure)"
        subgraph "Inbound Adapters"
            REST[REST Controllers]
            WebSocket[WebSocket Gateway]
            GraphQL[GraphQL Resolvers]
        end
        
        subgraph "Outbound Adapters"
            Postgres_Repo[PostgreSQL Repository]
            Mongo_Repo[MongoDB Repository]
            Redis_Adapter[Redis Cache]
            S3_Adapter[S3 Storage]
            Email_Adapter[Email Service]
            Push_Adapter[Push Service]
        end
    end
    
    Web --> HTTP
    API_Client --> HTTP
    Admin --> CLI
    Mobile --> WS_Port
    
    HTTP --> REST
    WS_Port --> WebSocket
    CLI --> GraphQL
    Event --> WebSocket
    
    REST --> Auth_UC
    REST --> Chat_UC
    REST --> File_UC
    WebSocket --> Chat_UC
    WebSocket --> Notification_Service
    
    Auth_UC --> Auth_Service
    Chat_UC --> Chat_Service
    File_UC --> File_Service
    
    Auth_Service --> User_Entity
    Chat_Service --> Message_Entity
    Chat_Service --> Room_Entity
    File_Service --> Attachment_Entity
    
    Auth_Service --> Postgres_Repo
    Chat_Service --> Mongo_Repo
    File_Service --> S3_Adapter
    Notification_Service --> Redis_Adapter
    Notification_Service --> Email_Adapter
    Notification_Service --> Push_Adapter
```

## 3. Data Flow Diagram

```mermaid
sequenceDiagram
    participant UI as Vue Frontend
    participant LB as Load Balancer
    participant API as NestJS API
    participant WS as WebSocket Gateway
    participant Auth as Auth Service
    participant Chat as Chat Service
    participant DB as Database
    participant Cache as Redis Cache
    participant Storage as File Storage
    
    Note over UI,Storage: User Authentication Flow
    UI->>+LB: POST /auth/login
    LB->>+API: Forward request
    API->>+Auth: Authenticate user
    Auth->>+DB: Validate credentials
    DB-->>-Auth: User data
    Auth-->>-API: JWT tokens
    API-->>-LB: Auth response
    LB-->>-UI: JWT tokens
    
    Note over UI,Storage: WebSocket Connection
    UI->>+WS: Connect with JWT
    WS->>+Auth: Validate token
    Auth-->>-WS: User validated
    WS-->>-UI: Connection established
    
    Note over UI,Storage: Send Message Flow
    UI->>+API: POST /messages
    API->>+Chat: Create message
    Chat->>+DB: Store message
    DB-->>-Chat: Message saved
    Chat->>+Cache: Cache message
    Cache-->>-Chat: Cached
    Chat-->>-API: Message created
    API-->>-UI: Success response
    
    API->>+WS: Broadcast message
    WS->>UI: Real-time message
    WS->>UI: Delivery confirmation
    
    Note over UI,Storage: File Upload Flow
    UI->>+API: POST /files/upload
    API->>+Storage: Store file
    Storage-->>-API: File URL
    API->>+DB: Save metadata
    DB-->>-API: Metadata saved
    API-->>-UI: Upload success
    
    UI->>+API: POST /messages (with file)
    API->>+Chat: Create message with attachment
    Chat->>+DB: Store message
    DB-->>-Chat: Message saved
    Chat-->>-API: Message created
    API->>+WS: Broadcast file message
    WS->>UI: Real-time file message
```

## 4. Database Schema Diagram

```mermaid
erDiagram
    USERS {
        uuid id PK
        string username UK
        string email UK
        string password_hash
        string avatar_url
        string text_color
        string background_color
        boolean is_online
        timestamp last_seen
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    
    ROOMS {
        uuid id PK
        string name
        text description
        boolean is_private
        integer max_users
        uuid created_by FK
        timestamp created_at
        timestamp updated_at
    }
    
    MESSAGES {
        uuid id PK
        text content
        uuid user_id FK
        uuid room_id FK
        string message_type
        uuid thread_id FK
        boolean is_edited
        timestamp edited_at
        json metadata
        timestamp created_at
        timestamp deleted_at
    }
    
    ATTACHMENTS {
        uuid id PK
        string filename
        string original_name
        string mime_type
        bigint size
        string url
        string storage_provider
        uuid uploaded_by FK
        uuid message_id FK
        json metadata
        timestamp uploaded_at
    }
    
    REACTIONS {
        uuid id PK
        uuid message_id FK
        uuid user_id FK
        string emoji
        timestamp created_at
    }
    
    MENTIONS {
        uuid id PK
        uuid message_id FK
        uuid mentioned_user_id FK
        integer position
        timestamp created_at
    }
    
    READ_RECEIPTS {
        uuid id PK
        uuid message_id FK
        uuid user_id FK
        timestamp read_at
    }
    
    USER_ROOMS {
        uuid user_id FK
        uuid room_id FK
        string role
        timestamp joined_at
        timestamp last_read_at
    }
    
    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        string type
        string title
        text content
        json data
        boolean is_read
        string delivery_status
        timestamp created_at
        timestamp read_at
    }
    
    USERS ||--o{ MESSAGES : creates
    USERS ||--o{ ROOMS : creates
    USERS ||--o{ ATTACHMENTS : uploads
    USERS ||--o{ REACTIONS : makes
    USERS ||--o{ MENTIONS : receives
    USERS ||--o{ READ_RECEIPTS : has
    USERS ||--o{ NOTIFICATIONS : receives
    
    ROOMS ||--o{ MESSAGES : contains
    ROOMS ||--o{ USER_ROOMS : has_members
    
    MESSAGES ||--o{ ATTACHMENTS : has
    MESSAGES ||--o{ REACTIONS : receives
    MESSAGES ||--o{ MENTIONS : contains
    MESSAGES ||--o{ READ_RECEIPTS : tracks
    MESSAGES ||--o{ MESSAGES : replies_to
    
    USERS ||--o{ USER_ROOMS : belongs_to
```

## 5. WebSocket Event Flow

```mermaid
sequenceDiagram
    participant C1 as Client 1
    participant C2 as Client 2
    participant WS as WebSocket Gateway
    participant Chat as Chat Service
    participant DB as Database
    participant Cache as Redis
    
    Note over C1,Cache: User Joins Room
    C1->>+WS: join_room event
    WS->>+Chat: Add user to room
    Chat->>+DB: Update user_rooms
    DB-->>-Chat: Updated
    Chat-->>-WS: User added
    WS->>C1: room_joined confirmation
    WS->>C2: user_joined notification
    
    Note over C1,Cache: Typing Indicator
    C1->>+WS: typing_start event
    WS->>+Cache: Set typing status
    Cache-->>-WS: Status set
    WS->>C2: user_typing notification
    
    Note over C1,Cache: Send Message
    C1->>+WS: send_message event
    WS->>+Chat: Process message
    Chat->>+DB: Store message
    DB-->>-Chat: Message stored
    Chat->>+Cache: Cache message
    Cache-->>-Chat: Cached
    Chat-->>-WS: Message processed
    WS->>C1: message_sent confirmation
    WS->>C2: new_message notification
    
    Note over C1,Cache: Message Reaction
    C2->>+WS: add_reaction event
    WS->>+Chat: Add reaction
    Chat->>+DB: Store reaction
    DB-->>-Chat: Reaction stored
    Chat-->>-WS: Reaction added
    WS->>C1: reaction_added notification
    WS->>C2: reaction_confirmed
    
    Note over C1,Cache: Read Receipt
    C2->>+WS: mark_read event
    WS->>+Chat: Mark as read
    Chat->>+DB: Update read receipt
    DB-->>-Chat: Updated
    Chat-->>-WS: Marked as read
    WS->>C1: message_read notification
    
    Note over C1,Cache: User Leaves
    C1->>+WS: leave_room event
    WS->>+Chat: Remove from room
    Chat->>+Cache: Update presence
    Cache-->>-Chat: Updated
    Chat-->>-WS: User removed
    WS->>C2: user_left notification
```

## 6. Authentication & Security Flow

```mermaid
sequenceDiagram
    participant Client as Frontend
    participant LB as Load Balancer
    participant API as API Gateway
    participant Auth as Auth Service
    participant JWT as JWT Service
    participant DB as Database
    participant Cache as Redis
    
    Note over Client,Cache: Registration Flow
    Client->>+LB: POST /auth/register
    LB->>+API: Forward request
    API->>+Auth: Validate registration data
    Auth->>+DB: Check if user exists
    DB-->>-Auth: User status
    Auth->>+DB: Create user
    DB-->>-Auth: User created
    Auth->>+JWT: Generate tokens
    JWT-->>-Auth: Access & refresh tokens
    Auth->>+Cache: Store refresh token
    Cache-->>-Auth: Token stored
    Auth-->>-API: Registration success
    API-->>-LB: Success response
    LB-->>-Client: User created with tokens
    
    Note over Client,Cache: Login Flow
    Client->>+LB: POST /auth/login
    LB->>+API: Forward request
    API->>+Auth: Validate credentials
    Auth->>+DB: Verify user
    DB-->>-Auth: User data
    Auth->>+JWT: Generate tokens
    JWT-->>-Auth: New tokens
    Auth->>+Cache: Store refresh token
    Cache-->>-Auth: Token stored
    Auth-->>-API: Login success
    API-->>-LB: Success with tokens
    LB-->>-Client: Authenticated
    
    Note over Client,Cache: Protected Request
    Client->>+LB: API request with JWT
    LB->>+API: Forward with token
    API->>+JWT: Validate access token
    JWT-->>-API: Token valid
    API->>+Auth: Process request
    Auth-->>-API: Response
    API-->>-LB: Success response
    LB-->>-Client: Protected data
    
    Note over Client,Cache: Token Refresh
    Client->>+LB: POST /auth/refresh
    LB->>+API: Forward refresh token
    API->>+JWT: Validate refresh token
    JWT->>+Cache: Check token validity
    Cache-->>-JWT: Token valid
    JWT->>+JWT: Generate new access token
    JWT-->>-API: New access token
    API-->>-LB: New token
    LB-->>-Client: Refreshed token
```

## 7. File Upload & Processing Flow

```mermaid
sequenceDiagram
    participant Client as Frontend
    participant API as File API
    participant Upload as Upload Service
    participant Storage as Storage Service
    participant Process as Processing Service
    participant DB as Database
    participant CDN as CDN
    
    Note over Client,CDN: File Upload Flow
    Client->>+API: POST /files/upload
    API->>+Upload: Validate file
    Upload->>Upload: Security checks
    Upload->>+Storage: Store original file
    Storage-->>-Upload: File stored
    Upload->>+DB: Save metadata
    DB-->>-Upload: Metadata saved
    Upload-->>-API: Upload success
    API-->>-Client: File URL & metadata
    
    Note over Client,CDN: Image Processing
    API->>+Process: Queue image processing
    Process->>+Storage: Get original image
    Storage-->>-Process: Original file
    Process->>Process: Generate thumbnails
    Process->>Process: Optimize images
    Process->>+Storage: Store processed files
    Storage-->>-Process: Processed files stored
    Process->>+DB: Update metadata
    DB-->>-Process: Metadata updated
    Process->>+CDN: Cache optimized files
    CDN-->>-Process: Files cached
    
    Note over Client,CDN: File Access
    Client->>+API: GET /files/:id
    API->>+DB: Get file metadata
    DB-->>-API: File info
    API->>+Storage: Generate signed URL
    Storage-->>-API: Signed URL
    API-->>-Client: Redirect to file
    Client->>+CDN: Access file directly
    CDN-->>-Client: File content
```

## 8. High Availability Architecture

```mermaid
graph TB
    subgraph "Global DNS & Load Balancing"
        DNS[Route 53 DNS]
        GLB[Global Load Balancer]
    end
    
    subgraph "Primary Region (US-East-1)"
        subgraph "Primary AZ-1"
            API1[API Server 1]
            WS1[WebSocket Server 1]
        end
        subgraph "Primary AZ-2"
            API2[API Server 2]
            WS2[WebSocket Server 2]
        end
        subgraph "Primary Database"
            PG1[(PostgreSQL Primary)]
            MONGO1[(MongoDB Primary)]
            REDIS1[(Redis Primary)]
        end
        ALB1[Application Load Balancer]
    end
    
    subgraph "Secondary Region (US-West-2)"
        subgraph "Secondary AZ-1"
            API3[API Server 3]
            WS3[WebSocket Server 3]
        end
        subgraph "Secondary AZ-2"
            API4[API Server 4]
            WS4[WebSocket Server 4]
        end
        subgraph "Secondary Database"
            PG2[(PostgreSQL Replica)]
            MONGO2[(MongoDB Replica)]
            REDIS2[(Redis Replica)]
        end
        ALB2[Application Load Balancer]
    end
    
    subgraph "Global Services"
        CDN[CloudFront CDN]
        S3[S3 Storage]
        MONITORING[Monitoring Stack]
    end
    
    DNS --> GLB
    GLB --> ALB1
    GLB --> ALB2
    
    ALB1 --> API1
    ALB1 --> API2
    ALB1 --> WS1
    ALB1 --> WS2
    
    ALB2 --> API3
    ALB2 --> API4
    ALB2 --> WS3
    ALB2 --> WS4
    
    API1 --> PG1
    API2 --> PG1
    API1 --> MONGO1
    API2 --> MONGO1
    API1 --> REDIS1
    API2 --> REDIS1
    
    API3 --> PG2
    API4 --> PG2
    API3 --> MONGO2
    API4 --> MONGO2
    API3 --> REDIS2
    API4 --> REDIS2
    
    PG1 -.->|Replication| PG2
    MONGO1 -.->|Replication| MONGO2
    REDIS1 -.->|Replication| REDIS2
    
    API1 --> S3
    API2 --> S3
    API3 --> S3
    API4 --> S3
    
    CDN --> S3
    
    MONITORING --> API1
    MONITORING --> API2
    MONITORING --> API3
    MONITORING --> API4
```

## 9. Deployment Pipeline Flow

```mermaid
flowchart TD
    DEV[Development] --> COMMIT[Git Commit]
    COMMIT --> WEBHOOK[GitHub Webhook]
    WEBHOOK --> BUILD[Build Pipeline]
    
    BUILD --> LINT[Code Linting]
    BUILD --> TEST[Unit Tests]
    BUILD --> SECURITY[Security Scan]
    
    LINT --> QUALITY{Quality Gates}
    TEST --> QUALITY
    SECURITY --> QUALITY
    
    QUALITY -->|Pass| DOCKER[Build Docker Images]
    QUALITY -->|Fail| NOTIFY_FAIL[Notify Failure]
    
    DOCKER --> REGISTRY[Push to Registry]
    REGISTRY --> STAGING[Deploy to Staging]
    
    STAGING --> E2E[E2E Tests]
    STAGING --> PERFORMANCE[Performance Tests]
    STAGING --> INTEGRATION[Integration Tests]
    
    E2E --> STAGING_GATE{Staging Gates}
    PERFORMANCE --> STAGING_GATE
    INTEGRATION --> STAGING_GATE
    
    STAGING_GATE -->|Pass| APPROVAL{Manual Approval}
    STAGING_GATE -->|Fail| ROLLBACK_STAGING[Rollback Staging]
    
    APPROVAL -->|Approved| BLUE_GREEN[Blue-Green Deploy]
    APPROVAL -->|Rejected| STOP[Stop Pipeline]
    
    BLUE_GREEN --> HEALTH_CHECK[Health Checks]
    HEALTH_CHECK -->|Healthy| SWITCH_TRAFFIC[Switch Traffic]
    HEALTH_CHECK -->|Unhealthy| ROLLBACK_PROD[Rollback Production]
    
    SWITCH_TRAFFIC --> MONITOR[Monitor Metrics]
    MONITOR -->|Stable| SUCCESS[Deployment Success]
    MONITOR -->|Issues| AUTO_ROLLBACK[Auto Rollback]
    
    SUCCESS --> CLEANUP[Cleanup Old Versions]
    AUTO_ROLLBACK --> INVESTIGATE[Investigate Issues]
    ROLLBACK_PROD --> INVESTIGATE
    ROLLBACK_STAGING --> FIX_ISSUES[Fix Issues]
    
    NOTIFY_FAIL --> FIX_ISSUES
    FIX_ISSUES --> DEV
    INVESTIGATE --> DEV
```

## 10. Monitoring & Observability Architecture

```mermaid
graph TB
    subgraph "Application Layer"
        API[API Servers]
        WS[WebSocket Servers]
        FRONTEND[Frontend Apps]
    end
    
    subgraph "Metrics Collection"
        PROMETHEUS[Prometheus]
        GRAFANA[Grafana]
        ALERTMANAGER[Alert Manager]
    end
    
    subgraph "Logging Stack"
        FLUENTD[Fluentd]
        ELASTICSEARCH[Elasticsearch]
        KIBANA[Kibana]
    end
    
    subgraph "Tracing"
        JAEGER[Jaeger]
        OPENTELEMETRY[OpenTelemetry]
    end
    
    subgraph "Infrastructure Monitoring"
        CLOUDWATCH[CloudWatch]
        DATADOG[Datadog]
        NEWRELIC[New Relic]
    end
    
    subgraph "Alerting Channels"
        SLACK[Slack]
        EMAIL[Email]
        PAGERDUTY[PagerDuty]
        SMS[SMS]
    end
    
    subgraph "Health Checks"
        UPTIME[Uptime Robot]
        PINGDOM[Pingdom]
        HEALTH_API[Health Check API]
    end
    
    API --> PROMETHEUS
    WS --> PROMETHEUS
    FRONTEND --> PROMETHEUS
    
    API --> FLUENTD
    WS --> FLUENTD
    
    API --> JAEGER
    WS --> JAEGER
    
    PROMETHEUS --> GRAFANA
    PROMETHEUS --> ALERTMANAGER
    
    FLUENTD --> ELASTICSEARCH
    ELASTICSEARCH --> KIBANA
    
    OPENTELEMETRY --> JAEGER
    
    ALERTMANAGER --> SLACK
    ALERTMANAGER --> EMAIL
    ALERTMANAGER --> PAGERDUTY
    ALERTMANAGER --> SMS
    
    CLOUDWATCH --> GRAFANA
    DATADOG --> GRAFANA
    NEWRELIC --> GRAFANA
    
    UPTIME --> ALERTMANAGER
    PINGDOM --> ALERTMANAGER
    HEALTH_API --> PROMETHEUS
```

## 11. Frontend Component Architecture

```mermaid
graph TB
    subgraph "App Shell"
        APP[App.vue]
        ROUTER[Vue Router]
        STORE[Pinia Store]
    end
    
    subgraph "Layout Components"
        HEADER[Header Component]
        SIDEBAR[Sidebar Component]
        MAIN[Main Layout]
        FOOTER[Footer Component]
    end
    
    subgraph "Core Modules"
        AUTH_MODULE[Auth Module]
        CHAT_MODULE[Chat Module]
        USER_MODULE[User Module]
        FILE_MODULE[File Module]
    end
    
    subgraph "Shared Components"
        BUTTON[Button Component]
        INPUT[Input Component]
        MODAL[Modal Component]
        LOADER[Loader Component]
        AVATAR[Avatar Component]
        NOTIFICATION[Notification Component]
    end
    
    subgraph "Chat Components"
        CHAT_CONTAINER[Chat Container]
        MESSAGE_LIST[Message List]
        MESSAGE_ITEM[Message Item]
        MESSAGE_INPUT[Message Input]
        USER_LIST[User List]
        TYPING_INDICATOR[Typing Indicator]
    end
    
    subgraph "Services Layer"
        API_SERVICE[API Service]
        SOCKET_SERVICE[Socket Service]
        AUTH_SERVICE[Auth Service]
        STORAGE_SERVICE[Storage Service]
        ERROR_SERVICE[Error Service]
    end
    
    APP --> ROUTER
    APP --> STORE
    APP --> HEADER
    APP --> SIDEBAR
    APP --> MAIN
    APP --> FOOTER
    
    ROUTER --> AUTH_MODULE
    ROUTER --> CHAT_MODULE
    ROUTER --> USER_MODULE
    ROUTER --> FILE_MODULE
    
    CHAT_MODULE --> CHAT_CONTAINER
    CHAT_CONTAINER --> MESSAGE_LIST
    CHAT_CONTAINER --> MESSAGE_INPUT
    CHAT_CONTAINER --> USER_LIST
    
    MESSAGE_LIST --> MESSAGE_ITEM
    MESSAGE_LIST --> TYPING_INDICATOR
    
    MESSAGE_ITEM --> AVATAR
    MESSAGE_INPUT --> BUTTON
    MESSAGE_INPUT --> INPUT
    
    AUTH_MODULE --> BUTTON
    AUTH_MODULE --> INPUT
    AUTH_MODULE --> MODAL
    
    STORE --> API_SERVICE
    STORE --> SOCKET_SERVICE
    STORE --> AUTH_SERVICE
    STORE --> STORAGE_SERVICE
    
    API_SERVICE --> ERROR_SERVICE
    SOCKET_SERVICE --> ERROR_SERVICE
    
    ERROR_SERVICE --> NOTIFICATION
```

## 12. Security Architecture Diagram

```mermaid
graph TB
    subgraph "External Threats"
        DDOS[DDoS Attacks]
        XSS[XSS Attempts]
        INJECTION[SQL/NoSQL Injection]
        CSRF[CSRF Attacks]
        MALWARE[Malware Upload]
    end
    
    subgraph "Security Layers"
        subgraph "Edge Security"
            WAF[Web Application Firewall]
            RATE_LIMIT[Rate Limiting]
            GEO_BLOCK[Geo Blocking]
        end
        
        subgraph "Application Security"
            INPUT_VALIDATION[Input Validation]
            OUTPUT_ENCODING[Output Encoding]
            CSRF_PROTECTION[CSRF Protection]
            CONTENT_SECURITY[Content Security Policy]
        end
        
        subgraph "Authentication & Authorization"
            JWT_AUTH[JWT Authentication]
            RBAC[Role-Based Access Control]
            MFA[Multi-Factor Authentication]
            SESSION_MGMT[Session Management]
        end
        
        subgraph "Data Security"
            ENCRYPTION[Data Encryption]
            HASHING[Password Hashing]
            SANITIZATION[Data Sanitization]
            BACKUP_ENCRYPTION[Backup Encryption]
        end
        
        subgraph "Infrastructure Security"
            VPC[Virtual Private Cloud]
            SECURITY_GROUPS[Security Groups]
            SSL_TLS[SSL/TLS Encryption]
            SECRETS_MGMT[Secrets Management]
        end
        
        subgraph "Monitoring & Response"
            SIEM[Security Information & Event Management]
            INTRUSION_DETECTION[Intrusion Detection]
            AUDIT_LOGGING[Audit Logging]
            INCIDENT_RESPONSE[Incident Response]
        end
    end
    
    subgraph "Protected Assets"
        USER_DATA[User Data]
        MESSAGES[Chat Messages]
        FILES[Uploaded Files]
        CREDENTIALS[Authentication Data]
        BUSINESS_LOGIC[Application Logic]
    end
    
    DDOS --> WAF
    XSS --> INPUT_VALIDATION
    INJECTION --> INPUT_VALIDATION
    CSRF --> CSRF_PROTECTION
    MALWARE --> CONTENT_SECURITY
    
    WAF --> RATE_LIMIT
    RATE_LIMIT --> GEO_BLOCK
    
    INPUT_VALIDATION --> OUTPUT_ENCODING
    OUTPUT_ENCODING --> SANITIZATION
    
    JWT_AUTH --> RBAC
    RBAC --> MFA
    MFA --> SESSION_MGMT
    
    ENCRYPTION --> HASHING
    HASHING --> BACKUP_ENCRYPTION
    
    VPC --> SECURITY_GROUPS
    SECURITY_GROUPS --> SSL_TLS
    SSL_TLS --> SECRETS_MGMT
    
    SIEM --> INTRUSION_DETECTION
    INTRUSION_DETECTION --> AUDIT_LOGGING
    AUDIT_LOGGING --> INCIDENT_RESPONSE
    
    ENCRYPTION --> USER_DATA
    ENCRYPTION --> MESSAGES
    ENCRYPTION --> FILES
    HASHING --> CREDENTIALS
    RBAC --> BUSINESS_LOGIC
```

These diagrams provide a comprehensive visual representation of the Chat Rooms application architecture, covering all aspects from high-level system design to detailed component interactions, security measures, and deployment strategies.
