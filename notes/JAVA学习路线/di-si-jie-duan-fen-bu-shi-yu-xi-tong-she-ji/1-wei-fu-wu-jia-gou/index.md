---
url: >-
  /my_notes/notes/JAVA学习路线/di-si-jie-duan-fen-bu-shi-yu-xi-tong-she-ji/1-wei-fu-wu-jia-gou/index.md
---
# 微服务架构

## 一、Spring Cloud

### 1.1 微服务核心概念

微服务架构将单体应用拆分为多个独立的服务，每个服务负责单一业务功能。

**单体架构 vs 微服务架构**

```text
单体架构：
+-----------------------------------------+
|            一个应用                      |
| +----------+ +----------+ +----------+ |
| | 用户模块 | | 订单模块 | | 支付模块 | |
| +----------+ +----------+ +----------+ |
| +----------+ +----------+              |
| | 商品模块 | | 通知模块 |              |
| +----------+ +----------+              |
+-----------------------------------------+
（共享数据库，一起部署）

微服务架构：
+----------++----------++----------++----------+
| 用户服务  || 订单服务  || 支付服务  || 商品服务  |
+----------++----------++----------++----------+
| 用户 DB   || 订单 DB   || 支付 DB   || 商品 DB   |
+----------++----------++----------++----------+
（各自独立数据库，独立部署，通过 API 通信）
```

**微服务核心特性**

| 特性 | 说明 | 实现方式 |
|------|------|---------|
| 服务注册发现 | 服务自动注册地址，消费者动态发现 | Nacos、Eureka |
| API 网关 | 统一入口，路由、限流、认证 | Spring Cloud Gateway |
| 服务间调用 | 服务间远程调用 | OpenFeign、RestTemplate |
| 配置中心 | 集中管理配置，动态刷新 | Nacos Config |
| 负载均衡 | 分散请求到多个实例 | Ribbon、LoadBalancer |
| 熔断降级 | 防止故障扩散 | Sentinel、Resilience4j |

### 1.2 服务发现（Nacos）

Nacos 是阿里巴巴开源的注册中心和配置中心。

**服务注册与发现原理**

```text
ServiceA 启动 → 注册到 Nacos（IP:Port, 健康检查接口）
ServiceB 启动 → 注册到 Nacos
    ↓
ServiceC 调用 ServiceA
    ↓
从 Nacos 获取 ServiceA 的实例列表
    ↓
负载均衡策略选择一个实例
    ↓
发起远程调用
    ↓
ServiceA 下线 → Nacos 剔除实例（心跳超时）
```

**Nacos 服务端部署**

```bash
# 下载 Nacos
# https://github.com/alibaba/nacos/releases
# 解压启动（单机模式）
cd nacos/bin
startup.cmd -m standalone  # Windows
sh startup.sh -m standalone # Linux/Mac

# 访问控制台：http://localhost:8848/nacos
# 默认账号密码：nacos/nacos
```

**Spring Cloud 集成 Nacos**

```xml
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
</dependency>
```

```yaml
# application.yml
spring:
  application:
    name: user-service          # 服务名（注册到 Nacos 的名称）
  cloud:
    nacos:
      discovery:
        server-addr: 127.0.0.1:8848
        namespace: public       # 命名空间（环境隔离）
        group: DEFAULT_GROUP    # 分组
        metadata:
          version: v1           # 元数据（可用于灰度发布）

server:
  port: 8081                    # 服务端口

# 启用服务发现客户端
@SpringBootApplication
@EnableDiscoveryClient         // 启用服务发现
public class UserServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(UserServiceApplication.class, args);
    }
}
```

**健康检查**

Nacos 通过心跳机制检测服务健康状态：

```text
服务实例 → 每 5 秒发送心跳包到 Nacos
Nacos → 超过 15 秒未收到心跳 → 标记为不健康
Nacos → 超过 30 秒未收到心跳 → 移除实例
```

### 1.3 API 网关（Spring Cloud Gateway）

Spring Cloud Gateway 是基于 WebFlux 的响应式 API 网关。

**核心功能**

```text
客户端 → Gateway（统一入口）
              |
    ┌─────────┼─────────┐
    ↓         ↓         ↓
 用户服务   订单服务   商品服务
              |
         统一处理：
         • 路由转发
         • 认证鉴权
         • 限流熔断
         • 日志记录
         • 跨域处理
```

**基础配置**

```yaml
spring:
  cloud:
    gateway:
      routes:
        # 用户服务路由
        - id: user-service
          uri: lb://user-service          # lb:// 表示负载均衡
          predicates:
            - Path=/api/users/**          # 匹配路径
          filters:
            - StripPrefix=1               # 去掉路径前缀
            - name: RequestRateLimiter    # 限流过滤器
              args:
                key-resolver: "#{@userKeyResolver}"
                redis-rate-limiter.replenishRate: 100
                redis-rate-limiter.burstCapacity: 200

        # 订单服务路由
        - id: order-service
          uri: lb://order-service
          predicates:
            - Path=/api/orders/**
          filters:
            - StripPrefix=1

        # 商品服务路由
        - id: product-service
          uri: lb://product-service
          predicates:
            - Path=/api/products/**
          filters:
            - StripPrefix=1

      # 全局过滤器配置
      default-filters:
        - AddResponseHeader=X-Response-Id, ${random.uuid}

      # 全局跨域配置
      globalcors:
        cors-configurations:
          '[/**]':
            allowedOrigins: "*"
            allowedMethods: "*"
            allowedHeaders: "*"
            maxAge: 3600
```

**自定义全局过滤器**

```java
@Component
@Order(-1)  // 优先级最高
public class AuthGlobalFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        // 白名单路径不校验
        if (path.contains("/auth/login") || path.contains("/auth/register")) {
            return chain.filter(exchange);
        }

        // 从请求头获取 Token
        String token = request.getHeaders().getFirst("Authorization");
        if (token == null || !token.startsWith("Bearer ")) {
            return unauthorized(exchange, "未登录");
        }

        // 验证 Token
        try {
            String userId = jwtTokenProvider.getUserIdFromToken(token.substring(7));

            // 将用户 ID 传递到下游服务（通过请求头）
            ServerHttpRequest mutatedRequest = request.mutate()
                    .header("X-User-Id", userId)
                    .header("X-User-Info", URLEncoder.encode(userInfo, "UTF-8"))
                    .build();

            return chain.filter(exchange.mutate().request(mutatedRequest).build());

        } catch (Exception e) {
            return unauthorized(exchange, "Token 无效");
        }
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        return response.writeWith(Mono.just(response.bufferFactory()
                .wrap(("{\"code\":401,\"message\":\"" + message + "\"}")
                        .getBytes(StandardCharsets.UTF_8))));
    }
}
```

**自定义过滤器工厂**

```java
@Component
public class RequestLoggingGatewayFilterFactory
        extends AbstractGatewayFilterFactory<RequestLoggingGatewayFilterFactory.Config> {

    public RequestLoggingGatewayFilterFactory() {
        super(Config.class);
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            long startTime = System.currentTimeMillis();
            String path = exchange.getRequest().getURI().getPath();

            return chain.filter(exchange).then(Mono.fromRunnable(() -> {
                long elapsed = System.currentTimeMillis() - startTime;
                int status = exchange.getResponse().getStatusCode().value();
                log.info("[{}] {} {} - {}ms", exchange.getRequest().getMethod(),
                        path, status, elapsed);
            }));
        };
    }

    @Data
    public static class Config {
        private boolean logHeaders;
    }
}
```

### 1.4 服务间调用（OpenFeign）

OpenFeign 是声明式的 HTTP 客户端，让服务间调用像调用本地方法一样简单。

**基础使用**

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-openfeign</artifactId>
</dependency>
```

```java
// 启动类启用 Feign
@SpringBootApplication
@EnableFeignClients(basePackages = "com.example.client")
public class OrderServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderServiceApplication.class, args);
    }
}

// 声明 Feign 客户端（调用 user-service）
@FeignClient(
    name = "user-service",              // 目标服务名（从 Nacos 获取）
    path = "/api/users",                 // 基础路径
    fallbackFactory = UserClientFallbackFactory.class  // 熔断降级
)
public interface UserClient {

    @GetMapping("/{id}")
    Result<UserDTO> getUserById(@PathVariable("id") Long id);

    @GetMapping("/batch")
    Result<List<UserDTO>> getUsersByIds(@RequestParam("ids") List<Long> ids);

    @PostMapping("/validate")
    Result<Boolean> validateUser(@RequestBody UserValidateRequest request);
}

// Feign 配置（全局）
@Configuration
public class FeignConfig {

    @Bean
    public RequestInterceptor requestInterceptor() {
        return requestTemplate -> {
            // 从请求上下文获取 Token 并传递到下游服务
            RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = ((ServletRequestAttributes) attributes).getRequest();
                String token = request.getHeader("Authorization");
                if (token != null) {
                    requestTemplate.header("Authorization", token);
                }
            }
        };
    }

    @Bean
    public Logger.Level feignLoggerLevel() {
        return Logger.Level.FULL;  // 打印完整的请求响应日志
    }
}
```

**Feign 配置属性**

```yaml
feign:
  client:
    config:
      default:                             # 全局配置
        connect-timeout: 5000              # 连接超时（毫秒）
        read-timeout: 10000                # 读取超时（毫秒）
        logger-level: BASIC                # 日志级别：NONE/BASIC/HEADERS/FULL
      user-service:                        # 特定服务配置
        connect-timeout: 3000
        read-timeout: 5000
  compression:
    request:
      enabled: true
      mime-types: application/json
      min-request-size: 2048
    response:
      enabled: true

# 开启 Feign 对 Sentinel 的支持（熔断）
feign:
  sentinel:
    enabled: true
```

**熔断降级实现**

```java
@Component
@Slf4j
public class UserClientFallbackFactory implements FallbackFactory<UserClient> {

    @Override
    public UserClient create(Throwable cause) {
        log.error("调用 user-service 失败", cause);
        return new UserClient() {
            @Override
            public Result<UserDTO> getUserById(Long id) {
                // 降级返回默认值
                return Result.error("用户服务暂时不可用");
            }

            @Override
            public Result<List<UserDTO>> getUsersByIds(List<Long> ids) {
                return Result.error("用户服务暂时不可用");
            }

            @Override
            public Result<Boolean> validateUser(UserValidateRequest request) {
                return Result.success(false);
            }
        };
    }
}
```

***

## 二、Docker

### 2.1 Docker 核心概念

```text
Docker 架构：
+-------------------+
|   Docker Client   |  docker build/pull/run 命令
+-------------------+
         ↓
+-------------------+
|   Docker Daemon   |  守护进程（管理容器和镜像）
+-------------------+
    ↓           ↓
+---------+ +---------+
| 镜像    | | 容器    |
| Images  | | Containers|
+---------+ +---------+
    ↓           ↓
+-------------------+
|   Registry        |  Docker Hub / 私有仓库
+-------------------+
```

| 概念 | 说明 | 类比 |
|------|------|------|
| 镜像（Image） | 只读模板，包含运行环境和代码 | 类（Class） |
| 容器（Container） | 镜像的运行实例 | 对象（Instance） |
| Dockerfile | 构建镜像的脚本 | 设计图纸 |
| Registry | 镜像仓库 | Maven 仓库 |
| Volume | 持久化数据卷 | U 盘 |

### 2.2 Dockerfile 编写

```dockerfile
# 基础镜像
FROM openjdk:17-jdk-slim

# 维护者信息
LABEL maintainer="developer@example.com"

# 设置工作目录
WORKDIR /app

# 添加应用 Jar 包
COPY target/user-service-1.0.0.jar app.jar

# 暴露端口
EXPOSE 8080

# 配置 JVM 参数
ENV JAVA_OPTS="-Xms512m -Xmx1024m -XX:+UseG1GC"

# 启动命令
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1
```

**多阶段构建（优化镜像大小）**

```dockerfile
# 第一阶段：编译
FROM maven:3.9-openjdk-17 AS builder
WORKDIR /build
COPY pom.xml .
RUN mvn dependency:go-offline  # 下载依赖并缓存
COPY src ./src
RUN mvn clean package -DskipTests

# 第二阶段：运行（只包含最小运行环境）
FROM openjdk:17-jdk-slim
WORKDIR /app
COPY --from=builder /build/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### 2.3 Docker Compose（容器编排）

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Nacos 注册中心
  nacos:
    image: nacos/nacos-server:v2.2.3
    container_name: nacos
    ports:
      - "8848:8848"
      - "9848:9848"
    environment:
      MODE: standalone
      JVM_XMS: 256m
      JVM_XMX: 512m
    volumes:
      - nacos_data:/home/nacos/data
    networks:
      - micro-network

  # MySQL
  mysql:
    image: mysql:8.0
    container_name: mysql
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: root123
      MYSQL_DATABASE: user_db
    volumes:
      - mysql_data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - micro-network

  # Redis
  redis:
    image: redis:7.0
    container_name: redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - micro-network

  # 用户服务
  user-service:
    build: ./user-service
    container_name: user-service
    ports:
      - "8081:8081"
    environment:
      SPRING_PROFILES_ACTIVE: docker
      NACOS_ADDR: nacos:8848
    depends_on:
      - nacos
      - mysql
      - redis
    networks:
      - micro-network

  # 订单服务
  order-service:
    build: ./order-service
    container_name: order-service
    ports:
      - "8082:8082"
    environment:
      SPRING_PROFILES_ACTIVE: docker
      NACOS_ADDR: nacos:8848
    depends_on:
      - nacos
      - mysql
    networks:
      - micro-network

  # 网关服务
  gateway:
    build: ./gateway
    container_name: gateway
    ports:
      - "8080:8080"
    environment:
      SPRING_PROFILES_ACTIVE: docker
      NACOS_ADDR: nacos:8848
    depends_on:
      - nacos
      - user-service
      - order-service
    networks:
      - micro-network

volumes:
  nacos_data:
  mysql_data:
  redis_data:

networks:
  micro-network:
    driver: bridge
```

```yaml
# 对应 Docker 环境的 application-docker.yml
spring:
  datasource:
    url: jdbc:mysql://mysql:3306/user_db?useSSL=false
  redis:
    host: redis
  cloud:
    nacos:
      discovery:
        server-addr: nacos:8848
  # 在容器内通过服务名访问其他容器
```

**常用命令**

```bash
# 启动所有服务（-d 后台运行）
docker-compose up -d

# 查看服务日志
docker-compose logs -f user-service

# 重启某个服务
docker-compose restart user-service

# 扩缩容
docker-compose up -d --scale user-service=3

# 停止并删除所有容器
docker-compose down

# 重新构建并启动
docker-compose up -d --build
```

***

## 三、Kubernetes（K8s）

### 3.1 基础概念

```text
+-------------------+
|   Master Node     |
| +-------+-------+ |
| | API   | Sched | |
| | Server| -uler | |
| +-------+-------+ |
| | Controller     | |
| | Manager        | |
| +-------+-------+ |
| | etcd (集群状态)| |
| +-------+-------+ |
+-------------------+
           |
+----------+-----------+
|         |             |
+----+ +----+      +----+
|Node| |Node| ...  |Node|
| +--+ | +--+      | +--+
| |Pod| | |Pod|    | |Pod|
| +--+ | +--+      | +--+
+------+ +------+  +------+
```

**核心资源对象**

| 资源 | 简称 | 说明 | 类比 |
|------|------|------|------|
| Pod | pod | 最小部署单元（一个或多个容器） | 虚拟机 |
| Service | svc | 稳定的网络入口和负载均衡 | 负载均衡器 |
| Deployment | deploy | 管理 Pod 的声明式更新 | 自动伸缩组 |
| ConfigMap | cm | 配置管理（非敏感） | 配置文件 |
| Secret | - | 敏感信息管理（密码、密钥） | 保险箱 |
| Namespace | ns | 资源隔离 | 租户/环境 |
| Ingress | ing | HTTP/HTTPS 路由规则 | 网关路由 |

### 3.2 核心资源 YAML

**Deployment（无状态应用）**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: production
  labels:
    app: user-service
spec:
  replicas: 3                    # 副本数
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
        - name: user-service
          image: registry.example.com/user-service:v1.0.0
          imagePullPolicy: Always
          ports:
            - containerPort: 8080
              protocol: TCP
          env:
            - name: SPRING_PROFILES_ACTIVE
              value: "k8s"
            - name: NACOS_ADDR
              value: "nacos-headless:8848"
            - name: JAVA_OPTS
              value: "-Xms512m -Xmx1024m"
          resources:
            requests:               # 请求资源（调度依据）
              cpu: "500m"           # 500 毫核 = 0.5 核
              memory: "512Mi"
            limits:                 # 限制资源
              cpu: "1"
              memory: "1Gi"
          livenessProbe:            # 存活探针（是否存活）
            httpGet:
              path: /actuator/health
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
          readinessProbe:           # 就绪探针（是否接受流量）
            httpGet:
              path: /actuator/health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: production
spec:
  type: ClusterIP                # 集群内部访问
  ports:
    - port: 8080                 # 服务端口
      targetPort: 8080           # 容器端口
  selector:
    app: user-service
```

**ConfigMap（配置管理）**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: production
data:
  application.yml: |
    spring:
      datasource:
        url: jdbc:mysql://mysql-service:3306/user_db
      redis:
        host: redis-service
    logging:
      level:
        com.example: DEBUG
---
# Pod 中引用 ConfigMap
spec:
  containers:
    - name: user-service
      volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
  volumes:
    - name: config
      configMap:
        name: app-config
```

**Ingress（外部访问）**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-gateway
  namespace: production
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
spec:
  ingressClassName: nginx
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /api/users
            pathType: Prefix
            backend:
              service:
                name: user-service
                port:
                  number: 8080
          - path: /api/orders
            pathType: Prefix
            backend:
              service:
                name: order-service
                port:
                  number: 8080
```

### 3.3 常用命令

```bash
# 查看资源
kubectl get pods -n production
kubectl get deployments -n production
kubectl get services -n production
kubectl get all -n production

# 查看详情
kubectl describe pod user-service-xxxxx -n production

# 查看日志
kubectl logs -f user-service-xxxxx -n production

# 进入容器
kubectl exec -it user-service-xxxxx -- /bin/sh

# 应用配置
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# 删除资源
kubectl delete deployment user-service -n production

# 扩缩容
kubectl scale deployment user-service --replicas=5 -n production

# 滚动更新（修改镜像后）
kubectl set image deployment/user-service user-service=registry/...:v2 -n production
kubectl rollout status deployment/user-service -n production

# 回滚
kubectl rollout undo deployment/user-service -n production

# 暴露端口（开发调试）
kubectl port-forward svc/user-service 8080:8080 -n production
```

### 3.4 部署策略

```yaml
# 滚动更新（默认）
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1         # 最多比期望多 1 个 Pod
      maxUnavailable: 0   # 更新期间最多 0 个不可用

# 蓝绿部署（通过 Service 切换标签）
# 先部署新版本（green），再切换 Service 标签
# Blue（旧版本）→ Green（新版本）

# 灰度发布（金丝雀发布）
# 先部署少量新版本 Pod，逐步增加比例
spec:
  replicas: 1   # 先只部署 1 个新版本
---
# 等验证通过后，再替换全部
kubectl set image deployment/user-service user-service=image:v2
```

***

## 四、实践项目

### 项目 1：Spring Cloud 微服务架构

**目标**：使用 Spring Cloud 实现完整的微服务系统。

**服务清单**：

1. **注册中心**：Nacos
2. **API 网关**：Spring Cloud Gateway
3. **用户服务**：用户注册登录、信息管理
4. **订单服务**：订单创建、状态管理
5. **商品服务**：商品信息、库存管理

**功能要求**：

1. 服务通过 Nacos 注册发现
2. 网关统一路由和认证
3. 服务间通过 OpenFeign 调用
4. 集成 Sentinel 实现熔断降级

### 项目 2：Docker + K8s 部署

**目标**：将微服务容器化并部署到 Kubernetes。

**步骤**：

1. 为每个服务编写 Dockerfile（多阶段构建）
2. 编写 docker-compose.yml 本地编排测试
3. 编写 K8s Deployment、Service、ConfigMap 清单
4. 配置健康检查探针
5. 配置 Ingress 对外暴露
6. 使用滚动更新策略发布新版本
