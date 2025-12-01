import React, { useMemo, useEffect, useState } from 'react';
import { BookmarkNode } from './types';
import { useAppContext } from './AppContext';

import { FileUploader } from './components/FileUploader';
import { Toolbar } from './components/Toolbar';
import { LoadingOverlay } from './components/LoadingOverlay';
import { BookmarkTreeView } from './components/BookmarkTreeView';
import { BookmarkListView } from './components/BookmarkListView';
import { DuplicateManagerView } from './components/DuplicateManagerView';
import { InsightsView } from './components/InsightsView';
import { EmptyFolderManagerView } from './components/EmptyFolderManagerView';
import { HealthAuditReportView } from './components/HealthAuditReportView';
import { FixItAllView } from './components/FixItAllView';
import { BugIcon } from './components/icons';
import { ConfirmationModal } from './components/ConfirmationModal';
import { flattenBookmarks, findNodeById } from './utils/bookmarkUtils';

export default function App() {
  const { state, dispatch, actions } = useAppContext();
  const { 
    bookmarks, appMode, loadingState, confirmation, stats, 
    activeFolderId, duplicates, analysisResults, 
    filteredState, emptyFolders, isDebugVisible, searchQuery,
    healthAuditReport, proposedBookmarks
  } = state;

  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // Effect to handle searching
  useEffect(() => {
    actions.performSearch(searchQuery);
  }, [searchQuery, actions, state.bookmarks]); // Added state.bookmarks to re-run search on data change

  // Effect to handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarVisible(false);
      } else {
        setIsSidebarVisible(true);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeFolder = useMemo(() => {
    if (!bookmarks || !activeFolderId) return null;
    if (activeFolderId === 'root') {
      const allBookmarks = flattenBookmarks(bookmarks);
      return { id: 'root', type: 'folder', title: 'All Bookmarks', children: allBookmarks };
    }
    return findNodeById(bookmarks, activeFolderId) as BookmarkNode | null;
  }, [bookmarks, activeFolderId]);

  const renderMainView = () => {
    switch(appMode) {
      case 'duplicates':
        return <DuplicateManagerView duplicates={duplicates} />;
      case 'insights':
        return analysisResults ? <InsightsView results={analysisResults.results} /> : null;
      case 'emptyFolders':
        return <EmptyFolderManagerView folders={emptyFolders} />;
      case 'healthAudit':
        return healthAuditReport ? <HealthAuditReportView report={healthAuditReport} /> : null;
      case 'fixItAll':
        return proposedBookmarks ? <FixItAllView proposedBookmarks={proposedBookmarks} /> : null;
      case 'filtered':
        return filteredState ? <BookmarkListView bookmarks={filteredState.bookmarks} title={filteredState.title} /> : null;
      case 'normal':
      default:
        return activeFolder?.type === 'folder' ? <BookmarkListView bookmarks={activeFolder.children} title={activeFolder.title} /> : null;
    }
  };

  if (appMode === 'welcome') {
    return (
      <>
        <LoadingOverlay {...loadingState} />
        <FileUploader onFileLoaded={actions.parseFile} />
        {confirmation && <ConfirmationModal {...confirmation} onCancel={() => dispatch({type: 'HIDE_CONFIRMATION'})} />}
      </>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--color-bg-primary)] text-slate-200 font-sans">
      <LoadingOverlay {...loadingState} />
      {confirmation && <ConfirmationModal {...confirmation} onCancel={() => dispatch({type: 'HIDE_CONFIRMATION'})} />}

      <Toolbar />
      
      <div className="flex-grow flex overflow-hidden">
        {appMode !== 'fixItAll' && (
            <aside 
                className="flex-shrink-0 bg-slate-900/70 p-4 flex flex-col overflow-y-auto transition-all duration-300"
                style={{ width: `var(--sidebar-width)` }}
            >
            {stats && (
                <div className="mb-4 flex-shrink-0 p-3 bg-slate-800 rounded-lg border border-slate-700">
                <h2 className="text-sm font-semibold text-slate-400 mb-2">Statistics</h2>
                <div className="flex justify-between text-sm">
                    <span>Total Bookmarks:</span>
                    <span className="font-medium text-white">{stats.bookmarkCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span>Total Folders:</span>
                    <span className="font-medium text-white">{stats.folderCount.toLocaleString()}</span>
                </div>
                </div>
            )}
            <div className="flex-grow overflow-y-auto">
                <BookmarkTreeView 
                nodes={bookmarks || []} 
                />
            </div>
            </aside>
        )}
        
        <main className={`flex-grow p-6 overflow-y-auto animate-fade-in ${appMode === 'fixItAll' ? 'w-full' : ''}`}>
          {renderMainView()}
        </main>
      </div>

      <div className="fixed bottom-4 right-4 z-50">
        <button onClick={() => dispatch({ type: 'TOGGLE_DEBUG' })} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full p-3 shadow-lg transition-transform hover:scale-110">
            <BugIcon className="w-6 h-6" />
        </button>
        {isDebugVisible && (
            <div className="absolute bottom-16 right-0 w-80 bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono shadow-xl animate-fade-in-up">
                <h3 className="font-bold text-sm mb-2">Debug Info</h3>
                <p><span className="text-slate-400 w-32 inline-block">Mode:</span> <span className="text-white">{appMode}</span></p>
                <p><span className="text-slate-400 w-32 inline-block">AI Quota Exceeded:</span> <span className="text-white">{String(state.isAIQuotaExceeded)}</span></p>
                <p><span className="text-slate-400 w-32 inline-block">Bookmarks:</span> <span className="text-white">{stats?.bookmarkCount.toLocaleString() ?? 'N/A'}</span></p>
                <p><span className="text-slate-400 w-32 inline-block">Folders:</span> <span className="text-white">{stats?.folderCount.toLocaleString() ?? 'N/A'}</span></p>
                <p><span className="text-slate-400 w-32 inline-block">Duplicate Sets:</span> <span className="text-white">{duplicates.length}</span></p>
                <p><span className="text-slate-400 w-32 inline-block">Filtered Items:</span> <span className="text-white">{filteredState?.bookmarks.length.toLocaleString() ?? 'N/A'}</span></p>
                <p><span className="text-slate-400 w-32 inline-block">Empty Folders:</span> <span className="text-white">{emptyFolders.length}</span></p>
                <p><span className="text-slate-400 w-32 inline-block">Health Issues:</span> <span className="text-white">{healthAuditReport?.issues.length ?? 'N/A'}</span></p>
            </div>
        )}
      </div>
    </div>
  );
}