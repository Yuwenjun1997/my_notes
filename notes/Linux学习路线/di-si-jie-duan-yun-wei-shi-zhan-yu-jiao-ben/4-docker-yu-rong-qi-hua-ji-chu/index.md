---
url: >-
  /my_notes/notes/Linux学习路线/di-si-jie-duan-yun-wei-shi-zhan-yu-jiao-ben/4-docker-yu-rong-qi-hua-ji-chu/index.md
---
# Docker 与容器化基础

Docker 是现代应用部署的标准方式，也是 Java 后端开发者必须掌握的技能。

## 一、Docker 核心概念

### 1.1 三大核心对象

```text
镜像 (Image)    —— 应用的只读模板（类似 Java 的 Class）
容器 (Container) —— 镜像的运行实例（类似 Java 的 Object）
仓库 (Registry)  —— 存储和分发镜像的地方（类似 Maven 中央仓库）
```

### 1.2 Docker 架构

```text
┌──────────────────────────────────┐
│         Docker CLI (客户端)        │  → docker build, run, pull...
├──────────────────────────────────┤
│         Docker Daemon (dockerd)   │  → 管理镜像、容器、网络、卷
├──────────────────────────────────┤
│         containerd / runc         │  → 容器运行时
├──────────────────────────────────┤
│         Linux 内核特性             │
│   (namespace 隔离 + cgroup 限制)    │
└──────────────────────────────────┘
```

### 1.3 Docker vs 虚拟机

| 对比维度 | Docker 容器 | 虚拟机 |
|:---------|:------------|:-------|
| 启动速度 | 秒级 | 分钟级 |
| 资源占用 | MB 级 | GB 级 |
| 隔离级别 | 进程级（共享内核） | 硬件级（独立 OS） |
| 镜像大小 | 几十 MB ~ 几百 MB | 几 GB |
| 移植性 | 跨平台（需相同架构） | 较差 |

***

## 二、Docker 安装与配置

### 2.1 Ubuntu 安装 Docker

```bash
# 方式一：官方脚本（推荐）
curl -fsSL https://get.docker.com | sudo bash

# 方式二：apt 安装
sudo apt update
sudo apt install docker.io docker-compose-v2 -y

# 将当前用户加入 docker 组（免 sudo）
sudo usermod -aG docker $USER
# 重新登录后生效
```

### 2.2 镜像加速（国内用户）

```bash
sudo tee /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.m.daocloud.io"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
EOF

sudo systemctl daemon-reload
sudo systemctl restart docker
```

***

## 三、Docker 常用命令

### 3.1 镜像管理

```bash
# 搜索与拉取
docker search nginx                              # 搜索镜像
docker pull nginx:1.25                           # 拉取指定版本
docker pull openjdk:17-slim                      # Java 17 精简镜像

# 查看
docker images                                    # 列出所有镜像
docker images | grep nginx                       # 过滤
docker inspect nginx:1.25                        # 查看镜像详情
docker history nginx:1.25                        # 查看镜像构建历史

# 删除
docker rmi nginx:1.25                            # 删除镜像
docker rmi $(docker images -q -f "dangling=true") # 删除悬空镜像
docker image prune -a                            # 删除所有未使用的镜像

# 导出/导入（离线部署）
docker save -o nginx.tar nginx:1.25              # 导出
docker load -i nginx.tar                         # 导入
```

### 3.2 容器管理

```bash
# ===== 运行容器 =====
# 基本运行
docker run -d --name myapp -p 8080:8080 myapp:latest

# 完整示例
docker run -d \
    --name myapp \
    -p 8080:8080 \                         # 端口映射（主机:容器）
    -v /opt/config:/app/config \           # 挂载卷（主机:容器）
    -e JAVA_OPTS="-Xmx512m -Xms256m" \     # 环境变量
    --restart unless-stopped \             # 重启策略
    --memory 1g \                          # 内存限制
    --cpus 2 \                             # CPU 限制
    myapp:latest

# ===== 容器生命周期 =====
docker ps                                   # 查看运行中的容器
docker ps -a                                # 查看所有容器（含已停止）
docker stop myapp                           # 停止
docker start myapp                          # 启动
docker restart myapp                        # 重启
docker rm myapp                             # 删除（需先停止）
docker rm -f myapp                          # 强制删除（运行中也删）

# ===== 调试 =====
docker logs myapp                           # 查看日志
docker logs -f myapp                        # 实时跟踪 ⭐
docker logs --tail 100 myapp                # 最近 100 行
docker logs --since 10m myapp               # 最近 10 分钟

docker exec -it myapp bash                  # ⭐ 进入容器内部
docker exec myapp cat /etc/hosts            # 在容器中执行命令

docker inspect myapp                        # 查看容器完整信息
docker inspect -f '{{.NetworkSettings.IPAddress}}' myapp  # 查 IP

docker stats                                # 查看所有容器资源使用
docker stats myapp                          # 查看指定容器

# ===== 清理 =====
docker container prune                      # 删除所有已停止的容器
docker system prune -a                      # 清理所有未使用的资源（镜像+容器+卷+网络）
```

### 3.3 常用运行参数速查

| 参数 | 含义 | 示例 |
|:-----|:-----|:-----|
| `-d` | 后台运行 | `docker run -d ...` |
| `--name` | 容器名称 | `--name myapp` |
| `-p` | 端口映射 | `-p 8080:8080` |
| `-v` | 挂载目录 | `-v /host/path:/container/path` |
| `-e` | 环境变量 | `-e SPRING_PROFILES_ACTIVE=prod` |
| `--restart` | 重启策略 | `--restart unless-stopped` |
| `--memory` | 内存限制 | `--memory 512m` |
| `--network` | 指定网络 | `--network mynet` |
| `--rm` | 退出时自动删除 | `docker run --rm ...` |

***

## 四、Dockerfile 编写

### 4.1 基本指令

```dockerfile
# ===== Java 应用 Dockerfile =====
FROM eclipse-temurin:17-jre-alpine       # 基础镜像

LABEL maintainer="alice@example.com"      # 元数据
LABEL version="1.0.0"

WORKDIR /app                              # 工作目录

# 创建非 root 用户
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# 先复制依赖（利用 Docker 缓存层）
COPY target/app.jar app.jar

# 非 root 运行
USER appuser

# 暴露端口（文档用途，实际映射在运行时指定）
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:8080/actuator/health || exit 1

# 启动命令
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### 4.2 编写最佳实践

| 实践 | 说明 |
|:-----|:-----|
| **使用官方精简镜像** | `eclipse-temurin:17-jre-alpine` 而非 `ubuntu + 手动装 JDK` |
| **多阶段构建** | 在 builder 阶段编译，最终镜像只放 JAR |
| **非 root 运行** | 安全最低要求 ⭐ |
| **利用缓存层** | 先 COPY 依赖，再 COPY 代码 |
| **使用 .dockerignore** | 排除 target/、.git、node\_modules 等 |
| **健康检查** | HEALTHCHECK 指令，方便编排工具监控 |

### 4.3 多阶段构建（Spring Boot 示例）

```dockerfile
# ===== 第一阶段：构建 =====
FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /app
COPY pom.xml mvnw ./
COPY .mvn .mvn
RUN ./mvnw dependency:resolve
COPY src src
RUN ./mvnw package -DskipTests

# ===== 第二阶段：运行 =====
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/target/*.jar app.jar
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

***

## 五、docker-compose 多容器编排

### 5.1 基本示例

```yaml
# docker-compose.yml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: mysql
    environment:
      MYSQL_ROOT_PASSWORD: root123
      MYSQL_DATABASE: myapp
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: redis
    ports:
      - "6379:6379"
    restart: unless-stopped

  app:
    build: .
    container_name: myapp
    ports:
      - "8080:8080"
    environment:
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/myapp
      SPRING_REDIS_HOST: redis
    depends_on:
      - mysql
      - redis
    restart: unless-stopped

volumes:
  mysql_data:
```

### 5.2 常用命令

```bash
docker compose up -d                    # 启动所有服务（后台）
docker compose up -d --build            # 重新构建并启动
docker compose down                     # 停止并删除所有容器
docker compose down -v                  # 同时删除数据卷 ⚠️
docker compose ps                       # 查看服务状态
docker compose logs -f app              # 查看指定服务日志
docker compose restart app              # 重启指定服务
docker compose exec app bash            # 进入服务容器
docker compose pull                     # 拉取最新镜像
```

***

## 📝 实践项目

### 目标

将 Spring Boot 应用容器化并编排依赖服务。

### 步骤

1. **准备 Spring Boot 项目**（已有 JAR 包）

2. **编写 Dockerfile**（参照上面最佳实践）

3. **构建镜像**
   ```bash
   docker build -t myapp:1.0.0 .
   docker images | grep myapp
   ```

4. **本地运行验证**
   ```bash
   docker run -d --name myapp -p 8080:8080 myapp:1.0.0
   docker logs -f myapp
   curl localhost:8080/health
   docker stop myapp && docker rm myapp
   ```

5. **编写 docker-compose.yml**，添加 MySQL 和 Redis

6. **一键启动**
   ```bash
   docker compose up -d
   docker compose ps
   docker compose logs -f
   ```

7. **清理**
   ```bash
   docker compose down -v
   docker system prune -a
   ```
