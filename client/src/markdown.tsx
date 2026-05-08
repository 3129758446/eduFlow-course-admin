import { createElement, useState } from 'react';
import type { ReactNode } from 'react';

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; lang: string; code: string }
  | { type: 'image'; alt: string; src: string };

function resolveImage(src: string) {
  if (/^https?:\/\//.test(src)) return src;
  if (src.startsWith('/api/static/')) return src;
  return `/api/static/${src.replace(/^\.?\//, '')}`;
}

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      nodes.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<code key={match.index}>{match[3]}</code>);
    } else if (match[4] && match[5]) {
      nodes.push(<img key={match.index} src={resolveImage(match[5])} alt={match[4]} className="md-image" />);
    } else if (match[6] && match[7]) {
      nodes.push(
        <a key={match.index} href={match[7]} target="_blank" rel="noreferrer">
          {match[6]}
        </a>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function parseMarkdown(content: string): Block[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const buffer: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        buffer.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: 'code', lang, code: buffer.join('\n') });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      blocks.push({ type: 'image', alt: image[1], src: image[2] });
      index += 1;
      continue;
    }

    const listMatch = line.match(/^(\d+\.\s+|[-*]\s+)(.*)$/);
    if (listMatch) {
      const ordered = /^\d+\./.test(listMatch[1]);
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        const currentMatch = current.match(/^(\d+\.\s+|[-*]\s+)(.*)$/);
        if (!currentMatch) break;
        items.push(currentMatch[2]);
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s+/.test(lines[index]) && !/^```/.test(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}

function highlightCode(code: string, lang: string) {
  const normalizedLang = lang.toLowerCase();
  const lines = code.split('\n');

  return lines.map((line, lineIndex) => (
    <span key={lineIndex} className="code-line">
      {tokenizeLine(line, normalizedLang)}
      {lineIndex < lines.length - 1 ? '\n' : ''}
    </span>
  ));
}

function tokenizeLine(line: string, lang: string): ReactNode[] {
  const patterns = getHighlightPatterns(lang);
  const tokens: ReactNode[] = [];
  let index = 0;

  while (index < line.length) {
    let matched = false;

    for (const pattern of patterns) {
      pattern.regex.lastIndex = index;
      const match = pattern.regex.exec(line);
      if (match && match.index === index) {
        tokens.push(
          <span key={`${index}-${pattern.className}`} className={pattern.className}>
            {match[0]}
          </span>
        );
        index += match[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      tokens.push(<span key={index}>{line[index]}</span>);
      index += 1;
    }
  }

  return tokens;
}

function getHighlightPatterns(lang: string) {
  const common = [
    { regex: /\/\/.*/gy, className: 'token-comment' },
    { regex: /\/\*[\s\S]*?\*\//gy, className: 'token-comment' },
    { regex: /`(?:\\.|[^`])*`/gy, className: 'token-string' },
    { regex: /"(?:\\.|[^"])*"/gy, className: 'token-string' },
    { regex: /'(?:\\.|[^'])*'/gy, className: 'token-string' },
    { regex: /\b\d+(?:\.\d+)?\b/gy, className: 'token-number' },
  ];

  if (['ts', 'tsx', 'js', 'jsx'].includes(lang)) {
    return [
      ...common,
      { regex: /\b(?:import|from|export|default|return|const|let|var|function|if|else|for|while|switch|case|break|continue|new|async|await|try|catch|throw|type|interface|extends)\b/gy, className: 'token-keyword' },
      { regex: /\b(?:useState|useEffect|useMemo|useCallback|React)\b/gy, className: 'token-built-in' },
      { regex: /<\/?[A-Za-z][\w.-]*/gy, className: 'token-tag' },
      { regex: /\b[A-Za-z_]\w*(?=\s*\()/gy, className: 'token-function' },
      { regex: /\b[A-Za-z_]\w*(?=\s*=)/gy, className: 'token-variable' },
      { regex: /\bclassName\b|\bstyle\b|\bvalue\b|\blabel\b/giy, className: 'token-attr' },
    ];
  }

  if (lang === 'html') {
    return [
      ...common,
      { regex: /<!--.*?-->/gy, className: 'token-comment' },
      { regex: /<\/?[A-Za-z][\w:-]*/gy, className: 'token-tag' },
      { regex: /\b[A-Za-z-:]+(?==)/gy, className: 'token-attr' },
    ];
  }

  return common;
}

export function MarkdownRenderer({ content }: { content: string }) {
  const blocks = parseMarkdown(content);

  return (
    <div className="markdown-body">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const tagName = `h${Math.min(block.level, 6)}`;
          return createElement(tagName, { key: index }, parseInline(block.text));
        }

        if (block.type === 'paragraph') {
          return <p key={index}>{parseInline(block.text)}</p>;
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{parseInline(item)}</li>
              ))}
            </ListTag>
          );
        }

        if (block.type === 'code') {
          return <CodeBlock key={index} code={block.code} lang={block.lang} />;
        }

        return <img key={index} src={resolveImage(block.src)} alt={block.alt} className="md-image" />;
      })}
    </div>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="code-block-wrap">
      <button type="button" className="code-copy-button" onClick={handleCopy}>
        {copied ? '已复制' : '复制'}
      </button>
      <pre className="code-block" data-lang={lang}>
        <code>{highlightCode(code, lang)}</code>
      </pre>
    </div>
  );
}
