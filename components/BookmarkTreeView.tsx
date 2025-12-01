import React, { useEffect } from 'react';
import { BookmarkNode } from '../types';
import { FolderIcon, FolderOpenIcon, ChevronRightIcon, MagicIcon } from './icons';
import { useAppContext } from '../AppContext';

interface BookmarkTreeViewProps {
  nodes: BookmarkNode[];
}

interface NodeViewProps {
  node: BookmarkNode;
  level: number;
}

const NodeView: React.FC<NodeViewProps> = ({ node, level }) => {
  const { state, dispatch } = useAppContext();
  const { activeFolderId, expandedFolders, appMode } = state;

  if (node.type !== 'folder') {
    return null;
  }
  
  const handleSelect = () => {
    dispatch({ type: 'SET_ACTIVE_FOLDER', payload: node.id });
    if (appMode !== 'normal') {
        dispatch({ type: 'SET_APP_MODE', payload: 'normal' });
    }
  }

  const isExpanded = expandedFolders.has(node.id);
  const isActive = activeFolderId === node.id;
  const isAICategory = node.isAICategory;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'TOGGLE_FOLDER_EXPAND', payload: node.id });
  };

  const hasChildren = node.children.some(child => child.type === 'folder');

  return (
    <div style={{ marginLeft: `${level * 1}rem` }}>
      <div
        className={`flex items-center p-2 rounded-md cursor-pointer transition-colors group ${isActive ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700'}`}
        onClick={handleSelect}
      >
        {hasChildren ? (
          <ChevronRightIcon
            className={`w-4 h-4 mr-2 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            onClick={handleToggle}
          />
        ) : (
          <div className="w-4 h-4 mr-2 flex-shrink-0" />
        )}

        {isAICategory 
            ? <MagicIcon className={`w-5 h-5 mr-2 flex-shrink-0 ${isActive ? 'text-indigo-200' : 'text-indigo-400'}`} /> 
            : (isExpanded 
                ? <FolderOpenIcon className="w-5 h-5 mr-2 flex-shrink-0" /> 
                : <FolderIcon className="w-5 h-5 mr-2 flex-shrink-0" />)
        }
        
        <span className="truncate flex-grow">{node.title}</span>
        {node.childStats && node.childStats.bookmarkCount > 0 && (
            <span 
                className="ml-auto flex-shrink-0 text-xs font-medium text-slate-400 bg-slate-800/50 group-hover:bg-slate-600 group-hover:text-slate-200 px-2 py-0.5 rounded-full transition-colors"
                title={`${node.childStats.bookmarkCount} bookmarks in this folder`}
            >
                {node.childStats.bookmarkCount}
            </span>
        )}
      </div>
      {isExpanded && node.children.length > 0 && (
        <div className="mt-1">
          {node.children.map(child => (
            <NodeView 
              key={child.id} 
              node={child} 
              level={level + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const BookmarkTreeView: React.FC<BookmarkTreeViewProps> = (props) => {
  const { state, dispatch } = useAppContext();
  const { activeFolderId, appMode, stats } = state;
  
  const handleSelectRoot = () => {
      dispatch({ type: 'SET_ACTIVE_FOLDER', payload: 'root'});
      if (appMode !== 'normal') {
          dispatch({ type: 'SET_APP_MODE', payload: 'normal' });
      }
  };

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center p-2 rounded-md cursor-pointer transition-colors group ${activeFolderId === 'root' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700'}`}
        onClick={handleSelectRoot}
      >
         <div className="w-4 h-4 mr-2 flex-shrink-0" />
         <FolderOpenIcon className="w-5 h-5 mr-2 flex-shrink-0" />
         <span className="truncate flex-grow">All Bookmarks</span>
         {stats && (
            <span 
                className="ml-auto flex-shrink-0 text-xs font-medium text-slate-400 bg-slate-800/50 group-hover:bg-slate-600 group-hover:text-slate-200 px-2 py-0.5 rounded-full transition-colors"
                title={`${stats.bookmarkCount} total bookmarks`}
            >
                {stats.bookmarkCount.toLocaleString()}
            </span>
         )}
      </div>
      {props.nodes.map(node => (
        <NodeView key={node.id} node={node} level={0} />
      ))}
    </div>
  );
};