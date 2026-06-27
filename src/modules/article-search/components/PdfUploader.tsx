import { useRef, useState } from 'react';

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

  const handleMainChange = (file: File | null) => {
    setMainFile(file);
    if (file && !disabled) {
      onUpload(file, suppFile);
    }
  };

  const handleSuppChange = (file: File | null) => {
    setSuppFile(file);
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
        {mainFile ? (
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
        {suppFile ? (
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
    </div>
  );
}
