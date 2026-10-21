import {useState} from 'react';
import {Button, Paper, Stack, Text} from '@mantine/core';
import {HEROES, HERO_PORTRAIT, PARTY} from '@canvas/games-silk-road-tactics';
import type {HeroId} from '@canvas/games-silk-road-tactics';
import {PALETTE_VARS} from './TacticsPanels';
import styles from './TacticsPage.module.css';

const PARTY_STORAGE = 'canvas:tactics:party';

/** Each hero in a line or two of story (roster.md, 15.8): who they are, not their numbers. */
const LORE: Partial<Record<HeroId, string>> = {
  bokh: 'A Mongol wrestler famed at the naadam games. The Champion fights bare handed, seizing enemies, pinning them down, and hurling them aside.',
  mangudai:
    'A Mongol horse archer from the vanguard of the Mongol army. The Outrider strikes from afar with a composite bow and relies on a fast horse to stay out of reach.',
  storm:
    'A Turkic weather worker born with the gift of commanding storms. With a sacred rain stone, the Storm Caller brings down hail, sunlight, and freezing cold, though storms never choose sides.',
};

/** The stats on the menu, each a meter of three pips: Low, Medium, High (roster.md's bands). */
const METERS: {label: string; band: (h: (typeof HEROES)[HeroId]) => number}[] = [
  {label: 'Health', band: (h) => (h.health <= 300 ? 1 : h.health <= 420 ? 2 : 3)},
  {label: 'Speed', band: (h) => statBand(h.speed)},
  {label: 'Power', band: (h) => statBand(h.power)},
  {label: 'Defence', band: (h) => statBand(h.defence)},
];
const BAND_NAME = ['', 'Low', 'Medium', 'High'];

/** Speed, power and defence share one scale: Low 10, Medium 25, High 40 (config.ts). */
function statBand(value: number): number {
  return value <= 10 ? 1 : value <= 25 ? 2 : 3;
}

/** The party chosen last time, if it's still a valid one; else everyone. */
function savedParty(): HeroId[] {
  try {
    const saved = JSON.parse(localStorage.getItem(PARTY_STORAGE) ?? 'null') as unknown;
    if (Array.isArray(saved)) {
      const party = PARTY.filter((h) => saved.includes(h));
      if (party.length) return party;
    }
  } catch {
    // storage blocked or garbled: everyone comes
  }
  return PARTY;
}

/**
 * The start menu: what the game is, which heroes to take (the camel always
 * comes), and Start. `onBack` returns to a finished fight's result.
 */
export function StartMenu(props: {
  busy: boolean;
  error: string | null;
  onStart: (party: HeroId[]) => void;
  onBack?: () => void;
}) {
  const [party, setParty] = useState<HeroId[]>(savedParty);
  const toggle = (hero: HeroId) =>
    setParty((p) => PARTY.filter((h) => (h === hero ? !p.includes(h) : p.includes(h))));
  const start = () => {
    try {
      localStorage.setItem(PARTY_STORAGE, JSON.stringify(party));
    } catch {
      // the choice just isn't remembered
    }
    props.onStart(party);
  };

  return (
    <Stack
      className={`${styles.page} ${styles.startPage}`}
      style={PALETTE_VARS}
      align="center"
      py={{base: 'sm', sm: 'xl'}}
      gap="lg"
      px={{base: 'xs', sm: 'md'}}
    >
      <Paper className={styles.plaque!} p={{base: 'md', sm: 'xl'}} maw={760} w="100%">
        <Stack gap="lg">
          <Stack gap="xs">
            <Text component="h1" className={styles.display!} fz={28} fw="bold" m={0}>
              Silk Road Tactics
            </Text>
            <Text>
              Lead a caravan from the Mongolian steppe to Byzantium, guarding your cargo against
              rival caravans and the spirits and monsters of every land you cross. Along the way,
              rest at caravanserais, trade in bazaars, and hire travellers to join your band.
            </Text>
          </Stack>

          <Stack gap="xs">
            <Text className={styles.display!} fw="bold">
              Choose your party{' '}
              <Text span c="dimmed" fz="sm" fw="normal">
                {party.length} of {PARTY.length}
              </Text>
            </Text>
            <div className={styles.heroPicks} data-testid="hero-picks">
              {PARTY.map((hero) => (
                <HeroPick
                  key={hero}
                  hero={hero}
                  picked={party.includes(hero)}
                  onToggle={() => toggle(hero)}
                />
              ))}
            </div>
          </Stack>

          <Stack gap="xs">
            <Button
              size="lg"
              className={styles.seal!}
              fw="bold"
              onClick={start}
              loading={props.busy}
              disabled={party.length === 0}
            >
              Start a fight
            </Button>
            {party.length === 0 && (
              <Text c="dimmed" fz="sm" ta="center">
                Choose at least one hero.
              </Text>
            )}
            {props.onBack && (
              <Button variant="subtle" color="yellow" onClick={props.onBack}>
                Back to the fight
              </Button>
            )}
            {props.error && <Text c="var(--c-madderLight)">{props.error}</Text>}
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}

/** One hero on the start menu: portrait, story and stat meters; tap to take or leave it. */
function HeroPick(props: {hero: HeroId; picked: boolean; onToggle: () => void}) {
  const stats = HEROES[props.hero];
  const lore = LORE[props.hero];
  const portrait = HERO_PORTRAIT[props.hero]?.src;
  return (
    <button
      type="button"
      className={`${styles.heroPick} ${props.picked ? styles.heroPicked : ''}`}
      aria-pressed={props.picked}
      onClick={props.onToggle}
    >
      <div className={styles.heroPickHead}>
        <div className={styles.heroPickPortrait}>
          {portrait ? <img src={portrait} alt="" /> : stats.letter}
        </div>
        <div>
          <div className={styles.display}>{stats.name}</div>
          <div className={styles.heroPickMark}>
            {props.picked ? '✓ In the party' : 'Left behind'}
          </div>
        </div>
      </div>
      {lore && <div className={styles.heroPickBlurb}>{lore}</div>}
      <div className={styles.heroPickStats}>
        {METERS.map(({label, band}) => {
          const filled = band(stats);
          return (
            <div key={label} role="img" aria-label={`${label}: ${BAND_NAME[filled]}`}>
              <span>{label}</span>
              <span className={styles.meter}>
                {[1, 2, 3].map((pip) => (
                  <i key={pip} className={pip <= filled ? styles.meterOn : undefined} />
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </button>
  );
}
