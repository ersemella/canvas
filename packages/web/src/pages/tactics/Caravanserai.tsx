import {useState} from 'react';
import {Button, Paper, Stack, Text} from '@mantine/core';
import {HEROES, HERO_PORTRAIT, healthOf} from '@canvas/games-silk-road-run';
import type {FightState, Provision, StatId, Unit} from '@canvas/games-silk-road-run';
import {PALETTE_VARS} from './TacticsPanels';
import styles from './TacticsPage.module.css';

const STATS: {stat: StatId; label: string}[] = [
  {stat: 'speed', label: 'Speed'},
  {stat: 'power', label: 'Power'},
  {stat: 'defence', label: 'Defence'},
];

/** What a stat point does, under the choices once one is picked. */
const STAT_RULE: Record<StatId, string> = {
  speed: 'Its card comes round the track sooner, so it acts more often.',
  power: 'Each of its abilities deals 1 more damage.',
  defence: 'It has 2 more health.',
};

/**
 * The caravanserai, between a won stage and the next (progression.md,
 * 19.2): after a stage that earns a provision, one hero still standing
 * takes 1 more of one stat, for the rest of the run, and the caravan sets
 * out. The camel can't take one. After a stage that earns none (`provision`
 * false) the caravan only rests.
 */
export function Caravanserai(props: {
  fight: FightState;
  stage: number;
  stages: number;
  provision: boolean;
  busy: boolean;
  error: string | null;
  onSetOut: (provision?: Provision) => void;
}) {
  const [picked, setPicked] = useState<Provision | null>(null);
  const heroes = props.fight.units
    .filter((u) => u.side === 'player' && u.alive && !HEROES[u.hero].walksRoad)
    .sort((a, b) => a.partyIndex - b.partyIndex);

  return (
    <Stack
      className={`${styles.page} ${styles.startPage}`}
      style={PALETTE_VARS}
      align="center"
      py={{base: 'sm', sm: 'xl'}}
      gap="lg"
      px={{base: 'xs', sm: 'md'}}
      data-testid="caravanserai"
    >
      <Paper className={styles.plaque!} p={{base: 'md', sm: 'xl'}} maw={760} w="100%">
        <Stack gap="lg">
          <Stack gap="xs">
            <Text component="h1" className={styles.display!} fz={28} fw="bold" m={0}>
              Caravanserai
            </Text>
            <Text>
              Stage {props.stage + 1} of {props.stages} won. The caravan rests behind the inn’s
              walls before the road goes on
              {props.provision
                ? ': raise one stat of one hero by 1, for the rest of the run.'
                : '.'}
            </Text>
          </Stack>

          {props.provision && (
            <div className={styles.heroPicks} data-testid="provision-picks">
              {heroes.map((unit) => (
                <ProvisionRow
                  key={unit.id}
                  unit={unit}
                  picked={picked?.hero === unit.hero ? picked.stat : null}
                  onPick={(stat) => setPicked({hero: unit.hero, stat})}
                />
              ))}
            </div>
          )}

          <Stack gap="xs">
            {props.provision && (
              <Text c="dimmed" fz="sm" ta="center" mih="1.5em" data-testid="provision-rule">
                {picked
                  ? `${HEROES[picked.hero].name}: ${STAT_RULE[picked.stat]}`
                  : 'Choose a hero’s stat to raise.'}
              </Text>
            )}
            <Button
              size="lg"
              className={styles.seal!}
              fw="bold"
              loading={props.busy}
              disabled={props.provision && !picked}
              onClick={() => props.onSetOut(props.provision ? (picked ?? undefined) : undefined)}
            >
              Set out
            </Button>
            {props.error && <Text c="var(--c-madderLight)">{props.error}</Text>}
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}

/** One hero standing: portrait and name, and a choice for each stat, showing what 1 more makes it. */
function ProvisionRow(props: {unit: Unit; picked: StatId | null; onPick: (stat: StatId) => void}) {
  const {unit} = props;
  const hero = HEROES[unit.hero];
  const portrait = HERO_PORTRAIT[unit.hero]?.src;
  return (
    <div className={styles.provisionHero}>
      <div className={styles.heroPickPortrait}>
        {portrait ? <img src={portrait} alt="" /> : hero.letter}
      </div>
      <span className={styles.display}>{hero.name}</span>
      <div className={styles.provisionStats}>
        {STATS.map(({stat, label}) => {
          const on = props.picked === stat;
          return (
            <button
              key={stat}
              type="button"
              className={`${styles.provisionStat} ${on ? styles.heroPicked : ''}`}
              aria-pressed={on}
              data-testid={`provision-${unit.hero}-${stat}`}
              onClick={() => props.onPick(stat)}
            >
              <span>{label}</span>
              <span>
                {unit[stat]} → <b>{unit[stat] + 1}</b>
              </span>
              {stat === 'defence' && (
                <span className={styles.provisionNote}>
                  health {unit.maxHp} → {healthOf(unit.defence + 1)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
