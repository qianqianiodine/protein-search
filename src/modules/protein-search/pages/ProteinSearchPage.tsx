import { useState } from 'react';

/**
 * Protein Search 主页面
 * Phase 0: 占位骨架，切片 1-3 逐步填充
 */
export function ProteinSearchPage() {
  const [query, setQuery] = useState('');

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' }}>
          Protein Structure Search
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
          检索 UniProt 蛋白，查看 RCSB PDB 晶体结构，识别配体类型
        </p>
      </header>

      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}>
        <input
          type="text"
          placeholder="搜索蛋白名称、基因或 UniProt accession..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            fontSize: '1rem',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            outline: 'none',
          }}
        />
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
          功能开发中 — 切片 1/2/3 将逐步实现搜索、配体分类、历史记录
        </p>
      </div>
    </div>
  );
}
