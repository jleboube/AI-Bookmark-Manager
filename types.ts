import React from 'react';

export interface Bookmark {
  id: string;
  type: 'bookmark';
  title: string;
  url: string;
  addDate?: string;
  icon?: string;
  // For search
  searchText?: string;
}

export interface BookmarkFolder {
  id:string;
  type: 'folder';
  title: string;
  children: BookmarkNode[];
  addDate?: string;
  isAICategory?: boolean;
  childStats?: {
    bookmarkCount: number;
    folderCount: number;
  };
}

export type BookmarkNode = Bookmark | BookmarkFolder;

export interface DuplicateSet {
  url: string;
  items: {
    bookmark: Bookmark;
    path: string;
  }[];
}

export interface AnalysisResults {
    totalCount: number;
    topDomains: { domain: string, count: number }[];
    ageAnalysis: { label: string, bookmarks: {id: string}[] }[];
    topKeywords: { keyword: string, count: number }[];
    timeline: { year: string, count: number }[];
}

export interface EmptyFolder {
  id: string;
  title: string;
  path: string;
}

// --- NEW HEALTH AUDIT TYPES ---
export type LinkStatus = 
  | 'OK'
  | '404 Not Found'
  | '301 Permanent Redirect'
  | '503 Service Unavailable'
  | 'Timeout'
  | 'Content Shift'
  | 'Paywall Detected'
  | 'Domain For Sale'
  | 'Parked Domain'
  | 'Network Error'
  | 'Unknown Error';

export interface LinkHealthIssue {
    bookmark: Bookmark;
    path: string;
    status: LinkStatus;
    newUrl?: string; // For redirects
}

export interface HealthAuditReport {
  issues: LinkHealthIssue[];
  stats: {
    totalChecked: number;
    totalIssues: number;
    healthScore: number;
  };
}

// --- STATE MANAGEMENT TYPES ---

export type AppMode = 'welcome' | 'normal' | 'duplicates' | 'insights' | 'filtered' | 'emptyFolders' | 'healthAudit' | 'fixItAll';

export interface LoadingState {
  isLoading: boolean;
  message: string;
  details?: React.ReactNode;
}

export interface FilteredState {
  title: string;
  bookmarks: Bookmark[];
}

export interface AppState {
  bookmarks: BookmarkNode[] | null;
  proposedBookmarks: BookmarkNode[] | null; // For Fix It All
  stats: { bookmarkCount: number; folderCount: number } | null;
  activeFolderId: string | null;
  expandedFolders: Set<string>;
  loadingState: LoadingState;
  appMode: AppMode;
  duplicates: DuplicateSet[];
  analysisResults: { results: AnalysisResults; folderTitle?: string; } | null;
  filteredState: FilteredState | null;
  emptyFolders: EmptyFolder[];
  healthAuditReport: HealthAuditReport | null;
  selectedIssues: Set<string>; // New for granular control
  isAIQuotaExceeded: boolean;
  isDebugVisible: boolean;
  confirmation: ConfirmationState | null;
  searchQuery: string;
}

export interface ConfirmationState {
  title: string;
  message: string;
  onConfirm: () => void;
}


// --- REDUCER ACTION TYPES ---

export type Action =
  | { type: 'SET_LOADING'; payload: Partial<LoadingState> }
  | { type: 'PARSE_SUCCESS'; payload: { bookmarks: BookmarkNode[]; stats: { bookmarkCount: number; folderCount: number } } }
  | { type: 'PARSE_FAILURE'; payload: string }
  | { type: 'SET_BOOKMARKS'; payload: BookmarkNode[] }
  | { type: 'SET_PROPOSED_BOOKMARKS'; payload: BookmarkNode[] | null }
  | { type: 'SET_STATS'; payload: { bookmarkCount: number; folderCount: number } }
  | { type: 'SET_ACTIVE_FOLDER'; payload: string }
  | { type: 'SET_EXPANDED_FOLDERS'; payload: Set<string> }
  | { type: 'TOGGLE_FOLDER_EXPAND'; payload: string }
  | { type: 'SET_APP_MODE'; payload: AppMode }
  | { type: 'SET_DUPLICATES'; payload: DuplicateSet[] }
  | { type: 'RESOLVE_DUPLICATES'; payload: { idsToRemove: Set<string>; urlToRemove: string } }
  | { type: 'RESOLVE_ALL_DUPLICATES'; payload: Set<string> }
  | { type: 'SET_ANALYSIS_RESULTS'; payload: { results: AnalysisResults, folderTitle?: string } }
  | { type: 'SET_FILTERED_STATE'; payload: FilteredState | null }
  | { type: 'FILTER_BY_INSIGHT'; payload: { type: 'domain' | 'age'; key: string } }
  | { type: 'DELETE_FILTERED_BOOKMARKS' }
  | { type: 'SET_EMPTY_FOLDERS'; payload: EmptyFolder[] }
  | { type: 'DELETE_EMPTY_FOLDERS' }
  | { type: 'SET_HEALTH_AUDIT_REPORT'; payload: HealthAuditReport }
  | { type: 'DELETE_SELECTED_ISSUES' }
  | { type: 'UPDATE_BOOKMARK_URL'; payload: { bookmarkId: string; newUrl: string } }
  | { type: 'TOGGLE_ISSUE_SELECTION'; payload: { issueId: string, isGroup: false } }
  | { type: 'TOGGLE_ISSUE_GROUP_SELECTION'; payload: { issueIds: string[], groupSelected: boolean } }
  | { type: 'SET_AI_QUOTA_EXCEEDED'; payload: boolean }
  | { type: 'SHOW_CONFIRMATION'; payload: ConfirmationState }
  | { type: 'HIDE_CONFIRMATION' }
  | { type: 'TOGGLE_DEBUG' }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'APPLY_FIX_IT_ALL' };

// --- CONTEXT TYPE ---
export interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  actions: ActionCreators;
}

export interface ActionCreators {
    parseFile: (content: string) => void;
    handleAutoCategorize: () => Promise<void>;
    findAndSetDuplicates: () => void;
    analyzeAndShowInsights: (folderId?: string) => void;
    performSearch: (query: string) => void;
    findAndSetEmptyFolders: () => void;
    runBookmarkHealthAudit: () => Promise<void>;
    generateFixItAllProposal: () => Promise<void>;
}