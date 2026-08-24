import React from 'react';

interface FormattedTextProps {
  text: string;
  className?: string;
}

export const FormattedText: React.FC<FormattedTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // Split by code blocks ```code```
  const codeBlockRegex = /```([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    parts.push({ type: 'code', content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  const renderInline = (str: string) => {
    // Mentions @Name or @channel
    const mentionRegex = /(@[\w.-]+)/g;
    const tokens = str.split(mentionRegex);

    return tokens.map((token, idx) => {
      if (token.startsWith('@')) {
        return (
          <span
            key={idx}
            className="inline-block bg-indigo-500/20 text-indigo-300 font-semibold px-1.5 py-0.5 rounded-md text-[12px] mx-0.5 border border-indigo-500/30"
          >
            {token}
          </span>
        );
      }

      // Parse bold **text**
      const boldParts = token.split(/(\*\*.*?\*\*)/g);
      return boldParts.map((bPart, bIdx) => {
        if (bPart.startsWith('**') && bPart.endsWith('**')) {
          return <strong key={`${idx}-${bIdx}`} className="font-bold text-white">{bPart.slice(2, -2)}</strong>;
        }

        // Parse italic *text*
        const italicParts = bPart.split(/(\*.*?\*)/g);
        return italicParts.map((iPart, iIdx) => {
          if (iPart.startsWith('*') && iPart.endsWith('*')) {
            return <em key={`${idx}-${bIdx}-${iIdx}`} className="italic text-slate-300">{iPart.slice(1, -1)}</em>;
          }
          return iPart;
        });
      });
    });
  };

  return (
    <div className={`space-y-1.5 leading-relaxed text-sm ${className}`}>
      {parts.map((part, index) => {
        if (part.type === 'code') {
          return (
            <div key={index} className="my-2 rounded-xl bg-[#0f0e13] border border-white/10 p-3 font-mono text-xs text-emerald-400 overflow-x-auto select-text shadow-inner">
              <pre className="whitespace-pre">{part.content}</pre>
            </div>
          );
        }

        // Normal paragraph with line breaks
        const lines = part.content.split('\n');
        return (
          <p key={index} className="whitespace-pre-wrap break-words">
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {renderInline(line)}
                {lIdx < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
};
