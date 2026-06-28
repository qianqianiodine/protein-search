import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  analysisTaskManager,
  type AnalysisTask,
} from '../../article-search/services/analysisTaskManager';
import { previewText } from '../utils/markdown';

// ---- styles ----

const container: React.CSSProperties = {
  position: 'fixed',
  bottom: 20,
  right: 20,
  zIndex: 10000,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  maxWidth: '50vw',
  pointerEvents: 'none',
};

const card: React.CSSProperties = {
  background: '#e8f5e9',
  border: '1px solid #a5d6a7',
  borderRadius: 8,
  padding: '12px 16px',
  cursor: 'pointer',
  pointerEvents: 'auto',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  fontSize: 'var(--text-sm)',
  color: '#2e7d32',
  lineHeight: 1.5,
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  transition: 'box-shadow 0.15s, transform 0.15s',
  maxWidth: '50vw',
};

// ---- component ----

export function NotificationStack() {
  const [completedTasks, setCompletedTasks] = useState<AnalysisTask[]>(() =>
    analysisTaskManager.getCompletedTasks(),
  );
  const navigate = useNavigate();

  useEffect(() => {
    return analysisTaskManager.subscribe(() => {
      setCompletedTasks(analysisTaskManager.getCompletedTasks());
    });
  }, []);

  const handleClick = useCallback(
    (task: AnalysisTask) => {
      const { doi, pdb, uniprot, proteinName, gene, paperTitle } = task.metadata;
      const params = new URLSearchParams();
      if (doi) params.set('doi', doi);
      if (pdb) params.set('pdb', pdb);
      if (uniprot) params.set('uniprot', uniprot);
      if (proteinName) params.set('proteinName', proteinName);
      if (gene) params.set('gene', gene);
      if (paperTitle) params.set('title', paperTitle);
      analysisTaskManager.dismissTask(task.id);
      navigate(`/article-search?${params.toString()}`);
    },
    [navigate],
  );

  if (completedTasks.length === 0) return null;

  return (
    <div style={container}>
      {completedTasks.map((task) => (
        <div
          key={task.id}
          style={card}
          onClick={() => handleClick(task)}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
            (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
            (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
          }}
        >
          <span style={{ flexShrink: 0, fontWeight: 600, fontSize: '1.1em' }}>✓</span>
          <span>
            {task.extraction
              ? previewText(task.extraction.construct)
              : '分析完成'}
          </span>
        </div>
      ))}
    </div>
  );
}
