'use client';

import React, { useMemo, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import type { Root, Text, Parent } from 'mdast';
import type { Element as HastElement } from 'hast';
import type { RagSource } from '@/types';
import { CitationChip } from './CitationChip';

/** hast nodes often have `parent` at runtime; unist types omit it. */
type HastElementWithParent = HastElement & { parent?: HastElement };
// ─── Remark Citation Plugin ──────────────────────────────────────────────────
// Transforms [N] text nodes into inlineCode nodes with a __cite: prefix
// so the code component renderer can intercept and render CitationChip.

function remarkCitations() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (!parent || index === undefined) return;
      if (!/\[\d+\]/.test(node.value)) return;

      const pattern = /\[(\d+)\]/g;
      const newNodes: any[] = [];
      let last = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(node.value)) !== null) {
        if (match.index > last) {
          newNodes.push({ type: 'text', value: node.value.slice(last, match.index) });
        }
        newNodes.push({ type: 'inlineCode', value: `__cite:${match[1]}` });
        last = match.index + match[0].length;
      }

      if (last < node.value.length) {
        newNodes.push({ type: 'text', value: node.value.slice(last) });
      }

      (parent.children as any[]).splice(index, 1, ...newNodes);
    });
  };
}

// ─── Shared ReactMarkdown Components ─────────────────────────────────────────

function makeComponents(sources: RagSource[]): React.ComponentProps<typeof ReactMarkdown>['components'] {
  return {
    p:          ({ children }) => <p className="md-p">{children}</p>,
    h1:         ({ children }) => <h1 className="md-h1">{children}</h1>,
    h2:         ({ children }) => <h2 className="md-h2">{children}</h2>,
    h3:         ({ children }) => <h3 className="md-h3">{children}</h3>,
    ul:         ({ children }) => <ul className="md-ul">{children}</ul>,
    ol:         ({ children }) => <ol className="md-ol">{children}</ol>,
    li: ({ children, node }) => {
      const liNode = node as HastElementWithParent | undefined;
      const parent = liNode?.parent;
      const isOrdered = parent?.tagName === 'ol';
      if (isOrdered && parent && liNode) {
        const siblings = parent.children.filter((n): n is HastElement => n.type === 'element');
        const index = siblings.indexOf(liNode) + 1;
        return (
          <li className="md-li-ordered">
            <span className="md-li-num">{index}.</span>
            <span>{children}</span>
          </li>
        );
      }
      return (
        <li className="md-li-bullet">
          <span className="md-li-dot">●</span>
          <span>{children}</span>
        </li>
      );
    },
    blockquote: ({ children }) => <blockquote className="md-blockquote">{children}</blockquote>,
    hr:         () => <hr className="md-hr" />,
    strong:     ({ children }) => <strong className="md-strong">{children}</strong>,
    em:         ({ children }) => <em className="md-em">{children}</em>,
    code: ({ children, className }) => {
      const text = String(children);
      if (text.startsWith('__cite:')) {
        const n = parseInt(text.slice(7), 10);
        const source = sources[n - 1];
        return <CitationChip index={n} text={source?.text ?? ''} />;
      }
      if (className) return <code>{children}</code>;
      return <code className="md-code">{children}</code>;
    },
    pre: ({ children }) => (
      <div className="md-pre-wrap">
        <pre className="md-pre">{children}</pre>
      </div>
    ),
  };
}

// ─── Citation Chip (legacy reference kept) ───────────────────────────────────

// ─── Inline Parser (kept for fallback) ───────────────────────────────────────

type InlineNode = React.ReactNode;

function parseInline(text: string, sources: RagSource[], keyPrefix: string): InlineNode[] {
  const tokens: { type: 'text' | 'token'; value: string }[] = [];
  const pattern = /(`[^`]+`|\[\d+\]|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push({ type: 'text', value: text.slice(last, match.index) });
    }
    tokens.push({ type: 'token', value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    tokens.push({ type: 'text', value: text.slice(last) });
  }

  return tokens.map((t, i) => {
    const key = `${keyPrefix}-${i}`;
    if (t.type === 'text') return t.value;

    const v = t.value;

    // Inline code
    if (v[0] === '`') {
      return <code key={key} className="md-code">{v.slice(1, -1)}</code>;
    }

    // Citation [N]
    if (v[0] === '[') {
      const n = parseInt(v.slice(1, -1), 10);
      return <CitationChip key={key} index={n} text={sources[n - 1].text} />;
    }

    // Bold **...**
    if (v.startsWith('**')) {
      return <strong key={key} className="md-strong">{v.slice(2, -2)}</strong>;
    }

    // Italic *...*
    if (v.startsWith('*')) {
      return <em key={key} className="md-em">{v.slice(1, -1)}</em>;
    }

    return v;
  });
}

// ─── Block Parser ─────────────────────────────────────────────────────────────

function parseBlocks(markdown: string, sources: RagSource[]): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const fencePattern = /```(\w*)\n?([\s\S]*?)```/g;
  const segments: { type: 'text' | 'code'; content: string; lang?: string }[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(markdown)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', content: markdown.slice(last, match.index) });
    }
    segments.push({ type: 'code', lang: match[1] || '', content: match[2].trimEnd() });
    last = match.index + match[0].length;
  }
  if (last < markdown.length) {
    segments.push({ type: 'text', content: markdown.slice(last) });
  }

  let blockKey = 0;

  for (const segment of segments) {
    if (segment.type === 'code') {
      elements.push(
        <div key={blockKey++} className="md-pre-wrap">
          {segment.lang && <div className="md-pre-lang">{segment.lang}</div>}
          <pre className="md-pre">{segment.content}</pre>
        </div>
      );
      continue;
    }

    const lines = segment.content.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Blank line
      if (line.trim() === '') { i++; continue; }

      // Horizontal rule
      if (/^---+$/.test(line.trim())) {
        elements.push(<hr key={blockKey++} className="md-hr" />);
        i++; continue;
      }

      // H1
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={blockKey++} className="md-h1">{parseInline(line.slice(2), sources, `${blockKey}`)}</h1>
        );
        i++; continue;
      }

      // H2
      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={blockKey++} className="md-h2">{parseInline(line.slice(3), sources, `${blockKey}`)}</h2>
        );
        i++; continue;
      }

      // H3
      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={blockKey++} className="md-h3">{parseInline(line.slice(4), sources, `${blockKey}`)}</h3>
        );
        i++; continue;
      }

      // Unordered list
      if (/^[-*] /.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^[-*] /.test(lines[i])) {
          items.push(lines[i].slice(2));
          i++;
        }
        elements.push(
          <ul key={blockKey++} className="md-ul">
            {items.map((item, idx) => (
              <li key={idx} className="md-li-bullet">
                <span className="md-li-dot">●</span>
                <span>{parseInline(item, sources, `${blockKey}-li-${idx}`)}</span>
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // Ordered list
      if (/^\d+\. /.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+\. /.test(lines[i])) {
          items.push(lines[i].replace(/^\d+\. /, ''));
          i++;
        }
        elements.push(
          <ol key={blockKey++} className="md-ol">
            {items.map((item, idx) => (
              <li key={idx} className="md-li-ordered">
                <span className="md-li-num">{idx + 1}.</span>
                <span>{parseInline(item, sources, `${blockKey}-ol-${idx}`)}</span>
              </li>
            ))}
          </ol>
        );
        continue;
      }

      // Blockquote
      if (line.startsWith('> ')) {
        const bqLines: string[] = [];
        while (i < lines.length && lines[i].startsWith('> ')) {
          bqLines.push(lines[i].slice(2));
          i++;
        }
        elements.push(
          <blockquote key={blockKey++} className="md-blockquote">
            {bqLines.map((l, idx) => (
              <div key={idx}>{parseInline(l, sources, `${blockKey}-bq-${idx}`)}</div>
            ))}
          </blockquote>
        );
        continue;
      }

      // Paragraph
      const paraLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !/^[#>]/.test(lines[i]) &&
        !/^[-*] /.test(lines[i]) &&
        !/^\d+\./.test(lines[i]) &&
        !/^---+$/.test(lines[i].trim())
      ) {
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length > 0) {
        elements.push(
          <p key={blockKey++} className="md-p">
            {parseInline(paraLines.join(' '), sources, `${blockKey}`)}
          </p>
        );
      }
    }
  }

  return elements;
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface AthenaMarkdownProps {
  content: string;
  sources?: RagSource[];
}

export function AthenaMarkdown({ content, sources = [] }: AthenaMarkdownProps) {
  const components = useMemo(() => makeComponents(sources), [sources]);
  if (!content) return null;
  return (
    <div className="md-root">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkCitations]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── Streaming Utilities ──────────────────────────────────────────────────────

function repairMarkdown(text: string): string {
  if (!text) return text;
  let result = text;

  // Unclosed code fence — must be checked first, affects context for everything else
  const fenceCount = result.split('\n').filter(l => l.trimStart().startsWith('```')).length;
  if (fenceCount % 2 === 1) {
    return result + '\n```';
  }

  // Unclosed bold **
  const boldMatches = result.match(/\*\*/g);
  if (boldMatches && boldMatches.length % 2 === 1) result += '**';

  // Unclosed inline code `
  const backtickMatches = result.match(/(?<!`)`(?!`)/g);
  if (backtickMatches && backtickMatches.length % 2 === 1) result += '`';

  return result;
}

function splitIntoBlocks(markdown: string): string[] {
  const lines = markdown.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) inFence = !inFence;

    if (!inFence && line.trim() === '' && current.length > 0) {
      blocks.push(current.join('\n'));
      current = [];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) blocks.push(current.join('\n'));
  return blocks.filter(b => b.trim());
}

// ─── Memoized Block ───────────────────────────────────────────────────────────

const MemoBlock = memo(
  ({ content, components }: { content: string; components: React.ComponentProps<typeof ReactMarkdown>['components'] }) => (
    <div className="md-root">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkCitations]} components={components}>{content}</ReactMarkdown>
    </div>
  ),
  (prev, next) => prev.content === next.content && prev.components === next.components,
);

// ─── Streaming Markdown ───────────────────────────────────────────────────────

export function StreamingMarkdown({ content, sources = [] }: { content: string; sources?: RagSource[] }) {
  const repaired = useMemo(() => repairMarkdown(content), [content]);
  const blocks = useMemo(() => splitIntoBlocks(repaired), [repaired]);
  const components = useMemo(() => makeComponents(sources), [sources]);

  return (
    <div className="space-y-1">
      {blocks.map((block, i) => (
        <MemoBlock key={`block-${i}`} content={block} components={components} />
      ))}
    </div>
  );
}
