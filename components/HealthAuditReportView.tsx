import React, { useMemo } from 'react';
import { HealthAuditReport, LinkHealthIssue, LinkStatus } from '../types';
import { useAppContext } from '../AppContext';
import { HeartPulseIcon, LinkBrokenIcon, TrashIcon, WandSparklesIcon, RefreshCwIcon, FolderIcon, TagIcon, ParkingIcon, ServerSlashIcon } from './icons';

interface HealthAuditReportViewProps {
  report: HealthAuditReport;
}

const getStatusInfo = (status: LinkStatus): { icon: React.ReactNode, label: string, color: string, description: string } => {
    switch (status) {
        case '404 Not Found':
            return { icon: <LinkBrokenIcon className="w-5 h-5"/>, label: '404 Not Found', color: 'text-red-400', description: 'The page or resource could not be found at this URL.' };
        case 'Network Error':
            return { icon: <ServerSlashIcon className="w-5 h-5"/>, label: 'Network Error', color: 'text-red-500', description: 'Could not connect to the server. The domain may be offline or incorrect.' };
        case 'Content Shift':
            return { icon: <WandSparklesIcon className="w-5 h-5"/>, label: 'Content Shift', color: 'text-purple-400', description: 'The domain may have been sold or repurposed; content has likely changed.' };
        case '301 Permanent Redirect':
            return { icon: <RefreshCwIcon className="w-5 h-5"/>, label: 'Redirected', color: 'text-blue-400', description: 'The URL has permanently moved to a new location.' };
        case '503 Service Unavailable':
            return { icon: <LinkBrokenIcon className="w-5 h-5"/>, label: 'Server Error', color: 'text-amber-400', description: 'The server is temporarily unavailable or down for maintenance.' };
        case 'Paywall Detected':
            return { icon: <LinkBrokenIcon className="w-5 h-5"/>, label: 'Paywall', color: 'text-yellow-400', description: 'This content is likely behind a subscription paywall.' };
        case 'Timeout':
            return { icon: <LinkBrokenIcon className="w-5 h-5"/>, label: 'Timeout', color: 'text-orange-400', description: 'The server took too long to respond.' };
        case 'Domain For Sale':
            return { icon: <TagIcon className="w-5 h-5"/>, label: 'Domain For Sale', color: 'text-green-400', description: 'This domain is listed for sale and does not contain original content.' };
        case 'Parked Domain':
            return { icon: <ParkingIcon className="w-5 h-5"/>, label: 'Parked Domain', color: 'text-cyan-400', description: 'This domain is parked, showing ads or a "coming soon" page.' };
        default:
            return { icon: <LinkBrokenIcon className="w-5 h-5"/>, label: 'Unknown Error', color: 'text-slate-400', description: 'An unknown network or other error occurred.' };
    }
};

const IssueItem: React.FC<{ issue: LinkHealthIssue }> = ({ issue }) => {
    const { state, dispatch } = useAppContext();
    const { selectedIssues } = state;
    const { bookmark, path, status, newUrl } = issue;
    const { color } = getStatusInfo(status);
    const isSelected = selectedIssues.has(bookmark.id);

    const handleToggleSelection = () => {
        dispatch({ type: 'TOGGLE_ISSUE_SELECTION', payload: { issueId: bookmark.id, isGroup: false } });
    };
    
    const handleUpdateUrl = () => {
      if (!newUrl) return;
      dispatch({ type: 'SHOW_CONFIRMATION', payload: {
        title: "Confirm URL Update",
        message: `Update this bookmark's URL to "${newUrl}"?`,
        onConfirm: () => dispatch({ type: 'UPDATE_BOOKMARK_URL', payload: { bookmarkId: bookmark.id, newUrl } })
      }});
    };

    return (
        <div className={`grid grid-cols-12 gap-4 text-sm p-3 items-center border-b border-slate-800 last:border-b-0 transition-colors ${isSelected ? 'bg-indigo-900/30' : ''}`}>
            <div className="col-span-1 flex justify-center">
                <input 
                    type="checkbox" 
                    className="h-4 w-4 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"
                    checked={isSelected}
                    onChange={handleToggleSelection}
                />
            </div>
            <div className="col-span-4 overflow-hidden">
                <p className="truncate font-medium text-white">{bookmark.title}</p>
                <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline truncate block">{bookmark.url}</a>
            </div>
            <div className="col-span-3 overflow-hidden">
                 <p className="truncate text-slate-300 flex items-center">
                    <FolderIcon className="w-4 h-4 mr-2 text-slate-500 flex-shrink-0" />
                    {path || 'Bookmarks Bar'}
                </p>
            </div>
            <div className={`col-span-2 flex items-center space-x-2 font-medium ${color}`}>
               <span>{getStatusInfo(status).label}</span>
            </div>
            <div className="col-span-2 flex justify-end space-x-2">
                 {status === '301 Permanent Redirect' && newUrl && (
                    <button onClick={handleUpdateUrl} className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600/80 hover:bg-blue-600 rounded-md transition-colors" title={`Update to: ${newUrl}`}>
                        Update URL
                    </button>
                 )}
            </div>
        </div>
    );
};

const IssueGroup: React.FC<{ status: LinkStatus, issues: LinkHealthIssue[] }> = ({ status, issues }) => {
    const { state, dispatch } = useAppContext();
    const { selectedIssues } = state;
    const { icon, label, color, description } = getStatusInfo(status);

    const issueIds = useMemo(() => issues.map(i => i.bookmark.id), [issues]);
    const isGroupSelected = useMemo(() => issueIds.every(id => selectedIssues.has(id)), [issueIds, selectedIssues]);

    const handleToggleGroup = () => {
        dispatch({ type: 'TOGGLE_ISSUE_GROUP_SELECTION', payload: { issueIds, groupSelected: !isGroupSelected } });
    };

    return (
        <div className="bg-slate-900/50 rounded-lg border border-slate-700">
            <header className="flex justify-between items-center p-3 border-b border-slate-800">
                <div className="flex items-center">
                    <input 
                        type="checkbox"
                        className="h-4 w-4 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500 mr-4"
                        checked={isGroupSelected}
                        onChange={handleToggleGroup}
                        title={`Select all ${label} issues`}
                    />
                    <div>
                        <h3 className={`font-bold text-lg flex items-center space-x-3 ${color}`}>
                            {icon}
                            <span>{label} ({issues.length})</span>
                        </h3>
                        <p className="text-sm text-slate-400 ml-8">{description}</p>
                    </div>
                </div>
            </header>
            <div className="space-y-0">
                {issues.map(issue => <IssueItem key={issue.bookmark.id} issue={issue} />)}
            </div>
        </div>
    );
};


export function HealthAuditReportView({ report }: HealthAuditReportViewProps) {
  const { issues, stats } = report;

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center py-16">
        <HeartPulseIcon className="w-16 h-16 mb-4 text-green-400" />
        <h2 className="text-2xl font-bold text-white mb-2">Excellent Health!</h2>
        <p>Congratulations, your bookmark collection seems to be in perfect condition. No issues were found.</p>
      </div>
    );
  }

  const groupedIssues = useMemo(() => issues.reduce((acc, issue) => {
      if (!acc[issue.status]) {
          acc[issue.status] = [];
      }
      acc[issue.status].push(issue);
      return acc;
  }, {} as Record<LinkStatus, LinkHealthIssue[]>), [issues]);
  
  const issueOrder: LinkStatus[] = ['Network Error', '404 Not Found', 'Content Shift', '301 Permanent Redirect', 'Domain For Sale', 'Parked Domain', '503 Service Unavailable', 'Paywall Detected', 'Timeout', 'Unknown Error'];
  const sortedGroups = issueOrder.filter(status => groupedIssues[status]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-start border-b border-slate-700 pb-4">
        <div>
            <h2 className="text-2xl font-bold text-white">Bookmark Health Audit Report</h2>
            <p className="text-slate-400">
                Found {stats.totalIssues} issue(s) across {stats.totalChecked.toLocaleString()} bookmarks. Select issues to delete.
            </p>
        </div>
        <div className="text-center bg-slate-800 p-3 rounded-lg border border-slate-700">
            <p className="text-sm text-slate-400">Collection Health Score</p>
            <p className={`text-4xl font-bold ${stats.healthScore > 90 ? 'text-green-400' : stats.healthScore > 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                {stats.healthScore}%
            </p>
        </div>
      </div>
      <div className="space-y-6">
        {sortedGroups.map(status => (
            <IssueGroup key={status} status={status} issues={groupedIssues[status]} />
        ))}
      </div>
    </div>
  );
}