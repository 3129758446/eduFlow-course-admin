/* 
模块：轻量 Markdown 渲染器
定位：内置解析/内联高亮/图片资源解析与复制代码按钮，无第三方依赖
要点：仅支持常用语法（标题/段落/列表/代码/图片/链接/加粗/行内代码）
用法：<MarkdownRenderer content={md} />
*/
import { createElement, useState } from "react";
import type { ReactNode } from "react";

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; lang: string; code: string }
  // 先抽象成统一 Block 数据结构，再由渲染层按类型分别输出 JSX。
  | { type: "image"; alt: string; src: string };

function resolveImage(src: string) {
  // Markdown 中既支持绝对 http 链接，也支持相对路径自动映射到服务端静态资源接口。
  if (/^https?:\/\//.test(src)) return src;
  if (src.startsWith("/api/static/")) return src;
  return `/api/static/${src.replace(/^\.?\//, "")}`;
}

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\*\*([^*]+)\*\*|`([^`]+)`|!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // 使用一个正则完成常见行内语法拆分，避免再引入第三方 Markdown 解析库。
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      nodes.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<code key={match.index}>{match[3]}</code>);
    } else if (match[4] && match[5]) {
      nodes.push(
        <img
          key={match.index}
          src={resolveImage(match[5])}
          alt={match[4]}
          className="md-image"
        />,
      );
    } else if (match[6] && match[7]) {
      nodes.push(
        <a key={match.index} href={match[7]} target="_blank" rel="noreferrer">
          {match[6]}
        </a>,
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
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  // 这是一个“按行扫描”的简化解析器，优先保证项目所需语法足够稳定、易读。
  while (index < lines.length) {
    const line = lines[index].trimEnd();

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const buffer: string[] = [];
      index += 1;
      // 代码块持续读取到下一个 ```，保留原始缩进与换行供高亮器使用。
      while (index < lines.length && !lines[index].startsWith("```")) {
        buffer.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: "code", lang, code: buffer.join("\n") });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2],
      });
      index += 1;
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      blocks.push({ type: "image", alt: image[1], src: image[2] });
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
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^```/.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function highlightCode(code: string, lang: string) {
  const normalizedLang = lang.toLowerCase();
  const lines = code.split("\n");

  return lines.map((line, lineIndex) => (
    <span key={lineIndex} className="code-line">
      {tokenizeLine(line, normalizedLang)}
      {lineIndex < lines.length - 1 ? "\n" : ""}
    </span>
  ));
}

function tokenizeLine(line: string, lang: string): ReactNode[] {
  const patterns = getHighlightPatterns(lang);
  const tokens: ReactNode[] = [];
  let index = 0;

  // 从左到右尝试规则，命中后推进索引，实现一个轻量级词法着色器。
  while (index < line.length) {
    let matched = false;

    for (const pattern of patterns) {
      pattern.regex.lastIndex = index;
      const match = pattern.regex.exec(line);
      if (match && match.index === index) {
        tokens.push(
          <span
            key={`${index}-${pattern.className}`}
            className={pattern.className}
          >
            {match[0]}
          </span>,
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
    { regex: /\/\/.*/gy, className: "token-comment" },
    { regex: /\/\*[\s\S]*?\*\//gy, className: "token-comment" },
    { regex: /`(?:\\.|[^`])*`/gy, className: "token-string" },
    { regex: /"(?:\\.|[^"])*"/gy, className: "token-string" },
    { regex: /'(?:\\.|[^'])*'/gy, className: "token-string" },
    { regex: /\b\d+(?:\.\d+)?\b/gy, className: "token-number" },
  ];

  if (["ts", "tsx", "js", "jsx"].includes(lang)) {
    // 当前项目主要展示前端代码，因此对 TS/JSX 做了更细的关键字和标签着色。
    return [
      ...common,
      {
        regex:
          /\b(?:import|from|export|default|return|const|let|var|function|if|else|for|while|switch|case|break|continue|new|async|await|try|catch|throw|type|interface|extends)\b/gy,
        className: "token-keyword",
      },
      {
        regex: /\b(?:useState|useEffect|useMemo|useCallback|React)\b/gy,
        className: "token-built-in",
      },
      { regex: /<\/?[A-Za-z][\w.-]*/gy, className: "token-tag" },
      { regex: /\b[A-Za-z_]\w*(?=\s*\()/gy, className: "token-function" },
      { regex: /\b[A-Za-z_]\w*(?=\s*=)/gy, className: "token-variable" },
      {
        regex: /\bclassName\b|\bstyle\b|\bvalue\b|\blabel\b/giy,
        className: "token-attr",
      },
    ];
  }

  if (lang === "html") {
    return [
      ...common,
      { regex: /<!--.*?-->/gy, className: "token-comment" },
      { regex: /<\/?[A-Za-z][\w:-]*/gy, className: "token-tag" },
      { regex: /\b[A-Za-z-:]+(?==)/gy, className: "token-attr" },
    ];
  }

  return common;
}

export function MarkdownRenderer({ content }: { content: string }) {
  // 先转成中间 Block 结构，再映射成 React 节点，渲染层会更清晰。
  const blocks = parseMarkdown(content);

  return (
    <div className="markdown-body">
      {blocks.map((block, index) => {
        // 每种 Block 单独渲染，结构虽然朴素，但比把所有逻辑揉在一个大正则里更好维护。
        if (block.type === "heading") {
          const tagName = `h${Math.min(block.level, 6)}`;
          return createElement(
            tagName,
            { key: index },
            parseInline(block.text),
          );
        }

        if (block.type === "paragraph") {
          return <p key={index}>{parseInline(block.text)}</p>;
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{parseInline(item)}</li>
              ))}
            </ListTag>
          );
        }

        if (block.type === "code") {
          return <CodeBlock key={index} code={block.code} lang={block.lang} />;
        }

        return (
          <img
            key={index}
            src={resolveImage(block.src)}
            alt={block.alt}
            className="md-image"
          />
        );
      })}
    </div>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // 复制成功后短暂反馈“已复制”，避免引入额外提示组件。
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="code-block-wrap">
      {/* 复制按钮悬浮在代码块右上角，避免占用正文布局空间。 */}
      <button type="button" className="code-copy-button" onClick={handleCopy}>
        {copied ? "已复制" : "复制"}
      </button>
      <pre className="code-block" data-lang={lang}>
        <code>{highlightCode(code, lang)}</code>
      </pre>
    </div>
  );
}
