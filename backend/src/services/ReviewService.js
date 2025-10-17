const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const GitHubService = require("./git/GitHubService");
const CodeChangeParser = require("./codeParser/CodeChangeParser");
const { v4: uuidv4 } = require("uuid");

// 数据目录路径
const dataDir = process.env.DATA_DIR || path.join(__dirname, "../../../data");
const projectsDir = path.join(dataDir, "projects");
const resultsDir = path.join(dataDir, "results");
const tempDir = path.join(dataDir, "temp");
const logsDir = path.join(dataDir, "logs"); // 添加日志目录

// 存储当前正在进行的审查任务
const activeReviews = new Map();

class ReviewService {
  // 执行代码审查
  static async performCodeReview(project, startTime, endTime) {
    try {
      const {
        id: projectId,
        name: projectName,
        repoUrl,
        repoType,
        token: gitToken,
      } = project;

      const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

      // 生成审查任务ID
      const reviewId = `review_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 11)}`;

      // 初始化审查进度
      const progress = {
        id: reviewId,
        projectId,
        projectName,
        startTime: startTime || new Date().toISOString(),
        endTime: endTime || new Date().toISOString(),
        status: "pending",
        progress: 0,
        message: "准备开始审查",
      };

      // 保存到活跃审查任务中
      activeReviews.set(reviewId, progress);

      try {
        // 1. 获取代码变更
        progress.status = "cloning";
        progress.progress = 10;
        progress.message = "正在获取代码变更";
        const githubService = new GitHubService(gitToken);

        // 获取修改和增加变更文件
        const changedFiles = await githubService.getChangedFiles(
          repoUrl,
          startTime ||
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endTime || new Date().toISOString()
        );

        // 获取过滤配置
        const fileExtensions = process.env.FILTER_FILES
          ? process.env.FILTER_FILES.split(",").map((ext) => ext.trim())
          : [];
        if (project.fileExtensions)
          fileExtensions.push(...project.fileExtensions);

        // 过滤变更文件
        const filteredChangedFiles = this.filterChangedFiles(
          changedFiles,
          fileExtensions
          // ignoreFolders
        ).filter(
          // 只取修改和新增文件
          (item) => item.status === "modified" || item.status === "added"
        );

        // 2. 获取变更文件的内容
        progress.status = "getContent";
        progress.progress = 20;
        progress.message = "正在获取代码变更";
        const { owner, repo } = githubService.parseRepoUrl(repoUrl);

        // 获取变更文件的内容
        const filesWithContent =
          await CodeChangeParser.parseChangedFilesWithContent(
            filteredChangedFiles,
            githubService,
            repoUrl,
            owner,
            repo
          );

        // 3. 执行代码审查
        progress.status = "reviewing";
        progress.progress = 50;
        progress.message = "正在执行代码审查";

        // 使用新的方法审查变更代码
        const reviewResults = await this.reviewCodeChangesWithDeepSeek(
          filesWithContent,
          deepseekApiKey
        );

        console.log("reviewResults:", reviewResults);

        // 3. 生成审查报告
        progress.status = "reporting";
        progress.progress = 90;
        progress.message = "正在生成审查报告";

        const reviewResult = {
          id: reviewId,
          projectId,
          projectName,
          startTime: progress.startTime,
          endTime: progress.endTime,
          reviewedAt: new Date().toISOString(),
          fileCount: filesWithContent.length,
          results: reviewResults,
        };

        // 4. 保存审查结果
        await this.saveReviewResult(projectId, reviewResult);

        // 5. 清理临时文件
        if (repoType === "git" && (await fs.pathExists(tempDir))) {
          await fs.remove(tempDir);
        }

        // 更新进度为完成
        progress.status = "completed";
        progress.progress = 100;
        progress.message = "代码审查完成";

        // 从活跃审查任务中移除
        setTimeout(() => {
          activeReviews.delete(reviewId);
        }, 3600000); // 1小时后移除

        return reviewResult;
      } catch (error) {
        await this.handleError("执行代码审查失败", error);
        throw error;
      }
    } catch (error) {
      await this.handleError("执行代码审查失败", error);
      throw error;
    }
  }

  // 获取审查进度
  static async getReviewProgress(projectId) {
    try {
      // 查找该项目的活跃审查任务
      for (const [reviewId, progress] of activeReviews.entries()) {
        if (progress.projectId === projectId) {
          return progress;
        }
      }

      // 如果没有活跃的审查任务，返回默认状态
      return {
        status: "idle",
        progress: 0,
        message: "当前没有正在进行的审查任务",
      };
    } catch (error) {
      await this.handleError("获取审查进度失败", error);
      throw error;
    }
  }

  // 扫描代码文件
  static async scanCodeFiles(dir, fileExtensions = [], ignoreDirs = []) {
    try {
      const files = [];

      const scanDir = async (currentDir) => {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          const relativePath = path.relative(dir, fullPath);

          // 检查是否应该忽略该目录
          if (entry.isDirectory()) {
            if (
              !ignoreDirs.some(
                (ignoreDir) =>
                  relativePath.startsWith(ignoreDir + path.sep) ||
                  relativePath === ignoreDir
              )
            ) {
              await scanDir(fullPath);
            }
          } else if (entry.isFile()) {
            // 检查文件扩展名
            if (
              fileExtensions.length === 0 ||
              fileExtensions.some((ext) => fullPath.endsWith(ext))
            ) {
              files.push(fullPath);
            }
          }
        }
      };

      await scanDir(dir);
      return files;
    } catch (error) {
      await this.handleError("扫描代码文件失败", error);
      throw error;
    }
  }

  // 生成审查摘要
  static generateReviewSummary(reviewResults) {
    const issueCounts = {
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    let fileWithMostIssues = null;
    let maxIssues = 0;

    reviewResults.forEach((file) => {
      const issues = file.issues || [];

      if (issues.length > maxIssues) {
        maxIssues = issues.length;
        fileWithMostIssues = file.file;
      }

      issues.forEach((issue) => {
        if (issueCounts[issue.severity] !== undefined) {
          issueCounts[issue.severity]++;
        }
      });
    });

    return {
      issueCounts,
      totalIssues: Object.values(issueCounts).reduce(
        (sum, count) => sum + count,
        0
      ),
      fileWithMostIssues,
      maxIssuesPerFile: maxIssues,
    };
  }

  // 保存审查结果
  static async saveReviewResult(projectId, reviewResult) {
    try {
      const projectResultsDir = path.join(resultsDir, projectId);
      await fs.ensureDir(projectResultsDir);

      // 保存到单独的文件
      const resultFilePath = path.join(
        projectResultsDir,
        `${reviewResult.startTime.replace(
          /:/g,
          "-"
        )}_to_${reviewResult.endTime.replace(/:/g, "-")}.json`
      );
      await fs.writeJSON(resultFilePath, reviewResult, { spaces: 2 });

      // 更新项目的结果索引
      const indexFilePath = path.join(projectResultsDir, "index.json");
      let index = [];

      if (await fs.pathExists(indexFilePath)) {
        index = await fs.readJSON(indexFilePath);
      }

      index.unshift({
        id: reviewResult.id,
        projectId,
        startTime: reviewResult.startTime,
        endTime: reviewResult.endTime,
        reviewedAt: reviewResult.reviewedAt,
        issuesCount: reviewResult.issuesCount,
        fileCount: reviewResult.fileCount,
      });

      await fs.writeJSON(indexFilePath, index, { spaces: 2 });
    } catch (error) {
      await this.handleError("保存审查结果失败", error);
      throw error;
    }
  }

  // 通用的DeepSeek API调用方法
  static async callDeepSeekAPI(messages, apiKey, options = {}) {
    try {
      const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL;
      const apiUrl = DEEPSEEK_API_URL.endsWith("/")
        ? DEEPSEEK_API_URL + "v1/chat/completions"
        : DEEPSEEK_API_URL + "/v1/chat/completions";
      const response = await axios.post(
        apiUrl,
        {
          model: "deepseek-coder",
          messages,
          temperature: 0.2,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      await this.handleError("调用DeepSeek API失败", error);
      throw error;
    }
  }

  // 提取通用的JSON解析方法
  static parseAPIResponse(responseData) {
    if (responseData.choices && responseData.choices.length > 0) {
      const content = responseData.choices[0].message.content;
      try {
        // 尝试直接解析JSON
        return JSON.parse(content);
      } catch (jsonError) {
        // 如果直接解析失败，尝试提取代码块中的JSON
        try {
          // 匹配代码块中的内容
          const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (codeBlockMatch && codeBlockMatch[1]) {
            return JSON.parse(codeBlockMatch[1]);
          }
          
          // 如果没有代码块，尝试清理内容后解析
          const cleanedContent = content
            .replace(/```(?:json)?/g, '')
            .trim();
          
          return JSON.parse(cleanedContent);
        } catch (cleanJsonError) {
          console.error("JSON解析失败:", jsonError);
          console.error("清理后JSON解析也失败:", cleanJsonError);
          return null;
        }
      }
    }
    return null;
  }

  // 提取通用的API错误处理方法
  static createAPIResultWithIssue(severity, line, message, suggestion) {
    return {
      issues: [
        {
          severity,
          line,
          message,
          suggestion,
        },
      ],
    };
  }

  // 提取通用的空结果方法
  static createEmptyResult() {
    return { issues: [] };
  }

  // 辅助方法：去重问题
  static dedupeIssues(issues) {
    const seen = new Set();
    return issues.filter((issue) => {
      const key = `${issue.line}-${issue.message.substring(0, 50)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // 新增方法：摘要大文件变更
  static summarizeChanges(fileChange) {
    // 如果内容不大，直接返回
    if (fileChange.length <= 10000) {
      return fileChange;
    }

    // 解析文件变更内容
    const lines = fileChange.split("\n");

    // 提取文件基本信息（第一行通常包含文件路径）
    const headerLines = [];
    let i = 0;
    while (i < lines.length && !lines[i].startsWith("@@") && i < 10) {
      headerLines.push(lines[i]);
      i++;
    }

    // 收集重要的变更行（添加和删除的行）
    const importantLines = [];
    let currentContext = "";

    for (let j = i; j < lines.length && importantLines.length < 800; j++) {
      const line = lines[j];

      // 记录上下文信息（hunk头）
      if (line.startsWith("@@")) {
        currentContext = line;
        // 保留一些上下文行
        importantLines.push({ type: "context", content: line, lineNum: j });
      }
      // 添加重要的变更行
      else if (line.startsWith("+") || line.startsWith("-")) {
        importantLines.push({
          type: line.startsWith("+") ? "addition" : "deletion",
          content: line,
          lineNum: j,
          context: currentContext,
        });
      }
      // 保留少量上下文行（不变的行）
      else if (
        line.trim() !== "" &&
        importantLines.length > 0 &&
        importantLines.filter((l) => l.type !== "context").length > 0
      ) {
        // 只保留变更附近的上下文行
        if (
          importantLines.length > 0 &&
          j - importantLines[importantLines.length - 1].lineNum < 5
        ) {
          importantLines.push({ type: "context", content: line, lineNum: j });
        }
      }
    }

    // 如果找到了重要变更，构建摘要
    if (importantLines.length > 0) {
      let summarizedContent = [...headerLines, ""].join("\n");

      // 按照上下文分组变更
      const groups = [];
      let currentGroup = [];

      importantLines.forEach((line) => {
        if (line.type === "context" && line.content.startsWith("@@")) {
          if (currentGroup.length > 0) {
            groups.push(currentGroup);
          }
          currentGroup = [line];
        } else {
          currentGroup.push(line);
        }
      });

      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }

      // 添加分组的变更内容
      groups.forEach((group) => {
        if (summarizedContent.length < 9000) {
          // 预留空间给结尾说明
          summarizedContent += group.map((l) => l.content).join("\n") + "\n";
        }
      });

      // 添加说明
      summarizedContent += `\n...内容已根据重要性进行摘要处理...`;
      summarizedContent += `\n原始变更共${lines.length}行，提取了${importantLines.length}个重要行`;

      return summarizedContent;
    }

    // 如果没有找到合适的变更行，则回退到原来的策略
    const start = fileChange.substring(0, 4500);
    const end = fileChange.substring(fileChange.length - 4500);
    return `${start}\n...\n[中间内容已省略，共省略${
      fileChange.length - 9000
    }个字符]\n...\n${end}`;
  }

  // 新增方法：智能分片处理大文件变更
  static async reviewHugeFileChanges(file, apiKey) {
    const MAX_CHUNK_SIZE = 8000; // 每个块最大字符数
    const OVERLAP_LINES = 3; // 块之间的重叠行数

    // 如果文件不太大，直接处理
    if (file.content.length <= MAX_CHUNK_SIZE) {
      return await this.reviewSingleChunk(file, file.content, apiKey, 1, 1);
    }

    // 将变更按行分割
    const lines = file.content.split("\n");
    const chunks = [];

    // 创建重叠的块
    let startIndex = 0;
    while (startIndex < lines.length) {
      let endIndex = startIndex;
      let chunkSize = 0;

      // 添加文件头部信息到第一个块
      if (startIndex === 0) {
        while (
          endIndex < lines.length &&
          !lines[endIndex].startsWith("@@") &&
          chunkSize < MAX_CHUNK_SIZE / 2
        ) {
          chunkSize += lines[endIndex].length + 1; // +1 for newline
          endIndex++;
        }
      }

      // 添加变更内容直到达到块大小限制
      while (endIndex < lines.length && chunkSize < MAX_CHUNK_SIZE) {
        const lineLength = lines[endIndex].length + 1;
        if (chunkSize + lineLength > MAX_CHUNK_SIZE && endIndex > startIndex) {
          break;
        }
        chunkSize += lineLength;
        endIndex++;
      }

      // 确保块在hunk边界结束（如果不是最后一块）
      if (endIndex < lines.length) {
        let hunkEnd = endIndex;
        while (
          hunkEnd > startIndex + OVERLAP_LINES &&
          !lines[hunkEnd].startsWith("@@")
        ) {
          hunkEnd--;
        }

        // 如果找到hunk边界且不是太早结束，则在此处分割
        if (hunkEnd > startIndex + OVERLAP_LINES) {
          endIndex = hunkEnd;
        } else {
          // 否则保留几行重叠
          endIndex = Math.min(endIndex, lines.length);
        }
      } else {
        endIndex = lines.length;
      }

      // 创建块内容
      let chunkContent = lines.slice(startIndex, endIndex).join("\n");

      // 如果不是第一个块，添加一些上下文信息
      if (startIndex > 0) {
        // 查找最近的hunk头
        let contextStart = startIndex;
        while (
          contextStart > Math.max(0, startIndex - 20) &&
          !lines[contextStart].startsWith("@@")
        ) {
          contextStart--;
        }

        if (lines[contextStart].startsWith("@@")) {
          const header = lines.slice(contextStart, startIndex).join("\n");
          chunkContent = header + "\n" + chunkContent;
        }
      }

      chunks.push({
        content: chunkContent,
        startLine: startIndex,
        endLine: endIndex,
      });

      // 计算下一个块的起始位置（带重叠）
      startIndex = endIndex - Math.min(OVERLAP_LINES, endIndex - 1);
      if (startIndex >= lines.length) break;
    }

    // 并行处理所有块（限制并发数）
    const CONCURRENT_LIMIT = 3;
    const allIssues = [];

    for (let i = 0; i < chunks.length; i += CONCURRENT_LIMIT) {
      const batch = chunks.slice(i, i + CONCURRENT_LIMIT);
      const promises = batch.map((chunk, idx) =>
        this.reviewSingleChunk(
          file,
          chunk.content,
          apiKey,
          i + idx + 1,
          chunks.length
        )
      );

      try {
        const results = await Promise.all(promises);
        results.forEach((result) => {
          if (result && result.issues) {
            // 调整行号以匹配原始文件
            const baseLine = chunks[i + results.indexOf(result)].startLine;
            result.issues.forEach((issue) => {
              issue.line = issue.line + baseLine;
            });
            allIssues.push(...result.issues);
          }
        });
      } catch (error) {
        await this.handleError(
          `处理文件 ${file.filename} 的块批次失败`,
          error
        );
      }
    }

    // 去重相同位置的问题
    const uniqueIssues = this.dedupeIssues(allIssues);

    return {
      file: file.filename,
      status: file.status,
      issues: uniqueIssues,
    };
  }

  // 辅助方法：处理单个块
  static async reviewSingleChunk(
    file,
    chunkContent,
    apiKey,
    chunkIndex,
    totalChunks
  ) {
    try {
      const promptContent = `文件: ${file.filename}${
        totalChunks > 1 ? ` (块 ${chunkIndex}/${totalChunks})` : ""
      }\n变更内容:\n${chunkContent}`;

      const messages = [
        {
          role: "system",
          content:
            "你是一个代码审查专家，需要帮助开发者发现代码变更中的问题并提供改进建议。请分析以下代码变更，重点关注：\n1. 代码质量和可维护性\n2. 潜在的bug和安全问题\n3. 性能优化机会\n4. 是否符合最佳实践\n请以JSON格式返回结果，包含issues数组，每个issue应包含severity（'high', 'medium', 'low', 'info'）、line（问题所在行）、message（问题描述）和suggestion（改进建议）。如果没有问题，返回空的issues数组。请只返回JSON格式，不要包含其他解释文本或Markdown代码块标记。",
        },
        {
          role: "user",
          content: promptContent,
        },
      ];

      const responseData = await this.callDeepSeekAPI(messages, apiKey, {
        timeout: 60000,
      });
      const result = this.parseAPIResponse(responseData);

      return result || this.createEmptyResult();
    } catch (error) {
      await this.handleError(`审查文件块 ${chunkIndex} 失败`, error);
      return this.createAPIResultWithIssue(
        "error",
        1,
        `审查文件块 ${chunkIndex} 失败: ${error.message}`,
        "请检查API配置和网络连接"
      );
    }
  }

  // 处理文件审查逻辑
  static async processFileReview(file, apiKey) {
    // 判断是否为大文件（超过一定字符数）
    if (file.content && file.content.length > 15000) {
      // 使用智能分片处理大文件
      return await this.reviewHugeFileChanges(file, apiKey);
    } else {
      // 小文件直接处理
      return await this.reviewSmallFileChanges(file, apiKey);
    }
  }

  // 处理小文件变更
  static async reviewSmallFileChanges(file, apiKey) {
    let changeContent = `文件路径: ${file.filename}\n`;
    // changeContent += `变更类型: ${file.status}\n`;

    if (file.content) {
      changeContent += `文件内容:\n${file.content}\n`;
    }

    // 对于仍然较大的文件，使用摘要处理
    if (changeContent.length > 10000) {
      changeContent = this.summarizeChanges(changeContent);
    }

    try {
      const messages = [
        {
          role: "system",
          content:
            "你是一个代码审查专家，需要帮助开发者发现代码变更中的问题并提供改进建议。请分析以下代码变更，重点关注：\n1. 代码质量和可维护性\n2. 潜在的bug和安全问题\n3. 性能优化机会\n4. 是否符合最佳实践\n请以JSON格式返回结果，包含issues数组，每个issue应包含severity（'high', 'medium', 'low', 'info'）、line（问题所在行）、message（问题描述）和suggestion（改进建议）。如果没有问题，返回空的issues数组。请只返回JSON格式，不要包含其他解释文本或Markdown代码块标记。",
        },
        {
          role: "user",
          content: changeContent,
        },
      ];

      const responseData = await this.callDeepSeekAPI(messages, apiKey);
      const parsedResult = this.parseAPIResponse(responseData);

      return {
        file: file.filename,
        status: file.status,
        issues: parsedResult?.issues || [],
      };
    } catch (apiError) {
      await this.handleError("调用DeepSeek API失败", apiError);
      return {
        file: file.filename,
        status: file.status,
        issues: [
          {
            severity: "error",
            line: 1,
            message: `调用代码审查API失败: ${apiError.message}`,
            suggestion: "请检查API配置和网络连接",
          },
        ],
      };
    }
  }

  // 使用DeepSeek API审查变更的代码
  static async reviewCodeChangesWithDeepSeek(changedFiles, apiKey) {
    try {
      const reviewResults = [];

      for (const file of changedFiles) {
        try {
          const result = await this.processFileReview(file, apiKey);

          if (result && result.issues && result.issues.length > 0) {
            reviewResults.push(result);
          }
        } catch (fileError) {
          await this.handleError(`处理文件 ${file.filename} 失败`, fileError);
          // 继续处理其他文件
          reviewResults.push({
            file: file.filename,
            status: file.status,
            issues: [
              {
                severity: "error",
                line: 1,
                message: `处理文件失败: ${fileError.message}`,
                suggestion: "系统内部错误",
              },
            ],
          });
        }
      }

      return reviewResults;
    } catch (error) {
      await this.handleError("处理变更文件失败", error);
      return [
        this.createAPIResultWithIssue(
          "error",
          1,
          `处理变更文件失败: ${error.message}`,
          "系统内部错误"
        ),
      ];
    }
  }

  // 过滤变更文件
  static filterChangedFiles(
    changedFiles,
    fileExtensions = []
    // ignoreFolders = []
  ) {
    return changedFiles.filter((file) => {
      // 检查是否在忽略的文件夹中
      // if (ignoreFolders.length > 0) {
      //   const inIgnoredFolder = ignoreFolders.some((folder) => {
      //     // 确保文件路径以文件夹名开头，或者包含 "/文件夹名/"
      //     return (
      //       file.filename.startsWith(folder + "/") ||
      //       file.filename.includes("/" + folder + "/")
      //     );
      //   });

      //   if (inIgnoredFolder) {
      //     return false;
      //   }
      // }

      // 检查文件扩展名
      if (fileExtensions.length > 0) {
        const hasValidExtension = fileExtensions.some((ext) => {
          // 支持带点和不带点的扩展名格式
          const extension = ext.startsWith(".") ? ext : "." + ext;
          return file.filename.endsWith(extension);
        });

        // 如果定义了扩展名过滤但文件不匹配，则过滤掉
        if (hasValidExtension) {
          return false;
        }
      }

      return true;
    });
  }

  // 统一错误处理方法
  static async handleError(message, error) {
    try {
      // 确保日志目录存在
      await fs.ensureDir(logsDir);

      // 创建日志文件名
      const date = new Date().toISOString().split("T")[0]; // 获取当前日期
      const logFileName = `error_${date}.txt`;
      const logFilePath = path.join(logsDir, logFileName);

      // 格式化错误信息
      const timestamp = new Date().toISOString();
      const errorDetails = `
[${timestamp}] ${message}
Error: ${error.message || error}
Stack: ${error.stack || "No stack trace available"}

----------------------------------------
`;

      // 追加写入日志文件
      await fs.appendFile(logFilePath, errorDetails);
      console.log(`错误日志已写入: ${logFilePath}`);
    } catch (logError) {
      console.error("写入错误日志失败:", logError);
    }
  }
}

module.exports = ReviewService;