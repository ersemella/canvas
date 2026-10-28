import {useState} from 'react';
import {Link} from 'react-router-dom';
import {Button, Paper, Stack, Text} from '@mantine/core';
import {HEROES, HERO_PORTRAIT, PARTY, ROSTER} from '@canvas/games-silk-road-run';
import type {HeroId} from '@canvas/games-silk-road-run';
import {PALETTE_VARS} from './TacticsPanels';
import styles from './TacticsPage.module.css';

const PARTY_STORAGE = 'canvas:tactics:party';

/**
 * Each hero in a line or two of story (roster.md, 15.8): who they are, not
 * their numbers. No real names, places or cultures: those show only in the
 * art (owner, 2026-10-26).
 */
const LORE: Partial<Record<HeroId, string>> = {
  bokh: 'A champion wrestler of the festival games. The Bonebreaker fights bare handed, seizing enemies, pinning them down, and hurling them aside.',
  mangudai:
    'A mounted archer who rides ahead of the army. The Harrier strikes from afar with a composite bow and relies on a fast horse to stay out of reach.',
  storm:
    'A weather worker born with the gift of commanding storms. With a sacred rain stone, the Storm Caller brings down hail that holds whoever it catches fast, though storms never choose sides.',
  modao:
    'An armoured spearhead of the imperial army, wielding a long two-handed blade. The Vanguard is slow, but its blade cuts through the first foe into the one behind.',
  alchemist:
    'A master of elixirs, brewed from minerals in sealed crucibles. The Alchemist throws an elixir at anyone close by, itself included: an ally is mended and strikes harder, while an enemy is scalded and weakened.',
  youxia:
    'A wandering knight-errant, sworn to keep their word and avenge wrongs. The Oathblade travels light with a straight sword, and every stroke that lands quickens the next.',
  mahout:
    'A driver of war elephants, perched behind the ears of a beast no one can shift. The Juggernaut tramples through whatever stands in the way, driving a whole line of foes back before it, and neither a wrestler’s grip nor the hail can hold it.',
  archer:
    'A foot archer of the royal army, whose heavy arrows punch through armour. The Deadeye hits harder than anyone, and the first unit in its line staggers, losing time, but it is frail and must be kept out of reach.',
  magus:
    'A court astrologer who reads the stars with an astrolabe. The Magus strikes no one, but reads an omen for one unit: an ally acts at once, an enemy must wait until the Magus has acted again, while its own course is fixed and cannot be hurried or held back.',
};

/**
 * The stats on the menu, each a meter of three pips, one a point (the
 * heroes' stats run 0 to 3, owner 2026-10-23). Health follows from defence.
 */
const METERS: {label: string; value: (h: (typeof HEROES)[HeroId]) => number}[] = [
  {label: 'Speed', value: (h) => h.speed},
  {label: 'Power', value: (h) => h.power},
  {label: 'Defence', value: (h) => h.defence},
];

/** A party's most heroes: the default party's size. */
const MAX_PARTY = PARTY.length;

/** The party chosen last time, if it's still a valid one; else the default party. */
function savedParty(): HeroId[] {
  try {
    const saved = JSON.parse(localStorage.getItem(PARTY_STORAGE) ?? 'null') as unknown;
    if (Array.isArray(saved)) {
      const party = ROSTER.filter((h) => saved.includes(h));
      if (party.length && party.length <= MAX_PARTY) return party;
    }
  } catch {
    // storage blocked or garbled: the default party comes
  }
  return PARTY;
}

/**
 * The start menu: what the game is, which heroes to take (the camel always
 * comes), and Start, which always starts a new run (a new seed), and a way
 * back to the Canvas home page. Test stage starts a run of one fight set
 * up in test-stage.json instead (in the game's package), for play-testing.
 */
export function StartMenu(props: {
  busy: boolean;
  error: string | null;
  onStart: (party: HeroId[]) => void;
  onTest: () => void;
}) {
  const [party, setParty] = useState<HeroId[]>(savedParty);
  const toggle = (hero: HeroId) =>
    setParty((p) =>
      !p.includes(hero) && p.length >= MAX_PARTY
        ? p
        : ROSTER.filter((h) => (h === hero ? !p.includes(h) : p.includes(h)))
    );
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
              Caravan
            </Text>
            <Text>
              Lead a caravan down a long road across the world. Humphrey, your camel, carries the
              cargo and walks the road on its own: guard it against rival caravans and the spirits
              and monsters of every land you cross. Your heroes start every fight fresh, but
              Humphrey’s wounds stay with it all the way down the road.
            </Text>
          </Stack>

          <Stack gap="xs">
            <Text className={styles.display!} fw="bold">
              Choose your party{' '}
              <Text span c="dimmed" fz="sm" fw="normal">
                {party.length} of {MAX_PARTY}
              </Text>
            </Text>
            <div className={styles.heroPicks} data-testid="hero-picks">
              {ROSTER.map((hero) => (
                <HeroPick
                  key={hero}
                  hero={hero}
                  picked={party.includes(hero)}
                  full={party.length >= MAX_PARTY}
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
              Start
            </Button>
            {party.length === 0 && (
              <Text c="dimmed" fz="sm" ta="center">
                Choose at least one hero.
              </Text>
            )}
            <Button component={Link} to="/" variant="subtle" color="yellow">
              Back to Canvas
            </Button>
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={props.onTest}
              disabled={props.busy}
              data-testid="test-stage"
            >
              Test stage (set up in test-stage.json)
            </Button>
            {props.error && <Text c="var(--c-madderLight)">{props.error}</Text>}
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}

/** One hero on the start menu, a row: portrait, story and stat meters; tap to take or leave it. */
function HeroPick(props: {hero: HeroId; picked: boolean; full: boolean; onToggle: () => void}) {
  const stats = HEROES[props.hero];
  const lore = LORE[props.hero];
  const portrait = HERO_PORTRAIT[props.hero]?.src;
  return (
    <button
      type="button"
      className={`${styles.heroPick} ${props.picked ? styles.heroPicked : ''}`}
      aria-pressed={props.picked}
      disabled={!props.picked && props.full}
      onClick={props.onToggle}
    >
      <div className={styles.heroPickPortrait}>
        {portrait ? <img src={portrait} alt="" /> : stats.letter}
      </div>
      <div className={styles.heroPickHead}>
        <span className={styles.display}>{stats.name}</span>
        <span className={styles.heroPickMark}>
          {props.picked ? '✓ In the party' : props.full ? 'Party full' : 'Left behind'}
        </span>
      </div>
      {lore && <div className={styles.heroPickBlurb}>{lore}</div>}
      <div className={styles.heroPickStats}>
        {METERS.map(({label, value}) => {
          const filled = value(stats);
          return (
            <div key={label} role="img" aria-label={`${label}: ${filled}`}>
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
