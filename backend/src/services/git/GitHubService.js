const axios = require('axios')

module.exports = class GitHubChangesService {
  constructor(token) {
    this.token = token
    this.apiBaseUrl = 'https://api.github.com'
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CodeReview-App'
    }
  }

  /**
   * 解析GitHub仓库URL获取owner和repo
   * @param {string} repoUrl - GitHub仓库URL
   * @returns {Object} 包含owner和repo的对象
   */
  parseRepoUrl(repoUrl) {
    // 处理HTTPS URL: https://github.com/owner/repo
    let match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/)
    if (match) {
      return {
        owner: match[1],
        repo: match[2]
      }
    }
    
    // 处理SSH URL: git@github.com:owner/repo.git
    match = repoUrl.match(/git@github\.com:([^\/]+)\/([^\/\.]+)/)
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, '') // 移除.git后缀
      }
    }
    
    throw new Error('Invalid GitHub repository URL')
  }

  /**
   * 获取指定时间范围内的提交
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名称
   * @param {string} since - 开始时间 (ISO 8601格式)
   * @param {string} until - 结束时间 (ISO 8601格式)
   * @returns {Array} 提交列表
   */
  async getCommits(owner, repo, since, until) {
    try {
      const params = new URLSearchParams({
        since: since,
        until: until,
        per_page: 100,  // 每页最大数量
        page: 1
      })
      
      const commits = []
      let hasNextPage = true
      
      while (hasNextPage) {
        const response = await axios.get(
          `${this.apiBaseUrl}/repos/${owner}/${repo}/commits?${params.toString()}`,
          { headers: this.headers }
        )
        
        commits.push(...response.data)
        
        // 检查是否有下一页
        const linkHeader = response.headers.link
        if (linkHeader && linkHeader.includes('rel="next"')) {
          // 提取下一页URL
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
          if (nextMatch) {
            const nextUrl = new URL(nextMatch[1])
            params.set('page', nextUrl.searchParams.get('page'))
          } else {
            hasNextPage = false
          }
        } else {
          hasNextPage = false
        }
      }
      
      return commits
    } catch (error) {
      if (error.response) {
        throw new Error(`GitHub API error: ${error.response.status} - ${error.response.data.message}`)
      }
      throw new Error(`Failed to fetch commits: ${error.message}`)
    }
  }

  /**
   * 获取提交的详细变更信息
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名称
   * @param {string} commitSha - 提交SHA
   * @returns {Object} 提交的变更详情
   */
  async getCommitDetails(owner, repo, commitSha) {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/repos/${owner}/${repo}/commits/${commitSha}`,
        { headers: this.headers }
      )
      
      return response.data
    } catch (error) {
      if (error.response) {
        throw new Error(`GitHub API error: ${error.response.status} - ${error.response.data.message}`)
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
      const { owner, repo } = this.parseRepoUrl(repoUrl)
      
      // 获取时间范围内的提交
      const commits = await this.getCommits(owner, repo, since, until)
      
      if (commits.length === 0) {
        return []
      }
      
      const changedFiles = new Map()
      
      // 获取每个提交的变更详情
      for (const commit of commits) {
        const commitDetails = await this.getCommitDetails(owner, repo, commit.sha)
        
        if (commitDetails.files) {
          commitDetails.files.forEach(file => {
            // 如果文件已存在，合并变更状态
            if (changedFiles.has(file.filename)) {
              const existingFile = changedFiles.get(file.filename)
              // 累加变更行数
              existingFile.additions += file.additions
              existingFile.deletions += file.deletions
              existingFile.changes += file.changes
            } else {
              changedFiles.set(file.filename, { ...file })
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
   * 获取文件内容
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名称
   * @param {string} filePath - 文件路径
   * @param {string} ref - 分支、标签或提交SHA (可选)
   * @returns {string} 文件内容
   */
  async getFileContent(owner, repo, filePath, ref = 'HEAD') {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/repos/${owner}/${repo}/contents/${filePath}`,
        {
          headers: this.headers,
          params: { ref }
        }
      )
      
      // GitHub API返回base64编码的内容
      return Buffer.from(response.data.content, 'base64').toString('utf-8')
    } catch (error) {
      if (error.response) {
        if (error.response.status === 404) {
          throw new Error(`File not found: ${filePath}`)
        }
        throw new Error(`GitHub API error: ${error.response.status} - ${error.response.data.message}`)
      }
      throw new Error(`Failed to fetch file content: ${error.message}`)
    }
  }

  /**
   * 获取文件在特定提交时的内容
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名称
   * @param {string} filePath - 文件路径
   * @param {string} commitSha - 提交SHA
   * @returns {string} 文件内容
   */
  async getFileContentAtCommit(owner, repo, filePath, commitSha) {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/repos/${owner}/${repo}/contents/${filePath}`,
        {
          headers: this.headers,
          params: { ref: commitSha }
        }
      )
      
      // GitHub API返回base64编码的内容
      return Buffer.from(response.data.content, 'base64').toString('utf-8')
    } catch (error) {
      if (error.response) {
        if (error.response.status === 404) {
          throw new Error(`File not found: ${filePath} at commit ${commitSha}`)
        }
        throw new Error(`GitHub API error: ${error.response.status} - ${error.response.data.message}`)
      }
      throw new Error(`Failed to fetch file content at commit: ${error.message}`)
    }
  }
}