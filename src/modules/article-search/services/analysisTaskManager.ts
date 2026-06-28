import type { ArticleExtraction } from '../../shared/types';
import { extractPdf } from './extractionService';
import { saveArticleExtraction } from './articleHistoryService';

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
}

type Subscriber = () => void;

// ---- Manager ----

class AnalysisTaskManager {
  private tasks = new Map<string, AnalysisTask>();
  private subscribers = new Set<Subscriber>();

  /** 启动新任务（自动去重：同 doi+uniprot 已有 running 任务则复用） */
  startTask(
    metadata: TaskMetadata,
    mainPdf: File,
    suppPdf?: File | null,
  ): string {
    // 去重
    for (const existing of this.tasks.values()) {
      if (
        existing.status === 'running' &&
        existing.metadata.doi === metadata.doi &&
        existing.metadata.uniprot === metadata.uniprot
      ) {
        return existing.id;
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
    mainPdf: File,
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
        },
      );

      if (task.controller.signal.aborted) return;

      task.extraction = result;
      task.status = 'completed';
      task.completedAt = Date.now();

      // 自动保存到 localStorage
      const { doi, pdb, uniprot, proteinName, gene, paperTitle } = task.metadata;
      if (doi && uniprot) {
        saveArticleExtraction({
          id: task.id,
          doi,
          pdbId: pdb,
          uniprot,
          proteinName,
          gene,
          title: paperTitle || doi || pdb || uniprot,
          extraction: result,
          timestamp: Date.now(),
        });
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
