// src/services/CodeDiffParser.js

class CodeDiffParser {
  /**
   * 解析Git差异格式的内容
   * @param {string} diffContent - Git diff格式的内容
   * @returns {Array} 解析后的变更块
   */
  static parseDiffContent(diffContent) {
    if (!diffContent) return [];
    
    const hunks = [];
    const lines = diffContent.split('\n');
    let currentHunk = null;
    let lineNumber = 1;
    
    for (const line of lines) {
      // 检查是否是hunk头部 (@@ -start,length +start,length @@)
      const hunkHeaderMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (hunkHeaderMatch) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        
        currentHunk = {
          originalStart: parseInt(hunkHeaderMatch[1]),
          originalLength: hunkHeaderMatch[2] ? parseInt(hunkHeaderMatch[2]) : 1,
          newStart: parseInt(hunkHeaderMatch[3]),
          newLength: hunkHeaderMatch[4] ? parseInt(hunkHeaderMatch[4]) : 1,
          changes: [],
          lineNumber: lineNumber
        };
      } else if (currentHunk) {
        // 处理变更行
        if (line.startsWith('+') && !line.startsWith('+++')) {
          // 新增行
          currentHunk.changes.push({
            type: 'add',
            content: line.substring(1),
            lineNumber: lineNumber
          });
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          // 删除行
          currentHunk.changes.push({
            type: 'remove',
            content: line.substring(1),
            lineNumber: lineNumber
          });
        } else if (line.startsWith(' ')) {
          // 未变更行
          currentHunk.changes.push({
            type: 'context',
            content: line.substring(1),
            lineNumber: lineNumber
          });
        } else if (!line.startsWith('\\')) {
          // 上下文行（有些diff格式中上下文行可能不以空格开头）
          currentHunk.changes.push({
            type: 'context',
            content: line,
            lineNumber: lineNumber
          });
        }
      }
      lineNumber++;
    }
    
    // 添加最后一个hunk
    if (currentHunk) {
      hunks.push(currentHunk);
    }
    
    return hunks;
  }

  /**
   * 从变更文件中提取具体的变更代码
   * @param {Array} changedFiles - 变更文件列表
   * @returns {Array} 包含详细变更信息的文件列表
   */
  static extractCodeChanges(changedFiles) {
    return changedFiles.map(file => {
      let detailedChanges = [];
      
      if (file.patch) {
        // 解析patch内容
        const hunks = this.parseDiffContent(file.patch);
        detailedChanges = hunks;
      }
      
      return {
        ...file,
        detailedChanges: detailedChanges,
        addedLines: this.extractAddedLines(detailedChanges),
        addedContent: this.extractAddedLines(detailedChanges).map(line => line.content).join('\n'),
        removedLines: this.extractRemovedLines(detailedChanges),
        changeCount: detailedChanges.reduce((count, hunk) => 
          count + hunk.changes.filter(change => 
            change.type === 'add' || change.type === 'remove'
          ).length, 0)
      };
    });
  }

  /**
   * 从变更块中提取新增的代码行
   * @param {Array} hunks - 变更块列表
   * @returns {Array} 新增的代码行
   */
  static extractAddedLines(hunks) {
    const addedLines = [];
    
    hunks.forEach(hunk => {
      hunk.changes.forEach(change => {
        if (change.type === 'add') {
          addedLines.push({
            content: change.content,
            lineNumber: change.lineNumber,
            hunkStartLine: hunk.newStart
          });
        }
      });
    });
    
    return addedLines;
  }

  /**
   * 从变更块中提取删除的代码行
   * @param {Array} hunks - 变更块列表
   * @returns {Array} 删除的代码行
   */
  static extractRemovedLines(hunks) {
    const removedLines = [];
    
    hunks.forEach(hunk => {
      hunk.changes.forEach(change => {
        if (change.type === 'remove') {
          removedLines.push({
            content: change.content,
            lineNumber: change.lineNumber,
            hunkStartLine: hunk.originalStart
          });
        }
      });
    });
    
    return removedLines;
  }

  /**
   * 生成变更摘要
   * @param {Array} changedFiles - 变更文件列表
   * @returns {Object} 变更摘要
   */
  static generateChangeSummary(changedFiles) {
    const summary = {
      totalFiles: changedFiles.length,
      totalChanges: 0,
      addedLines: 0,
      removedLines: 0,
      modifiedFiles: [],
      fileTypeChanges: {}
    };

    changedFiles.forEach(file => {
      const addedCount = file.addedLines ? file.addedLines.length : 0;
      const removedCount = file.removedLines ? file.removedLines.length : 0;
      
      summary.totalChanges += addedCount + removedCount;
      summary.addedLines += addedCount;
      summary.removedLines += removedCount;
      
      if (addedCount > 0 || removedCount > 0) {
        summary.modifiedFiles.push({
          filename: file.filename,
          status: file.status,
          changes: addedCount + removedCount
        });
      }
      
      // 按文件类型统计
      const fileType = file.filename.split('.').pop() || 'unknown';
      if (!summary.fileTypeChanges[fileType]) {
        summary.fileTypeChanges[fileType] = { added: 0, removed: 0, count: 0 };
      }
      summary.fileTypeChanges[fileType].added += addedCount;
      summary.fileTypeChanges[fileType].removed += removedCount;
      summary.fileTypeChanges[fileType].count++;
    });
    
    return summary;
  }

  /**
   * 格式化显示变更内容
   * @param {Array} changedFiles - 变更文件列表
   * @returns {string} 格式化的变更内容
   */
  static formatChanges(changedFiles) {
    let output = '';
    
    changedFiles.forEach(file => {
      output += `文件: ${file.filename} (${file.status})\n`;
      output += '='.repeat(50) + '\n';
      
      if (file.detailedChanges && file.detailedChanges.length > 0) {
        file.detailedChanges.forEach(hunk => {
          output += `@@ -${hunk.originalStart},${hunk.originalLength} +${hunk.newStart},${hunk.newLength} @@\n`;
          
          hunk.changes.forEach(change => {
            const prefix = change.type === 'add' ? '+' : change.type === 'remove' ? '-' : ' ';
            output += `${prefix}${change.content}\n`;
          });
          
          output += '\n';
        });
      } else if (file.addedLines && file.addedLines.length > 0) {
        output += '新增行:\n';
        file.addedLines.forEach(line => {
          output += `+${line.content}\n`;
        });
        output += '\n';
      }
      
      output += '\n';
    });
    
    return output;
  }

  /**
   * 查找包含特定关键词的变更
   * @param {Array} changedFiles - 变更文件列表
   * @param {string} keyword - 搜索关键词
   * @returns {Array} 包含关键词的变更
   */
  static findChangesWithKeyword(changedFiles, keyword) {
    const results = [];
    
    changedFiles.forEach(file => {
      const matchingChanges = [];
      
      if (file.detailedChanges) {
        file.detailedChanges.forEach(hunk => {
          hunk.changes.forEach(change => {
            if (change.content.includes(keyword)) {
              matchingChanges.push({
                ...change,
                hunkStartLine: hunk.newStart || hunk.originalStart
              });
            }
          });
        });
      }
      
      if (matchingChanges.length > 0) {
        results.push({
          filename: file.filename,
          changes: matchingChanges
        });
      }
    });
    
    return results;
  }
}

module.exports = CodeDiffParser;