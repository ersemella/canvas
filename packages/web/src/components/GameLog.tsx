import {useEffect, useRef} from 'react';
import {ScrollArea, Text, Stack, Box} from '@mantine/core';
import styles from './GameLog.module.css';

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
    <Box className={styles.container!}>
      <Text
        fz={12}
        fw="bold"
        c="dimmed"
        tt="uppercase"
        px="md"
        py={8}
        className={styles.label!}
      >
        Game Log
      </Text>
      <ScrollArea className={styles.scroll!} p="xs">
        <Stack gap={4}>
          {entries.map((entry, i) => (
            <Text
              key={i}
              ff="monospace"
              fz={12}
              c={entry.text.startsWith('---') ? 'yellow' : 'gray.4'}
              fw={entry.text.startsWith('---') ? 'bold' : 'normal'}
            >
              {entry.text}
            </Text>
          ))}
          <div ref={endRef} />
        </Stack>
      </ScrollArea>
    </Box>
  );
}
