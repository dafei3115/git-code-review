// src/services/CodeChangeParser.js

class CodeChangeParser {
  /**
   * 解析变更文件并获取代码内容
   * @param {Array} changedFiles - 变更文件列表
   * @param {Object} githubService - GitHub服务实例
   * @param {string} repoUrl - 仓库URL
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名称
   * @returns {Array} 包含文件内容的变更文件列表
   */
  static async parseChangedFilesWithContent(changedFiles, githubService, repoUrl, owner, repo) {
    const filesWithContent = [];
    
    for (const file of changedFiles) {
      try {
        // 获取文件当前内容
        const fileContent = await githubService.getFileContent(owner, repo, file.filename);
        
        filesWithContent.push({
          ...file,
          content: fileContent,
          contentLength: fileContent.length,
          // 判断是否为新增文件
          isNewFile: file.status === 'added',
          // 判断是否为删除文件
          isDeletedFile: file.status === 'removed',
          // 判断是否为修改文件
          isModifiedFile: file.status === 'modified'
        });
      } catch (error) {
        console.error(`获取文件 ${file.filename} 内容失败:`, error.message);
        // 即使某个文件获取失败，也继续处理其他文件
        filesWithContent.push({
          ...file,
          content: null,
          contentError: error.message,
          contentLength: 0
        });
      }
    }
    
    return filesWithContent;
  }

  /**
   * 解析变更文件并获取变更差异内容
   * @param {Array} changedFiles - 变更文件列表
   * @param {Object} githubService - GitHub服务实例
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名称
   * @param {string} baseCommit - 基础提交SHA
   * @param {string} headCommit - 比较提交SHA
   * @returns {Array} 包含差异内容的变更文件列表
   */
  static async parseChangedFilesWithDiff(changedFiles, githubService, owner, repo, baseCommit, headCommit) {
    try {
      // 获取两个提交之间的差异
      const compareResult = await githubService.getCompareChanges(owner, repo, baseCommit, headCommit);
      
      const filesWithDiff = changedFiles.map(file => {
        // 在比较结果中找到对应的文件差异
        const diffInfo = compareResult.find(diffFile => diffFile.filename === file.filename);
        
        return {
          ...file,
          patch: diffInfo ? diffInfo.patch : null,
          blob_url: diffInfo ? diffInfo.blob_url : null,
          raw_url: diffInfo ? diffInfo.raw_url : null
        };
      });
      
      return filesWithDiff;
    } catch (error) {
      console.error('获取文件差异内容失败:', error.message);
      // 如果获取差异失败，返回原始文件信息
      return changedFiles.map(file => ({
        ...file,
        patch: null,
        diffError: error.message
      }));
    }
  }

  /**
   * 过滤需要审查的文件（根据文件扩展名和忽略规则）
   * @param {Array} filesWithContent - 包含内容的文件列表
   * @param {Array} fileExtensions - 需要审查的文件扩展名
   * @param {Array} ignoreDirs - 需要忽略的目录
   * @returns {Array} 过滤后的文件列表
   */
  static filterFilesForReview(filesWithContent, fileExtensions = [], ignoreDirs = []) {
    return filesWithContent.filter(file => {
      // 跳过删除的文件
      if (file.isDeletedFile) {
        return false;
      }
      
      // 检查是否在忽略目录中
      const isInIgnoreDir = ignoreDirs.some(ignoreDir => 
        file.filename.startsWith(ignoreDir + '/') || file.filename === ignoreDir
      );
      
      if (isInIgnoreDir) {
        return false;
      }
      
      // 如果没有指定文件扩展名，则审查所有文件
      if (fileExtensions.length === 0) {
        return true;
      }
      
      // 检查文件扩展名
      return fileExtensions.some(ext => file.filename.endsWith(ext));
    });
  }

  /**
   * 提取文件变更统计信息
   * @param {Array} changedFiles - 变更文件列表
   * @returns {Object} 统计信息
   */
  static extractChangeStats(changedFiles) {
    const stats = {
      totalFiles: changedFiles.length,
      addedFiles: 0,
      modifiedFiles: 0,
      removedFiles: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      fileTypes: {}
    };
    
    changedFiles.forEach(file => {
      switch (file.status) {
        case 'added':
          stats.addedFiles++;
          break;
        case 'modified':
          stats.modifiedFiles++;
          break;
        case 'removed':
          stats.removedFiles++;
          break;
      }
      
      stats.totalAdditions += file.additions || 0;
      stats.totalDeletions += file.deletions || 0;
      
      // 统计文件类型
      const fileType = file.filename.split('.').pop();
      if (fileType) {
        stats.fileTypes[fileType] = (stats.fileTypes[fileType] || 0) + 1;
      }
    });
    
    return stats;
  }

  /**
   * 将文件按变更大小排序
   * @param {Array} filesWithContent - 包含内容的文件列表
   * @param {string} sortBy - 排序依据 ('additions', 'deletions', 'changes', 'contentLength')
   * @param {boolean} descending - 是否降序排列
   * @returns {Array} 排序后的文件列表
   */
  static sortFilesByChangeSize(filesWithContent, sortBy = 'changes', descending = true) {
    return [...filesWithContent].sort((a, b) => {
      const aValue = a[sortBy] || 0;
      const bValue = b[sortBy] || 0;
      
      if (descending) {
        return bValue - aValue;
      } else {
        return aValue - bValue;
      }
    });
  }

  /**
   * 获取大文件列表（内容超过指定大小的文件）
   * @param {Array} filesWithContent - 包含内容的文件列表
   * @param {number} maxSize - 最大大小（字节）
   * @returns {Array} 大文件列表
   */
  static getLargeFiles(filesWithContent, maxSize = 50000) { // 默认50KB
    return filesWithContent.filter(file => 
      file.content && file.content.length > maxSize
    );
  }
}

module.exports = CodeChangeParser;