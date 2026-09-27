import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Link2, Upload } from 'lucide-react';
import { useToast } from './Toast';
import { compressImageFile, describeDataUrlSize, validateImageFile } from '../utils/imageHelpers';

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  /** أقصى بُعد (بكسل) تُضغط إليه الصورة قبل الحفظ */
  maxDimension?: number;
  previewShape?: 'circle' | 'square';
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label,
  value,
  onChange,
  hint,
  maxDimension = 256,
  previewShape = 'square',
}) => {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setPreviewFailed(false);
  }, [value]);

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsProcessing(true);
    try {
      const finalUrl = await compressImageFile(file, maxDimension);
      onChange(finalUrl);
      toast.success(`تم تجهيز الصورة (${describeDataUrlSize(finalUrl)}).`);
    } catch {
      toast.error('تعذر قراءة الصورة، جرّب ملفاً آخر.');
    } finally {
      setIsProcessing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const shapeClass = previewShape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-bold text-slate-700">{label}:</label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[11px] font-bold text-red-500 hover:underline"
          >
            إزالة الصورة
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`shrink-0 w-16 h-16 ${shapeClass} border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${
            isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50'
          }`}
        >
          {value && !previewFailed ? (
            <img
              src={value}
              alt="معاينة الصورة"
              onError={() => setPreviewFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImagePlus className="w-5 h-5 text-slate-400" />
          )}
        </div>

        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => inputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white shadow-sm flex items-center gap-1.5"
            >
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>{isProcessing ? 'جاري معالجة الصورة...' : 'رفع صورة من الجهاز'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowUrlInput((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 transition-colors ${
                showUrlInput
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>رابط خارجي</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            {hint || 'اختر صورة من جهازك أو اسحبها وأفلتها في المربع — تُضغط الصورة تلقائياً قبل الحفظ.'}
          </p>
        </div>
      </div>

      {showUrlInput && (
        <input
          type="text"
          dir="ltr"
          value={value.startsWith('data:') ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={value.startsWith('data:') ? 'الصورة الحالية مرفوعة من الجهاز — الصق رابطاً لاستبدالها' : 'https://...'}
          className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono text-left"
        />
      )}
    </div>
  );
};
