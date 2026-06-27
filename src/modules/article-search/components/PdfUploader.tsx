import { useRef, useState, useEffect } from 'react';
import { savePendingPdf, loadPendingPdf } from '../services/pdfFileCache';

interface PdfUploaderProps {
  onUpload: (mainPdf: File, suppPdf?: File | null) => void;
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

  const handleSubmit = () => {
    if (mainFile && !disabled) {
      onUpload(mainFile, suppFile);
    }
  };

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
      if (file?.type === 'application/pdf') {
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

  const submitBtn: React.CSSProperties = {
    marginTop: 'var(--space-lg)',
    padding: 'var(--space-md) var(--space-2xl)',
    fontSize: 'var(--text-base)',
    fontWeight: 600,
    color: '#fff',
    background: mainFile && !disabled ? 'var(--color-primary)' : 'var(--color-text-muted)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: mainFile && !disabled ? 'pointer' : 'not-allowed',
    width: '100%',
  };

  return (
    <div>
      {/* 正文 PDF */}
      <div style={label}>正文 PDF（必须）</div>
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
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            拖拽 PDF 到此处或点击选择
          </span>
        )}
        <input
          ref={mainRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleMainChange(file);
          }}
        />
      </div>

      {/* 补充材料 PDF */}
      <div style={label}>补充材料 PDF（可选）</div>
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
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            如有补充材料，拖拽或点击选择
          </span>
        )}
        <input
          ref={suppRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleSuppChange(file);
          }}
        />
      </div>

      {/* 提交按钮 */}
      <button
        style={submitBtn}
        disabled={!mainFile || disabled}
        onClick={handleSubmit}
      >
        {disabled ? '提取中...' : '🚀 提交分析'}
      </button>
    </div>
  );
}
