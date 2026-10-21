import {createContext, useContext, useRef, useState} from 'react';
import {CloseButton, Text} from '@mantine/core';
import {KEYWORD_INFO} from '@canvas/games-silk-road-tactics';
import type {KeywordId} from '@canvas/games-silk-road-tactics';
import styles from './TacticsPage.module.css';

/** What the box explains: a keyword, or an ability (with a keyword from its text under it). */
type Shown =
  | {kind: 'keyword'; id: KeywordId}
  | {kind: 'ability'; id: string; keyword: KeywordId | null};

const GlossaryContext = createContext<{
  shown: Shown | null;
  showKeyword: (id: KeywordId) => void;
  showAbility: (id: string) => void;
  /** Each ability's explanation, as its name last rendered it: the box shows the current one. */
  bodies: Map<string, React.ReactNode>;
} | null>(null);

/** Inside the box: a keyword tapped there explains itself under the ability, not instead of it. */
const InBoxContext = createContext(false);

/**
 * Holds what was last tapped in its children, a keyword or an ability's
 * name, and explains it in a box below them (kept in view at the bottom of
 * a scrolling tooltip). An ability's text has keywords of its own: tapping
 * one adds its rule under the ability's. Tapping the same thing again, or
 * the box's ×, hides it.
 */
export function Glossary({children}: {children: React.ReactNode}) {
  const [shown, setShown] = useState<Shown | null>(null);
  const bodies = useRef(new Map<string, React.ReactNode>()).current;
  const showKeyword = (id: KeywordId) =>
    setShown((s) => (s?.kind === 'keyword' && s.id === id ? null : {kind: 'keyword', id}));
  const showAbility = (id: string) =>
    setShown((s) =>
      s?.kind === 'ability' && s.id === id ? null : {kind: 'ability', id, keyword: null}
    );
  const showNested = (id: KeywordId) =>
    setShown((s) => (s?.kind === 'ability' ? {...s, keyword: s.keyword === id ? null : id} : s));
  const rule = (id: KeywordId) => (
    <Text fz="xs" data-testid="keyword-info">
      <b>{KEYWORD_INFO[id].name}.</b> {KEYWORD_INFO[id].detail}
    </Text>
  );
  return (
    <GlossaryContext.Provider value={{shown, showKeyword, showAbility, bodies}}>
      {children}
      {shown && (
        <div className={styles.glossary}>
          <div style={{flex: 1}}>
            {shown.kind === 'keyword' ? (
              rule(shown.id)
            ) : (
              <>
                <GlossaryContext.Provider
                  value={{shown, showKeyword: showNested, showAbility, bodies}}
                >
                  <InBoxContext.Provider value>
                    <div data-testid="ability-info">{bodies.get(shown.id)}</div>
                  </InBoxContext.Provider>
                </GlossaryContext.Provider>
                {shown.keyword && <div className={styles.nestedRule}>{rule(shown.keyword)}</div>}
              </>
            )}
          </div>
          <CloseButton size="sm" aria-label="Hide" onClick={() => setShown(null)} />
        </div>
      )}
    </GlossaryContext.Provider>
  );
}

/** How a keyword reads: harmful statuses warm, the hex's own effect grey, the rest neutral. */
const TONE: Partial<Record<KeywordId, string>> = {
  immobilized: 'var(--c-gold)',
  slowed: 'var(--c-gold)',
  vulnerable: 'var(--c-gold)',
  taunted: 'var(--c-gold)',
  crushed: 'var(--c-gold)',
  flanked: 'var(--c-gold)',
  obscured: 'var(--c-dusk4)',
  cleanse: 'var(--c-jade)',
  melee: 'var(--c-madderLight)',
  ultimate: 'var(--c-plumLight)',
  charged: 'var(--c-plumLight)',
};

/**
 * A word with a rule behind it: marked (coloured, dotted underline) and
 * tappable inside a Glossary; plain text outside one.
 */
export function Term(props: {id: KeywordId; children: React.ReactNode}) {
  const glossary = useContext(GlossaryContext);
  const inBox = useContext(InBoxContext);
  if (!glossary) return <>{props.children}</>;
  const {shown} = glossary;
  const pressed = inBox
    ? shown?.kind === 'ability' && shown.keyword === props.id
    : shown?.kind === 'keyword' && shown.id === props.id;
  const color = TONE[props.id];
  return (
    <button
      type="button"
      className={styles.term}
      data-keyword={props.id}
      aria-pressed={pressed}
      style={color ? {color} : undefined}
      onClick={() => glossary.showKeyword(props.id)}
    >
      {props.children}
    </button>
  );
}

/**
 * An ability's name, tappable inside a Glossary to explain it there
 * (`body`); its label is what the list shows (name, cost, charge).
 */
export function AbilityName(props: {
  id: string;
  body: React.ReactNode;
  ultimate?: boolean;
  children: React.ReactNode;
}) {
  const glossary = useContext(GlossaryContext);
  if (!glossary) return <>{props.children}</>;
  glossary.bodies.set(props.id, props.body);
  const pressed = glossary.shown?.kind === 'ability' && glossary.shown.id === props.id;
  return (
    <button
      type="button"
      className={`${styles.abilityChip} ${props.ultimate ? styles.abilityChipUltimate : ''}`}
      data-ability={props.id}
      aria-pressed={pressed}
      onClick={() => glossary.showAbility(props.id)}
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
