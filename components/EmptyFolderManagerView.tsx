import React from 'react';
import { FolderIcon, FolderXIcon } from './icons';
import { useAppContext } from '../AppContext';
import { EmptyFolder } from '../types';

interface EmptyFolderManagerViewProps {
  folders: EmptyFolder[];
}

export function EmptyFolderManagerView({ folders }: EmptyFolderManagerViewProps) {
  if (folders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center py-16">
        <FolderXIcon className="w-16 h-16 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">No Empty Folders</h2>
        <p>Your bookmark structure is clean and contains no empty folders!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b border-slate-700 pb-2">
        <h2 className="text-2xl font-bold text-white">
          {folders.length} {folders.length === 1 ? 'Empty Folder' : 'Empty Folders'} Found
        </h2>
        <p className="text-slate-400">Review the list of empty folders below. You can delete them all using the button in the toolbar.</p>
      </div>
      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 max-w-4xl mx-auto">
        <div className="space-y-2">
          {folders.map((folder) => (
            <div key={folder.id} className="flex items-center text-sm p-2 rounded-md bg-slate-800">
              <FolderIcon className="w-5 h-5 mr-3 flex-shrink-0 text-slate-400" />
              <div className="overflow-hidden">
                <p className="truncate font-medium text-white">{folder.title}</p>
                <p className="truncate text-slate-400 text-xs">{folder.path}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}