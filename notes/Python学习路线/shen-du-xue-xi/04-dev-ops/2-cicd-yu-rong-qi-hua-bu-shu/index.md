---
url: >-
  /my_notes/notes/Python学习路线/shen-du-xue-xi/04-dev-ops/2-cicd-yu-rong-qi-hua-bu-shu/index.md
---
# CI/CD 与容器化部署

> 面向 Python 项目的持续集成与容器化部署实战，掌握 GitHub Actions 流水线、Docker 多阶段构建、docker-compose 生产编排，以及 Kubernetes 部署入门。

***

## 一、GitHub Actions 流水线

### 1.1 核心概念

GitHub Actions 是基于 YAML 的 CI/CD 平台，通过 **workflow / job / step** 三级结构定义流水线。

```yaml
# .github/workflows/ci.yml
name: CI                     # 工作流名称

on:                          # 触发条件
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:         # 手动触发

jobs:
  test:                      # 一个 job 在独立 runner 上运行
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4          # 检出代码
      - uses: actions/setup-python@v5      # 安装 Python
        with:
          python-version: '3.12'
      - name: 安装依赖
        run: pip install -r requirements-dev.txt
      - name: 运行测试
        run: pytest --cov=app --cov-report=xml
```

**常用触发器与语法**

| 触发器 / 语法 | 说明 |
|:-------------|:-----|
| `on.push.branches` | 推送代码时触发 |
| `on.pull_request` | 创建 / 更新 PR 时触发 |
| `on.schedule` | 定时触发（cron 表达式） |
| `on.workflow_dispatch` | 手动触发按钮 |
| `if: contains(github.event.head_commit.message, '[skip ci]')` | 条件跳过 |
| `continue-on-error: true` | 失败不阻断后续步骤 |

### 1.2 Python 项目 CI 最佳实践

一个完整的 Python CI 通常包含 **代码质量 → 类型检查 → 测试 → 覆盖率** 四个阶段：

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - name: 安装依赖
        run: |
          python -m pip install --upgrade pip
          pip install ruff mypy pytest pytest-cov
      - name: Ruff 代码检查
        run: ruff check app tests
      - name: Mypy 类型检查
        run: mypy app
      - name: Pytest 测试
        run: pytest --cov=app --cov-fail-under=80
```

**依赖缓存**（大幅缩短安装时间）：

```yaml
      - name: 缓存 pip
        uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles('requirements*.txt') }}
          restore-keys: |
            ${{ runner.os }}-pip-
```

### 1.3 构建产物与发布

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    needs: lint                 # 依赖 lint job 成功
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - name: 构建 Wheel 包
        run: |
          pip install build
          python -m build
      - uses: actions/upload-artifact@v4   # 上传产物
        with:
          name: dist
          path: dist/

  publish:                       # 发布到 PyPI（需 secrets）
    runs-on: ubuntu-latest
    needs: build
    if: startsWith(github.ref, 'refs/tags/')
    environment: pypi
    permissions:
      id-token: write            # 用 Trusted Publishing 免密发布
    steps:
      - uses: actions/download-artifact@v4
        with: { name: dist, path: dist }
      - uses: pypa/gh-action-pypi-publish@release/v1
```

***

## 二、Docker 多阶段构建与依赖缓存

### 2.1 基础镜像选型

| 镜像 | 体积 | 特点 | 适用场景 |
|:-----|:----|:-----|:--------|
| `python:3.12-slim` | ~120MB | Debian 精简版，兼容性好 | 推荐默认选择 |
| `python:3.12-alpine` | ~50MB | 极致精简，musl libc | 对体积敏感的小服务 |
| `python:3.12` | ~1GB | 完整工具链 | 本地开发、CI 构建 |

### 2.2 多阶段构建与缓存

分层缓存依赖是 Python 镜像提速的关键：

```dockerfile
# ===== 阶段一：构建依赖 =====
FROM python:3.12-slim AS builder

WORKDIR /app

# ❌ 错误做法：COPY . . 再 pip install，依赖层会因代码变动全部失效
# ✅ 正确做法：先只复制依赖清单，利用 Docker 层缓存
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ===== 阶段二：运行时 =====
FROM python:3.12-slim AS runtime

# 运行时依赖（时区、CA 证书）
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV TZ=Asia/Shanghai \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 仅拷贝已安装的依赖，体积更小
COPY --from=builder /install /usr/local

# 非 root 运行（安全加固）
RUN useradd -m appuser
USER appuser

COPY --chown=appuser:appuser app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**最佳实践清单**

| 实践 | 说明 |
|:-----|:-----|
| 只复制依赖清单再安装 | 利用层缓存，代码改动不重装依赖 |
| 多阶段构建 | 运行时镜像不含编译工具，体积更小 |
| 非 root 用户 | 降低容器逃逸风险 |
| 固定基础镜像 tag | `3.12-slim` 而非 `latest`，保证可复现 |
| 设置环境变量 | `PYTHONUNBUFFERED=1` 保证日志实时输出 |
| 用 `.dockerignore` | 排除 `.venv`、`__pycache__`、`.git` |

***

## 三、docker-compose 生产编排

### 3.1 服务编排

```yaml
# docker-compose.yml
version: "3.8"

services:
  api:
    build: .
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/appdb
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      db:
        condition: service_healthy    # 等待 db 健康后再启动
      redis:
        condition: service_started
    healthcheck:                      # 应用健康检查
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=${DB_PASSWORD}    # 从 .env 读取，不硬编码
      - POSTGRES_DB=appdb
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d appdb"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:

networks:
  default:
    name: app_network
```

### 3.2 生产部署要点

```bash
# 使用环境变量文件（不入库）
cp .env.example .env

# 构建并后台启动
docker compose up -d --build

# 查看日志
docker compose logs -f api

# 平滑更新（零停机）
docker compose up -d --build --no-deps api

# 查看服务状态
docker compose ps
```

**环境变量 vs 配置文件**

| 方案 | 优点 | 缺点 |
|:-----|:-----|:-----|
| 环境变量 + `.env` | 简单，易注入，不泄露 | 复杂配置难维护 |
| `pydantic-settings` | 类型校验、默认值、自动读取 | 需引入依赖 |
| Vault / K8s Secret | 安全、动态轮换 | 运维复杂度高 |

***

## 四、Kubernetes 入门与发布策略

### 4.1 核心资源

**Deployment（无状态应用）** + **Service（稳定访问入口）** + **Ingress（外部路由）**：

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels: { app: api }
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # 最多多出 1 个临时副本
      maxUnavailable: 0    # 保证至少 3 个可用
  selector:
    matchLabels: { app: api }
  template:
    metadata:
      labels: { app: api }
    spec:
      containers:
        - name: api
          image: registry.example.com/myapp:1.2.0
          ports: [{ containerPort: 8000 }]
          envFrom:
            - configMapRef: { name: api-config }
            - secretRef: { name: api-secret }
          resources:
            requests: { cpu: "100m", memory: "128Mi" }
            limits: { cpu: "500m", memory: "512Mi" }
          livenessProbe:    # 存活探针：挂死自动重启
            httpGet: { path: /health, port: 8000 }
            initialDelaySeconds: 10
          readinessProbe:   # 就绪探针：就绪才接流量
            httpGet: { path: /health, port: 8000 }
            periodSeconds: 5
```

```yaml
# service.yaml —— 提供稳定的 ClusterIP 与负载均衡
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector: { app: api }
  ports:
    - port: 80
      targetPort: 8000
  type: ClusterIP
```

```yaml
# configmap.yaml —— 非敏感配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
data:
  LOG_LEVEL: info
  MAX_WORKERS: "4"
```

```bash
# 敏感信息用 Secret（base64 存储）
kubectl create secret generic api-secret \
  --from-literal=db-password='S3cr3t!' \
  --from-literal=jwt-secret='long-random-string'

kubectl apply -f deployment.yaml -f service.yaml -f configmap.yaml
kubectl get pods -l app=api          # 查看 Pod 状态
kubectl rollout status deploy/api    # 查看滚动发布进度
kubectl rollout undo deploy/api      # 回滚到上一版本
```

### 4.2 发布策略对比

| 策略 | 原理 | 优点 | 缺点 |
|:-----|:-----|:-----|:-----|
| 滚动更新 | 逐个替换旧 Pod | 零停机、自动化 | 新旧版本并存期 |
| 蓝绿发布 | 两套环境切换流量 | 快速回滚 | 资源翻倍 |
| 金丝雀发布 | 小流量灰度验证 | 风险可控 | 需流量控制组件 |
| 重建 | 停旧启新 | 简单 | 有停机窗口 |

***

## 五、实践项目

### 项目 1：搭建 FastAPI 项目的完整 CI/CD

**目标**：为一个 FastAPI 项目配置 GitHub Actions 流水线：PR 触发代码检查与测试，打 tag 时自动构建镜像并推送到容器仓库。

**步骤**：

1. 创建 `requirements.txt` 与 `requirements-dev.txt`，锁定依赖版本
2. 编写 `.github/workflows/ci.yml`：lint（ruff）→ mypy → pytest（带覆盖率阈值）
3. 编写 Dockerfile 多阶段构建，`--prefix=/install` 分离依赖层
4. 添加 CD workflow：`on.push.tags` 触发构建镜像并推送
5. 本地用 `docker compose up -d --build` 验证编排，检查健康检查生效

**目录结构参考**：

```
myapp/
├── .github/workflows/
│   ├── ci.yml              # PR/推送触发：lint+mypy+test
│   └── cd.yml              # 打 tag 触发：构建推送镜像
├── app/
│   ├── main.py             # FastAPI 入口
│   └── config.py
├── tests/
│   └── test_main.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── requirements-dev.txt
```

### 项目 2：docker-compose 编排 + K8s 部署演练

**目标**：将「FastAPI + PostgreSQL + Redis」三件套用 docker-compose 编排，并编写 K8s 部署清单。

**步骤**：

1. 编写三个服务的 docker-compose，db/redis 配健康检查，api 依赖健康后启动
2. 使用 `.env` 管理敏感环境变量，`.gitignore` 忽略 `.env`
3. 编写 `deployment.yaml` / `service.yaml` / `configmap.yaml` / `secret.yaml`
4. 配置 livenessProbe 与 readinessProbe、资源 requests/limits
5. 演练 `kubectl apply` → `rollout status` → `rollout undo` 发布流程

**目录结构参考**：

```
deploy/
├── docker-compose.yml
├── .env.example
├── Dockerfile
└── k8s/
    ├── deployment.yaml
    ├── service.yaml
    ├── configmap.yaml
    └── secret.yaml
```
