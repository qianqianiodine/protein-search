import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { taskController } from '../services/articleSearchTaskController';

/**
 * Article Search 页面
 * 当前占位 — 纯化与结晶分析功能待开发
 *
 * "返回搜索结果" 按钮行为（三合一）:
 * 1. cancelAllArticleSearchTasks() — 取消所有进行中任务
 * 2. restoreProteinSearchState() — 恢复表格/排序/筛选/滚动位置
 * 3. navigate('/') — 回到搜索结果
 *
 * 取消触发时机: 点击返回按钮 | 组件卸载 | 路由离开
 */
export function ArticleSearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const doi = searchParams.get('doi') || '-';
  const pdb = searchParams.get('pdb') || '-';
  const uniprot = searchParams.get('uniprot') || '-';

  // 组件卸载时取消所有任务
  useEffect(() => {
    return () => {
      taskController.cancelAll();
    };
  }, []);

  const handleBack = () => {
    // 1. 取消所有进行中任务
    taskController.cancelAll();
    // 2. 恢复状态已由 ProteinSearchPage 的 useEffect 读取 localStorage
    //    滚动位置恢复也在 ProteinSearchPage mount 时完成
    // 3. 回到搜索结果
    navigate('/');
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' }}>
          Article Analysis
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
          纯化与结晶分析功能待开发
        </p>
      </header>

      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>参数</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {[
              ['DOI', doi],
              ['PDB ID', pdb],
              ['UniProt', uniprot],
            ].map(([label, value]) => (
              <tr key={label}>
                <td style={{ padding: '0.5rem 0', color: 'var(--color-text-secondary)', width: 120 }}>
                  {label}
                </td>
                <td style={{ padding: '0.5rem 0', fontFamily: 'monospace' }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={handleBack}
        style={{
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          color: '#fff',
          background: 'var(--color-primary)',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        ← 返回搜索结果
      </button>
    </div>
  );
}
