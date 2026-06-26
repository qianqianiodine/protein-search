import { useEffect, useRef, useState } from 'react';
import styles from './SearchBar.module.css';

const SPECIES = [
  { label: 'Human', taxId: 9606 },
  { label: 'Mouse', taxId: 10090 },
] as const;

interface SearchBarProps {
  onSearch: (query: string, taxId: number) => void;
  disabled?: boolean;
}

export function SearchBar({ onSearch, disabled }: SearchBarProps) {
  const [input, setInput] = useState('');
  const [taxId, setTaxId] = useState<number>(9606);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hasFiredImmediately = useRef(false);

  const handleInput = (value: string) => {
    setInput(value);
    const trimmed = value.trim();

    if (trimmed.length < 2) {
      clearTimeout(timerRef.current);
      hasFiredImmediately.current = false;
      return;
    }

    // Leading edge: fire immediately on first qualifying input
    if (!hasFiredImmediately.current) {
      hasFiredImmediately.current = true;
      clearTimeout(timerRef.current);
      onSearch(trimmed, taxId);
      return;
    }

    // Trailing edge: debounce subsequent changes
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearch(trimmed, taxId);
    }, 400);
  };

  const handleSpeciesChange = (newTaxId: number) => {
    setTaxId(newTaxId);
    if (input.trim().length >= 2) {
      clearTimeout(timerRef.current);
      hasFiredImmediately.current = true;
      onSearch(input.trim(), newTaxId);
    }
  };

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputWrap}>
        <input
          type="text"
          className={styles.input}
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="搜索蛋白名称、基因或 UniProt accession..."
          disabled={disabled}
        />
      </div>
      <select
        className={styles.select}
        value={taxId}
        onChange={(e) => handleSpeciesChange(Number(e.target.value))}
      >
        {SPECIES.map((s) => (
          <option key={s.taxId} value={s.taxId}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}
