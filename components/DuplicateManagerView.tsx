import React, { useState, useEffect } from 'react';
import { BookmarkIcon, TrashIcon, MagicIcon, SpinnerIcon, CheckCircleIcon, XCircleIcon, RefreshCwIcon } from './icons';
import { useAppContext } from '../AppContext';
import { DuplicateSet } from '../types';

interface DuplicateManagerViewProps {
  duplicates: DuplicateSet[];
}

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return 'N/A';
  const date = new Date(parseInt(timestamp) * 1000);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
}

type LinkHealth = 'unknown' | 'loading' | 'ok' | 'dead';

export function DuplicateManagerView({ duplicates }: DuplicateManagerViewProps) {
  const { dispatch } = useAppContext();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [linkHealth, setLinkHealth] = useState<Record<string, LinkHealth>>({});
  const [isScanning, setIsScanning] = useState(false);

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectGroup = (items: { bookmark: { id: string } }[], shouldSelect: boolean) => {
      const newSelected = new Set(selectedIds);
      items.forEach(item => {
          if (shouldSelect) newSelected.add(item.bookmark.id);
          else newSelected.delete(item.bookmark.id);
      });
      setSelectedIds(newSelected);
  };
  
  const performSmartScan = async () => {
    setIsScanning(true);
    const newHealth: Record<string, LinkHealth> = {};
    const newSelections = new Set(selectedIds);

    // 1. Identify unique URLs
    const uniqueUrls = new Set(duplicates.map(d => d.url));
    const urlsArray = Array.from(uniqueUrls);
    const BATCH_SIZE = 10;
    
    // Check links in batches
    for (let i = 0; i < urlsArray.length; i += BATCH_SIZE) {
        const batch = urlsArray.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (url) => {
            try {
                // Using no-cors 'HEAD' just to check if server exists/accepts connection
                await fetch(url, { method: 'HEAD', mode: 'no-cors' });
                newHealth[url] = 'ok'; 
            } catch (e) {
                newHealth[url] = 'dead';
            }
        }));
        setLinkHealth(prev => ({ ...prev, ...newHealth }));
    }

    // 2. Recommendation Logic
    duplicates.forEach(group => {
        const urlHealth = newHealth[group.url];
        
        if (urlHealth === 'dead') {
            // Recommendation: Delete ALL copies if link is dead
            group.items.forEach(item => newSelections.add(item.bookmark.id));
        } else {
            // Recommendation: Keep the "Best" one
            // Scoring System:
            // - Newer is better (+timestamp)
            // - Root/Bar is better (shorter path length usually means better organization)
            
            const sorted = [...group.items].sort((a, b) => {
                // Prefer shorter paths (closer to root/bar)
                const pathA = (a.path || '').split('/').length;
                const pathB = (b.path || '').split('/').length;
                if (pathA !== pathB) return pathA - pathB;
                
                // Then prefer newer
                return parseInt(b.bookmark.addDate || '0') - parseInt(a.bookmark.addDate || '0');
            });

            // Keep the first one (Best Score), Delete the rest
            const bestId = sorted[0].bookmark.id;
            
            // Ensure best ID is NOT selected
            newSelections.delete(bestId);
            
            // Select all others
            sorted.slice(1).forEach(item => newSelections.add(item.bookmark.id));
        }
    });

    setSelectedIds(newSelections);
    setIsScanning(false);
  };

  const handleResolveSelected = () => {
      if (selectedIds.size === 0) return;
      dispatch({ type: 'SHOW_CONFIRMATION', payload: {
        title: "Confirm Deletion",
        message: `Are you sure you want to delete ${selectedIds.size} selected bookmark(s)? This action cannot be undone.`,
        onConfirm: () => dispatch({ type: 'RESOLVE_ALL_DUPLICATES', payload: selectedIds })
      }});
  };

  if (duplicates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center py-16">
        <BookmarkIcon className="w-16 h-16 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">No More Duplicates</h2>
        <p>All duplicate bookmarks have been resolved!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-fade-in relative">
        {/* Header Control Panel */}
      <div className="border-b border-slate-700 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4 sticky top-0 bg-slate-900/95 z-20 backdrop-blur-sm pt-2">
        <div>
            <h2 className="text-2xl font-bold text-white">
            {duplicates.length} {duplicates.length === 1 ? 'Duplicate Set' : 'Duplicate Sets'} Found
            </h2>
            <p className="text-slate-400 text-sm mt-1">
                Found {duplicates.reduce((acc, g) => acc + g.items.length, 0)} total bookmarks sharing {duplicates.length} unique URLs.
            </p>
        </div>
        
        <button 
            onClick={performSmartScan}
            disabled={isScanning}
            className={`px-4 py-2.5 text-sm font-semibold text-white rounded-md flex items-center space-x-2 transition-all shadow-lg ${isScanning ? 'bg-indigo-600/50 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105'}`}
        >
            {isScanning ? <SpinnerIcon className="w-5 h-5 text-indigo-200" /> : <MagicIcon className="w-5 h-5 text-indigo-200" />}
            <span>{isScanning ? 'Scanning Links...' : 'Smart Scan & Auto-Select'}</span>
        </button>
      </div>

      <div className="space-y-6">
        {duplicates.map((group) => {
            const status = linkHealth[group.url] || 'unknown';
            const allSelected = group.items.every(item => selectedIds.has(item.bookmark.id));

            return (
                <div key={group.url} className={`p-4 rounded-lg border transition-colors duration-300 ${status === 'dead' ? 'bg-red-900/10 border-red-900/30' : 'bg-slate-900/50 border-slate-700'}`}>
                {/* Group Header */}
                <div className="flex items-start justify-between border-b border-slate-700/50 pb-3 mb-3">
                    <div className="overflow-hidden pr-4">
                        <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-semibold text-slate-200">{group.items.length} Copies</span>
                            {status === 'loading' && <SpinnerIcon className="w-3 h-3 text-indigo-400" />}
                            {status === 'ok' && <span className="flex items-center text-xs text-green-400 bg-green-900/20 px-1.5 py-0.5 rounded border border-green-900/30"><CheckCircleIcon className="w-3 h-3 mr-1" /> Active</span>}
                            {status === 'dead' && <span className="flex items-center text-xs text-red-400 bg-red-900/20 px-1.5 py-0.5 rounded border border-red-900/30"><XCircleIcon className="w-3 h-3 mr-1" /> Broken</span>}
                        </div>
                        <a href={group.url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs md:text-sm text-indigo-400 hover:underline break-all block">{group.url}</a>
                        {status === 'dead' && <p className="text-xs text-red-400 mt-1">Recommendation: Delete all copies (Link unreachable).</p>}
                    </div>
                    <div className="flex-shrink-0 flex items-center space-x-2">
                        <button 
                            onClick={() => handleSelectGroup(group.items, !allSelected)}
                            className="text-xs font-medium text-slate-400 hover:text-white px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                        >
                            {allSelected ? 'Unselect All' : 'Select All'}
                        </button>
                    </div>
                </div>

                {/* Bookmark List */}
                <div className="space-y-2">
                    {group.items.map(({ bookmark, path }) => {
                        const isSelected = selectedIds.has(bookmark.id);
                        return (
                            <label 
                                key={bookmark.id} 
                                className={`flex items-center p-3 rounded-md border cursor-pointer transition-all duration-200 group ${
                                    isSelected 
                                    ? 'bg-red-900/10 border-red-500/30' 
                                    : 'bg-slate-800 border-transparent hover:bg-slate-750 hover:border-slate-600'
                                }`}
                            >
                                <div className="flex items-center h-full mr-4">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 rounded border-slate-600 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900 bg-slate-700 transition-colors"
                                        checked={isSelected}
                                        onChange={() => handleToggleSelect(bookmark.id)}
                                    />
                                </div>
                                
                                <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                    <div className="overflow-hidden">
                                        <div className={`font-medium truncate transition-colors ${isSelected ? 'text-slate-400 line-through decoration-slate-600' : 'text-white'}`}>
                                            {bookmark.title}
                                        </div>
                                        <div className={`text-xs truncate flex items-center mt-0.5 ${isSelected ? 'text-slate-500' : 'text-indigo-300'}`}>
                                            {path || 'Bookmarks Bar'}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end text-right">
                                        <span className={`text-xs ${isSelected ? 'text-slate-500' : 'text-slate-400'}`}>
                                            Added: {formatTimestamp(bookmark.addDate)}
                                        </span>
                                        { !isSelected && status !== 'dead' && (
                                            <span className="ml-2 px-2 py-0.5 bg-green-900/30 text-green-400 text-[10px] font-bold uppercase rounded border border-green-800 tracking-wide">
                                                Keep
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </label>
                        );
                    })}
                </div>
                </div>
            );
        })}
      </div>

      {/* Floating Action Bar */}
      <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-30 transition-all duration-300 ${selectedIds.size > 0 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
          <div className="bg-slate-800 border border-slate-600 rounded-full shadow-2xl p-2 pl-6 pr-2 flex items-center space-x-6">
              <span className="text-sm font-medium text-white">
                  <span className="text-red-400 font-bold">{selectedIds.size}</span> selected for deletion
              </span>
              <button 
                onClick={handleResolveSelected}
                className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-full font-bold text-sm shadow-md transition-transform active:scale-95 flex items-center"
              >
                  <TrashIcon className="w-4 h-4 mr-2" />
                  Delete Selected
              </button>
          </div>
      </div>
    </div>
  );
}