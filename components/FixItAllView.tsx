import React, { useMemo } from 'react';
import { BookmarkNode, Bookmark } from '../types';
import { useAppContext } from '../AppContext';
import { FolderIcon, FolderOpenIcon, BookmarkIcon, MagicIcon, XCircleIcon, CheckCircleIcon } from './icons';
import { flattenBookmarks } from '../utils/bookmarkUtils';

interface FixItAllViewProps {
    proposedBookmarks: BookmarkNode[];
}

// Helper to check recursively if a node ID exists in a list
const findIdInList = (id: string, list: BookmarkNode[]): boolean => {
    for (const node of list) {
        if (node.id === id) return true;
        if (node.type === 'folder' && findIdInList(id, node.children)) return true;
    }
    return false;
};

// --- Tree Renderer for Comparison ---

interface ComparisonTreeProps {
    nodes: BookmarkNode[];
    referenceList?: BookmarkNode[]; // If provided, we check against this list to detect removals
    isProposed?: boolean; // Changes styling for the "New" tree
    keptIds?: Set<string>; // For the Current tree, checking if items are in the proposed
}

const ComparisonTreeNode: React.FC<{ 
    node: BookmarkNode, 
    level: number, 
    keptIds?: Set<string>,
    isProposed?: boolean
}> = ({ node, level, keptIds, isProposed }) => {
    
    // Logic:
    // If we are rendering the CURRENT tree (isProposed=false),
    // and the node ID is NOT in keptIds, it means it will be REMOVED.
    const isRemoved = !isProposed && keptIds && node.type === 'bookmark' && !keptIds.has(node.id);
    
    // Folders in Current Tree are tricky because structure changes. 
    // We mainly care about visualising removed *Bookmarks*. 
    // If a folder contains only removed bookmarks, maybe dim it? 
    // For now, let's keep folders neutral unless explicit.

    return (
        <div className="select-none">
            <div 
                className={`flex items-center py-1 px-2 rounded hover:bg-slate-700/50 transition-colors ${isRemoved ? 'bg-red-900/20' : ''}`}
                style={{ marginLeft: `${level * 1.2}rem` }}
            >
                {node.type === 'folder' ? (
                    <FolderIcon className={`w-4 h-4 mr-2 flex-shrink-0 ${isProposed ? 'text-indigo-400' : 'text-slate-400'}`} />
                ) : (
                    <BookmarkIcon className={`w-4 h-4 mr-2 flex-shrink-0 ${isRemoved ? 'text-red-500' : (isProposed ? 'text-green-500' : 'text-slate-500')}`} />
                )}
                
                <span className={`truncate text-sm ${isRemoved ? 'text-red-400 line-through' : 'text-slate-300'}`}>
                    {node.title}
                </span>

                {isRemoved && (
                    <span className="ml-auto text-xs text-red-500 flex items-center">
                        <XCircleIcon className="w-3 h-3 mr-1" /> Removed
                    </span>
                )}
                {isProposed && node.type === 'bookmark' && (
                    <span className="ml-auto text-xs text-green-500 flex items-center opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity">
                         New Location
                    </span>
                )}
            </div>
            {node.type === 'folder' && node.children.map(child => (
                 <ComparisonTreeNode 
                    key={child.id} 
                    node={child} 
                    level={level + 1} 
                    keptIds={keptIds}
                    isProposed={isProposed}
                />
            ))}
        </div>
    );
};

export function FixItAllView({ proposedBookmarks }: FixItAllViewProps) {
    const { state, dispatch } = useAppContext();
    const { bookmarks: currentBookmarks } = state;

    // 1. Calculate Statistics
    const currentFlat = useMemo(() => flattenBookmarks(currentBookmarks || []), [currentBookmarks]);
    const proposedFlat = useMemo(() => flattenBookmarks(proposedBookmarks), [proposedBookmarks]);
    
    const removedCount = currentFlat.length - proposedFlat.length;
    
    // 2. Build Set of Kept IDs for fast lookup
    const keptIds = useMemo(() => {
        const set = new Set<string>();
        proposedFlat.forEach(b => set.add(b.id));
        return set;
    }, [proposedFlat]);

    const handleApply = () => {
        dispatch({ type: 'SHOW_CONFIRMATION', payload: {
            title: 'Apply "Fix It All" Changes?',
            message: `This will restructure your folders and PERMANENTLY delete ${removedCount} bookmarks (duplicates & broken links). This cannot be undone.`,
            onConfirm: () => dispatch({ type: 'APPLY_FIX_IT_ALL' })
        }});
    };

    return (
        <div className="h-full flex flex-col animate-fade-in">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-slate-700 pb-4 mb-4 flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center">
                        <MagicIcon className="w-6 h-6 mr-3 text-indigo-400" />
                        Fix It All Proposal
                    </h2>
                    <p className="text-slate-400 mt-1">
                        Review the changes below. Red items on the left will be removed. The structure on the right will be applied.
                    </p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="text-right">
                         <div className="text-sm text-slate-400">Total Bookmarks</div>
                         <div className="text-xl font-bold text-white">
                            <span className="text-slate-500 line-through mr-2">{currentFlat.length}</span>
                            <span className="text-green-400">{proposedFlat.length}</span>
                         </div>
                    </div>
                    <div className="text-right">
                         <div className="text-sm text-slate-400">Removing</div>
                         <div className="text-xl font-bold text-red-400">-{removedCount}</div>
                    </div>
                </div>
            </div>

            {/* Split View */}
            <div className="flex-grow flex gap-4 overflow-hidden">
                {/* Current State (Left) */}
                <div className="flex-1 flex flex-col min-w-0 bg-slate-900/50 rounded-lg border border-slate-700/50">
                    <div className="p-3 border-b border-slate-700 bg-slate-800/50 rounded-t-lg">
                        <h3 className="font-bold text-slate-300">Current Structure</h3>
                    </div>
                    <div className="flex-grow overflow-y-auto p-2 custom-scrollbar">
                        {currentBookmarks?.map(node => (
                            <ComparisonTreeNode 
                                key={node.id} 
                                node={node} 
                                level={0} 
                                keptIds={keptIds} 
                            />
                        ))}
                    </div>
                </div>

                {/* Proposed State (Right) */}
                 <div className="flex-1 flex flex-col min-w-0 bg-indigo-900/10 rounded-lg border border-indigo-500/30">
                    <div className="p-3 border-b border-indigo-500/30 bg-indigo-900/20 rounded-t-lg">
                        <h3 className="font-bold text-indigo-200">Proposed Structure (AI Optimized)</h3>
                    </div>
                    <div className="flex-grow overflow-y-auto p-2 custom-scrollbar">
                         {proposedBookmarks.map(node => (
                            <ComparisonTreeNode 
                                key={node.id} 
                                node={node} 
                                level={0} 
                                isProposed={true}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex-shrink-0 mt-4 flex justify-end space-x-4">
                 <button 
                    onClick={() => dispatch({ type: 'SET_APP_MODE', payload: 'normal' })}
                    className="px-6 py-2 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleApply}
                    className="px-6 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 font-bold shadow-lg shadow-indigo-500/20 transition-transform active:scale-95 flex items-center"
                >
                    <CheckCircleIcon className="w-5 h-5 mr-2" />
                    Apply Changes
                </button>
            </div>
        </div>
    );
}