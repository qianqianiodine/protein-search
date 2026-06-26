/**
 * 统一的任务取消控制器
 * 管理 article-search 模块的所有进行中请求
 */
class ArticleSearchTaskController {
  private controllers: Set<AbortController> = new Set();

  /** 注册一个新的 AbortController */
  register(): AbortController {
    const controller = new AbortController();
    this.controllers.add(controller);
    return controller;
  }

  /** 取消所有进行中的任务 */
  cancelAll(): void {
    for (const c of this.controllers) {
      c.abort();
    }
    this.controllers.clear();
  }

  /** 移除一个已完成的任务 */
  remove(controller: AbortController): void {
    this.controllers.delete(controller);
  }

  /** 是否有进行中的任务 */
  get hasActive(): boolean {
    return this.controllers.size > 0;
  }
}

/** 全局单例 */
export const taskController = new ArticleSearchTaskController();
