import { describe, expect, it } from 'vitest';
import { editPackage, parseNewGameArgs, setCopyTitle, stripFeatureLines } from '../../scripts/kit/lib/scaffold.ts';

describe('new-game', () => {
  it('parses the renderer and the features to drop', () => {
    expect(parseNewGameArgs(['--renderer', 'three', '--no-race', '--title', 'Orbs'])).toEqual({
      renderer: 'three',
      drop: ['race'],
      title: 'Orbs',
    });
    expect(parseNewGameArgs([])).toEqual({ renderer: 'pixi', drop: [] });
    expect(() => parseNewGameArgs(['--renderer=babylon'])).toThrow(/pixi, three or none/);
  });

  it('strips the hooks lines of dropped features only', () => {
    const text =
      "import { daily } from './daily.ts'; // new-game:daily\nimport { race } from './race.ts'; // new-game:race\nkeep";
    expect(stripFeatureLines(text, ['daily'])).toBe("import { race } from './race.ts'; // new-game:race\nkeep");
  });

  it('puts the title into COPY.title', () => {
    const src = ['export const COPY = {', "  title: 'Coin Dash',", "  tagline: 'x',", '};'].join('\n');
    expect(setCopyTitle(src, "Kit's Pixi")).toBe(src.replace("'Coin Dash'", "'Kit\\'s Pixi'"));
  });

  it('strips start/end blocks too', () => {
    const text = ['a', '// new-game:online:start', 'online: x({', '}),', '// new-game:online:end', 'b'].join('\n');
    expect(stripFeatureLines(text, ['online'])).toBe('a\nb');
    expect(stripFeatureLines(text, [])).toBe(text);
  });

  it('keeps only the chosen renderer package, sets 2d/3d and drops game-block features', () => {
    const pkg = {
      dependencies: { '@diffenderfer-games/hub': '1', 'pixi.js': '8', three: '0.186' },
      devDependencies: { '@types/three': '0.186', vitest: '3' },
      game: {
        labels: ['arcade', '2d', 'single-player', 'multiplayer'],
        dailyChallenges: true,
        race: {},
        changes: ['x'],
      },
    };
    const three = editPackage(pkg, { renderer: 'three', drop: ['race', 'online', 'turns'] });
    expect(three.dependencies).toEqual({ '@diffenderfer-games/hub': '1', three: '0.186' });
    expect(three.devDependencies).toEqual({ '@types/three': '0.186', vitest: '3' });
    expect(three.game).toEqual({ labels: ['arcade', '3d', 'single-player'], dailyChallenges: true, changes: [] });
    const none = editPackage(pkg, { renderer: 'none', drop: [] });
    expect(none.dependencies).toEqual({ '@diffenderfer-games/hub': '1' });
  });

  it('--no-world drops game.world; --title also names the generated room', () => {
    const pkg = { game: { labels: [], world: { generate: { type: 'lounge', needs: { game: 'Coin Dash' } } } } };
    expect(editPackage(pkg, { renderer: 'none', drop: ['world'] }).game).not.toHaveProperty('world');
    expect(editPackage(pkg, { renderer: 'none', drop: [], title: 'Orbs' }).game).toMatchObject({
      title: 'Orbs',
      world: { generate: { needs: { game: 'Orbs' } } },
    });
    expect(pkg.game.world.generate.needs.game).toBe('Coin Dash'); // the input is left alone
  });

  it('--no-turns drops game.turns; online games over days alone keep the multiplayer label', () => {
    const pkg = { game: { labels: ['board', 'multiplayer'], turns: { rules: 'dist-rules/rules.mjs' }, race: {} } };
    expect(editPackage(pkg, { renderer: 'none', drop: ['turns'] }).game).toEqual({
      labels: ['board', '2d', 'multiplayer'],
      race: {},
      changes: [],
    });
    expect(editPackage(pkg, { renderer: 'none', drop: ['race', 'online'] }).game).toMatchObject({
      labels: ['board', '2d', 'multiplayer'],
      turns: { rules: 'dist-rules/rules.mjs' },
    });
  });
});
