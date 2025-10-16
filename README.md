# 代码审查系统

一个基于前端工程化思维设计的代码审查系统，使用Vue.js和Node.js开发，支持通过AI进行自动化代码审查。

## 项目特点

- 📊 **模块化设计**：前后端分离架构，高度模块化组件化设计
- 🤖 **AI辅助审查**：集成DeepSeek API进行智能代码审查
- 📈 **可视化界面**：直观的用户界面，支持项目管理、代码审查和结果查看
- 📋 **多格式导出**：支持JSON、CSV、Markdown和TXT格式的审查结果导出
- 🔧 **灵活配置**：支持不同类型的代码仓库和技术栈

## 技术栈

### 前端
- Vue 3
- Vue Router
- Element Plus
- Vite
- Axios

### 后端
- Node.js
- Express
- Simple Git
- fs-extra
- Moment.js
- Axios

## 目录结构

```
code-review/
├── frontend/             # 前端项目
│   ├── public/           # 静态资源
│   ├── src/              # 源码目录
│   │   ├── views/        # 页面组件
│   │   ├── App.vue       # 根组件
│   │   ├── main.js       # 入口文件
│   │   └── router.js     # 路由配置
│   ├── package.json      # 前端依赖
│   └── vite.config.js    # Vite配置
├── backend/              # 后端项目
│   ├── src/              # 源码目录
│   │   ├── routes/       # API路由
│   │   ├── services/     # 业务逻辑
│   │   ├── utils/        # 工具函数
│   │   └── index.js      # 入口文件
│   ├── .env              # 环境变量配置
│   └── package.json      # 后端依赖
├── data/                 # 数据存储目录
│   ├── projects/         # 项目配置
│   ├── results/          # 审查结果
│   └── logs/             # 日志文件
├── package.json          # 项目根依赖
└── README.md             # 项目说明
```

## 快速开始

### 安装依赖

```bash
# 安装根项目依赖
npm install

# 安装所有子项目依赖
npm run install:all
```

### 配置环境变量

在 `backend/.env` 文件中配置环境变量：

```
# 服务器配置
PORT=3001

# 数据存储路径
DATA_DIR=./data

# 邮件配置（可选）
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=user@example.com
EMAIL_PASS=password
EMAIL_FROM=code-review@example.com

# DeepSeek API配置
DEEPSEEK_API_URL=https://api.deepseek.com

# 日志配置
LOG_LEVEL=info
```

### 运行项目

```bash
# 同时启动前端和后端开发服务器
npm run dev

# 单独启动前端开发服务器
npm run dev:frontend

# 单独启动后端开发服务器
npm run dev:backend
```

### 构建项目

```bash
# 构建前端项目
cd frontend
npm run build
```

## 使用说明

### 1. 项目配置

1. 登录系统
2. 点击"项目管理"菜单
3. 点击"新增项目"按钮
4. 填写项目信息，包括：
   - 项目名称
   - 仓库类型（Git、SVN或本地）
   - 仓库地址
   - 技术栈
   - 文件扩展名（可选）
   - 忽略目录（可选）
   - DeepSeek API Key

### 2. 执行代码审查

1. 在项目列表中，点击项目的"审查"按钮
2. 选择审查时间范围
3. 点击"开始审查"按钮
4. 等待审查完成（可查看实时进度）

### 3. 查看审查结果

1. 点击"审查结果"菜单
2. 可以查看所有项目的审查结果列表
3. 点击"查看详情"可以查看具体的审查问题
4. 支持导出审查结果为不同格式

## 注意事项

1. 确保您的DeepSeek API Key有效且余额充足
2. 对于大型项目，代码审查可能需要较长时间
3. 审查结果存储在`data/results`目录下
4. 如需修改服务器端口，请修改`backend/.env`文件中的`PORT`配置

## License

MIT