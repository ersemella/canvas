import type {GridPuzzleConfigData} from 'components/GridPuzzleConfigComponent';

export type PuzzleGeneratorFn = (config: GridPuzzleConfigData) => number[][];

const registry = new Map<string, PuzzleGeneratorFn>();

export const puzzleGenerators = {
  register(name: string, fn: PuzzleGeneratorFn): void {
    registry.set(name, fn);
  },
  get(name: string): PuzzleGeneratorFn | undefined {
    return registry.get(name);
  },
};
