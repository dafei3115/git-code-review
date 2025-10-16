const fs = require("fs-extra");
const path = require("path");
const ProjectService = require("./ProjectService");

// 数据目录路径
const dataDir = process.env.DATA_DIR || path.join(__dirname, "../../../data");
const resultsDir = path.join(dataDir, "results");

class ResultService {
  // 获取所有审查结果列表（带分页和筛选）
  static async getReviewResults({
    projectId,
    startDate,
    endDate,
    page = 1,
    pageSize = 10,
  }) {
    try {
      let allResults = [];

      if (projectId) {
        // 只获取特定项目的结果
        const projectResults = await this.getReviewResultsByProjectId(
          projectId,
          { startDate, endDate }
        );
        allResults = projectResults.data || [];
      } else {
        // 获取所有项目的结果
        const projectDirs = await fs.readdir(resultsDir, {
          withFileTypes: true,
        });

        for (const dir of projectDirs) {
          if (dir.isDirectory()) {
            const projectId = dir.name;
            const projectResults = await this.getReviewResultsByProjectId(
              projectId,
              { startDate, endDate }
            );
            allResults = allResults.concat(projectResults.data || []);
          }
        }
      }

      // 按时间排序
      allResults.sort(
        (a, b) => new Date(b.reviewedAt) - new Date(a.reviewedAt)
      );

      // 分页
      const total = allResults.length;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const paginatedResults = allResults.slice(start, end);

      return {
        data: paginatedResults,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      console.error("获取审查结果列表失败:", error);
      throw new Error("获取审查结果列表失败");
    }
  }

  // 获取特定项目的审查结果列表
  static async getReviewResultsByProjectId(
    projectId,
    { startDate, endDate, page = 1, pageSize = 10 } = {}
  ) {
    try {
      const projectResultsDir = path.join(resultsDir, projectId);

      // 检查项目是否存在
      if (!(await fs.pathExists(projectResultsDir))) {
        return {
          data: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
        };
      }

      // 读取结果索引
      const indexFilePath = path.join(projectResultsDir, "index.json");
      let index = [];

      if (await fs.pathExists(indexFilePath)) {
        index = await fs.readJSON(indexFilePath);
      }

      // 如果没有索引，尝试扫描目录生成
      if (index.length === 0) {
        index = await this.scanResultsDirectory(projectResultsDir, projectId);
      }

      // 筛选日期范围
      let filteredResults = index;

      if (startDate) {
        filteredResults = filteredResults.filter(
          (result) => new Date(result.reviewedAt) >= new Date(startDate)
        );
      }

      if (endDate) {
        filteredResults = filteredResults.filter(
          (result) => new Date(result.reviewedAt) <= new Date(endDate)
        );
      }

      // 按时间排序
      filteredResults.sort(
        (a, b) => new Date(b.reviewedAt) - new Date(a.reviewedAt)
      );

      // 分页
      const total = filteredResults.length;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const paginatedResults = filteredResults.slice(start, end);

      // 获取项目名称
      const project = await ProjectService.getProjectById(projectId);
      const projectName = project ? project.name : "未知项目";

      // 为结果添加项目名称
      const resultsWithProjectName = paginatedResults.map((result) => ({
        ...result,
        projectName,
      }));

      return {
        data: resultsWithProjectName,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      console.error(`获取项目 ${projectId} 的审查结果失败:`, error);
      throw new Error("获取审查结果失败");
    }
  }

  // 获取特定审查结果的详情
  static async getReviewDetail(projectId, startTime, endTime) {
    try {
      const projectResultsDir = path.join(resultsDir, projectId);

      // 检查项目是否存在
      if (!(await fs.pathExists(projectResultsDir))) {
        return null;
      }

      // 构建文件名（注意替换时间中的冒号）
      const fileName = `${startTime.replace(/:/g, "-")}_to_${endTime.replace(
        /:/g,
        "-"
      )}.json`;
      const resultFilePath = path.join(projectResultsDir, fileName);

      // 检查结果文件是否存在
      if (!(await fs.pathExists(resultFilePath))) {
        // 尝试查找最接近的结果文件
        const closestResult = await this.findClosestResult(
          projectResultsDir,
          startTime
        );
        if (closestResult) {
          return closestResult;
        }
        return null;
      }

      // 读取结果文件
      const result = await fs.readJSON(resultFilePath);

      // 获取项目名称
      const project = await ProjectService.getProjectById(projectId);
      if (project) {
        result.projectName = project.name;
      }

      return result;
    } catch (error) {
      console.error(
        `获取审查结果详情失败 (项目: ${projectId}, 时间: ${startTime} 至 ${endTime}):`,
        error
      );
      throw new Error("获取审查结果详情失败");
    }
  }

  // 导出审查结果
  static async exportReviewResult(result, format = "json") {
    try {
      switch (format.toLowerCase()) {
        case "json":
          return JSON.stringify(result, null, 2);
        case "csv":
          return this.generateCsvReport(result);
        case "markdown":
          return this.generateMarkdownReport(result);
        case "txt":
        default:
          return this.generateTextReport(result);
      }
    } catch (error) {
      console.error("导出审查结果失败:", error);
      throw new Error("导出审查结果失败");
    }
  }

  // 扫描结果目录生成索引
  static async scanResultsDirectory(projectResultsDir, projectId) {
    try {
      const files = await fs.readdir(projectResultsDir, {
        withFileTypes: true,
      });
      const index = [];

      for (const file of files) {
        if (
          file.isFile() &&
          file.name.endsWith(".json") &&
          file.name !== "index.json"
        ) {
          try {
            const resultFilePath = path.join(projectResultsDir, file.name);
            const result = await fs.readJSON(resultFilePath);

            if (result.id && result.startTime && result.endTime) {
              index.push({
                id: result.id,
                startTime: result.startTime,
                endTime: result.endTime,
                reviewedAt: result.reviewedAt || new Date().toISOString(),
                issuesCount: result.issuesCount || 0,
                fileCount: result.fileCount || 0,
              });
            }
          } catch (err) {
            console.warn(`无法读取结果文件 ${file.name}:`, err);
            continue;
          }
        }
      }

      // 按时间排序
      index.sort((a, b) => new Date(b.reviewedAt) - new Date(a.reviewedAt));

      // 保存索引
      const indexFilePath = path.join(projectResultsDir, "index.json");
      await fs.writeJSON(indexFilePath, index, { spaces: 2 });

      return index;
    } catch (error) {
      console.error("扫描结果目录失败:", error);
      throw error;
    }
  }

  // 查找最接近的结果文件
  static async findClosestResult(projectResultsDir, targetTime) {
    try {
      const files = await fs.readdir(projectResultsDir, {
        withFileTypes: true,
      });
      let closestResult = null;
      let minTimeDiff = Infinity;

      const targetDate = new Date(targetTime);

      for (const file of files) {
        if (
          file.isFile() &&
          file.name.endsWith(".json") &&
          file.name !== "index.json"
        ) {
          try {
            const resultFilePath = path.join(projectResultsDir, file.name);
            const result = await fs.readJSON(resultFilePath);

            if (result.reviewedAt) {
              const resultDate = new Date(result.reviewedAt);
              const timeDiff = Math.abs(resultDate - targetDate);

              if (timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff;
                closestResult = result;
              }
            }
          } catch (err) {
            console.warn(`无法读取结果文件 ${file.name}:`, err);
            continue;
          }
        }
      }

      return closestResult;
    } catch (error) {
      console.error("查找最接近的结果文件失败:", error);
      return null;
    }
  }

  // 生成CSV报告
  static generateCsvReport(result) {
    let csv = "文件路径,严重程度,行号,问题描述,改进建议\n";

    result.results.forEach((file) => {
      file.issues.forEach((issue) => {
        const escapedFile = file.file.replace(/,/g, ";");
        const escapedMessage = issue.message
          .replace(/,/g, ";")
          .replace(/\n/g, " ");
        const escapedSuggestion = issue.suggestion
          .replace(/,/g, ";")
          .replace(/\n/g, " ");

        csv += `${escapedFile},${issue.severity},${
          issue.line || 0
        },"${escapedMessage}","${escapedSuggestion}"\n`;
      });
    });

    return csv;
  }

  // 生成Markdown报告
  static generateMarkdownReport(result) {
    let markdown = `# 代码审查报告\n\n`;

    // 报告摘要
    markdown += `## 报告摘要\n\n`;
    markdown += `- **项目名称**: ${result.projectName}\n`;
    markdown += `- **审查时间**: ${new Date(
      result.reviewedAt
    ).toLocaleString()}\n`;
    markdown += `- **审查范围**: ${result.startTime} 至 ${result.endTime}\n`;
    markdown += `- **审查文件数**: ${result.fileCount}\n`;
    markdown += `- **发现问题数**: ${result.issuesCount}\n\n`;

    // 问题统计
    if (result.summary && result.summary.issueCounts) {
      markdown += `## 问题统计\n\n`;
      markdown += `| 严重程度 | 数量 |\n`;
      markdown += `|----------|------|\n`;
      Object.entries(result.summary.issueCounts).forEach(
        ([severity, count]) => {
          markdown += `| ${severity} | ${count} |\n`;
        }
      );
      markdown += `\n`;
    }

    // 文件问题详情
    markdown += `## 文件问题详情\n\n`;

    result.results.forEach((file) => {
      if (file.issues.length > 0) {
        markdown += `### ${file.file}\n\n`;
        markdown += `| 严重程度 | 行号 | 问题描述 | 改进建议 |\n`;
        markdown += `|----------|------|----------|----------|\n`;

        file.issues.forEach((issue) => {
          markdown += `| ${issue.severity} | ${issue.line || 0} | ${
            issue.message
          } | ${issue.suggestion} |\n`;
        });

        markdown += `\n`;
      }
    });

    return markdown;
  }

  // 生成文本报告
  static generateTextReport(result) {
    let text = "===== 代码审查报告 =====\n\n";

    // 报告摘要
    text += "报告摘要:\n";
    text += `  项目名称: ${result.projectName}\n`;
    text += `  审查时间: ${new Date(result.reviewedAt).toLocaleString()}\n`;
    text += `  审查范围: ${result.startTime} 至 ${result.endTime}\n`;
    text += `  审查文件数: ${result.fileCount}\n`;
    text += `  发现问题数: ${result.issuesCount}\n\n`;

    // 问题统计
    if (result.summary && result.summary.issueCounts) {
      text += "问题统计:\n";
      Object.entries(result.summary.issueCounts).forEach(
        ([severity, count]) => {
          text += `  ${severity}: ${count}\n`;
        }
      );
      text += "\n";
    }

    // 文件问题详情
    text += "文件问题详情:\n\n";

    result.results.forEach((file) => {
      if (file.issues.length > 0) {
        text += `${file.file}\n`;
        text += "-".repeat(40) + "\n";

        file.issues.forEach((issue) => {
          text += `  [${issue.severity}] 行 ${issue.line || 0}: ${
            issue.message
          }\n`;
          text += `    建议: ${issue.suggestion}\n`;
          text += "\n";
        });
      }
    });

    text += "======================\n";

    return text;
  }
}

module.exports = ResultService;
