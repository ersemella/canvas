import {useState} from 'react';
import {Button, Paper, Stack, Text} from '@mantine/core';
import {ABILITIES, HEROES, HERO_PORTRAIT, PARTY} from '@canvas/games-silk-road-tactics';
import type {AbilityId, HeroId} from '@canvas/games-silk-road-tactics';
import {AbilityIcon} from './AbilityIcon';
import {PALETTE_VARS} from './TacticsPanels';
import styles from './TacticsPage.module.css';

const PARTY_STORAGE = 'canvas:tactics:party';

/** Each hero's role and one line on how it plays (roster.md, 15.8). */
const ROLE: Partial<Record<HeroId, {role: string; blurb: string}>> = {
  bokh: {
    role: 'Tank',
    blurb: 'A champion wrestler: grabs, pins and throws enemies to hold the front.',
  },
  mangudai: {
    role: 'Damage',
    blurb: 'A mounted archer, fast and fragile: line of fire matters most.',
  },
  storm: {
    role: 'Support',
    blurb: 'A weather-worker: hail slows and hurts, sunlight heals and cleanses.',
  },
};

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
    <Stack className={styles.page!} style={PALETTE_VARS} align="center" py="xl" gap="lg" px="md">
      <Paper className={styles.plaque!} p="xl" maw={760} w="100%">
        <Stack gap="lg">
          <Stack gap="xs">
            <Text component="h1" className={styles.display!} fz={28} fw="bold" m={0}>
              Silk Road Tactics
            </Text>
            <Text>
              Lead a caravan along a fantasy Silk Road. On the Salt Flats Crossing your heroes and
              your camel meet a rival band on a small hex map.
            </Text>
            <ul className={styles.startRules}>
              <li>
                Turn order is a track: an action’s cost, divided by the unit’s speed, sets how far
                its card moves on. Cheap turns come round sooner.
              </li>
              <li>
                Every unit’s stats are shown, the enemy’s too; only what it will choose is hidden.
              </li>
              <li>
                Win by bringing your camel to the road out, or by scattering the rival band. If the
                camel falls, or all your heroes do, the fight is lost.
              </li>
            </ul>
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
            <Text c="dimmed" fz="sm">
              The caravan’s camel always comes: it can’t attack, and the enemy will hunt it.
            </Text>
          </Stack>

          <Text c="dimmed" fz="sm">
            Prototype: one fight. Hero numbers are placeholders.
          </Text>
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

/** One hero on the start menu: portrait, role, stats and abilities; tap to take or leave it. */
function HeroPick(props: {hero: HeroId; picked: boolean; onToggle: () => void}) {
  const stats = HEROES[props.hero];
  const role = ROLE[props.hero];
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
          {role && <div className={styles.heroPickRole}>{role.role}</div>}
          <div className={styles.heroPickMark}>
            {props.picked ? '✓ In the party' : 'Left behind'}
          </div>
        </div>
      </div>
      {role && <div className={styles.heroPickBlurb}>{role.blurb}</div>}
      <div className={styles.heroPickStats}>
        <span>Health {stats.health}</span>
        <span>Speed {stats.speed}</span>
        <span>Power {stats.power}</span>
        <span>Defence {stats.defence}</span>
      </div>
      <div className={styles.heroPickAbilities}>
        {stats.abilities
          .filter((id): id is Exclude<AbilityId, 'hold'> => id !== 'hold')
          .map((id) => (
            <span key={id}>
              <AbilityIcon id={id} />
              {ABILITIES[id].name}
              {id === stats.ultimate ? ' (ultimate)' : ''}
            </span>
          ))}
      </div>
    </button>
  );
}
