import { useEffect, useRef, useState } from 'react';

/** 支持的物种 */
const SPECIES = [
  { label: 'Human', taxId: 9606 },
  { label: 'Mouse', taxId: 10090 },
] as const;

interface SearchBarProps {
  onSearch: (query: string, taxId: number) => void;
  disabled?: boolean;
}

/**
 * 搜索输入框 + 物种下拉 + 400ms 防抖
 */
export function SearchBar({ onSearch, disabled }: SearchBarProps) {
  const [input, setInput] = useState('');
  const [taxId, setTaxId] = useState<number>(9606);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleInput = (value: string) => {
    setInput(value);
    clearTimeout(timerRef.current);
    if (value.trim().length < 2) return;
    timerRef.current = setTimeout(() => {
      onSearch(value.trim(), taxId);
    }, 400);
  };

  // 物种切换时，如果 input 已有内容则立即重新搜索
  const handleSpeciesChange = (newTaxId: number) => {
    setTaxId(newTaxId);
    if (input.trim().length >= 2) {
      clearTimeout(timerRef.current);
      onSearch(input.trim(), newTaxId);
    }
  };

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="搜索蛋白名称、基因或 UniProt accession..."
          disabled={disabled}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            fontSize: '1rem',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            outline: 'none',
            background: disabled ? '#f3f4f6' : '#fff',
          }}
        />
      </div>

      <select
        value={taxId}
        onChange={(e) => handleSpeciesChange(Number(e.target.value))}
        style={{
          padding: '0.75rem 0.75rem',
          fontSize: '0.9rem',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          background: '#fff',
          cursor: 'pointer',
          minWidth: 100,
        }}
      >
        {SPECIES.map((s) => (
          <option key={s.taxId} value={s.taxId}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
