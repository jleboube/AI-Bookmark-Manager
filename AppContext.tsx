import React, { createContext, useReducer, useContext, useCallback } from 'react';
import { AppState, Action, AppContextType, ActionCreators, BookmarkNode, BookmarkFolder, Bookmark, HealthAuditReport, LinkHealthIssue } from './types';
import { removeBookmarksByIds, flattenBookmarks, removeEmptyFolders, findDuplicates, findBookmarkPath, createSearchIndex, analyzeDomains, analyzeBookmarkAges, analyzeTitleKeywords, analyzeTimeline, findNodeById, findEmptyFolders, removeFoldersByIds, updateBookmarkUrl, buildPathMap } from './utils/bookmarkUtils';
import { categorizeBookmarks, DailyQuotaExceededError } from './services/geminiService';
import { runAudit, AuditProgress, RawHealthAuditReport } from './services/linkCheckerService';

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- EMBEDDED WORKER CODE ---
// Fixed escaping issue by using String.fromCharCode(96) for backtick
const workerCode = `
self.onmessage = (event) => {
    try {
        const { htmlContent } = event.data;
        console.log('[Worker] Received file content, starting parse...');
        const { bookmarks, stats } = parseBookmarks(htmlContent);
        console.log('[Worker] Parsing complete.', stats);
        self.postMessage({ type: 'success', bookmarks, stats });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[Worker] Error during parsing:', errorMessage);
        self.postMessage({ type: 'error', error: 'Error parsing bookmarks in worker: ' + errorMessage });
    }
};

function decodeEntities(encodedString) {
    if (!encodedString) return "";
    const translate_re = /&(nbsp|amp|quot|lt|gt|#39|#96);/g;
    const translate = {
        "nbsp": " ", "amp" : "&", "quot": '"',
        "lt"  : "<", "gt"  : ">", "#39" : "'", "#96" : String.fromCharCode(96)
    };
    return encodedString.replace(translate_re, (match, entity) => translate[entity] || match)
                       .replace(/&#(\\d+);/gi, (match, numStr) => String.fromCharCode(parseInt(numStr, 10)));
}

function sanitizeTitle(rawTitle) {
    if (!rawTitle) return "";
    const decoded = decodeEntities(rawTitle);
    const stripped = decoded.replace(/<[^>]*>/g, '');
    return stripped.trim();
}

function addFolderStats(nodes) {
    for (const node of nodes) {
        if (node.type === 'folder') {
            let bookmarkCount = 0;
            let folderCount = 0;
            for (const child of node.children) {
                if (child.type === 'bookmark') {
                    bookmarkCount++;
                } else if (child.type === 'folder') {
                    folderCount++;
                }
            }
            node.childStats = { bookmarkCount, folderCount };
            addFolderStats(node.children); // Recurse
        }
    }
}

function parseBookmarks(html) {
    const root = { id: 'root-folder', type: 'folder', title: 'Root', children: [] };
    const stack = [root];
    const stats = { bookmarkCount: 0, folderCount: 0 };
    const lines = html.split(/\\r?\\n/);

    for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.toUpperCase().startsWith('<DL>')) {
            const parent = stack[stack.length - 1];
            const lastChild = parent.children.length > 0 ? parent.children[parent.children.length - 1] : null;
            if (lastChild && lastChild.type === 'folder') {
                stack.push(lastChild);
            }
            continue;
        }

        if (trimmedLine.toUpperCase().startsWith('</DL>')) {
            if (stack.length > 1) stack.pop();
            continue;
        }

        const parent = stack[stack.length - 1];

        if (trimmedLine.toUpperCase().startsWith('<DT><H3')) {
            const titleMatch = trimmedLine.match(/>(.+?)<\\/H3>/i);
            const addDateMatch = trimmedLine.match(/ADD_DATE="([^"]*)"/i);
            const title = sanitizeTitle(titleMatch ? titleMatch[1] : 'Untitled Folder');
            
            const newFolder = {
                id: 'folder-' + Math.random().toString(36).substr(2, 9) + Date.now(),
                type: 'folder',
                title: title,
                addDate: addDateMatch ? addDateMatch[1] : String(Math.floor(Date.now() / 1000)),
                children: []
            };
            parent.children.push(newFolder);
            stats.folderCount++;
            continue;
        }
        
        if (trimmedLine.toUpperCase().startsWith('<DT><A')) {
            const hrefMatch = trimmedLine.match(/HREF="([^"]*)"/i);
            const url = hrefMatch ? hrefMatch[1] : '';
            if (!url || url.trim().startsWith('javascript:')) continue;

            const titleMatch = trimmedLine.match(/>(.+?)<\\/A>/i);
            const addDateMatch = trimmedLine.match(/ADD_DATE="([^"]*)"/i);
            const iconMatch = trimmedLine.match(/ICON="([^"]*)"/i);
            const title = sanitizeTitle(titleMatch ? titleMatch[1] : 'Untitled');

            const newBookmark = {
                id: 'bookmark-' + Math.random().toString(36).substr(2, 9) + Date.now(),
                type: 'bookmark',
                title: title,
                url: url,
                addDate: addDateMatch ? addDateMatch[1] : String(Math.floor(Date.now() / 1000)),
                icon: iconMatch ? iconMatch[1] : ''
            };
            parent.children.push(newBookmark);
            stats.bookmarkCount++;
            continue;
        }
    }
    
    // Post-process to add stats to each folder
    addFolderStats(root.children);
    
    return { bookmarks: root.children, stats };
}
`;


const initialState: AppState = {
  bookmarks: null,
  proposedBookmarks: null,
  stats: null,
  activeFolderId: null,
  expandedFolders: new Set(),
  loadingState: { isLoading: false, message: '' },
  appMode: 'welcome',
  duplicates: [],
  analysisResults: null,
  filteredState: null,
  emptyFolders: [],
  healthAuditReport: null,
  selectedIssues: new Set(),
  isAIQuotaExceeded: false,
  isDebugVisible: false,
  confirmation: null,
  searchQuery: '',
};

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { 
          ...state, 
          loadingState: { ...state.loadingState, ...action.payload },
          confirmation: null // Clear confirmation on loading
      };

    case 'PARSE_SUCCESS': {
      const { bookmarks, stats } = action.payload;
      const firstFolderId = bookmarks.length > 0 && bookmarks[0].type === 'folder' ? bookmarks[0].id : 'root';
      return {
        ...initialState,
        bookmarks,
        stats,
        appMode: 'normal',
        activeFolderId: firstFolderId,
        expandedFolders: new Set([firstFolderId]),
      };
    }
    case 'PARSE_FAILURE':
        return { ...state, loadingState: { isLoading: false, message: '' } };
    case 'SET_BOOKMARKS':
        return { ...state, bookmarks: action.payload };
    case 'SET_PROPOSED_BOOKMARKS':
        return { ...state, proposedBookmarks: action.payload, appMode: 'fixItAll' };
    case 'SET_STATS':
        return { ...state, stats: state.stats ? { ...state.stats, ...action.payload } : action.payload };
    case 'SET_ACTIVE_FOLDER':
      return { ...state, activeFolderId: action.payload };
    case 'TOGGLE_FOLDER_EXPAND': {
      const newSet = new Set(state.expandedFolders);
      if (newSet.has(action.payload)) newSet.delete(action.payload);
      else newSet.add(action.payload);
      return { ...state, expandedFolders: newSet };
    }
    case 'SET_EXPANDED_FOLDERS':
        return { ...state, expandedFolders: new Set(action.payload) };
    case 'SET_APP_MODE':
      return { 
        ...state, 
        appMode: action.payload, 
        filteredState: action.payload !== 'filtered' ? null : state.filteredState,
        selectedIssues: (action.payload !== 'healthAudit') ? new Set() : state.selectedIssues,
        searchQuery: (action.payload === 'normal' || action.payload === 'welcome') ? '' : state.searchQuery,
      };
    case 'SET_DUPLICATES':
        return { ...state, duplicates: action.payload, appMode: 'duplicates' };
    case 'RESOLVE_DUPLICATES': {
        if (!state.bookmarks) return state;
        const { idsToRemove, urlToRemove } = action.payload;
        const newBookmarks = removeBookmarksByIds(state.bookmarks, idsToRemove);
        const newDuplicates = state.duplicates.filter(d => d.url !== urlToRemove);
        const newBookmarkCount = (state.stats?.bookmarkCount ?? 0) - idsToRemove.size;
        return {
            ...state,
            bookmarks: newBookmarks,
            duplicates: newDuplicates,
            stats: state.stats ? { ...state.stats, bookmarkCount: newBookmarkCount } : null,
            confirmation: null,
        };
    }
    case 'RESOLVE_ALL_DUPLICATES': {
        if (!state.bookmarks) return state;
        const idsToRemove = action.payload;
        if (idsToRemove.size === 0) return { ...state, appMode: 'normal', duplicates: [], confirmation: null };
        let newBookmarks = removeBookmarksByIds(state.bookmarks, idsToRemove);
        newBookmarks = removeEmptyFolders(newBookmarks);
        const newBookmarkCount = (state.stats?.bookmarkCount ?? 0) - idsToRemove.size;
        return {
            ...state,
            bookmarks: newBookmarks,
            stats: state.stats ? { ...state.stats, bookmarkCount: newBookmarkCount } : null,
            appMode: 'normal', duplicates: [], confirmation: null,
        };
    }
    case 'SET_ANALYSIS_RESULTS':
        return { ...state, analysisResults: action.payload, appMode: 'insights' };
    case 'SET_FILTERED_STATE':
        return { ...state, filteredState: action.payload, appMode: 'filtered' };
    case 'FILTER_BY_INSIGHT': {
        if (!state.bookmarks || !state.analysisResults) return state;
        const { type, key } = action.payload;
        const allBookmarks = flattenBookmarks(state.bookmarks);
        let filteredBookmarks: Bookmark[] = [];
        let title = '';
        if (type === 'domain') {
            title = `Bookmarks from: ${key}`;
            filteredBookmarks = allBookmarks.filter(b => { try { return new URL(b.url).hostname.replace('www.', '') === key; } catch { return false; } });
        } else if (type === 'age') {
            title = `Bookmarks: ${key}`;
            const ageGroup = state.analysisResults.results.ageAnalysis.find(g => g.label === key);
            if (ageGroup) {
                const ids = new Set(ageGroup.bookmarks.map(b => b.id));
                filteredBookmarks = allBookmarks.filter(b => ids.has(b.id));
            }
        }
        return { ...state, appMode: 'filtered', filteredState: { title, bookmarks: filteredBookmarks } };
    }
    case 'DELETE_FILTERED_BOOKMARKS': {
        if (!state.bookmarks || !state.filteredState) return state;
        const idsToRemove = new Set(state.filteredState.bookmarks.map(b => b.id));
        if (idsToRemove.size === 0) return { ...state, confirmation: null };
        let newBookmarks = removeBookmarksByIds(state.bookmarks, idsToRemove);
        newBookmarks = removeEmptyFolders(newBookmarks);
        const newBookmarkCount = (state.stats?.bookmarkCount ?? 0) - idsToRemove.size;
        const previousMode = state.searchQuery ? 'normal' : 'insights';
        return { ...state, bookmarks: newBookmarks, stats: state.stats ? { ...state.stats, bookmarkCount: newBookmarkCount } : null, appMode: previousMode, filteredState: null, confirmation: null };
    }
    case 'SET_EMPTY_FOLDERS':
        return { ...state, appMode: 'emptyFolders', emptyFolders: action.payload };
    case 'DELETE_EMPTY_FOLDERS': {
        if (!state.bookmarks || state.emptyFolders.length === 0) return { ...state, confirmation: null };
        const idsToRemove = new Set(state.emptyFolders.map(f => f.id));
        const { cleanedBookmarks, removedCount } = removeFoldersByIds(state.bookmarks, idsToRemove);
        const newFolderCount = (state.stats?.folderCount ?? 0) - removedCount;
        return { ...state, bookmarks: cleanedBookmarks, stats: state.stats ? {...state.stats, folderCount: newFolderCount} : null, appMode: 'normal', emptyFolders: [], confirmation: null };
    }
    case 'SET_HEALTH_AUDIT_REPORT':
        return { ...state, appMode: 'healthAudit', healthAuditReport: action.payload, selectedIssues: new Set() };
    case 'DELETE_SELECTED_ISSUES': {
        if (!state.bookmarks || state.selectedIssues.size === 0) return { ...state, confirmation: null };
        const idsToRemove = state.selectedIssues;
        let newBookmarks = removeBookmarksByIds(state.bookmarks, idsToRemove);
        newBookmarks = removeEmptyFolders(newBookmarks);
        const newBookmarkCount = (state.stats?.bookmarkCount ?? 0) - idsToRemove.size;
        return { ...state, bookmarks: newBookmarks, stats: state.stats ? { ...state.stats, bookmarkCount: newBookmarkCount } : null, appMode: 'normal', healthAuditReport: null, selectedIssues: new Set(), confirmation: null };
    }
    case 'UPDATE_BOOKMARK_URL': {
        if (!state.bookmarks) return state;
        const { bookmarkId, newUrl } = action.payload;
        const newBookmarks = updateBookmarkUrl(state.bookmarks, bookmarkId, newUrl);
        const newReport = state.healthAuditReport ? {
            ...state.healthAuditReport,
            issues: state.healthAuditReport.issues.filter(issue => issue.bookmark.id !== bookmarkId)
        } : null;
        return { 
            ...state, 
            bookmarks: createSearchIndex(newBookmarks), 
            healthAuditReport: newReport,
            confirmation: null 
        };
    }
     case 'TOGGLE_ISSUE_SELECTION': {
      const newSelected = new Set(state.selectedIssues);
      if (newSelected.has(action.payload.issueId)) {
        newSelected.delete(action.payload.issueId);
      } else {
        newSelected.add(action.payload.issueId);
      }
      return { ...state, selectedIssues: newSelected };
    }
    case 'TOGGLE_ISSUE_GROUP_SELECTION': {
      const newSelected = new Set(state.selectedIssues);
      if (action.payload.groupSelected) {
        action.payload.issueIds.forEach(id => newSelected.add(id));
      } else {
        action.payload.issueIds.forEach(id => newSelected.delete(id));
      }
      return { ...state, selectedIssues: newSelected };
    }
    case 'SET_AI_QUOTA_EXCEEDED':
        return { ...state, isAIQuotaExceeded: action.payload };
    case 'SET_SEARCH_QUERY':
        return { ...state, searchQuery: action.payload };
    case 'SHOW_CONFIRMATION':
      return { ...state, confirmation: action.payload };
    case 'HIDE_CONFIRMATION':
      return { ...state, confirmation: null };
    case 'TOGGLE_DEBUG':
      return { ...state, isDebugVisible: !state.isDebugVisible };
    case 'APPLY_FIX_IT_ALL': {
        if (!state.proposedBookmarks) return state;
        
        // Use the proposed structure as the new bookmarks
        // Recalculate stats
        const flat = flattenBookmarks(state.proposedBookmarks);
        let folderCount = 0;
        const countFolders = (nodes: BookmarkNode[]) => {
            nodes.forEach(n => {
                if(n.type === 'folder') {
                    folderCount++;
                    countFolders(n.children);
                }
            });
        };
        countFolders(state.proposedBookmarks);
        
        // Reset active folder to root or first
        const firstId = state.proposedBookmarks.length > 0 ? state.proposedBookmarks[0].id : 'root';
        
        return {
            ...state,
            bookmarks: createSearchIndex(state.proposedBookmarks),
            stats: { bookmarkCount: flat.length, folderCount },
            activeFolderId: firstId,
            expandedFolders: new Set([firstId]),
            appMode: 'normal',
            proposedBookmarks: null,
            confirmation: null,
            loadingState: { isLoading: false, message: '' }
        };
    }
    default:
      return state;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const _doParse = useCallback((content: string) => {
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Parsing your bookmarks...' } });
    const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(workerBlob);
    const worker = new Worker(workerUrl);
    worker.onmessage = (event) => {
      const { type, bookmarks, stats, error } = event.data;
      if (type === 'success') {
        if (!bookmarks || bookmarks.length === 0) {
          dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
          alert("Parsing complete, but no bookmarks were found in the file.");
          return;
        }
        dispatch({ type: 'SET_LOADING', payload: { message: '✓ Parsing Complete', details: `${stats.bookmarkCount.toLocaleString()} bookmarks & ${stats.folderCount.toLocaleString()} folders found` }});
        setTimeout(() => dispatch({ type: 'PARSE_SUCCESS', payload: { bookmarks: createSearchIndex(bookmarks), stats } }), 2500);
      } else {
        dispatch({ type: 'PARSE_FAILURE', payload: error });
        alert(error);
      }
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };
    worker.onerror = (e) => {
      const errorMsg = e.error ? e.error.message : e.message;
      dispatch({ type: 'PARSE_FAILURE', payload: errorMsg });
      alert('Error parsing file: ' + errorMsg);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };
    worker.postMessage({ htmlContent: content });
  }, []);

  const actions: ActionCreators = {
    parseFile: (content: string) => {
      if (state.bookmarks && state.bookmarks.length > 0) {
        dispatch({ type: 'SHOW_CONFIRMATION', payload: {
          title: "Overwrite Bookmarks?",
          message: "This will replace your current bookmarks and all changes will be lost. Are you sure?",
          onConfirm: () => _doParse(content)
        }});
      } else {
        _doParse(content);
      }
    },

    handleAutoCategorize: async () => {
      if (!state.bookmarks || state.isAIQuotaExceeded) return;
      dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'AI is analyzing bookmarks...' }});
      try {
          const allBookmarks = flattenBookmarks(state.bookmarks);
          const categorizedResults = await categorizeBookmarks(allBookmarks, (msg) => {
              dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: msg } });
          });
          if (categorizedResults.length === 0) {
              alert("The AI could not create any new categories from your bookmarks.");
              return;
          }
          dispatch({ type: 'SET_LOADING', payload: { message: 'Reorganizing folders...' } });
          const categorizedIds = new Set<string>();
          const allBookmarksNow = flattenBookmarks(state.bookmarks);
          const aiCategoryParentId = 'ai-categories-parent-' + Date.now();
          const aiCategoryParent: BookmarkFolder = { id: aiCategoryParentId, type: 'folder', title: 'AI Categories', children: [], addDate: String(Date.now() / 1000), isAICategory: true };
          for (const category of categorizedResults) {
              const newFolder: BookmarkFolder = { id: `ai-${category.folderName.replace(/\s+/g, '-')}-${Math.random()}`, type: 'folder', title: category.folderName, children: [], addDate: String(Date.now() / 1000), isAICategory: true };
              for (const bookmarkId of category.bookmarkIds) {
                  const bookmark = allBookmarksNow.find(b => b.id === bookmarkId);
                  if (bookmark) { newFolder.children.push(bookmark); categorizedIds.add(bookmarkId); }
              }
              if (newFolder.children.length > 0) aiCategoryParent.children.push(newFolder);
          }
          if (aiCategoryParent.children.length > 0) {
              let newBookmarks = removeBookmarksByIds(state.bookmarks, categorizedIds);
              newBookmarks.unshift(aiCategoryParent);
              dispatch({ type: 'SET_BOOKMARKS', payload: createSearchIndex(newBookmarks) });
              const newStats = { bookmarkCount: state.stats?.bookmarkCount ?? 0, folderCount: (state.stats?.folderCount ?? 0) + aiCategoryParent.children.length + 1 };
              dispatch({type: 'SET_STATS', payload: newStats });
              const newExpanded = new Set(state.expandedFolders);
              newExpanded.add(aiCategoryParentId);
              aiCategoryParent.children.forEach(child => newExpanded.add(child.id));
              dispatch({ type: 'SET_EXPANDED_FOLDERS', payload: newExpanded });
              dispatch({ type: 'SET_ACTIVE_FOLDER', payload: aiCategoryParentId });
          } else {
               alert("AI analysis finished, but no valid categories could be created.");
          }
      } catch (error) {
          if (error instanceof DailyQuotaExceededError) {
              dispatch({ type: 'SET_AI_QUOTA_EXCEEDED', payload: true });
              alert("AI Categorization Failed: You have exceeded your daily usage quota for the Gemini API. Please try again tomorrow.");
          } else {
              alert("An error occurred during auto-categorization: " + (error instanceof Error ? error.message : String(error)));
          }
      } finally {
          dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
      }
    },
    
    findAndSetDuplicates: () => {
        if (!state.bookmarks) return;
        dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Finding duplicates...' } });
        setTimeout(() => {
            const allBookmarks = flattenBookmarks(state.bookmarks);
            const duplicateGroups = findDuplicates(allBookmarks);
            if (Object.keys(duplicateGroups).length === 0) {
                dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
                alert("No duplicate bookmarks found!");
                return;
            }
            const duplicateSets = Object.entries(duplicateGroups).map(([url, bms]) => ({
                url,
                items: bms.map(bm => ({ bookmark: bm, path: findBookmarkPath(state.bookmarks!, bm.id) }))
                .sort((a, b) => parseInt(a.bookmark.addDate || '0') - parseInt(b.bookmark.addDate || '0')),
            }));
            dispatch({ type: 'SET_DUPLICATES', payload: duplicateSets });
            dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
        }, 50);
    },
    
    analyzeAndShowInsights: (folderId?: string) => {
        if (!state.bookmarks) return;
        dispatch({ type: 'SET_LOADING', payload: {isLoading: true, message: 'Analyzing bookmarks...' }});
        setTimeout(() => {
            let bookmarksToAnalyze: Bookmark[];
            let folderTitle: string | undefined;
            if (folderId && folderId !== 'root') {
                const folder = findNodeById(state.bookmarks!, folderId) as BookmarkFolder | null;
                if (folder) { bookmarksToAnalyze = flattenBookmarks(folder.children); folderTitle = folder.title; } 
                else { bookmarksToAnalyze = []; }
            } else {
                bookmarksToAnalyze = flattenBookmarks(state.bookmarks!);
            }
            if (bookmarksToAnalyze.length === 0) {
                dispatch({ type: 'SET_LOADING', payload: {isLoading: false }});
                alert(`No bookmarks to analyze in "${folderTitle || 'All Bookmarks'}"`);
                return;
            }
            
            const topDomains = analyzeDomains(bookmarksToAnalyze);
            const ageAnalysis = analyzeBookmarkAges(bookmarksToAnalyze);
            const topKeywords = analyzeTitleKeywords(bookmarksToAnalyze);
            const timeline = analyzeTimeline(bookmarksToAnalyze);
            
            dispatch({ type: 'SET_ANALYSIS_RESULTS', payload: { 
                results: { 
                    totalCount: bookmarksToAnalyze.length,
                    topDomains, 
                    ageAnalysis,
                    topKeywords,
                    timeline
                }, 
                folderTitle 
            }});
            dispatch({ type: 'SET_LOADING', payload: {isLoading: false }});
        }, 50);
    },

    performSearch: (query: string) => {
        if (!state.bookmarks) return;
        const lowerQuery = query.toLowerCase();
        if (!lowerQuery) {
            if (state.appMode === 'filtered' && state.searchQuery) {
                dispatch({ type: 'SET_APP_MODE', payload: 'normal' });
            }
            return;
        }
        const allBookmarks = flattenBookmarks(state.bookmarks);
        const filtered = allBookmarks.filter(bm => bm.searchText?.includes(lowerQuery));
        dispatch({ type: 'SET_FILTERED_STATE', payload: { title: `Search results for: "${query}"`, bookmarks: filtered }});
    },

    findAndSetEmptyFolders: () => {
        if (!state.bookmarks) return;
        dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Finding empty folders...' } });
        setTimeout(() => {
            const empty = findEmptyFolders(state.bookmarks);
            if (empty.length === 0) {
                alert("No empty folders found!");
            } else {
                dispatch({ type: 'SET_EMPTY_FOLDERS', payload: empty });
            }
            dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
        }, 50);
    },

    runBookmarkHealthAudit: async () => {
        if (!state.bookmarks) return;
        const allBookmarks = flattenBookmarks(state.bookmarks);
        
        const onProgress = (progress: AuditProgress) => {
            const { stage, checked, issuesFound, total, currentBatch, totalBatches } = progress;
            const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;
            let message = `Running Health Audit... ${percentage}%`;
            let stageMessage = "";

            if (stage === 'PRECHECK') {
                message = `Stage 1: Pre-checking links...`;
                stageMessage = `Checking for basic network errors...`;
            } else if (stage === 'AICHECK') {
                message = `Stage 2: AI Deep Scan...`;
                stageMessage = `Analyzing batch ${currentBatch} of ${totalBatches} with AI...`;
            } else if (stage === 'DONE') {
                message = '✓ Audit Complete';
                stageMessage = `Analyzed ${total.toLocaleString()} bookmarks.`;
            }

            const details = (
              <div className="w-full">
                <p className="text-sm text-slate-400 mb-2 text-left">{stageMessage}</p>
                <div className="w-full bg-slate-700 rounded-full h-2.5">
                    <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${percentage}%`}}></div>
                </div>
                <p className="text-sm mt-2 text-slate-300">
                  Progress: {checked.toLocaleString()} / {total.toLocaleString()} | Issues Found: <span className="font-semibold text-white">{issuesFound}</span>
                </p>
              </div>
            );
            dispatch({ type: 'SET_LOADING', payload: { message, details } });
        };
        
        dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Preparing Health Audit...' } });

        try {
            console.time("buildPathMap");
            const pathMap = buildPathMap(state.bookmarks);
            console.timeEnd("buildPathMap");
            
            const rawAuditReport = await runAudit(allBookmarks, onProgress);
            
            console.time("enrichReportWithPaths");
            const reportWithPaths: HealthAuditReport = {
              stats: rawAuditReport.stats,
              issues: rawAuditReport.issues.map(issue => ({
                ...issue,
                path: pathMap.get(issue.bookmark.id) || 'Unknown Location'
              }))
            };
            console.timeEnd("enrichReportWithPaths");

            if (reportWithPaths.issues.length === 0) {
                 dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
                alert("Health Audit complete. No issues found!");
            } else {
                dispatch({ type: 'SET_HEALTH_AUDIT_REPORT', payload: reportWithPaths });
            }
        } catch (error) {
            alert("An error occurred during the Health Audit: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
        }
    },

    generateFixItAllProposal: async () => {
        if (!state.bookmarks) return;
        const allBookmarks = flattenBookmarks(state.bookmarks);
        const total = allBookmarks.length;

        dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Fix It All: Starting...' } });

        try {
            // 1. Identify Duplicates
            dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Step 1/3: Identifying duplicates...' } });
            const duplicateGroups = findDuplicates(allBookmarks);
            const idsToRemove = new Set<string>();
            
            // Logic: Keep oldest or "best" in duplicate sets
            Object.values(duplicateGroups).forEach(group => {
                // Sort by date added (ascending - oldest first)
                // In a real Fix It All, we prefer the oldest (most stable ID) or best path.
                // Let's keep the one with the shortest path (likely closer to root/bar).
                const sorted = group.sort((a, b) => {
                    // This path checking is expensive without the map, but ok for now in this context? 
                    // Actually, let's just use date for simplicity in "Auto" mode
                    return parseInt(a.addDate || '0') - parseInt(b.addDate || '0');
                });
                // Mark all but the first (oldest) for removal
                sorted.slice(1).forEach(bm => idsToRemove.add(bm.id));
            });

            // 2. Quick Health Check (Pre-check ONLY to save time/quota)
            dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Step 2/3: Checking for dead links...' } });
            // We do a rapid fire HEAD request check. 
            // We won't use the full `runAudit` because we just want to kill obviously dead links.
            const uniqueBookmarks = allBookmarks.filter(bm => !idsToRemove.has(bm.id));
            
            // Limit concurrency
            const CHUNK_SIZE = 50;
            let checkedCount = 0;
            for(let i=0; i<uniqueBookmarks.length; i+=CHUNK_SIZE) {
                const chunk = uniqueBookmarks.slice(i, i+CHUNK_SIZE);
                const results = await Promise.all(chunk.map(bm => 
                    fetch(bm.url, { method: 'HEAD', mode: 'no-cors' })
                        .then(() => true)
                        .catch(() => false)
                ));
                
                results.forEach((isAlive, idx) => {
                    if (!isAlive) idsToRemove.add(chunk[idx].id);
                });
                checkedCount += chunk.length;
                dispatch({ 
                    type: 'SET_LOADING', 
                    payload: { 
                        message: 'Step 2/3: Checking for dead links...',
                        details: <div className="text-sm text-slate-300">Checked {checkedCount}/{uniqueBookmarks.length} links</div>
                    } 
                });
            }

            // 3. AI Categorization of REMAINING bookmarks
            const goodBookmarks = allBookmarks.filter(bm => !idsToRemove.has(bm.id));
            
            dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Step 3/3: AI Re-organization...' } });
            
            const categorizedResults = await categorizeBookmarks(goodBookmarks, (msg) => {
                 dispatch({ type: 'SET_LOADING', payload: { message: 'Step 3/3: AI Re-organization...', details: <span className="text-sm text-slate-300">{msg}</span> } });
            });

            // 4. Construct New Tree
            const aiCategoryParentId = 'root'; // Flat structure for now? Or categorized folders?
            // The categorizeBookmarks returns { folderName, bookmarkIds }.
            
            const newTree: BookmarkFolder[] = [];
            const processedIds = new Set<string>();

            categorizedResults.forEach(cat => {
                const folderId = `fix-${cat.folderName}-${Date.now()}`;
                const folder: BookmarkFolder = {
                    id: folderId,
                    type: 'folder',
                    title: cat.folderName,
                    children: [],
                    addDate: String(Date.now()/1000)
                };
                
                cat.bookmarkIds.forEach(id => {
                    const bm = goodBookmarks.find(b => b.id === id);
                    if (bm) {
                        folder.children.push(bm);
                        processedIds.add(id);
                    }
                });
                
                if (folder.children.length > 0) newTree.push(folder);
            });

            // Add uncategorized leftovers (if any) to a "Misc" folder
            const leftovers = goodBookmarks.filter(bm => !processedIds.has(bm.id));
            if (leftovers.length > 0) {
                 const miscFolder: BookmarkFolder = {
                    id: 'fix-misc',
                    type: 'folder',
                    title: 'Miscellaneous',
                    children: leftovers,
                    addDate: String(Date.now()/1000)
                };
                newTree.push(miscFolder);
            }

            // Sort folders alphabetically
            newTree.sort((a,b) => a.title.localeCompare(b.title));

            dispatch({ type: 'SET_PROPOSED_BOOKMARKS', payload: newTree });
            dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });

        } catch (error) {
             if (error instanceof DailyQuotaExceededError) {
                dispatch({ type: 'SET_AI_QUOTA_EXCEEDED', payload: true });
                alert("Fix It All Failed: Quota exceeded.");
            } else {
                alert("Error during Fix It All: " + (error instanceof Error ? error.message : String(error)));
            }
            dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
        }
    }
  };
  
  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};