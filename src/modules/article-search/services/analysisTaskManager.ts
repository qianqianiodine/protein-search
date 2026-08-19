import type { ArticleExtraction } from '../../shared/types';
import { extractPdf } from './extractionService';
import { saveArticleExtraction } from './articleHistoryService';
import { updateSummaryExtraction } from './summaryStorage';

// ---- Types ----

export type TaskStatus = 'running' | 'completed' | 'failed';

export interface TaskMetadata {
  doi: string;
  pdb: string;
  uniprot: string;
  proteinName: string;
  gene: string;
  paperTitle: string;
}

export interface AnalysisTask {
  id: string;
  status: TaskStatus;
  metadata: TaskMetadata;
  extraction: ArticleExtraction | null;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
  controller: AbortController;
  textInput?: { text?: string; suppText?: string };
}

type Subscriber = () => void;

// ---- Manager ----

class AnalysisTaskManager {
  private tasks = new Map<string, AnalysisTask>();
  private subscribers = new Set<Subscriber>();

  /** 启动新任务（有 DOI 时自动去重；无 DOI 时不去重——不同论文可能同 uniprot，由页面 useEffect 负责重连） */
  startTask(
    metadata: TaskMetadata,
    mainPdf: File | null,
    suppPdf?: File | null,
    textInput?: { text?: string; suppText?: string },
  ): string {
    // 去重：仅当有 DOI 时（能唯一标识一篇论文），同 doi+uniprot 的 running 任务复用
    if (metadata.doi) {
      for (const existing of this.tasks.values()) {
        if (
          existing.status === 'running' &&
          existing.metadata.doi === metadata.doi &&
          existing.metadata.uniprot === metadata.uniprot
        ) {
          return existing.id;
        }
      }
    }

    const id = `${metadata.doi || metadata.pdb || 'no-doi'}-${metadata.uniprot || 'no-uniprot'}-${Date.now()}`;
    const controller = new AbortController();

    const task: AnalysisTask = {
      id,
      status: 'running',
      metadata,
      extraction: null,
      error: null,
      createdAt: Date.now(),
      completedAt: null,
      controller,
      textInput,
    };

    this.tasks.set(id, task);
    this.notify();
    this.executeTask(task, mainPdf, suppPdf);

    return id;
  }

  /** 取消任务 */
  cancelTask(id: string): void {
    const task = this.tasks.get(id);
    if (task && task.status === 'running') {
      task.controller.abort();
      this.tasks.delete(id);
      this.notify();
    }
  }

  /** 消除已完成的通知卡片 */
  dismissTask(id: string): void {
    this.tasks.delete(id);
    this.notify();
  }

  /** 按 id 获取任务 */
  getTask(id: string): AnalysisTask | undefined {
    return this.tasks.get(id);
  }

  /** 按 doi+uniprot 查找任务 */
  getTaskByMetadata(doi: string, uniprot: string): AnalysisTask | undefined {
    for (const task of this.tasks.values()) {
      if (task.metadata.doi === doi && task.metadata.uniprot === uniprot) {
        return task;
      }
    }
    return undefined;
  }

  /** 按 uniprot 查找任务（无 DOI 场景兜底），返回最新匹配 */
  findTaskByUniprot(uniprot: string): AnalysisTask | undefined {
    let best: AnalysisTask | undefined;
    for (const task of this.tasks.values()) {
      if (task.metadata.uniprot === uniprot) {
        if (!best || task.createdAt > best.createdAt) {
          best = task;
        }
      }
    }
    return best;
  }

  /** 获取所有已完成任务 */
  getCompletedTasks(): AnalysisTask[] {
    return [...this.tasks.values()].filter((t) => t.status === 'completed');
  }

  /** 订阅通知 */
  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => { this.subscribers.delete(fn); };
  }

  // ---- private ----

  private notify(): void {
    this.subscribers.forEach((fn) => fn());
  }

  private async executeTask(
    task: AnalysisTask,
    mainPdf: File | null,
    suppPdf?: File | null,
  ): Promise<void> {
    try {
      const result = await extractPdf(
        mainPdf,
        suppPdf,
        task.controller.signal,
        {
          doi: task.metadata.doi,
          pdb: task.metadata.pdb,
          uniprot: task.metadata.uniprot,
          paperTitle: task.metadata.paperTitle,
          gene: task.metadata.gene,
          proteinName: task.metadata.proteinName,
        },
        task.textInput,
      );

      if (task.controller.signal.aborted) return;

      task.extraction = result;
      task.status = 'completed';
      task.completedAt = Date.now();

      // 如果前端没传 paperTitle，用后端从 PDF 提取的标题兜底
      const effectiveTitle = task.metadata.paperTitle || result.paperTitle || '';
      if (effectiveTitle && !task.metadata.paperTitle) {
        task.metadata.paperTitle = effectiveTitle;
      }

      // 自动保存到 localStorage
      const { doi, pdb, uniprot, proteinName, gene } = task.metadata;
      if (uniprot) {
        saveArticleExtraction({
          id: task.id,
          doi,
          pdbId: pdb,
          uniprot,
          proteinName,
          gene,
          title: effectiveTitle || doi || pdb || uniprot,
          extraction: result,
          timestamp: Date.now(),
        });

        // 重新上传同一篇文献 → 汇总里对应的行刷新为新提取内容
        updateSummaryExtraction(
          { doi, uniprot, gene, title: effectiveTitle || '' },
          result,
        );
      }
    } catch (err: unknown) {
      if (task.controller.signal.aborted) return;
      task.status = 'failed';
      task.error = err instanceof Error ? err.message : 'Unknown error';
      task.completedAt = Date.now();
    } finally {
      this.notify();
    }
  }
}

export const analysisTaskManager = new AnalysisTaskManager();
