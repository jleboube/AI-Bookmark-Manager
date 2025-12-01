import React from 'react';
import { BookmarkNode, Bookmark } from '../types';
import { BookmarkIcon, TrashIcon, ChartIcon, ArchiveIcon } from './icons';
import { useAppContext } from '../AppContext';

interface BookmarkListViewProps {
  bookmarks: BookmarkNode[];
  title: string;
}

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return '';
  const date = new Date(parseInt(timestamp) * 1000);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const BookmarkItem: React.FC<{ bookmark: Bookmark }> = ({ bookmark }) => {
  const { actions } = useAppContext();
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${bookmark.url}&sz=32`;
  const addedDate = formatTimestamp(bookmark.addDate);
  const archiveUrl = `https://web.archive.org/web/*/${bookmark.url}`;

  return (
    <div className="flex flex-col p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors group">
        <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="flex items-start flex-grow">
            <img 
                src={faviconUrl} 
                alt="" 
                className="w-5 h-5 mr-4 mt-1 rounded-sm flex-shrink-0"
                onError={(e) => { 
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                }}
            />
            <div className="flex-grow overflow-hidden">
                <p className="font-medium text-slate-200 group-hover:text-indigo-400 truncate" title={bookmark.title}>{bookmark.title}</p>
                <p className="text-sm text-slate-500 truncate" title={bookmark.url}>{bookmark.url}</p>
            </div>
        </a>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/50">
           {addedDate ? <p className="text-xs text-slate-500">Added: {addedDate}</p> : <div />}
            <a 
                href={archiveUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                title="Search on Wayback Machine"
                onClick={(e) => e.stopPropagation()}
                className="text-slate-500 hover:text-indigo-400 transition-colors"
            >
                <ArchiveIcon className="w-4 h-4" />
            </a>
        </div>
    </div>
  );
};

export function BookmarkListView({ bookmarks, title }: BookmarkListViewProps) {
    const { state, dispatch, actions } = useAppContext();
    const { appMode, filteredState, activeFolderId } = state;
    const bookmarkItems = bookmarks.filter((b): b is Bookmark => b.type === 'bookmark');

    const handleDeleteFiltered = () => {
      if (!filteredState || filteredState.bookmarks.length === 0) return;
      dispatch({ type: 'SHOW_CONFIRMATION', payload: {
        title: "Confirm Deletion",
        message: `Are you sure you want to delete all ${filteredState.bookmarks.length} bookmarks in this filtered view? This action cannot be undone.`,
        onConfirm: () => dispatch({ type: 'DELETE_FILTERED_BOOKMARKS' })
      }});
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6 border-b border-slate-700 pb-2">
                <div className="flex items-center space-x-4">
                     <h2 className="text-2xl font-bold text-white truncate pr-4">{title}</h2>
                     {appMode === 'normal' && activeFolderId && activeFolderId !== 'root' && (
                        <button onClick={() => actions.analyzeAndShowInsights(activeFolderId)} className="px-3 py-1 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md flex items-center space-x-2 transition-colors">
                            <ChartIcon className="w-4 h-4"/> <span>Analyze This Folder</span>
                        </button>
                    )}
                </div>
                <span className="flex-shrink-0 text-sm font-medium text-slate-400 bg-slate-700/50 px-3 py-1 rounded-full">
                    {bookmarkItems.length} {bookmarkItems.length === 1 ? 'bookmark' : 'bookmarks'}
                </span>
            </div>
            
            {(appMode === 'filtered' && filteredState) && (
                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 mb-6 flex items-center justify-between animate-fade-in">
                    <p className="text-sm text-slate-300">
                        Showing <span className="font-bold text-white">{filteredState.bookmarks.length.toLocaleString()}</span> matching bookmarks.
                    </p>
                    <button 
                        onClick={handleDeleteFiltered}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600/80 hover:bg-red-600 rounded-md flex items-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={filteredState.bookmarks.length === 0}
                    >
                        <TrashIcon className="w-4 h-4"/>
                        <span>Delete All Shown</span>
                    </button>
                </div>
            )}

            {bookmarkItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center py-16">
                    <BookmarkIcon className="w-16 h-16 mb-4"/>
                    <p className="text-lg">{ appMode === 'filtered' ? 'No bookmarks match your filter.' : 'This folder is empty.' }</p>
                    <p>{ appMode !== 'filtered' && 'Select another folder from the list on the left.'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {bookmarkItems.map(bookmark => (
                        <BookmarkItem key={bookmark.id} bookmark={bookmark} />
                    ))}
                </div>
            )}
        </div>
    );
}