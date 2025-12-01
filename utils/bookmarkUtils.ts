import { BookmarkNode, Bookmark, EmptyFolder } from './types';

export function findNodeById(nodes: BookmarkNode[], id: string): BookmarkNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.type === 'folder') {
      const found = findNodeById(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export function flattenBookmarks(nodes: BookmarkNode[]): Bookmark[] {
  let bookmarks: Bookmark[] = [];
  for (const node of nodes) {
    if (node.type === 'bookmark') {
      bookmarks.push(node);
    } else if (node.type === 'folder') {
      bookmarks = bookmarks.concat(flattenBookmarks(node.children));
    }
  }
  return bookmarks;
}

export function findDuplicates(bookmarks: Bookmark[]): Record<string, Bookmark[]> {
    const urlMap = new Map<string, Bookmark[]>();
    bookmarks.forEach(bookmark => {
        if (bookmark.url) {
            if (!urlMap.has(bookmark.url)) {
                urlMap.set(bookmark.url, []);
            }
            urlMap.get(bookmark.url)!.push(bookmark);
        }
    });

    const duplicates: Record<string, Bookmark[]> = {};
    for (const [url, bookmarksWithUrl] of urlMap.entries()) {
        if (bookmarksWithUrl.length > 1) {
            duplicates[url] = bookmarksWithUrl;
        }
    }
    return duplicates;
}

function findPathRecursive(nodes: BookmarkNode[], id: string, currentPath: string[]): string[] | null {
    for (const node of nodes) {
        if (node.id === id) {
            return currentPath;
        }
        if (node.type === 'folder') {
            const newPath = [...currentPath, node.title];
            const foundPath = findPathRecursive(node.children, id, newPath);
            if (foundPath) {
                return foundPath;
            }
        }
    }
    return null;
}

export function findBookmarkPath(nodes: BookmarkNode[], id: string): string {
    const path = findPathRecursive(nodes, id, []);
    return path ? path.join(' / ') : 'Unknown Location';
}


export function removeBookmarksByIds(nodes: BookmarkNode[], idsToRemove: Set<string>): BookmarkNode[] {
    return nodes.reduce((acc, node) => {
        if (idsToRemove.has(node.id) && node.type === 'bookmark') {
            return acc; // Skip this bookmark
        }

        if (node.type === 'folder') {
            const newNode = { ...node, children: removeBookmarksByIds(node.children, idsToRemove) };
            acc.push(newNode);
        } else {
            acc.push(node);
        }
        return acc;
    }, [] as BookmarkNode[]);
}

export function removeEmptyFolders(nodes: BookmarkNode[]): BookmarkNode[] {
    let result: BookmarkNode[] = [];
    for (const node of nodes) {
        if (node.type === 'folder') {
            // Recursively clean children first
            const cleanedChildren = removeEmptyFolders(node.children);
            // Only keep the folder if it has bookmarks or non-empty subfolders
            if (cleanedChildren.length > 0) {
                result.push({ ...node, children: cleanedChildren });
            }
        } else {
            // It's a bookmark, always keep it
            result.push(node);
        }
    }
    return result;
}

function findEmptyFoldersRecursive(nodes: BookmarkNode[], currentPath: string[], emptyList: EmptyFolder[]) {
    for (const node of nodes) {
        if (node.type === 'folder') {
            const newPath = [...currentPath, node.title];
            if (node.children.length === 0) {
                emptyList.push({ id: node.id, title: node.title, path: newPath.join(' / ') });
            } else {
                findEmptyFoldersRecursive(node.children, newPath, emptyList);
            }
        }
    }
}

export function findEmptyFolders(nodes: BookmarkNode[]): EmptyFolder[] {
    const emptyList: EmptyFolder[] = [];
    findEmptyFoldersRecursive(nodes, [], emptyList);
    return emptyList;
}

export function removeFoldersByIds(nodes: BookmarkNode[], idsToRemove: Set<string>): { cleanedBookmarks: BookmarkNode[], removedCount: number } {
    let removedCount = 0;
    const cleanedBookmarks = nodes.reduce((acc, node) => {
        if (node.type === 'folder' && idsToRemove.has(node.id)) {
            removedCount++;
            return acc; // Skip this folder
        }
        if (node.type === 'folder') {
            const result = removeFoldersByIds(node.children, idsToRemove);
            node.children = result.cleanedBookmarks;
            removedCount += result.removedCount;
        }
        acc.push(node);
        return acc;
    }, [] as BookmarkNode[]);
    return { cleanedBookmarks, removedCount };
}

export function updateBookmarkUrl(nodes: BookmarkNode[], bookmarkId: string, newUrl: string): BookmarkNode[] {
    return nodes.map(node => {
        if (node.id === bookmarkId && node.type === 'bookmark') {
            return { ...node, url: newUrl };
        }
        if (node.type === 'folder') {
            return { ...node, children: updateBookmarkUrl(node.children, bookmarkId, newUrl) };
        }
        return node;
    });
}


export function createSearchIndex(nodes: BookmarkNode[]): BookmarkNode[] {
    return nodes.map(node => {
        if (node.type === 'folder') {
            return { ...node, children: createSearchIndex(node.children) };
        }
        const searchText = `${node.title.toLowerCase()} ${node.url.toLowerCase()}`;
        return { ...node, searchText };
    });
}

// --- ANALYSIS FUNCTIONS ---

const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after', 
    'how', 'new', 'top', 'best', 'guide', 'tutorial', 'pdf', 'video', 'watch', 'login', 'sign', 'home', 'page', 'site', 'website', 'com', 'org', 'net', 'www', 'https', 'http',
    'free', 'download', 'online', 'your', 'my', 'me', 'it', 'that', 'this', 'get', 'use', 'what', 'why', 'when', 'official', 'profile', 'google', 'search', 'docs', 'bookmarks',
    'recipes', 'recipe' // Specific common bookmark words
]);

export function analyzeTitleKeywords(bookmarks: Bookmark[]): { keyword: string, count: number }[] {
    const keywordCounts = new Map<string, number>();
    
    bookmarks.forEach(bm => {
        // Simple tokenization: remove special chars, split by space
        const words = bm.title.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
        
        words.forEach(word => {
            if (word.length > 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word)) {
                keywordCounts.set(word, (keywordCounts.get(word) || 0) + 1);
            }
        });
    });

    return Array.from(keywordCounts.entries())
        .map(([keyword, count]) => ({ keyword, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 30); // Top 30 keywords
}

export function analyzeTimeline(bookmarks: Bookmark[]): { year: string, count: number }[] {
    const yearCounts = new Map<string, number>();
    
    bookmarks.forEach(bm => {
        if (bm.addDate) {
            const date = new Date(parseInt(bm.addDate) * 1000);
            if (!isNaN(date.getTime())) {
                const year = date.getFullYear().toString();
                yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
            }
        }
    });

    // Fill in gaps? Maybe later. For now just sort by year.
    return Array.from(yearCounts.entries())
        .map(([year, count]) => ({ year, count }))
        .sort((a, b) => parseInt(a.year) - parseInt(b.year));
}


export function analyzeDomains(bookmarks: Bookmark[]): { domain: string, count: number }[] {
    const domainCounts = new Map<string, number>();
    for (const bookmark of bookmarks) {
        try {
            const domain = new URL(bookmark.url).hostname.replace('www.', '');
            domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
        } catch (e) {
            // Ignore invalid URLs
        }
    }
    return Array.from(domainCounts.entries())
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
}

export function analyzeBookmarkAges(bookmarks: Bookmark[]): { label: string; bookmarks: {id: string}[] }[] {
    const now = new Date();
    const ageGroups: Record<string, {id: string}[]> = {
        'Over 5 years old': [],
        '2-5 years old': [],
        '1-2 years old': [],
        '6-12 months old': [],
        '1-6 months old': [],
        'Less than 1 month old': [],
    };

    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    const sixMonths = 6 * oneMonth;
    const oneYear = 12 * oneMonth;
    const twoYears = 2 * oneYear;
    const fiveYears = 5 * oneYear;

    for (const bookmark of bookmarks) {
        if (!bookmark.addDate) continue;
        const addDate = new Date(parseInt(bookmark.addDate) * 1000);
        if (isNaN(addDate.getTime())) continue;

        const age = now.getTime() - addDate.getTime();
        const bmInfo = { id: bookmark.id };

        if (age > fiveYears) ageGroups['Over 5 years old'].push(bmInfo);
        else if (age > twoYears) ageGroups['2-5 years old'].push(bmInfo);
        else if (age > oneYear) ageGroups['1-2 years old'].push(bmInfo);
        else if (age > sixMonths) ageGroups['6-12 months old'].push(bmInfo);
        else if (age > oneMonth) ageGroups['1-6 months old'].push(bmInfo);
        else ageGroups['Less than 1 month old'].push(bmInfo);
    }
    
    return Object.entries(ageGroups)
        .map(([label, bookmarks]) => ({ label, bookmarks }))
        .filter(group => group.bookmarks.length > 0);
}

export function buildPathMap(nodes: BookmarkNode[]): Map<string, string> {
    const map = new Map<string, string>();
    function recurse(nodes: BookmarkNode[], currentPath: string[]) {
        for (const node of nodes) {
            if (node.type === 'folder') {
                const newPath = [...currentPath, node.title];
                recurse(node.children, newPath);
            } else {
                map.set(node.id, currentPath.join(' / '));
            }
        }
    }
    recurse(nodes, []);
    return map;
}