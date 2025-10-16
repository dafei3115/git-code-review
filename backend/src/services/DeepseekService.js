import axios from 'axios';
import { config } from '../config/config.js';
import { ReviewRulesService } from './review-rules.service.js';
import { ReviewResultsService } from './review-results.service.js';
import { CodeCacheService } from './code-cache.service.js';

export class DeepseekService {
  static async reviewCode(codeChange, projectId = 'default') {
    const { file, diff, commitHash } = codeChange;
    
    // 生成基础提示词
    const prompt = this.generateReviewPrompt(codeChange, projectId);
    
    // 生成规则哈希值用于缓存键
    const rulesHash = await ReviewRulesService.generateRulesHash(projectId);
    
    // 检查是否有缓存的审查结果
    const cachedReview = await CodeCacheService.getCachedReview(diff, file, rulesHash, projectId);
    if (cachedReview) {
      console.log(`Using cached review for ${file} (project: ${projectId})`);
      
      // 记录审查结果（即使是缓存的）
      if (commitHash) {
        ReviewResultsService.recordReview(file, commitHash, cachedReview, projectId);
      }
      
      return cachedReview;
    }
    
    try {
      // 确保API URL包含完整路径
      const apiUrl = config.DEEPSEEK_API_URL.endsWith('/') 
        ? config.DEEPSEEK_API_URL + 'v1/chat/completions'
        : config.DEEPSEEK_API_URL + '/v1/chat/completions';
        
      const response = await axios.post(apiUrl, {
        model: 'deepseek-coder',
        messages: [
          {
            role: 'system',
            content: '你是一个资深的代码审查专家，请分析以下代码并提供详细的审查意见，包括潜在的bug、性能问题、代码风格建议等。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.DEEPSEEK_API_KEY}`
        }
      });
      
      const reviewResult = response.data.choices[0].message.content;
      
      // 记录审查结果
      if (commitHash) {
        ReviewResultsService.recordReview(file, commitHash, reviewResult, projectId);
      }
      
      // 缓存审查结果
      await CodeCacheService.cacheReviewResult(diff, file, rulesHash, reviewResult, projectId);
      
      return reviewResult;
    } catch (error) {
      console.error('Deepseek API error:', error);
      throw new Error('Failed to review code with Deepseek API');
    }
  }
  
  static generateReviewPrompt(codeChange, projectId = 'default') {
    const { file, diff } = codeChange;
    
    // 使用ReviewRulesService生成包含自定义规则的增强提示词
    let prompt = ReviewRulesService.generateEnhancedPrompt(codeChange, projectId);
    
    // 生成并添加过滤提示词，用于排除不合理结果
    const filterPrompt = ReviewResultsService.generateFilterPrompt(file, diff, projectId);
    if (filterPrompt) {
      prompt += '\n' + filterPrompt;
    }
    
    return prompt;
  }
  
  /**
   * 添加对审查结果的反馈，标记不合理的部分
   * @param {string} reviewId 审查记录ID
   * @param {string} unreasonablePart 不合理的审查内容
   * @param {string} reason 不合理的原因
   * @param {string} feedback 用户反馈
   * @param {boolean} isUseful 审查结果是否有用
   * @param {string} projectId 项目ID
   */
  static addReviewFeedback(reviewId, unreasonablePart = null, reason = null, feedback = null, isUseful = true, projectId = null) {
    // 添加反馈
    if (feedback) {
      ReviewResultsService.addFeedback(reviewId, feedback, isUseful, projectId);
    }
    
    // 标记并排除不合理的部分
    if (unreasonablePart && reason) {
      ReviewResultsService.flagAndExcludeUnreasonablePart(reviewId, unreasonablePart, reason, projectId);
    }
  }
  
  /**
   * 学习历史审查结果
   * @param {string} projectId 项目ID
   */
  static learnFromHistory(projectId = null) {
    // 实现从历史审查结果中学习的逻辑
    ReviewResultsService.learnFromHistory(projectId);
  }
    
}