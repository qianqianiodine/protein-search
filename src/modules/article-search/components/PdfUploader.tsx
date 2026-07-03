import { useRef, useState, useEffect } from 'react';
import { savePendingPdf, loadPendingPdf } from '../services/pdfFileCache';

interface PdfUploaderProps {
  onUpload: (mainPdf: File | null, suppPdf?: File | null) => void;
  disabled?: boolean;
}

export function PdfUploader({ onUpload, disabled }: PdfUploaderProps) {
  const mainRef = useRef<HTMLInputElement>(null);
  const suppRef = useRef<HTMLInputElement>(null);
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [suppFile, setSuppFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState<'main' | 'supp' | null>(null);
  const [restored, setRestored] = useState(false);

  // 页面刷新后恢复缓存的文件
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [main, supp] = await Promise.all([
        loadPendingPdf('main-pdf'),
        loadPendingPdf('supp-pdf'),
      ]);
      if (cancelled) return;
      if (main) setMainFile(main);
      if (supp) setSuppFile(supp);
      setRestored(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleMainChange = (file: File | null) => {
    setMainFile(file);
    if (file) {
      savePendingPdf('main-pdf', file);
    }
  };

  const handleSuppChange = (file: File | null) => {
    setSuppFile(file);
    if (file) {
      savePendingPdf('supp-pdf', file);
    }
  };

  const handleRemoveMain = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMainFile(null);
    if (mainRef.current) mainRef.current.value = '';
  };

  const handleRemoveSupp = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSuppFile(null);
    if (suppRef.current) suppRef.current.value = '';
  };

  const handleSubmit = () => {
    if ((mainFile || suppFile) && !disabled) {
      onUpload(mainFile, suppFile);
    }
  };

  const isAllowedFile = (file: File) =>
    /\.(pdf|doc|docx)$/i.test(file.name);

  const buildDropHandler = (target: 'main' | 'supp') => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(target);
    },
    onDragLeave: () => setDragOver(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(null);
      const file = e.dataTransfer.files[0];
      if (file && isAllowedFile(file)) {
        if (target === 'main') handleMainChange(file);
        else handleSuppChange(file);
      }
    },
  });

  const zoneBase: React.CSSProperties = {
    border: '2px dashed var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-xl)',
    textAlign: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'border-color 0.2s',
    marginBottom: 'var(--space-md)',
  };

  const label: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-text-secondary)',
    marginBottom: 'var(--space-sm)',
    fontWeight: 600,
  };

  const hasFile = !!(mainFile || suppFile);
  const submitBtn: React.CSSProperties = {
    marginTop: 'var(--space-lg)',
    padding: 'calc(var(--space-md) * 0.7) calc(var(--space-2xl) * 0.8)',
    fontSize: 'var(--text-base)',
    fontWeight: 600,
    color: '#fff',
    background: hasFile && !disabled ? 'var(--color-primary)' : 'var(--color-text-muted)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: hasFile && !disabled ? 'pointer' : 'not-allowed',
    width: '100%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1.2,
  };

  const removeBtn: React.CSSProperties = {
    marginLeft: 8,
    cursor: 'pointer',
    color: 'var(--color-text-muted)',
    fontSize: '14px',
    fontWeight: 700,
    lineHeight: 1,
    padding: '0 4px',
    border: 'none',
    background: 'none',
  };

  return (
    <div>
      {/* 正文文件 */}
      <div style={label}>正文文件（可选）</div>
      <div
        style={{
          ...zoneBase,
          borderColor: dragOver === 'main' ? 'var(--color-primary)' : 'var(--color-border)',
          opacity: disabled ? 0.5 : 1,
        }}
        {...buildDropHandler('main')}
        onClick={() => mainRef.current?.click()}
      >
        {!restored ? (
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            恢复中...
          </span>
        ) : mainFile ? (
          <span style={{ color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}>
            📄 {mainFile.name} ({(mainFile.size / 1024 / 1024).toFixed(1)} MB)
            <button style={removeBtn} onClick={handleRemoveMain} title="移除文件">✕</button>
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            拖拽 PDF 或 Word 文档到此处或点击选择
          </span>
        )}
        <input
          ref={mainRef}
          type="file"
          accept="application/pdf,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: 'none' }}
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && isAllowedFile(file)) handleMainChange(file);
          }}
        />
      </div>

      {/* 补充材料文件 */}
      <div style={label}>补充材料文件（可选）</div>
      <div
        style={{
          ...zoneBase,
          borderColor: dragOver === 'supp' ? 'var(--color-primary)' : 'var(--color-border)',
          opacity: disabled ? 0.5 : 1,
        }}
        {...buildDropHandler('supp')}
        onClick={() => suppRef.current?.click()}
      >
        {!restored ? (
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            恢复中...
          </span>
        ) : suppFile ? (
          <span style={{ color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}>
            📎 {suppFile.name} ({(suppFile.size / 1024 / 1024).toFixed(1)} MB)
            <button style={removeBtn} onClick={handleRemoveSupp} title="移除文件">✕</button>
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            如有补充材料，拖拽或点击选择
          </span>
        )}
        <input
          ref={suppRef}
          type="file"
          accept="application/pdf,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: 'none' }}
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && isAllowedFile(file)) handleSuppChange(file);
          }}
        />
      </div>

      {/* 提交按钮 */}
      <button
        style={submitBtn}
        disabled={!hasFile || disabled}
        onClick={handleSubmit}
      >
        {disabled ? '提取中...' : '提交分析'}
      </button>
    </div>
  );
}
