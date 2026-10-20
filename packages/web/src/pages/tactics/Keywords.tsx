import {createContext, useContext, useState} from 'react';
import {CloseButton, Text} from '@mantine/core';
import {KEYWORD_INFO} from '@canvas/games-silk-road-tactics';
import type {KeywordId} from '@canvas/games-silk-road-tactics';
import styles from './TacticsPage.module.css';

const GlossaryContext = createContext<{
  active: KeywordId | null;
  show: (id: KeywordId) => void;
} | null>(null);

/**
 * Holds the keyword last tapped in its children and shows that keyword's
 * rule in a box below them (kept in view at the bottom of a scrolling
 * tooltip). Tapping the keyword again, or the box's ×, hides it.
 */
export function Glossary({children}: {children: React.ReactNode}) {
  const [active, setActive] = useState<KeywordId | null>(null);
  const show = (id: KeywordId) => setActive((a) => (a === id ? null : id));
  return (
    <GlossaryContext.Provider value={{active, show}}>
      {children}
      {active && (
        <div className={styles.glossary} data-testid="keyword-info">
          <Text fz="xs" style={{flex: 1}}>
            <b>{KEYWORD_INFO[active].name}.</b> {KEYWORD_INFO[active].detail}
          </Text>
          <CloseButton size="sm" aria-label="Hide" onClick={() => setActive(null)} />
        </div>
      )}
    </GlossaryContext.Provider>
  );
}

/** How a keyword reads: harmful statuses warm, the hex's own effect grey, the rest neutral. */
const TONE: Partial<Record<KeywordId, string>> = {
  immobilized: 'var(--mantine-color-orange-4)',
  slowed: 'var(--mantine-color-orange-4)',
  vulnerable: 'var(--mantine-color-orange-4)',
  taunted: 'var(--mantine-color-orange-4)',
  crushed: 'var(--mantine-color-orange-4)',
  flanked: 'var(--mantine-color-orange-4)',
  obscured: 'var(--mantine-color-gray-4)',
  cleanse: 'var(--mantine-color-green-4)',
  melee: 'var(--mantine-color-red-3)',
  ultimate: 'var(--mantine-color-grape-4)',
  charged: 'var(--mantine-color-grape-3)',
};

/**
 * A word with a rule behind it: marked (coloured, dotted underline) and
 * tappable inside a Glossary; plain text outside one.
 */
export function Term(props: {id: KeywordId; children: React.ReactNode; className?: string}) {
  const glossary = useContext(GlossaryContext);
  if (!glossary) return <>{props.children}</>;
  const color = TONE[props.id];
  return (
    <button
      type="button"
      className={`${styles.term} ${props.className ?? ''}`}
      data-keyword={props.id}
      aria-pressed={glossary.active === props.id}
      style={color ? {color} : undefined}
      onClick={() => glossary.show(props.id)}
    >
      {props.children}
    </button>
  );
}

/** The keywords as written in the rules' text, with any number that belongs to them (Slowed 2, Vulnerable 10%). */
const WORDS: [RegExp, KeywordId][] = [
  [/Melee/, 'melee'],
  [/Immobilized/, 'immobilized'],
  [/Slowed(?: \d+)?/, 'slowed'],
  [/Vulnerable(?: \d+%)?/, 'vulnerable'],
  [/Taunted/, 'taunted'],
  [/Crushed/, 'crushed'],
  [/Flanked/, 'flanked'],
  [/Obscured/, 'obscured'],
  [/[Cc]leanse[sd]?/, 'cleanse'],
];
const ANY = new RegExp(WORDS.map(([re]) => `(${re.source})`).join('|'), 'g');

/** Rules text with its keywords marked as Terms. */
export function KeywordText({text}: {text: string}) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(ANY)) {
    const i = m.slice(1).findIndex((g) => g !== undefined);
    parts.push(text.slice(last, m.index));
    parts.push(
      <Term key={m.index} id={WORDS[i]![1]}>
        {m[0]}
      </Term>
    );
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}
