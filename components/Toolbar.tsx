import React, { useRef } from 'react';
import { ExportIcon, DuplicateIcon, MagicIcon, LogoIcon, UploadIcon, ExitIcon, ChartIcon, TrashIcon, SearchIcon, FolderXIcon, LinkBrokenIcon, WrenchScrewdriverIcon, ChevronDownIcon } from './icons';
import { useAppContext } from '../AppContext';
import { exportBookmarks } from '../services/bookmarkExporter';
import { DropdownMenu } from './DropdownMenu';
import { DropdownMenuItem } from './DropdownMenuItem';

export function Toolbar() {
  const { state, dispatch, actions } = useAppContext();
  const { appMode, duplicates, filteredState, searchQuery, bookmarks, emptyFolders, healthAuditReport, isAIQuotaExceeded, selectedIssues } = state;
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const handleNewUploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => actions.parseFile(event.target?.result as string);
      reader.readAsText(file);
    }
    e.target.value = ''; 
  };
  
  const handleExport = () => {
    if (!bookmarks) return;
    const html = exportBookmarks(bookmarks);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bookmarks_organized.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResolveAllKeepOldest = () => {
    const idsToRemove = new Set<string>();
    duplicates.forEach(group => {
        group.items.slice(1).forEach(item => idsToRemove.add(item.bookmark.id));
    });
    const totalToRemove = idsToRemove.size;
    dispatch({ type: 'SHOW_CONFIRMATION', payload: {
      title: "Confirm Bulk Deletion",
      message: `This will remove all newer copies for ${duplicates.length} duplicate sets. A total of ${totalToRemove} bookmarks will be deleted. This action cannot be undone.`,
      onConfirm: () => dispatch({ type: 'RESOLVE_ALL_DUPLICATES', payload: idsToRemove })
    }});
  };
  
  const handleDeleteFiltered = () => {
    if (!filteredState || filteredState.bookmarks.length === 0) return;
    dispatch({ type: 'SHOW_CONFIRMATION', payload: {
      title: "Confirm Deletion",
      message: `Are you sure you want to delete all ${filteredState.bookmarks.length} bookmarks in this filtered view? This action cannot be undone.`,
      onConfirm: () => dispatch({ type: 'DELETE_FILTERED_BOOKMARKS' })
    }});
  };

  const handleDeleteEmptyFolders = () => {
    if (emptyFolders.length === 0) return;
    dispatch({ type: 'SHOW_CONFIRMATION', payload: {
        title: "Confirm Deletion",
        message: `Are you sure you want to delete all ${emptyFolders.length} empty folders? This action cannot be undone.`,
        onConfirm: () => dispatch({ type: 'DELETE_EMPTY_FOLDERS' })
    }});
  };

  const handleDeleteSelectedIssues = () => {
    if (!healthAuditReport || selectedIssues.size === 0) return;
    dispatch({ type: 'SHOW_CONFIRMATION', payload: {
        title: "Confirm Deletion",
        message: `Are you sure you want to delete the ${selectedIssues.size} selected bookmarks with health issues? This action cannot be undone.`,
        onConfirm: () => dispatch({ type: 'DELETE_SELECTED_ISSUES' })
    }});
  };
  
  const handleExitMode = () => {
      if (appMode === 'filtered' && !searchQuery) {
          dispatch({ type: 'SET_APP_MODE', payload: 'insights' });
      } else {
          dispatch({ type: 'SET_APP_MODE', payload: 'normal' });
      }
  };

  const getTitle = () => {
    switch (appMode) {
      case 'duplicates': return 'Duplicate Manager';
      case 'insights': return state.analysisResults?.folderTitle ? `Insights: ${state.analysisResults.folderTitle}` : 'Global Insights';
      case 'filtered': return filteredState?.title || 'Filtered View';
      case 'emptyFolders': return 'Empty Folder Manager';
      case 'healthAudit': return 'Bookmark Health Audit Report';
      case 'fixItAll': return 'Complete Organization Proposal';
      default: return 'AI Bookmark Organizer';
    }
  };
  
  const currentTitle = getTitle();
  React.useEffect(() => {
    const el = titleRef.current;
    if (el) {
        el.classList.remove('animate-title-change');
        void el.offsetWidth; // Trigger reflow
        el.classList.add('animate-title-change');
    }
  }, [currentTitle]);

  return (
    <header className="flex-shrink-0 bg-slate-900/70 backdrop-blur-sm border-b border-slate-700 p-3 flex items-center justify-between z-10">
       <input type="file" ref={uploadInputRef} className="hidden" accept=".html" onChange={handleNewUploadFileChange} />

      <div className="flex items-center space-x-3 overflow-hidden">
        <LogoIcon className="w-8 h-8 text-indigo-400 flex-shrink-0"/>
        <h1 ref={titleRef} className="text-xl font-bold text-white truncate">
          {currentTitle}
        </h1>
      </div>

      <div className="flex items-center space-x-2">
        {appMode === 'normal' && (
          <>
            <div className="relative">
                <SearchIcon className="w-5 h-5 text-slate-500 absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none" />
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
                    className="pl-10 pr-4 py-2 text-sm w-40 bg-slate-800 text-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all focus:w-64"
                />
            </div>
            <button onClick={() => uploadInputRef.current?.click()} className="px-3 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md flex items-center space-x-2 transition-colors">
              <UploadIcon className="w-4 h-4"/> <span>Upload</span>
            </button>
            
            <div className="h-6 w-px bg-slate-700 mx-1"></div>

             <div className="relative" title={isAIQuotaExceeded ? 'Daily AI quota exceeded.' : 'Fix Everything (Dedupe, Clean, Organize)'}>
              <button 
                onClick={actions.generateFixItAllProposal} 
                className="px-3 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-md flex items-center space-x-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isAIQuotaExceeded}
              >
                <MagicIcon className="w-4 h-4"/> <span>Fix It All</span>
              </button>
            </div>

            <div className="h-6 w-px bg-slate-700 mx-1"></div>

            <DropdownMenu trigger={
                <button className="px-3 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md flex items-center space-x-2 transition-colors">
                    <WrenchScrewdriverIcon className="w-4 h-4"/> 
                    <span>Utilities</span>
                    <ChevronDownIcon className="w-4 h-4 ml-1" />
                </button>
            }>
                <DropdownMenuItem icon={<DuplicateIcon />} onClick={actions.findAndSetDuplicates}>
                    Find Duplicates
                </DropdownMenuItem>
                <DropdownMenuItem icon={<LinkBrokenIcon />} onClick={actions.runBookmarkHealthAudit}>
                    Health Audit
                </DropdownMenuItem>
                <DropdownMenuItem icon={<FolderXIcon />} onClick={actions.findAndSetEmptyFolders}>
                    Find Empty Folders
                </DropdownMenuItem>
                <DropdownMenuItem icon={<ChartIcon />} onClick={() => actions.analyzeAndShowInsights()}>
                    Global Insights
                </DropdownMenuItem>
                <div className="border-t border-slate-700 my-1"></div>
                 <DropdownMenuItem icon={<MagicIcon />} onClick={actions.handleAutoCategorize}>
                    Categorize Only
                </DropdownMenuItem>
            </DropdownMenu>

            <button onClick={handleExport} className="px-3 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md flex items-center space-x-2 transition-colors">
              <ExportIcon className="w-4 h-4"/> <span>Export</span>
            </button>
          </>
        )}
        {appMode === 'duplicates' && (
           <>
              <button onClick={handleResolveAllKeepOldest} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md flex items-center space-x-2 transition-colors">
                <DuplicateIcon className="w-4 h-4"/>
                <span>Resolve All (Keep Oldest)</span>
              </button>
              <button onClick={() => dispatch({ type: 'SET_APP_MODE', payload: 'normal' })} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md flex items-center space-x-2 transition-colors">
                <ExitIcon className="w-4 h-4"/>
                <span>Exit View</span>
              </button>
          </>
        )}
        {appMode === 'emptyFolders' && (
           <>
              <button onClick={handleDeleteEmptyFolders} className="px-4 py-2 text-sm font-semibold text-white bg-red-600/80 hover:bg-red-600 rounded-md flex items-center space-x-2 transition-colors">
                <TrashIcon className="w-4 h-4"/>
                <span>Delete All Empty Folders</span>
              </button>
              <button onClick={() => dispatch({ type: 'SET_APP_MODE', payload: 'normal' })} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md flex items-center space-x-2 transition-colors">
                <ExitIcon className="w-4 h-4"/>
                <span>Exit View</span>
              </button>
          </>
        )}
        {appMode === 'healthAudit' && (
           <>
              <button 
                onClick={handleDeleteSelectedIssues} 
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600/80 hover:bg-red-600 rounded-md flex items-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={selectedIssues.size === 0}
              >
                <TrashIcon className="w-4 h-4"/>
                <span>Delete Selected ({selectedIssues.size})</span>
              </button>
              <button onClick={() => dispatch({ type: 'SET_APP_MODE', payload: 'normal' })} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md flex items-center space-x-2 transition-colors">
                <ExitIcon className="w-4 h-4"/>
                <span>Exit View</span>
              </button>
          </>
        )}
         {(appMode === 'insights' || appMode === 'filtered') && (
           <>
              {appMode === 'filtered' && (
                  <button onClick={handleDeleteFiltered} className="px-4 py-2 text-sm font-semibold text-white bg-red-600/80 hover:bg-red-600 rounded-md flex items-center space-x-2 transition-colors">
                    <TrashIcon className="w-4 h-4"/>
                    <span>Delete All Shown</span>
                  </button>
              )}
              <button onClick={handleExitMode} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md flex items-center space-x-2 transition-colors">
                <ExitIcon className="w-4 h-4"/>
                <span>{appMode === 'filtered' && !searchQuery ? 'Back to Insights' : 'Exit View'}</span>
              </button>
          </>
        )}
      </div>
    </header>
  );
}