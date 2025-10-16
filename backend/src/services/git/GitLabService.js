const axios = require('axios')

module.exports = class GitLabChangesService {
  constructor(token) {
    this.token = token
    this.apiBaseUrl = process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4'
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }

  /**
   * 设置GitLab实例URL
   * @param {string} baseUrl - GitLab实例基础URL
   */
  setInstanceUrl(baseUrl) {
    this.apiBaseUrl = baseUrl.replace(/\/$/, '') + '/api/v4'
  }

  /**
   * 解析GitLab仓库URL获取项目ID
   * @param {string} repoUrl - GitLab仓库URL
   * @returns {string} 项目ID (URL编码)
   */
  parseRepoUrl(repoUrl) {
    // 移除协议部分
    let path = repoUrl.replace(/^https?:\/\/[^\/]+/, '')
    
    // 移除.git后缀
    path = path.replace(/\.git$/, '')
    
    // 移除开头的斜杠
    path = path.replace(/^\//, '')
    
    if (!path) {
      throw new Error('Invalid GitLab repository URL')
    }
    
    // GitLab API需要URL编码的项目路径
    return encodeURIComponent(path)
  }

  /**
   * 获取指定时间范围内的提交
   * @param {string} projectId - 项目ID
   * @param {string} since - 开始时间 (ISO 8601格式)
   * @param {string} until - 结束时间 (ISO 8601格式)
   * @returns {Array} 提交列表
   */
  async getCommits(projectId, since, until) {
    try {
      const params = new URLSearchParams({
        since: since,
        until: until,
        per_page: 100,
        page: 1
      })
      
      const commits = []
      let hasNextPage = true
      
      while (hasNextPage) {
        const response = await axios.get(
          `${this.apiBaseUrl}/projects/${projectId}/repository/commits?${params.toString()}`,
          { headers: this.headers }
        )
        
        commits.push(...response.data)
        
        // 检查是否有下一页
        const nextPage = response.headers['x-next-page']
        if (nextPage && nextPage !== '') {
          params.set('page', nextPage)
        } else {
          hasNextPage = false
        }
      }
      
      return commits
    } catch (error) {
      if (error.response) {
        throw new Error(`GitLab API error: ${error.response.status} - ${error.response.data.message}`)
      }
      throw new Error(`Failed to fetch commits: ${error.message}`)
    }
  }

  /**
   * 获取提交的详细变更信息
   * @param {string} projectId - 项目ID
   * @param {string} commitSha - 提交SHA
   * @returns {Object} 提交的变更详情
   */
  async getCommitDetails(projectId, commitSha) {
    try {
      const commitResponse = await axios.get(
        `${this.apiBaseUrl}/projects/${projectId}/repository/commits/${commitSha}`,
        { headers: this.headers }
      )
      
      // 获取提交的变更文件
      const diffResponse = await axios.get(
        `${this.apiBaseUrl}/projects/${projectId}/repository/commits/${commitSha}/diff`,
        { headers: this.headers }
      )
      
      return {
        ...commitResponse.data,
        diffs: diffResponse.data
      }
    } catch (error) {
      if (error.response) {
        throw new Error(`GitLab API error: ${error.response.status} - ${error.response.data.message}`)
      }
      throw new Error(`Failed to fetch commit details: ${error.message}`)
    }
  }

  /**
   * 获取指定时间范围内的变更文件
   * @param {string} repoUrl - 仓库URL
   * @param {string} since - 开始时间 (ISO 8601格式)
   * @param {string} until - 结束时间 (ISO 8601格式)
   * @returns {Array} 变更文件详情列表
   */
  async getChangedFiles(repoUrl, since, until) {
    try {
      const projectId = this.parseRepoUrl(repoUrl)
      
      // 获取时间范围内的提交
      const commits = await this.getCommits(projectId, since, until)
      
      if (commits.length === 0) {
        return []
      }
      
      const changedFiles = new Map()
      
      // 获取每个提交的变更详情
      for (const commit of commits) {
        const commitDetails = await this.getCommitDetails(projectId, commit.id)
        
        if (commitDetails.diffs) {
          commitDetails.diffs.forEach(diff => {
            const filePath = diff.new_path || diff.old_path
            
            // 如果文件已存在，合并变更状态
            if (changedFiles.has(filePath)) {
              const existingFile = changedFiles.get(filePath)
              // 累加变更行数
              existingFile.additions += diff.added_lines || 0
              existingFile.deletions += diff.removed_lines || 0
            } else {
              changedFiles.set(filePath, {
                filename: filePath,
                old_path: diff.old_path,
                new_path: diff.new_path,
                status: this.determineFileStatus(diff),
                additions: diff.added_lines || 0,
                deletions: diff.removed_lines || 0,
                changes: (diff.added_lines || 0) + (diff.removed_lines || 0),
                diff: diff.diff
              })
            }
          })
        }
      }
      
      // 转换为数组并返回
      return Array.from(changedFiles.values())
    } catch (error) {
      throw new Error(`Failed to get changed files: ${error.message}`)
    }
  }

  /**
   * 确定文件变更状态
   * @param {Object} diff - 差异对象
   * @returns {string} 变更状态
   */
  determineFileStatus(diff) {
    if (diff.new_file) return 'added'
    if (diff.deleted_file) return 'removed'
    if (diff.renamed_file) return 'renamed'
    return 'modified'
  }

  /**
   * 获取文件内容
   * @param {string} projectId - 项目ID
   * @param {string} filePath - 文件路径
   * @param {string} ref - 分支、标签或提交SHA (可选)
   * @returns {string} 文件内容
   */
  async getFileContent(projectId, filePath, ref = 'main') {
    try {
      const params = new URLSearchParams({
        ref: ref
      })
      
      const response = await axios.get(
        `${this.apiBaseUrl}/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}?${params.toString()}`,
        { headers: this.headers }
      )
      
      // GitLab API返回base64编码的内容
      return Buffer.from(response.data.content, 'base64').toString('utf-8')
    } catch (error) {
      if (error.response) {
        if (error.response.status === 404) {
          throw new Error(`File not found: ${filePath}`)
        }
        throw new Error(`GitLab API error: ${error.response.status} - ${error.response.data.message}`)
      }
      throw new Error(`Failed to fetch file content: ${error.message}`)
    }
  }

  /**
   * 获取文件在特定提交时的内容
   * @param {string} projectId - 项目ID
   * @param {string} filePath - 文件路径
   * @param {string} commitSha - 提交SHA
   * @returns {string} 文件内容
   */
  async getFileContentAtCommit(projectId, filePath, commitSha) {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`,
        {
          headers: this.headers,
          params: { ref: commitSha }
        }
      )
      
      // GitLab API返回base64编码的内容
      return Buffer.from(response.data.content, 'base64').toString('utf-8')
    } catch (error) {
      if (error.response) {
        if (error.response.status === 404) {
          throw new Error(`File not found: ${filePath} at commit ${commitSha}`)
        }
        throw new Error(`GitLab API error: ${error.response.status} - ${error.response.data.message}`)
      }
      throw new Error(`Failed to fetch file content at commit: ${error.message}`)
    }
  }
}