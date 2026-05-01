"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Eye, Trash2, UploadCloud } from "lucide-react";
import { PDFDocument } from "pdf-lib";

export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  previewUrl: string;
  pages: number;
  colorMode: 'bw' | 'color';
  copies: number;
}

interface UploadManagerProps {
  onContinue: (files: UploadedFile[], totalPages: number, totalCost: number, deliveryLocation: string) => void;
}

export default function UploadManager({ onContinue }: UploadManagerProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (newFiles: File[]) => {
    setIsProcessing(true);
    const pdfFiles = newFiles.filter(f => f.type === "application/pdf");
    
    const processed: UploadedFile[] = [];
    
    for (const file of pdfFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pageCount = pdfDoc.getPageCount();
        const previewUrl = URL.createObjectURL(file);
        
        processed.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          name: file.name,
          pages: pageCount,
          previewUrl,
          colorMode: 'bw',
          copies: 1
        });
      } catch (err) {
        console.error("Error parsing PDF", err);
        // Fallback if parsing fails
        processed.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          name: file.name,
          pages: 1,
          previewUrl: URL.createObjectURL(file),
          colorMode: 'bw',
          copies: 1
        });
      }
    }
    
    setFiles(prev => [...prev, ...processed]);
    setIsProcessing(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const setColorMode = (id: string, mode: 'bw' | 'color') => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, colorMode: mode } : f));
  };

  const setCopies = (id: string, copies: number) => {
    const validCopies = Math.max(1, Math.min(100, copies));
    setFiles(prev => prev.map(f => f.id === id ? { ...f, copies: validCopies } : f));
  };

  const openPreview = (url: string) => {
    window.open(url, '_blank');
  };

  const totalPages = files.reduce((acc, curr) => acc + (curr.pages * curr.copies), 0);
  const totalCost = files.reduce((acc, curr) => acc + (curr.pages * curr.copies * (curr.colorMode === 'bw' ? 2 : 5)), 0);

  return (
    <div className="w-full space-y-6">
      <div 
        className={`w-full h-48 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
          isDragging ? "border-[#8ab4f8] bg-[#8ab4f8]/10" : "border-[#5f6368] bg-[#292a2d] hover:bg-[#303134]"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud size={32} className={isDragging ? "text-[#8ab4f8]" : "text-[#9aa0a6]"} />
        <p className="text-[#e8eaed] font-medium text-lg mt-3">Drop your PDFs here</p>
        <p className="text-[#9aa0a6] text-sm mt-1">or click to browse files</p>
        <input 
          type="file" 
          accept="application/pdf" 
          multiple 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileChange}
        />
      </div>

      {isProcessing && (
        <div className="text-[#8ab4f8] text-sm flex items-center justify-center gap-2">
           <div className="w-4 h-4 border-2 border-[#8ab4f8]/30 border-t-[#8ab4f8] rounded-full animate-spin" />
           Processing PDFs...
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence>
            {files.map(file => (
              <motion.div 
                layout
                key={file.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#292a2d] border border-[#3c4043] rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between group hover:border-[#5f6368] transition-colors gap-4 sm:gap-0"
              >
                <div className="flex items-center gap-4 overflow-hidden w-full sm:w-auto">
                  <div className="p-2 bg-[#202124] rounded text-[#ea4335]">
                    <FileText size={20} />
                  </div>
                  <div className="truncate">
                    <p className="text-[#e8eaed] font-medium truncate max-w-[200px] sm:max-w-[300px]">{file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[#81c995] text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#81c995]/10 border border-[#81c995]/20 shadow-[0_0_8px_rgba(129,201,149,0.2)]">
                        {file.pages} {file.pages === 1 ? 'Page' : 'Pages'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                  {/* Print Options */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-[#202124] rounded-md p-1 border border-[#3c4043]">
                      <button 
                        onClick={() => setColorMode(file.id, 'bw')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${file.colorMode === 'bw' ? 'bg-[#3c4043] text-white shadow-sm' : 'text-[#9aa0a6] hover:text-[#e8eaed]'}`}
                      >
                        B&W
                      </button>
                      <button 
                        onClick={() => setColorMode(file.id, 'color')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${file.colorMode === 'color' ? 'bg-[#3c4043] text-white shadow-sm' : 'text-[#9aa0a6] hover:text-[#e8eaed]'}`}
                      >
                        Color
                      </button>
                    </div>

                    <div className="flex items-center gap-2 bg-[#202124] rounded-md px-2 py-1 border border-[#3c4043]">
                      <span className="text-[#9aa0a6] text-xs font-medium">Copies:</span>
                      <input 
                        type="number" 
                        min="1" 
                        max="10" 
                        value={file.copies}
                        onChange={(e) => setCopies(file.id, parseInt(e.target.value) || 1)}
                        className="w-12 bg-transparent text-white text-xs outline-none text-center font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => openPreview(file.previewUrl)}
                      className="p-2 text-[#9aa0a6] hover:text-[#8ab4f8] hover:bg-[#202124] rounded transition-colors"
                      title="Preview PDF"
                    >
                      <Eye size={18} />
                    </button>
                    <button 
                      onClick={() => removeFile(file.id)}
                      className="p-2 text-[#9aa0a6] hover:text-[#ea4335] hover:bg-[#202124] rounded transition-colors"
                      title="Remove file"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="mt-6 mb-2">
            <label className="block text-sm font-medium text-[#9aa0a6] mb-2">Delivery Location (Inside Campus Only)</label>
            <input 
              type="text" 
              placeholder="e.g., Main Gate, Library, Hostel Block A..."
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
              className="w-full bg-[#202124] border border-[#3c4043] focus:border-[#8ab4f8] rounded-md px-4 py-3 outline-none text-[#e8eaed] transition-colors"
            />
          </div>

          <div className="sticky bottom-4 bg-[#202124] border border-[#3c4043] rounded-lg p-5 mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl z-10">
             <div className="flex items-center gap-8 w-full sm:w-auto">
               <div>
                 <p className="text-[#9aa0a6] text-xs uppercase tracking-wider font-medium mb-1">Total Volume</p>
                 <p className="text-2xl font-medium text-[#e8eaed] leading-none">{totalPages} <span className="text-sm text-[#9aa0a6] font-normal">Pages</span></p>
               </div>
               <div className="w-px h-10 bg-[#3c4043] hidden sm:block"></div>
               <div>
                 <p className="text-[#9aa0a6] text-xs uppercase tracking-wider font-medium mb-1">Total Base Cost</p>
                 <p className="text-2xl font-medium text-[#81c995] leading-none">₹{totalCost}</p>
               </div>
             </div>
             
             <button 
               onClick={() => {
                 if (!deliveryLocation.trim()) {
                   alert("Please provide a delivery location (inside campus only).");
                   return;
                 }
                 onContinue(files, totalPages, totalCost, deliveryLocation);
               }}
               className="w-full sm:w-auto bg-[#8ab4f8] text-[#202124] font-medium px-8 py-3 rounded hover:bg-[#aecbfa] transition-colors whitespace-nowrap"
             >
               Find Runner
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
