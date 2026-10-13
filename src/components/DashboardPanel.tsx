import React, { useState, useMemo } from 'react';
import { ExtractionState, ActionItem, Priority } from '../types';
import {
  CheckSquare,
  FileText,
  Milestone,
  HelpCircle,
  Copy,
  Check,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface DashboardPanelProps {
  state: ExtractionState;
  isExtracting: boolean;
  newWordsCount: number;
  onExtractNow: () => void;
  onToggleDone: (id: string) => void;
  onEditItem: (item: ActionItem) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: () => void;
}

type TabType = 'actions' | 'summary' | 'decisions' | 'questions';

export const DashboardPanel: React.FC<DashboardPanelProps> = ({
  state,
  isExtracting,
  onExtractNow,
  onToggleDone,
  onEditItem,
  onDeleteItem,
  onAddItem,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('actions');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'done'>('all');
  const [lastExtractedTime, setLastExtractedTime] = useState<string>('Ready');

  // Track extraction timestamp
  React.useEffect(() => {
    if (!isExtracting && (state.actionItems.length > 0 || state.summary)) {
      setLastExtractedTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    }
  }, [isExtracting, state]);

  const handleCopySummary = () => {
    if (!state.summary) return;
    navigator.clipboard.writeText(state.summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // Split and group action items: Open above Done
  const { openItems, doneItems } = useMemo(() => {
    const open: ActionItem[] = [];
    const done: ActionItem[] = [];
    for (const item of state.actionItems) {
      if (item.status === 'done') {
        done.push(item);
      } else {
        open.push(item);
      }
    }
    return { openItems: open, doneItems: done };
  }, [state.actionItems]);

  const displayedItems = useMemo(() => {
    if (statusFilter === 'open') return openItems;
    if (statusFilter === 'done') return doneItems;
    return [...openItems, ...doneItems];
  }, [statusFilter, openItems, doneItems]);

  // Format combined due chip (e.g. "Friday · 16 Oct")
  const formatDeadline = (phrase: string | null | undefined, resolvedIso: string | null | undefined): string | null => {
    if (!phrase && !resolvedIso) return null;
    if (!resolvedIso) return phrase || null;

    try {
      const d = new Date(resolvedIso);
      if (isNaN(d.getTime())) return phrase || null;
      const formattedDate = d.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
      });

      if (!phrase) return formattedDate;

      // If phrase already contains the date digits, just show phrase
      if (phrase.toLowerCase().includes(formattedDate.toLowerCase())) {
        return phrase;
      }
      return `${phrase} · ${formattedDate}`;
    } catch {
      return phrase || null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface)] rounded-panel border border-[var(--line)] shadow-calm overflow-hidden transition-colors">
      {/* Top Header: Segmented Tabs + Extract Now */}
      <div className="px-5 py-3 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
        {/* Segmented Tab Bar */}
        <div role="tablist" aria-label="Meeting notes sections" className="flex items-center gap-1 bg-[var(--surface-2)] p-1 rounded-control border border-[var(--line)]">
          <button
            role="tab"
            aria-selected={activeTab === 'actions'}
            aria-controls="panel-actions"
            id="tab-actions"
            onClick={() => setActiveTab('actions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-scale-13 font-medium transition-colors ${
              activeTab === 'actions'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-[var(--cobalt)]" />
            <span>Action items</span>
            <span className="ml-0.5 text-scale-12 font-mono text-[var(--ink-3)]">
              {state.actionItems.length}
            </span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'summary'}
            aria-controls="panel-summary"
            id="tab-summary"
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-scale-13 font-medium transition-colors ${
              activeTab === 'summary'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Summary</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'decisions'}
            aria-controls="panel-decisions"
            id="tab-decisions"
            onClick={() => setActiveTab('decisions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-scale-13 font-medium transition-colors ${
              activeTab === 'decisions'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            <Milestone className="w-3.5 h-3.5" />
            <span>Decisions</span>
            <span className="ml-0.5 text-scale-12 font-mono text-[var(--ink-3)]">
              {state.decisions.length}
            </span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'questions'}
            aria-controls="panel-questions"
            id="tab-questions"
            onClick={() => setActiveTab('questions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-scale-13 font-medium transition-colors ${
              activeTab === 'questions'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Questions</span>
            <span className="ml-0.5 text-scale-12 font-mono text-[var(--ink-3)]">
              {state.openQuestions.length}
            </span>
          </button>
        </div>

        {/* Right side: Last updated + Extract now button */}
        <div className="flex items-center gap-3">
          <span className="text-scale-12 text-[var(--ink-3)] hidden md:inline">
            {lastExtractedTime === 'Ready' ? 'Ready' : `Updated ${lastExtractedTime}`}
          </span>

          <button
            onClick={onExtractNow}
            disabled={isExtracting}
            title="Extract now (E)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-[var(--surface-2)] hover:bg-[var(--line)] border border-[var(--line)] text-scale-13 font-medium text-[var(--ink)] transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2"
          >
            {isExtracting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--cobalt)]" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-[var(--cobalt)]" />
            )}
            <span>{isExtracting ? 'Extracting' : 'Extract now'}</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* TAB 1: ACTION ITEMS */}
        {activeTab === 'actions' && (
          <div
            id="panel-actions"
            role="tabpanel"
            aria-labelledby="tab-actions"
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Filter Bar */}
            <div className="px-5 py-2.5 border-b border-[var(--line)] bg-[var(--surface-2)]/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 text-scale-12">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-[var(--ink)] text-[var(--surface)]'
                      : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                  }`}
                >
                  All ({state.actionItems.length})
                </button>
                <button
                  onClick={() => setStatusFilter('open')}
                  className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                    statusFilter === 'open'
                      ? 'bg-[var(--ink)] text-[var(--surface)]'
                      : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                  }`}
                >
                  Open ({openItems.length})
                </button>
                <button
                  onClick={() => setStatusFilter('done')}
                  className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                    statusFilter === 'done'
                      ? 'bg-[var(--ink)] text-[var(--surface)]'
                      : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                  }`}
                >
                  Done ({doneItems.length})
                </button>
              </div>

              <button
                onClick={onAddItem}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-control bg-[var(--surface)] hover:bg-[var(--line)] border border-[var(--line)] text-scale-12 font-medium text-[var(--ink)] transition-colors"
              >
                <Plus className="w-3 h-3 text-[var(--cobalt)]" />
                <span>Add item</span>
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {displayedItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
                  <p className="text-scale-15 text-[var(--ink-2)] max-w-[44ch] leading-relaxed">
                    No action items noted yet. As you talk through next steps, action items will
                    appear here.
                  </p>
                </div>
              ) : (
                displayedItems.map((item) => {
                  const isDone = item.status === 'done';
                  const formattedDue = formatDeadline(item.deadline, item.resolvedDeadline);

                  // Priority style
                  const priorityClass = {
                    high: 'text-[var(--live)] bg-[var(--live)]/10',
                    medium: 'text-[var(--amber)] bg-[var(--amber-bg)]',
                    low: 'text-[var(--ink-2)] bg-[var(--surface-2)]',
                  }[item.priority as Priority] || 'text-[var(--ink-2)] bg-[var(--surface-2)]';

                  // Owner label: convert "speaker" or empty to unassigned / you
                  let displayOwner = item.owner ? `@${item.owner}` : 'Unassigned';
                  if (item.owner?.toLowerCase() === 'you') displayOwner = 'You';

                  return (
                    <div
                      key={item.id}
                      className={`group p-3.5 rounded-control border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--ink-3)] transition-all ${
                        isDone ? 'opacity-60 bg-[var(--surface-2)]/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <label className="pt-0.5 cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => onToggleDone(item.id)}
                            className="sr-only"
                          />
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              isDone
                                ? 'bg-[var(--done)] border-[var(--done)] text-white'
                                : 'border-[var(--line)] hover:border-[var(--ink-3)] bg-[var(--surface)]'
                            }`}
                          >
                            {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </label>

                        {/* Title and metadata */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`text-scale-15 font-medium leading-snug break-words ${
                                isDone
                                  ? 'line-through text-[var(--ink-3)]'
                                  : 'text-[var(--ink)]'
                              }`}
                            >
                              {item.task}
                            </span>

                            {/* Edit / Delete actions (hover on desktop, always visible on mobile) */}
                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={() => onEditItem(item)}
                                aria-label="Edit item"
                                className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteItem(item.id)}
                                aria-label="Delete item"
                                className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--live)] hover:bg-[var(--surface-2)] transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Chips Row */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {/* Owner Chip */}
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-scale-12 font-medium bg-[var(--surface-2)] text-[var(--ink-2)] border border-[var(--line)]">
                              {displayOwner}
                            </span>

                            {/* Deadline Chip */}
                            {formattedDue && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-scale-12 font-medium bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)]">
                                <Calendar className="w-3 h-3 text-[var(--ink-3)]" />
                                <span>{formattedDue}</span>
                              </span>
                            )}

                            {/* Priority Chip */}
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-scale-12 font-medium capitalize ${priorityClass}`}
                            >
                              {item.priority}
                            </span>

                            {/* Low confidence warning chip (<90%) */}
                            {item.confidence !== undefined && item.confidence < 0.9 && (
                              <span
                                title="Speech extraction confidence was lower than 90%"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-scale-12 font-medium bg-[var(--amber-bg)] text-[var(--amber)]"
                              >
                                <AlertCircle className="w-3 h-3" />
                                <span>Check this</span>
                              </span>
                            )}
                          </div>

                          {/* Verbatim Source Quote */}
                          {item.sourceQuote && (
                            <p className="mt-2 text-scale-12 text-[var(--ink-3)] italic border-l-2 border-[var(--line)] pl-2 leading-relaxed">
                              &ldquo;{item.sourceQuote}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SUMMARY */}
        {activeTab === 'summary' && (
          <div
            id="panel-summary"
            role="tabpanel"
            aria-labelledby="tab-summary"
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="px-5 py-2.5 border-b border-[var(--line)] bg-[var(--surface-2)]/40 flex items-center justify-between">
              <span className="text-scale-12 text-[var(--ink-3)]">Meeting minutes & overview</span>
              {state.summary && (
                <button
                  onClick={handleCopySummary}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-control bg-[var(--surface)] hover:bg-[var(--line)] border border-[var(--line)] text-scale-12 font-medium text-[var(--ink)] transition-colors"
                >
                  {copiedSummary ? <Check className="w-3 h-3 text-[var(--done)]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSummary ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {state.summary ? (
                <div className="font-serif text-scale-21 text-[var(--ink)] leading-relaxed max-w-[60ch] whitespace-pre-wrap select-text">
                  {state.summary}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
                  <p className="text-scale-15 text-[var(--ink-2)] max-w-[44ch] leading-relaxed">
                    No summary yet. Press Start listening and talk through your agenda to generate
                    rolling meeting notes.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DECISIONS */}
        {activeTab === 'decisions' && (
          <div
            id="panel-decisions"
            role="tabpanel"
            aria-labelledby="tab-decisions"
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="px-5 py-2.5 border-b border-[var(--line)] bg-[var(--surface-2)]/40">
              <span className="text-scale-12 text-[var(--ink-3)]">
                Agreed decisions & conclusions
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {state.decisions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
                  <p className="text-scale-15 text-[var(--ink-2)] max-w-[44ch] leading-relaxed">
                    No decisions noted yet. Concrete agreements and conclusions will be listed here.
                  </p>
                </div>
              ) : (
                state.decisions.map((dec) => (
                  <div
                    key={dec.id}
                    className="p-3.5 rounded-control border border-[var(--line)] bg-[var(--surface)] space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-scale-15 font-medium text-[var(--ink)] leading-snug">
                        {dec.text}
                      </p>
                      <span className="text-scale-12 font-mono text-[var(--ink-3)] shrink-0 pt-0.5">
                        {dec.timestamp || 'Noted'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: QUESTIONS */}
        {activeTab === 'questions' && (
          <div
            id="panel-questions"
            role="tabpanel"
            aria-labelledby="tab-questions"
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="px-5 py-2.5 border-b border-[var(--line)] bg-[var(--surface-2)]/40">
              <span className="text-scale-12 text-[var(--ink-3)]">
                Unresolved inquiries & follow-ups
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {state.openQuestions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
                  <p className="text-scale-15 text-[var(--ink-2)] max-w-[44ch] leading-relaxed">
                    No open questions noted yet. Unanswered queries will be tracked here.
                  </p>
                </div>
              ) : (
                state.openQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-control border border-[var(--line)] bg-[var(--surface)] flex items-start gap-3"
                  >
                    <div className="w-5 h-5 rounded-full bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-center text-[var(--cobalt)] font-mono text-[11px] shrink-0 mt-0.5">
                      ?
                    </div>
                    <p className="text-scale-15 text-[var(--ink)] leading-snug">{q}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
