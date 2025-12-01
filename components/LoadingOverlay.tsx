

import React from 'react';
import { SpinnerIcon } from './icons';

interface LoadingOverlayProps {
  isLoading: boolean;
  message: string;
  details?: React.ReactNode;
}

export function LoadingOverlay({ isLoading, message, details }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 transition-opacity duration-300 animate-fade-in">
      <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-8 shadow-2xl min-w-[320px] md:min-w-[480px] text-center">
        <div className="flex items-center justify-center space-x-4">
          { !message.includes('✓') && <SpinnerIcon className="w-10 h-10 text-indigo-400" /> }
          <span className="text-xl font-medium text-white">{message}</span>
        </div>
        {details && (
          <div className="mt-4 text-slate-300 w-full">
            {details}
          </div>
        )}
      </div>
    </div>
  );
}