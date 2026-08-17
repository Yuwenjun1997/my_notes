---
url: >-
  /my_notes/notes/JAVA学习路线/shen-du-xue-xi/04-yun-wei-yu-gong-cheng-hua/2-docker-k-8-s-bu-shu-shi-zhan/index.md
---
# Docker + Kubernetes 部署实战

## 一、Dockerfile 最佳实践

### 1.1 多阶段构建

多阶段构建是 Docker 镜像瘦身的核心手段。以下是一个从 Maven 编译到 JRE 运行的完整 Spring Boot 示例：

```dockerfile
# ===== 阶段一：Maven 编译 =====
FROM maven:3.9.6-eclipse-temurin-17 AS builder

WORKDIR /build

# 先拷贝 pom.xml 单独下载依赖，利用 Docker 缓存层
COPY pom.xml .
RUN mvn dependency:go-offline -B -DskipTests

# 拷贝源码并编译打包
COPY src ./src
RUN mvn package -B -DskipTests -Dmaven.test.skip=true

# ===== 阶段二：JRE 运行 =====
FROM eclipse-temurin:17-jre-alpine AS runner

# 安装必要的系统工具（非必须，按需裁剪）
RUN apk add --no-cache tzdata curl && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

# 创建非 root 用户运行应用（安全最佳实践）
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# 从 builder 阶段拷贝产物
COPY --from=builder /build/target/*.jar app.jar

# 创建日志和 dump 目录
RUN mkdir -p /app/logs /app/dumps && \
    chown -R appuser:appgroup /app

USER appuser

# JVM 优化参数（通过 ENV 可覆盖）
ENV JAVA_OPTS="-Xms512m -Xmx512m \
    -XX:+UseG1GC \
    -XX:MaxGCPauseMillis=200 \
    -XX:+PrintGCDetails \
    -XX:+PrintGCDateStamps \
    -Xloggc:/app/logs/gc.log \
    -XX:+UseGCLogFileRotation \
    -XX:NumberOfGCLogFiles=5 \
    -XX:GCLogFileSize=10M \
    -Dfile.encoding=UTF-8 \
    -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

### 1.2 .dockerignore 配置

```dockerignore
# 版本控制
.git/
.gitignore

# IDE
.idea/
*.iml
.vscode/
.settings/
.project
.classpath

# 构建产物
target/
*.class
*.jar
!target/*.jar  # 保留最终 jar（多阶段构建无需此条，但保留无害）

# 日志
logs/
*.log

# 系统文件
.DS_Store
Thumbs.db

# 文档
*.md
docs/

# 测试
src/test/
```

### 1.3 镜像瘦身技巧

**Alpine 基础镜像对比：**

| 基础镜像 | 大小 | 说明 |
|---------|------|------|
| eclipse-temurin:17-jre | ~180MB | 标准 JRE |
| eclipse-temurin:17-jre-alpine | ~50MB | Alpine 版 JRE |
| openjdk:17-jre-slim | ~120MB | Debian slim 版 |

**分层优化原则：**

```dockerfile
# 错误示范：每层都会产生新层
RUN apt-get update
RUN apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*

# 正确做法：合并为单层
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*
```

**清理缓存：**

```dockerfile
# Maven 构建后清理本地仓库（在 builder 阶段）
RUN mvn package -B -DskipTests && \
    rm -rf ~/.m2/repository

# apt/yum 安装后清理
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*
```

### 1.4 Spring Boot 容器化配置

**JMX 监控：**

```yaml
# application.yml 中添加 Actuator 端点暴露
management:
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus,jmx
  metrics:
    export:
      prometheus:
        enabled: true
```

```dockerfile
# Dockerfile 中启用 JMX
ENV JAVA_OPTS="-Dcom.sun.management.jmxremote \
    -Dcom.sun.management.jmxremote.port=1099 \
    -Dcom.sun.management.jmxremote.rmi.port=1099 \
    -Dcom.sun.management.jmxremote.authenticate=false \
    -Dcom.sun.management.jmxremote.ssl=false \
    -Djava.rmi.server.hostname=127.0.0.1"
```

**GC 日志配置（已内嵌在基础 Dockerfile 的 JAVA\_OPTS 中）：**

```bash
# 生产环境 GC 日志建议参数
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200
-XX:+PrintGCDetails
-XX:+PrintGCDateStamps
-Xloggc:/app/logs/gc.log
-XX:+UseGCLogFileRotation
-XX:NumberOfGCLogFiles=10
-XX:GCLogFileSize=10M
```

**Debug 模式（仅供开发环境）：**

```dockerfile
# 仅在开发/测试环境使用
ENV JAVA_OPTS="-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005"
```

***

## 二、Docker Compose 编排微服务

### 2.1 完整编排示例

以下编排包含 Nacos（注册中心）、MySQL、Redis 以及三个微服务（user-service、order-service、gateway）：

```yaml
version: "3.8"

# ===== 自定义网络 =====
networks:
  microservice-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

# ===== 持久化卷 =====
volumes:
  mysql-data:
  nacos-data:
  redis-data:
  user-service-logs:
  order-service-logs:
  gateway-logs:

services:
  # ===== MySQL =====
  mysql:
    image: mysql:8.0.35
    container_name: micro-mysql
    restart: always
    networks:
      - microservice-network
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
      - ./init-sql:/docker-entrypoint-initdb.d  # 初始化 SQL
    environment:
      MYSQL_ROOT_PASSWORD: root123
      MYSQL_DATABASE: micro_service
      TZ: Asia/Shanghai
    command:
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_unicode_ci
      --max_connections=200
      --innodb_buffer_pool_size=1G
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "2"
        reservations:
          memory: 1G
          cpus: "1"

  # ===== Redis =====
  redis:
    image: redis:7.2-alpine
    container_name: micro-redis
    restart: always
    networks:
      - microservice-network
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
      - ./redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
    command: redis-server /usr/local/etc/redis/redis.conf --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1"

  # ===== Nacos 注册中心 =====
  nacos:
    image: nacos/nacos-server:v2.3.0
    container_name: micro-nacos
    restart: always
    networks:
      - microservice-network
    ports:
      - "8848:8848"
      - "9848:9848"
    volumes:
      - nacos-data:/home/nacos/data
    environment:
      MODE: standalone
      SPRING_DATASOURCE_PLATFORM: mysql
      MYSQL_SERVICE_HOST: mysql
      MYSQL_SERVICE_PORT: 3306
      MYSQL_SERVICE_DB_NAME: nacos
      MYSQL_SERVICE_USER: root
      MYSQL_SERVICE_PASSWORD: root123
      JVM_XMS: 256m
      JVM_XMX: 512m
    depends_on:
      mysql:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8848/nacos/actuator/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: "1.5"

  # ===== 用户服务 =====
  user-service:
    image: user-service:latest
    build:
      context: ./user-service
      dockerfile: Dockerfile
    container_name: micro-user-service
    restart: always
    networks:
      - microservice-network
    ports:
      - "8081:8081"
    volumes:
      - user-service-logs:/app/logs
    environment:
      SPRING_PROFILES_ACTIVE: docker
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/micro_service?useUnicode=true&characterEncoding=utf8
      SPRING_DATASOURCE_USERNAME: root
      SPRING_DATASOURCE_PASSWORD: root123
      SPRING_REDIS_HOST: redis
      SPRING_CLOUD_NACOS_DISCOVERY_SERVER_ADDR: nacos:8848
      TZ: Asia/Shanghai
    depends_on:
      nacos:
        condition: service_healthy
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8081/actuator/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          memory: 768M
          cpus: "1"
        reservations:
          memory: 512M
          cpus: "0.5"
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"

  # ===== 订单服务 =====
  order-service:
    image: order-service:latest
    build:
      context: ./order-service
      dockerfile: Dockerfile
    container_name: micro-order-service
    restart: always
    networks:
      - microservice-network
    ports:
      - "8082:8082"
    volumes:
      - order-service-logs:/app/logs
    environment:
      SPRING_PROFILES_ACTIVE: docker
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/micro_service?useUnicode=true&characterEncoding=utf8
      SPRING_DATASOURCE_USERNAME: root
      SPRING_DATASOURCE_PASSWORD: root123
      SPRING_REDIS_HOST: redis
      SPRING_CLOUD_NACOS_DISCOVERY_SERVER_ADDR: nacos:8848
      TZ: Asia/Shanghai
    depends_on:
      nacos:
        condition: service_healthy
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      resources:
        limits:
          memory: 768M
          cpus: "1"
        reservations:
          memory: 512M
          cpus: "0.5"
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"

  # ===== API 网关 =====
  gateway:
    image: gateway:latest
    build:
      context: ./gateway
      dockerfile: Dockerfile
    container_name: micro-gateway
    restart: always
    networks:
      - microservice-network
    ports:
      - "8080:8080"
    volumes:
      - gateway-logs:/app/logs
    environment:
      SPRING_PROFILES_ACTIVE: docker
      SPRING_CLOUD_NACOS_DISCOVERY_SERVER_ADDR: nacos:8848
      TZ: Asia/Shanghai
    depends_on:
      nacos:
        condition: service_healthy
      user-service:
        condition: service_started
      order-service:
        condition: service_started
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1"
        reservations:
          memory: 256M
          cpus: "0.5"
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"
```

### 2.2 启动顺序控制详解

`depends_on` 有三种条件等级：

| 条件 | 说明 |
|------|------|
| `service_started` | 容器启动即满足（默认值） |
| `service_healthy` | 需要健康检查通过才满足 |
| `service_completed_successfully` | 容器成功退出才满足（One-shot 任务） |

**健康检查的配合使用：**

```yaml
# 在每个服务中配置 HEALTHCHECK 或使用 healthcheck 指令
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
  interval: 30s      # 每 30s 检查一次
  timeout: 10s       # 单次检查超时
  retries: 3         # 连续失败 3 次标记为 unhealthy
  start_period: 40s  # 容器启动后等待 40s 才开始检查
```

### 2.3 日志与资源限制

```yaml
# 日志配置：防止日志撑爆磁盘
logging:
  driver: "json-file"
  options:
    max-size: "100m"    # 每个日志文件最大 100MB
    max-file: "5"       # 保留最近 5 个文件

# 资源限制：防止单个服务耗尽主机资源
deploy:
  resources:
    limits:             # 硬限制（超过会被 OOM Kill 或限流）
      memory: 768M
      cpus: "1"
    reservations:       # 软限制（最低保障资源）
      memory: 512M
      cpus: "0.5"
```

**启动命令：**

```bash
# 构建并启动所有服务
docker-compose -f docker-compose.yml up -d --build

# 查看服务日志
docker-compose logs -f user-service

# 查看服务状态及健康检查结果
docker-compose ps

# 优雅关闭
docker-compose down

# 关闭时同时删除数据卷（谨慎使用）
docker-compose down -v
```

***

## 三、Kubernetes 核心资源进阶

### 3.1 Deployment 完整 YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: production
  labels:
    app: user-service
    version: v1
spec:
  replicas: 3
  # 滚动更新策略
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1              # 最大额外 Pod 数
      maxUnavailable: 0        # 允许不可用的最大 Pod 数（0 表示滚动更新不中断服务）
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
        version: v1
    spec:
      # 优雅关闭
      terminationGracePeriodSeconds: 30
      # 调度优先级
      priorityClassName: high-priority
      containers:
        - name: user-service
          image: registry.example.com/user-service:v1.2.3
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8081
              protocol: TCP
          # 环境变量（从 ConfigMap 和 Secret 注入）
          env:
            - name: SPRING_PROFILES_ACTIVE
              value: "production"
            - name: SPRING_DATASOURCE_URL
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: datasource.url
            - name: SPRING_DATASOURCE_USERNAME
              valueFrom:
                secretKeyRef:
                  name: app-secret
                  key: db-username
            - name: SPRING_DATASOURCE_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: app-secret
                  key: db-password
          # 资源限制
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          # 存活探针
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8081
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          # 就绪探针
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: 8081
            initialDelaySeconds: 20
            periodSeconds: 5
            timeoutSeconds: 3
            successThreshold: 1
            failureThreshold: 2
          # 启动探针（K8s 1.18+）
          startupProbe:
            httpGet:
              path: /actuator/health
              port: 8081
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 30  # 给够启动时间（30 * 5s = 150s）
          # 持久化挂载
          volumeMounts:
            - name: logs
              mountPath: /app/logs
            - name: config
              mountPath: /app/config
              readOnly: true
            - name: timezone
              mountPath: /etc/localtime
              readOnly: true
          lifecycle:
            preStop:
              exec:
                command:
                  - /bin/sh
                  - -c
                  - "sleep 10 && curl -X POST http://localhost:8081/actuator/shutdown"
      volumes:
        - name: logs
          persistentVolumeClaim:
            claimName: service-logs-pvc
        - name: config
          configMap:
            name: app-config
            items:
              - key: application-prod.yml
                path: application-prod.yml
        - name: timezone
          hostPath:
            path: /usr/share/zoneinfo/Asia/Shanghai
      # 优雅关闭
      terminationGracePeriodSeconds: 30
```

### 3.2 Service 类型详解

```yaml
# ===== ClusterIP（默认，集群内部访问）=====
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: production
spec:
  type: ClusterIP
  selector:
    app: user-service
  ports:
    - port: 8081           # Service 端口
      targetPort: 8081     # Pod 端口
      protocol: TCP

---
# ===== NodePort（外部可通过节点 IP 访问）=====
apiVersion: v1
kind: Service
metadata:
  name: gateway-service
  namespace: production
spec:
  type: NodePort
  selector:
    app: gateway
  ports:
    - port: 8080
      targetPort: 8080
      nodePort: 30080      # 节点端口范围 30000-32767

---
# ===== LoadBalancer（云环境/裸金属 LB）=====
apiVersion: v1
kind: Service
metadata:
  name: nginx-ingress
  namespace: ingress-nginx
spec:
  type: LoadBalancer
  selector:
    app.kubernetes.io/name: ingress-nginx
  ports:
    - name: http
      port: 80
      targetPort: 80
    - name: https
      port: 443
      targetPort: 443
  # 保留客户端真实 IP
  externalTrafficPolicy: Local

---
# ===== ExternalName（将外部服务映射为集群内服务名）=====
apiVersion: v1
kind: Service
metadata:
  name: external-database
  namespace: production
spec:
  type: ExternalName
  externalName: rds.example.com  # 映射到外部域名
  # 应用中可直接使用 external-database.production.svc.cluster.local 连接
```

**Service 选择场景：**

| 类型 | 使用场景 | 访问方式 |
|------|---------|---------|
| ClusterIP | 微服务间 RPC/HTTP 调用 | 集群内 `service-name.namespace.svc.cluster.local` |
| NodePort | 开发测试、小型集群对外暴露 | `http://<NodeIP>:30080` |
| LoadBalancer | 云原生环境暴露入口 | 云厂商分配的独立 IP |
| ExternalName | 对接外部数据库/缓存 | 集群内 DNS 别名 |

### 3.3 ConfigMap 与 Secret

```yaml
# ===== ConfigMap（存储非敏感配置）=====
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: production
data:
  # 键值对形式
  datasource.url: "jdbc:mysql://mysql-service:3306/micro_service?useUnicode=true&characterEncoding=utf8"
  redis.host: "redis-service"
  redis.port: "6379"
  log.level: "INFO"

  # 完整的配置文件
  application-prod.yml: |
    server:
      tomcat:
        max-threads: 200
        min-spare-threads: 50
    spring:
      jackson:
        date-format: yyyy-MM-dd HH:mm:ss
        time-zone: Asia/Shanghai
    management:
      endpoints:
        web:
          exposure:
            include: health,metrics,prometheus

---
# ===== Secret（存储敏感信息，Base64 编码）=====
apiVersion: v1
kind: Secret
metadata:
  name: app-secret
  namespace: production
type: Opaque
data:
  db-username: cm9vdA==          # echo -n "root" | base64
  db-password: cm9vdDEyMw==      # echo -n "root123" | base64
  redis-password: cmVkaXMxMjM=   # echo -n "redis123" | base64

# 使用 kubectl 创建 Secret 更安全（避免明文 base64 在 YAML 中）
# kubectl create secret generic app-secret \
#   --from-literal=db-username=root \
#   --from-literal=db-password=root123

---
# ===== 使用外部密钥管理（SealedSecrets / External Secrets）=====
# 使用 SealedSecret（加密后存入 Git）
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: app-secret
  namespace: production
spec:
  encryptedData:
    db-password: AgB4h...
```

### 3.4 PersistentVolumeClaim

```yaml
# ===== StorageClass（定义存储类）=====
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ssd-storage
provisioner: kubernetes.io/no-provisioner  # 使用本地存储
# provisioner: ebs.csi.aws.com             # AWS EBS
# provisioner: disk.csi.azure.com          # Azure Disk
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Retain

---
# ===== PV（静态预置持久卷）=====
apiVersion: v1
kind: PersistentVolume
metadata:
  name: service-logs-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteMany       # 支持多个 Pod 同时读写
  persistentVolumeReclaimPolicy: Retain
  storageClassName: ssd-storage
  nfs:
    path: /data/k8s-logs
    server: 192.168.1.100

---
# ===== PVC（持久卷声明）=====
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: service-logs-pvc
  namespace: production
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 5Gi
  storageClassName: ssd-storage

---
# ===== 使用 StatefulSet 管理有状态服务（MySQL 举例）=====
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
  namespace: production
spec:
  serviceName: mysql-headless
  replicas: 3
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
        - name: mysql
          image: mysql:8.0.35
          volumeMounts:
            - name: data
              mountPath: /var/lib/mysql
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 20Gi
        storageClassName: ssd-storage
```

### 3.5 HPA 自动扩缩容

```yaml
# ===== 基于 CPU/内存的 HPA =====
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: user-service-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: user-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    # CPU 利用率指标（目标平均值 60%）
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
    # 内存利用率指标（目标平均值 70%）
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 70

---
# ===== 基于自定义指标的 HPA（需要 Prometheus Adapter）=====
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
    # Pod 自定义指标（每秒请求数 > 1000 时扩容）
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: 1000
    # Object 指标（来自 Ingress 的 QPS）
    - type: Object
      object:
        metric:
          name: requests_per_second
        describedObject:
          apiVersion: networking.k8s.io/v1
          kind: Ingress
          name: main-ingress
        target:
          type: Value
          value: 2000
  # 扩缩容行为控制
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0       # 立即扩容
      policies:
        - type: Pods
          value: 4                        # 每次最多增加 4 个 Pod
          periodSeconds: 15
        - type: Percent
          value: 100                      # 或每次翻倍
          periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300     # 缩容等待 5 分钟稳定窗口
      policies:
        - type: Pods
          value: 2                        # 每次最多减少 2 个
          periodSeconds: 60
```

### 3.6 PodDisruptionBudget

```yaml
# 保证集群运维（节点升级、内核更新）时服务不中断
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: user-service-pdb
  namespace: production
spec:
  # 两种策略二选一
  minAvailable: 2          # 最少保留 2 个 Pod 运行
  # maxUnavailable: 1      # 或允许最多 1 个 Pod 不可用
  selector:
    matchLabels:
      app: user-service
```

***

## 四、Helm 包管理

### 4.1 Chart 目录结构

```
microservice-chart/
├── Chart.yaml                      # Chart 元信息
├── values.yaml                     # 默认配置值
├── values-prod.yaml                # 生产环境覆盖值
├── values-staging.yaml             # 预发布环境覆盖值
├── charts/                         # 子 Chart 依赖
│   ├── mysql/
│   ├── redis/
│   └── nacos/
├── templates/
│   ├── _helpers.tpl                # 公共模板函数
│   ├── NOTES.txt                   # 部署后的提示信息
│   ├── deployment.yaml             # Deployment 模板
│   ├── service.yaml                # Service 模板
│   ├── ingress.yaml                # Ingress 模板
│   ├── configmap.yaml              # ConfigMap 模板
│   ├── secret.yaml                 # Secret 模板
│   ├── hpa.yaml                    # HPA 模板
│   ├── pdb.yaml                    # PDB 模板
│   ├── pvc.yaml                    # PVC 模板
│   └── serviceaccount.yaml         # 服务账户
└── .helmignore                     # 类似 .gitignore
```

### 4.2 values.yaml 配置模板

```yaml
# ===== 全局配置 =====
global:
  namespace: default
  imageRegistry: registry.example.com
  imagePullSecrets:
    - name: registry-credentials

# ===== 应用通用配置 =====
app:
  name: user-service
  replicas: 3
  image:
    repository: "{{ .Values.global.imageRegistry }}/user-service"
    tag: "v1.2.3"
    pullPolicy: IfNotPresent
  containerPort: 8081

  # 环境变量
  env:
    SPRING_PROFILES_ACTIVE: "production"
    LOG_LEVEL: "INFO"
  envFrom:
    - configMapRef:
        name: app-config
    - secretRef:
        name: app-secret

  # 资源限制
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 1Gi

  # 探针
  probes:
    liveness:
      path: /actuator/health/liveness
      initialDelaySeconds: 30
      periodSeconds: 10
    readiness:
      path: /actuator/health/readiness
      initialDelaySeconds: 20
      periodSeconds: 5
    startup:
      path: /actuator/health
      initialDelaySeconds: 10
      failureThreshold: 30

  # 服务
  service:
    type: ClusterIP
    port: 8081

  # 持久化
  persistence:
    enabled: true
    size: 5Gi
    accessMode: ReadWriteMany
    storageClass: ssd-storage

  # 自动扩缩容
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 60
    targetMemoryUtilizationPercentage: 70

# ===== 中间件配置 =====
mysql:
  enabled: true
  image:
    repository: mysql
    tag: 8.0.35
  rootPassword: root123
  database: micro_service
  persistence:
    size: 20Gi

redis:
  enabled: true
  image:
    repository: redis
    tag: 7.2-alpine
  password: redis123
  persistence:
    size: 5Gi

nacos:
  enabled: true
  image:
    repository: nacos/nacos-server
    tag: v2.3.0
  mode: standalone
  persistence:
    size: 5Gi
```

### 4.3 部署整个微服务栈

```bash
# 添加依赖仓库
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# 安装 Chart（可使用 --values 覆盖默认配置）
helm install microservice ./microservice-chart \
    --namespace production \
    --create-namespace \
    --values values-prod.yaml

# 升级
helm upgrade microservice ./microservice-chart \
    --namespace production \
    --values values-prod.yaml

# 回滚
helm rollback microservice 1 \
    --namespace production

# 查看部署状态
helm status microservice --namespace production

# 查看历史版本
helm history microservice --namespace production

# 卸载
helm uninstall microservice --namespace production
```

**Helm 模板片段示例：**

```yaml
{{- /* _helpers.tpl 中的命名函数 */ -}}
{{- define "microservice.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "microservice.labels" -}}
app.kubernetes.io/name: {{ include "microservice.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
```

***

## 五、生产环境最佳实践

### 5.1 Namespace 隔离与资源配额

```yaml
# ===== 多环境命名空间隔离 =====
# kubectl create ns dev
# kubectl create ns staging
# kubectl create ns production
# kubectl create ns monitoring

# ===== 资源配额（限制命名空间总资源）=====
apiVersion: v1
kind: ResourceQuota
metadata:
  name: production-quota
  namespace: production
spec:
  hard:
    requests.cpu: "40"
    requests.memory: "80Gi"
    limits.cpu: "60"
    limits.memory: "120Gi"
    persistentvolumeclaims: "20"
    pods: "50"
    services: "10"
    configmaps: "30"
    secrets: "30"

---
# ===== 限制范围（限制单个 Pod/Container 的资源）=====
apiVersion: v1
kind: LimitRange
metadata:
  name: production-limits
  namespace: production
spec:
  limits:
    - max:
        cpu: "4"
        memory: "8Gi"
      min:
        cpu: "100m"
        memory: "128Mi"
      default:
        cpu: "500m"
        memory: "512Mi"
      defaultRequest:
        cpu: "200m"
        memory: "256Mi"
      type: Container
```

### 5.2 滚动更新策略

```yaml
# 滚动更新是生产环境默认策略
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1           # 允许额外多 1 个 Pod（加速更新）
    maxUnavailable: 0     # 保证更新期间 100% 可用

# 其他更新策略：
# type: Recreate          # 先全部删除再创建（有停机时间，适合批处理任务）

# kubectl 滚动更新操作
kubectl set image deployment/user-service user-service=registry.example.com/user-service:v1.3.0 -n production
kubectl rollout status deployment/user-service -n production
kubectl rollout undo deployment/user-service -n production        # 回滚到上一版本
kubectl rollout history deployment/user-service -n production     # 查看历史版本
```

### 5.3 优雅关闭

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      # Pod 级别：K8s 发送 SIGTERM 后等待的最长时间
      terminationGracePeriodSeconds: 60
      containers:
        - name: user-service
          lifecycle:
            preStop:
              exec:
                command:
                  - /bin/sh
                  - -c
                  - |
                    # 1. 通知注册中心下线（Spring Cloud 默认已实现）
                    # 2. 等待 10s 让上游不再发送新请求
                    sleep 10
                    # 3. 调用 Actuator 优雅关闭
                    curl -X POST http://localhost:8081/actuator/shutdown
```

**Spring Boot 端配置：**

```yaml
# application.yml
server:
  shutdown: graceful           # 优雅关闭（等待处理中的请求完成）
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s  # 优雅关闭超时时间
```

### 5.4 日志收集架构（Filebeat + ES + Kibana）

```yaml
# ===== Filebeat DaemonSet（采集节点日志）=====
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: filebeat
  namespace: logging
spec:
  selector:
    matchLabels:
      app: filebeat
  template:
    metadata:
      labels:
        app: filebeat
    spec:
      serviceAccountName: filebeat
      terminationGracePeriodSeconds: 30
      containers:
        - name: filebeat
          image: docker.elastic.co/beats/filebeat:8.11.0
          args:
            - "-c"
            - "/etc/filebeat.yml"
            - "-e"
          env:
            - name: ELASTICSEARCH_HOST
              value: "elasticsearch:9200"
          volumeMounts:
            - name: config
              mountPath: /etc/filebeat.yml
              readOnly: true
              subPath: filebeat.yml
            - name: pod-logs
              mountPath: /var/log/pods
              readOnly: true
            - name: container-logs
              mountPath: /var/lib/docker/containers
              readOnly: true
            - name: data
              mountPath: /usr/share/filebeat/data
      volumes:
        - name: config
          configMap:
            name: filebeat-config
        - name: pod-logs
          hostPath:
            path: /var/log/pods
        - name: container-logs
          hostPath:
            path: /var/lib/docker/containers
        - name: data
          hostPath:
            path: /var/lib/filebeat-data

---
# ===== Filebeat 配置 =====
apiVersion: v1
kind: ConfigMap
metadata:
  name: filebeat-config
  namespace: logging
data:
  filebeat.yml: |
    filebeat.inputs:
      - type: container
        paths:
          - /var/log/containers/*.log
        multiline:
          pattern: '^\d{4}-\d{2}-\d{2}'
          negate: true
          match: after
        processors:
          - add_kubernetes_metadata:
              host: ${NODE_NAME}
              matchers:
                - logs_path:
                    logs_path: "/var/log/containers/"

    output.elasticsearch:
      hosts: ['${ELASTICSEARCH_HOST:elasticsearch:9200}']
      index: "filebeat-%{[agent.version]}-%{+yyyy.MM.dd}"
      username: '${ELASTICSEARCH_USERNAME}'
      password: '${ELASTICSEARCH_PASSWORD}'
```

### 5.5 完整生产 Checklist

```bash
# ===== 安全检查 =====
# 1. 不使用特权容器
securityContext:
  capabilities:
    drop: ["ALL"]
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  runAsUser: 1000

# ===== Pod 反亲和性 =====
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: app
                operator: In
                values:
                  - user-service
          topologyKey: kubernetes.io/hostname

# ===== 节点选择器 =====
nodeSelector:
  node-type: application

# ===== Toleration 容忍 =====
tolerations:
  - key: "app-type"
    operator: "Equal"
    value: "java"
    effect: "NoSchedule"

# ===== Pod 拓扑分布约束 =====
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app: user-service
```

```bash
# ===== 日常运维命令 =====
# 查看所有资源
kubectl get all -n production

# 查看 Pod 详细信息
kubectl describe pod/user-service-xxx -n production

# 查看日志
kubectl logs -f deployment/user-service -n production

# 进入 Pod 调试
kubectl exec -it pod/user-service-xxx -n production -- /bin/sh

# 端口转发（本地调试）
kubectl port-forward svc/user-service 8081:8081 -n production

# 查看事件
kubectl get events -n production --sort-by='.lastTimestamp'

# 资源监控
kubectl top pod -n production
kubectl top node
```
