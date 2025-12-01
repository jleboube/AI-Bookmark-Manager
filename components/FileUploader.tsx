import React, { useCallback, useState } from 'react';
import { UploadIcon } from './icons';

interface FileUploaderProps {
  onFileLoaded: (content: string) => void;
}

export function FileUploader({ onFileLoaded }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onFileLoaded(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'text/html') {
      const reader = new FileReader();
      reader.onload = (event) => {
        onFileLoaded(event.target?.result as string);
      };
      reader.readAsText(file);
    } else {
      alert('Please drop a valid HTML file.');
    }
  }, [onFileLoaded]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center text-center p-4">
      <div className="max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-white mb-2">AI Bookmark Organizer</h1>
        <p className="text-lg text-slate-400 mb-8">
          Get started by uploading your bookmarks file exported from your browser.
        </p>
        
        <div 
            className={`relative border-2 border-dashed border-slate-600 rounded-lg p-12 transition-colors duration-300 flex flex-col justify-center ${isDragging ? 'bg-slate-700 border-indigo-500' : 'bg-slate-800/30'}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
        >
            <div className="flex flex-col items-center justify-center space-y-4 h-full">
                <UploadIcon className="w-16 h-16 text-slate-500"/>
                <h2 className="text-2xl font-semibold text-white mb-2">Upload Your Bookmarks</h2>
                <p className="text-slate-400">
                    <span className="font-semibold text-indigo-400">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-slate-500">HTML file exported from Chrome, Firefox, or Safari</p>
                <input
                    type="file"
                    id="file-upload"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept=".html"
                    onChange={handleFileChange}
                />
            </div>
        </div>
        
        <div className="text-left text-sm text-slate-500 mt-8 p-4 bg-slate-800/50 rounded-lg max-w-md mx-auto">
            <h3 className="font-semibold text-slate-300 mb-2">How to export bookmarks from Chrome:</h3>
            <ol className="list-decimal list-inside space-y-1">
                <li>Open Chrome and click the three-dots menu in the top-right corner.</li>
                <li>Go to <span className="font-mono bg-slate-700 px-1 rounded">Bookmarks</span> &rarr; <span className="font-mono bg-slate-700 px-1 rounded">Bookmark Manager</span>.</li>
                <li>In the Bookmark Manager, click the three-dots menu on the top blue bar.</li>
                <li>Select <span className="font-mono bg-slate-700 px-1 rounded">Export bookmarks</span> and save the HTML file.</li>
            </ol>
        </div>
      </div>
    </div>
  );
}