import { TranscriptSegment, ExtractionState } from '../types';

export function exportToMarkdown(
  segments: TranscriptSegment[],
  state: ExtractionState,
  sessionDuration: string
): string {
  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let md = `# LiveScribe Meeting Intelligence Report\n\n`;
  md += `**Date:** ${dateStr}  \n`;
  md += `**Duration:** ${sessionDuration}  \n`;
  md += `**Total Segments:** ${segments.length}  \n\n`;

  md += `## 📋 Executive Summary\n\n`;
  md += `${state.summary || '_No summary generated._'}\n\n`;

  md += `## ✅ Action Items\n\n`;
  if (state.actionItems.length === 0) {
    md += `_No action items recorded._\n\n`;
  } else {
    md += `| Status | Task | Owner | Deadline | Priority | Confidence | Source Quote |\n`;
    md += `|---|---|---|---|---|---|---|\n`;
    for (const item of state.actionItems) {
      const statusIcon = item.status === 'done' ? '✅ Done' : '⏳ Open';
      const owner = item.owner || '—';
      const deadline = item.deadline || '—';
      const priority = item.priority.toUpperCase();
      const conf = `${Math.round(item.confidence * 100)}%`;
      const quote = item.sourceQuote ? `"${item.sourceQuote}"` : '—';
      md += `| ${statusIcon} | ${item.task} | ${owner} | ${deadline} | ${priority} | ${conf} | ${quote} |\n`;
    }
    md += `\n`;
  }

  md += `## 🎯 Decisions\n\n`;
  if (state.decisions.length === 0) {
    md += `_No explicit decisions recorded._\n\n`;
  } else {
    for (const d of state.decisions) {
      md += `- **[${d.timestamp}]** ${d.text}\n`;
    }
    md += `\n`;
  }

  md += `## ❓ Open Questions\n\n`;
  if (state.openQuestions.length === 0) {
    md += `_No open questions._\n\n`;
  } else {
    for (const q of state.openQuestions) {
      md += `- ${q}\n`;
    }
    md += `\n`;
  }

  md += `## 🎙️ Full Verbatim Transcript\n\n`;
  if (segments.length === 0) {
    md += `_No transcript recorded._\n`;
  } else {
    for (const seg of segments) {
      md += `**[${seg.startedAt}]** ${seg.text}\n\n`;
    }
  }

  return md;
}

export function exportToJSON(
  segments: TranscriptSegment[],
  state: ExtractionState,
  sessionDuration: string
): string {
  const exportData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      duration: sessionDuration,
      segmentCount: segments.length,
      actionItemCount: state.actionItems.length,
    },
    summary: state.summary,
    actionItems: state.actionItems,
    decisions: state.decisions,
    openQuestions: state.openQuestions,
    transcript: segments,
  };

  return JSON.stringify(exportData, null, 2);
}

export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
