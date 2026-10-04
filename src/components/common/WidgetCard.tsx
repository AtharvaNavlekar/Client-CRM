import React, { useState } from 'react';
import { RefreshCw, Maximize2, Minimize2, Search } from 'lucide-react';

export type TimeRange = 'Today' | 'Yesterday' | 'This week' | 'This month' | 'This quarter' | 'All time';

interface WidgetCardProps {
  title: string;
  subtitle?: string;
  badge?: string;
  timeRange?: TimeRange;
  onTimeRangeChange?: (range: TimeRange) => void;
  timeRanges?: TimeRange[];
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  onRefresh?: () => void;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const WidgetCard: React.FC<WidgetCardProps> = ({
  title,
  subtitle,
  badge,
  timeRange = 'This month',
  onTimeRangeChange,
  timeRanges = ['Today', 'Yesterday', 'This week', 'This month', 'This quarter'],
  showSearch = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  onRefresh,
  headerAction,
  children,
  className = ''
}) => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>(timeRange);
  const [lastRefreshedSecs, setLastRefreshedSecs] = useState<number>(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleRangeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as TimeRange;
    setSelectedRange(val);
    if (onTimeRangeChange) onTimeRangeChange(val);
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setLastRefreshedSecs(0);
    if (onRefresh) onRefresh();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const formattedRefreshed =
    lastRefreshedSecs === 0
      ? 'Just now'
      : lastRefreshedSecs < 60
      ? `${lastRefreshedSecs}s ago`
      : `${Math.floor(lastRefreshedSecs / 60)}m ago`;

  const cardContent = (
    <div
      className={`bg-[#FFFFFF] dark:bg-[#161A19] rounded-[24px] border border-[#E2E8F0] dark:border-[#334155] shadow-xs flex flex-col overflow-hidden transition-all duration-200 ${className} ${
        isExpanded ? 'fixed inset-4 z-50 shadow-2xl p-4' : ''
      }`}
    >
      {/* Header Chrome */}
      <div className="px-4 py-3.5 border-b border-[#E2E8F0] dark:border-[#334155] flex flex-wrap items-center justify-between gap-2.5 bg-[#F8FAF9] dark:bg-[#111514]">
        <div className="flex items-center space-x-2.5 min-w-0">
          <h3 className="text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9] font-heading truncate">
            {title}
          </h3>
          {badge && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#CCE8E1] text-[#00201B] dark:bg-[#004F46] dark:text-[#80D5C4]">
              {badge}
            </span>
          )}
          {subtitle && (
            <span className="text-[11px] text-[#475569] dark:text-[#94A3B8] hidden sm:inline truncate">• {subtitle}</span>
          )}
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {/* Inline search if enabled */}
          {showSearch && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                aria-label={`Search within ${title}`}
                value={searchValue}
                onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                className="w-28 sm:w-36 pl-7 pr-2.5 py-1.5 text-xs rounded-full bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-[#0F172A] dark:text-[#F1F5F9] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00695C] transition-all"
              />
            </div>
          )}

          {headerAction}

          {/* Time-range filter dropdown */}
          <select
            value={selectedRange}
            onChange={handleRangeSelect}
            aria-label={`Time range filter for ${title}`}
            className="text-xs font-medium rounded-full px-3 py-1.5 bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-[#0F172A] dark:text-[#F1F5F9] focus:outline-none focus:ring-2 focus:ring-[#00695C] cursor-pointer"
          >
            {timeRanges.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {/* Last refreshed timestamp + manual refresh icon */}
          <div className="flex items-center space-x-1 pl-1 text-[10px] text-[#475569] dark:text-[#94A3B8]">
            <span className="hidden md:inline tabular-nums">{formattedRefreshed}</span>
            <button
              type="button"
              onClick={handleManualRefresh}
              aria-label={`Refresh data for ${title}`}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F1F5F4] dark:hover:bg-[#1E293B] text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00695C] transition-colors"
              title="Refresh widget data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#00695C] dark:text-[#80D5C4]' : ''}`} />
            </button>
          </div>

          {/* Fullscreen Expand Icon */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title} full screen`}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F1F5F4] dark:hover:bg-[#1E293B] text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00695C] transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand full screen'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Widget Content Body */}
      <div className={`p-4 flex-1 overflow-auto ${isExpanded ? 'max-h-[calc(100vh-140px)]' : ''}`}>
        {children}
      </div>
    </div>
  );

  return (
    <>
      {isExpanded && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}
      {cardContent}
    </>
  );
};
