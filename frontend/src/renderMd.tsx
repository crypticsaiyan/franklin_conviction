import type { ReactNode } from 'react';

/**
 * Minimal inline markdown → JSX: **bold**, *italic*, line breaks.
 * No library needed for the subset LLMs actually emit.
 */
export function renderMd(text: string): ReactNode {
  const lines = text.split('\n');
  return lines.map((line, li) => {
    const nodes: ReactNode[] = [];
    // regex: **bold** | *italic* | plain runs
    const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) nodes.push(line.slice(last, m.index));
      if (m[1] !== undefined) nodes.push(<strong key={m.index}>{m[1]}</strong>);
      else if (m[2] !== undefined) nodes.push(<em key={m.index}>{m[2]}</em>);
      last = m.index + m[0].length;
    }
    if (last < line.length) nodes.push(line.slice(last));
    return (
      <span key={li}>
        {nodes}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
}
