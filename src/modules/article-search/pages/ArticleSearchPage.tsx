import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { taskController } from '../services/articleSearchTaskController';

export function ArticleSearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const doi = searchParams.get('doi') || '-';
  const pdb = searchParams.get('pdb') || '-';
  const uniprot = searchParams.get('uniprot') || '-';

  useEffect(() => {
    return () => { taskController.cancelAll(); };
  }, []);

  const handleBack = () => {
    taskController.cancelAll();
    navigate('/');
  };

  const page = { maxWidth: 800, margin: '0 auto', padding: 'var(--space-2xl)' };
  const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)', marginBottom: 'var(--space-xl)' };
  const btn = { padding: 'var(--space-md) var(--space-xl)', fontSize: 'var(--text-base)', fontWeight: 500, color: '#fff', background: 'var(--color-primary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' };

  return (
    <div style={page}>
      <header style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
          Article Analysis
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, fontSize: 'var(--text-sm)' }}>
          纯化与结晶分析功能待开发
        </p>
      </header>

      <div style={card}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 'var(--space-lg)' }}>参数</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {[
              ['DOI', doi],
              ['PDB ID', pdb],
              ['UniProt', uniprot],
            ].map(([label, value]) => (
              <tr key={label}>
                <td style={{ padding: 'var(--space-sm) 0', color: 'var(--color-text-secondary)', width: 120, fontSize: 'var(--text-sm)' }}>
                  {label}
                </td>
                <td style={{ padding: 'var(--space-sm) 0', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={handleBack} style={btn}>
        ← 返回搜索结果
      </button>
    </div>
  );
}
