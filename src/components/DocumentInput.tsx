"use client";
import { useState, useRef, useCallback } from "react";
import { 
  DocumentArrowUpIcon, 
  DocumentTextIcon,
  XMarkIcon 
} from "@heroicons/react/24/outline";

interface Props {
  text: string;
  onTextChange: (text: string) => void;
  disabled?: boolean;
}

export default function DocumentInput({ text, onTextChange, disabled }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process file");
      }

      onTextChange(data.text);
      setFileName(data.fileName);
    } catch (e: any) {
      setError(e.message);
      console.error("File processing error:", e);
    } finally {
      setIsProcessing(false);
    }
  }, [onTextChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const clearFile = useCallback(() => {
    setFileName(null);
    onTextChange("");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onTextChange]);

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const charCount = text.length;

  return (
    <div className="space-y-4">
      {/* File Upload Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center transition-all
          ${isDragging 
            ? "border-indigo-500 bg-indigo-50" 
            : "border-gray-300 hover:border-indigo-300 bg-gray-50"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.pdf,.docx,.html,.htm"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        
        {isProcessing ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-gray-600">Processing file...</span>
          </div>
        ) : fileName ? (
          <div className="flex items-center justify-center gap-2">
            <DocumentTextIcon className="w-6 h-6 text-indigo-600" />
            <span className="font-medium text-gray-700">{fileName}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              className="p-1 hover:bg-gray-200 rounded-full"
            >
              <XMarkIcon className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        ) : (
          <>
            <DocumentArrowUpIcon className="w-10 h-10 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PDF, DOCX, TXT, MD, or HTML
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Text Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200"></div>
        <span className="text-xs text-gray-400 uppercase tracking-wide">or paste text</span>
        <div className="flex-1 h-px bg-gray-200"></div>
      </div>

      {/* Text Area */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => {
            onTextChange(e.target.value);
            setFileName(null);
          }}
          disabled={disabled}
          placeholder="Paste your text here to have it read aloud..."
          className={`
            w-full h-64 p-4 border border-gray-200 rounded-xl resize-none
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
            placeholder-gray-400 text-gray-700
            ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"}
          `}
        />
        
        {text && (
          <div className="absolute bottom-3 right-3 flex items-center gap-3 text-xs text-gray-400">
            <span>{wordCount.toLocaleString()} words</span>
            <span>•</span>
            <span>{charCount.toLocaleString()} chars</span>
          </div>
        )}
      </div>
    </div>
  );
}
