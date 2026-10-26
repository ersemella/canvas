import {useState} from 'react';
import {Button, Paper, Stack, Text} from '@mantine/core';
import {HEROES, HERO_PORTRAIT, PASSIVES, RULES, healthOf} from '@canvas/games-silk-road-run';
import type {
  FightState,
  PassiveGroup,
  PassiveId,
  PassivePick,
  Provision,
  StatId,
  Unit,
} from '@canvas/games-silk-road-run';
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

/** A passive's kind, over its name (progression.md, 19.8's headings). */
const GROUP_LABEL: Record<PassiveGroup, string> = {
  track: 'Track',
  board: 'Board',
  damage: 'Damage and survival',
  control: 'Control',
  allies: 'Position and allies',
};

/** What the caravan takes with it from the caravanserai. */
export interface SetOut {
  provision?: Provision;
  passive?: PassivePick;
}

/**
 * The caravanserai, between a won stage and the next (progression.md,
 * 19.2): after a stage that earns a provision, one hero still standing
 * takes 1 more of one stat, for the rest of the run, and the caravan sets
 * out. When the stage offers passives (`passives`, 19.3's passive slot) one
 * of three is taken, and one hero standing carries it for the rest
 * of the run. The camel takes neither. After a stage that earns nothing
 * the caravan only rests.
 */
export function Caravanserai(props: {
  fight: FightState;
  stage: number;
  stages: number;
  provision: boolean;
  passives: PassiveId[];
  busy: boolean;
  error: string | null;
  onSetOut: (choices: SetOut) => void;
}) {
  const [picked, setPicked] = useState<Provision | null>(null);
  const [passive, setPassive] = useState<PassiveId | null>(null);
  const [carrier, setCarrier] = useState<Unit['hero'] | null>(null);
  const offered = props.passives.length > 0;
  const carries = (unit: Unit, id: PassiveId | null) =>
    id !== null && (unit.passives?.includes(id) ?? false);
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
                : offered
                  ? ': take one of three passives for one hero, for the rest of the run.'
                  : '.'}
            </Text>
          </Stack>

          {offered && (
            <Stack gap="sm">
              <div className={styles.passiveOffer} data-testid="passive-offer">
                {props.passives.map((id) => {
                  const def = PASSIVES[id];
                  const on = passive === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`${styles.provisionStat} ${styles.passiveCard} ${on ? styles.heroPicked : ''}`}
                      aria-pressed={on}
                      data-testid={`passive-${id}`}
                      onClick={() => {
                        setPassive(id);
                        // A hero already carrying it can't take it again.
                        const unit = heroes.find((u) => u.hero === carrier);
                        if (unit && carries(unit, id)) setCarrier(null);
                      }}
                    >
                      <span className={styles.provisionNote}>{GROUP_LABEL[def.group]}</span>
                      <span className={`${styles.display} ${styles.passiveName}`}>{def.name}</span>
                      <span>{def.rule}</span>
                    </button>
                  );
                })}
              </div>
              <Text fz="sm" c="dimmed">
                Who carries it?
              </Text>
              <div className={styles.carriers} data-testid="passive-carriers">
                {heroes.map((unit) => {
                  const on = carrier === unit.hero;
                  const portrait = HERO_PORTRAIT[unit.hero]?.src;
                  const has = carries(unit, passive);
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      className={`${styles.provisionStat} ${styles.carrier} ${on ? styles.heroPicked : ''}`}
                      aria-pressed={on}
                      disabled={has}
                      data-testid={`carrier-${unit.hero}`}
                      onClick={() => setCarrier(unit.hero)}
                    >
                      <span className={styles.carrierPortrait}>
                        {portrait ? <img src={portrait} alt="" /> : HEROES[unit.hero].letter}
                      </span>
                      <span>
                        {HEROES[unit.hero].name}
                        {has && <span className={styles.provisionNote}> carries it</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Stack>
          )}

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
            {offered && (
              <Text c="dimmed" fz="sm" ta="center" mih="1.5em" data-testid="passive-rule">
                {passive && carrier
                  ? `${HEROES[carrier].name} carries ${PASSIVES[passive].name}.`
                  : passive
                    ? 'Choose a hero to carry it.'
                    : 'Choose a passive.'}
              </Text>
            )}
            <Button
              size="lg"
              className={styles.seal!}
              fw="bold"
              loading={props.busy}
              disabled={(props.provision && !picked) || (offered && !(passive && carrier))}
              onClick={() =>
                props.onSetOut({
                  ...(props.provision && picked ? {provision: picked} : {}),
                  ...(offered && passive && carrier ? {passive: {hero: carrier, passive}} : {}),
                })
              }
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

/**
 * One hero standing: portrait and name, and a choice for each stat, showing
 * what 1 more makes it; a stat already at RULES.statMax can't be chosen.
 */
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
          // No stat goes above RULES.statMax.
          const full = unit[stat] >= RULES.statMax;
          return (
            <button
              key={stat}
              type="button"
              className={`${styles.provisionStat} ${on ? styles.heroPicked : ''}`}
              aria-pressed={on}
              disabled={full}
              data-testid={`provision-${unit.hero}-${stat}`}
              onClick={() => props.onPick(stat)}
            >
              <span>{label}</span>
              <span>
                {full ? (
                  <>
                    {unit[stat]} <span className={styles.provisionNote}>at most</span>
                  </>
                ) : (
                  <>
                    {unit[stat]} → <b>{unit[stat] + 1}</b>
                  </>
                )}
              </span>
              {stat === 'defence' && !full && (
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
