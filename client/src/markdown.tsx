/*
模块：Markdown 渲染器
定位：基于 react-markdown + GFM + 代码高亮组件实现，保留项目自定义图片解析与复制能力
要点：支持常见 Markdown 语法扩展，便于后续继续接入表格、任务列表等能力
用法：<MarkdownRenderer content={md} />
*/
import { Children, isValidElement, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CopyOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function resolveImage(src: string) {
  // Markdown 中既支持绝对 http 链接，也支持相对路径自动映射到服务端静态资源接口。
  if (/^https?:\/\//.test(src)) return src;
  if (src.startsWith("/api/static/")) return src;
  return `/api/static/${src.replace(/^\.?\//, "")}`;
}

function getTextContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getTextContent).join("");
  }

  if (isValidElement(node)) {
    return getTextContent((node.props as { children?: ReactNode }).children);
  }

  return "";
}

function extractCodeBlock(children: ReactNode) {
  // react-markdown 会把 ```code``` 包成 pre > code，这里把语言和纯文本提取出来交给高亮组件。
  const [firstChild] = Children.toArray(children);
  if (!isValidElement(firstChild)) {
    return null;
  }

  const props = firstChild.props as {
    className?: string;
    children?: ReactNode;
  };
  const className = props.className ?? "";
  const match = /language-([\w-]+)/.exec(className);

  return {
    code: getTextContent(props.children).replace(/\n$/, ""),
    lang: normalizeCodeLang(match?.[1]),
  };
}

function normalizeCodeLang(lang?: string) {
  if (!lang) return "javascript";

  const aliases: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    shell: "bash",
    sh: "bash",
    cmd: "bash",
    json5: "json",
    md: "markdown",
  };

  return aliases[lang] ?? lang;
}

export function MarkdownRenderer({ content }: { content: string }) {
  const components = useMemo<Components>(
    () => ({
      a: ({ href = "", ...props }) => (
        <a href={href} target="_blank" rel="noreferrer" {...props} />
      ),
      img: ({ src = "", alt = "", ...props }) => (
        // 统一把 Markdown 图片地址映射到项目可访问的静态资源路径。
        <img
          {...props}
          src={resolveImage(src)}
          alt={alt}
          className="md-image"
        />
      ),
      pre: ({ children }) => {
        const block = extractCodeBlock(children);
        if (!block) {
          return <pre className="code-block">{children}</pre>;
        }

        // 代码块单独交给高亮组件渲染，顺便保留复制按钮和项目样式。
        return <CodeBlock code={block.code} lang={block.lang} />;
      },
    }),
    [],
  );

  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
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
        <CopyOutlined />
        <span>{copied ? "已复制" : "复制"}</span>
      </button>
      <pre className="code-block" data-lang={lang}>
        {/* 高亮库负责语言着色，外层 pre 继续复用项目现有的视觉样式。 */}
        <SyntaxHighlighter
          language={lang}
          style={oneDark}
          PreTag="div"
          showLineNumbers
          wrapLongLines
          customStyle={{
            margin: 0,
            padding: 0,
            background: "transparent",
            fontSize: "15px",
          }}
          lineNumberStyle={{
            minWidth: "2.8em",
            paddingRight: "16px",
            color: "#7f8ea3",
            opacity: 0.85,
            textAlign: "right",
            userSelect: "none",
          }}
          codeTagProps={{
            style: {
              fontFamily: '"Cascadia Code", Consolas, monospace',
              lineHeight: 1.75,
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      </pre>
    </div>
  );
}
