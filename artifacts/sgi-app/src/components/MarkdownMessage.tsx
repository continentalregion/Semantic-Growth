import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface Props {
  content: string;
  isUser?: boolean;
}

const PROMPT_RE = /^(>\s?.+(\n>.*)*)/m;

function detectPromptBlocks(content: string): boolean {
  return PROMPT_RE.test(content);
}

const assistantComponents: Components = {
  code({ className, children, ...props }) {
    const isInline = !className;
    const match = /language-(\w+)/.exec(className ?? "");
    const lang = match?.[1] ?? "";

    if (isInline) {
      return (
        <code
          style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontSize: "0.8em",
            padding: "2px 6px",
            borderRadius: "4px",
            background: "rgba(124,107,255,0.18)",
            border: "1px solid rgba(124,107,255,0.25)",
            color: "#c4b5fd",
          }}
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <div
        style={{
          margin: "10px 0",
          borderRadius: "10px",
          overflow: "hidden",
          border: "1px solid rgba(124,107,255,0.25)",
          background: "rgba(8,9,20,0.95)",
        }}
      >
        {lang && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 14px",
              borderBottom: "1px solid rgba(124,107,255,0.18)",
              background: "rgba(124,107,255,0.1)",
            }}
          >
            <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.5px", color: "#a89fff", textTransform: "uppercase" }}>
              {lang}
            </span>
            <span style={{ fontSize: "9px", color: "rgba(144,144,184,0.5)" }}>code</span>
          </div>
        )}
        <pre
          style={{
            margin: 0,
            padding: "14px 16px",
            overflowX: "auto",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontSize: "12.5px",
            lineHeight: "1.6",
            color: "#e2e2ff",
          }}
        >
          <code>{children}</code>
        </pre>
      </div>
    );
  },

  blockquote({ children }) {
    return (
      <blockquote
        style={{
          margin: "10px 0",
          padding: "10px 14px",
          borderRadius: "8px",
          borderLeft: "3px solid #06d6a0",
          background: "rgba(6,214,160,0.07)",
          color: "#a8f5e0",
          fontStyle: "italic",
          fontSize: "0.9em",
        }}
      >
        {children}
      </blockquote>
    );
  },

  p({ children }) {
    return (
      <p style={{ margin: "6px 0", lineHeight: "1.7", color: "#eeeeff" }}>
        {children}
      </p>
    );
  },

  h1({ children }) {
    return <h1 style={{ fontSize: "1.15em", fontWeight: 700, color: "#fff", margin: "12px 0 6px" }}>{children}</h1>;
  },
  h2({ children }) {
    return <h2 style={{ fontSize: "1.05em", fontWeight: 600, color: "#eeeeff", margin: "10px 0 5px" }}>{children}</h2>;
  },
  h3({ children }) {
    return <h3 style={{ fontSize: "0.95em", fontWeight: 600, color: "#d0d0f0", margin: "8px 0 4px" }}>{children}</h3>;
  },

  ul({ children }) {
    return <ul style={{ paddingLeft: "18px", margin: "6px 0" }}>{children}</ul>;
  },
  ol({ children }) {
    return <ol style={{ paddingLeft: "18px", margin: "6px 0" }}>{children}</ol>;
  },
  li({ children }) {
    return <li style={{ margin: "3px 0", color: "#d0d0f0" }}>{children}</li>;
  },

  strong({ children }) {
    return <strong style={{ fontWeight: 700, color: "#fff" }}>{children}</strong>;
  },

  em({ children }) {
    return <em style={{ color: "#b0a0f0", fontStyle: "italic" }}>{children}</em>;
  },

  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "#7c6bff", textDecoration: "underline", textDecorationColor: "rgba(124,107,255,0.4)" }}
      >
        {children}
      </a>
    );
  },

  hr() {
    return <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.1)", margin: "10px 0" }} />;
  },

  table({ children }) {
    return (
      <div style={{ overflowX: "auto", margin: "10px 0" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
          {children}
        </table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th style={{ padding: "6px 10px", borderBottom: "2px solid rgba(124,107,255,0.4)", color: "#a89fff", fontWeight: 600, textAlign: "left" }}>
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td style={{ padding: "5px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)", color: "#d0d0f0" }}>
        {children}
      </td>
    );
  },
};

export default function MarkdownMessage({ content, isUser = false }: Props) {
  if (isUser) {
    return (
      <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content}</span>
    );
  }

  return (
    <div style={{ minWidth: 0, wordBreak: "break-word" }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={assistantComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
