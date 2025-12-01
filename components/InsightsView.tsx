import React from 'react';
import { ChartIcon, DuplicateIcon, MagicIcon, BookmarkIcon, FolderIcon, TagIcon, ArchiveIcon } from './icons';
import { AnalysisResults } from '../types';
import { useAppContext } from '../AppContext';

interface InsightsViewProps {
    results: AnalysisResults;
}

const StatCard: React.FC<{ title: string, value: number, icon: React.ReactNode, onClick?: () => void }> = ({ title, value, icon, onClick }) => (
    <div 
        onClick={onClick}
        className={`bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex items-center justify-between transition-all ${onClick ? 'cursor-pointer hover:bg-slate-800 hover:scale-[1.02]' : ''}`}
    >
        <div>
            <p className="text-sm text-slate-400 font-medium mb-1">{title}</p>
            <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
        </div>
        <div className="p-3 bg-slate-700/50 rounded-full text-indigo-400">
            {icon}
        </div>
    </div>
);

const TimelineChart: React.FC<{ data: { year: string, count: number }[] }> = ({ data }) => {
    const maxCount = Math.max(...data.map(d => d.count), 1);
    return (
        <div className="flex items-end space-x-2 h-40 pt-4 px-2">
            {data.map(({ year, count }) => {
                const height = (count / maxCount) * 100;
                return (
                    <div key={year} className="flex-1 flex flex-col items-center group relative">
                        <div 
                            className="w-full bg-indigo-600/50 rounded-t hover:bg-indigo-500 transition-all relative" 
                            style={{ height: `${height}%` }}
                        >
                             <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-slate-700 pointer-events-none">
                                {count} bookmarks
                            </div>
                        </div>
                        <span className="text-xs text-slate-400 mt-2 rotate-0 md:rotate-0 truncate w-full text-center">{year}</span>
                    </div>
                )
            })}
        </div>
    );
};

export function InsightsView({ results }: InsightsViewProps) {
    const { state, dispatch } = useAppContext();
    const { analysisResults } = state;
    const { totalCount, topDomains, ageAnalysis, topKeywords, timeline } = results;

    const handleSelectInsight = (type: 'domain' | 'age', key: string) => {
        dispatch({ type: 'FILTER_BY_INSIGHT', payload: { type, key } });
    };

    const handleSearchKeyword = (keyword: string) => {
        dispatch({ type: 'SET_SEARCH_QUERY', payload: keyword });
        dispatch({ type: 'SET_APP_MODE', payload: 'normal' });
    };

    if (totalCount === 0) {
        return (
             <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center py-16">
                <ChartIcon className="w-16 h-16 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">No Insights Generated</h2>
                <p>Could not analyze the bookmarks. The folder might be empty.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="border-b border-slate-700 pb-4">
                <h2 className="text-2xl font-bold text-white flex items-center">
                    <ChartIcon className="w-6 h-6 mr-3 text-indigo-400" />
                    {analysisResults?.folderTitle ? `Analysis: ${analysisResults.folderTitle}` : 'Global Collection Analysis'}
                </h2>
                <p className="text-slate-400 mt-1">Deep dive into the composition and history of your bookmarks.</p>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Bookmarks" value={totalCount} icon={<BookmarkIcon className="w-6 h-6" />} />
                <StatCard title="Domains Analyzed" value={topDomains.length} icon={<DuplicateIcon className="w-6 h-6" />} />
                <StatCard title="Years Active" value={timeline.length} icon={<ArchiveIcon className="w-6 h-6" />} />
                <StatCard title="Top Topics" value={topKeywords.length} icon={<TagIcon className="w-6 h-6" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Collection Growth Timeline */}
                <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700">
                     <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                        <ArchiveIcon className="w-5 h-5 mr-2 text-indigo-400" />
                        Collection Growth
                    </h3>
                    <TimelineChart data={timeline} />
                </div>

                {/* Top Domains Bar Chart */}
                <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                        <DuplicateIcon className="w-5 h-5 mr-2 text-indigo-400" />
                        Top Domains
                    </h3>
                    <div className="space-y-3">
                        {topDomains.slice(0, 6).map(({ domain, count }) => (
                             <div key={domain} onClick={() => handleSelectInsight('domain', domain)} className="group cursor-pointer">
                                <div className="flex justify-between text-sm mb-1">
                                    <div className="flex items-center">
                                        <img 
                                            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`} 
                                            className="w-4 h-4 mr-2 rounded-sm opacity-70 group-hover:opacity-100" 
                                            alt=""
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                        <span className="text-slate-300 group-hover:text-white transition-colors">{domain}</span>
                                    </div>
                                    <span className="text-slate-400">{count}</span>
                                </div>
                                <div className="w-full bg-slate-700 rounded-full h-2">
                                    <div 
                                        className="bg-indigo-600 h-2 rounded-full group-hover:bg-indigo-500 transition-all" 
                                        style={{ width: `${(count / topDomains[0].count) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tag Cloud / Topics */}
                <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                        <TagIcon className="w-5 h-5 mr-2 text-indigo-400" />
                        Identified Topics
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {topKeywords.map(({ keyword, count }) => {
                            // Simple scaling for font size/opacity based on count relative to max
                            const max = topKeywords[0].count;
                            const scale = 0.5 + (0.5 * (count / max)); // between 0.5 and 1
                            return (
                                <button
                                    key={keyword}
                                    onClick={() => handleSearchKeyword(keyword)}
                                    className="px-3 py-1 rounded-full bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-all text-sm border border-slate-700 hover:border-indigo-500"
                                    style={{ opacity: 0.6 + (0.4 * scale) }}
                                >
                                    {keyword} <span className="text-xs opacity-60 ml-1">{count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Age Analysis */}
                <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                        <MagicIcon className="w-5 h-5 mr-2 text-indigo-400" />
                        Collection Dust
                    </h3>
                    <div className="space-y-2">
                         {ageAnalysis.map(({ label, bookmarks }) => (
                            <div 
                                key={label} 
                                onClick={() => handleSelectInsight('age', label)}
                                className="flex justify-between items-center p-3 rounded-md bg-slate-800/50 hover:bg-slate-800 cursor-pointer transition-colors border border-transparent hover:border-slate-600"
                            >
                                <span className="text-sm text-slate-300">{label}</span>
                                <span className="text-xs font-bold bg-slate-700 text-white px-2 py-1 rounded-full">{bookmarks.length.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}