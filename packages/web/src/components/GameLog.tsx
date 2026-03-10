import {useEffect, useRef} from 'react';

interface LogEntry {
  text: string;
  timestamp: number;
}

interface Props {
  entries: LogEntry[];
}

export function GameLog({entries}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [entries]);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    }}>
      <div style={{
        padding: '8px 16px',
        fontWeight: 'bold',
        color: '#aaa',
        fontSize: '12px',
        borderBottom: '1px solid #333',
        textTransform: 'uppercase',
      }}>
        Game Log
      </div>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}>
        {entries.map((entry, i) => (
          <div key={i} style={{
            color: entry.text.startsWith('---') ? '#ffd700' : '#ccc',
            fontSize: '12px',
            fontFamily: 'monospace',
            fontWeight: entry.text.startsWith('---') ? 'bold' : 'normal',
          }}>
            {entry.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
