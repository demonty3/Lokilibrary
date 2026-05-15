import Phaser from 'phaser';
import { SAMPLE_LIBRARY, headerImageUrl } from '../data/sampleLibrary';
import type { GameEntry } from '../types';

interface Cabinet {
  container: Phaser.GameObjects.Container;
  screen: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  game: GameEntry;
}

type Facing = 'up' | 'down' | 'left' | 'right';

const ROOM = { width: 960, height: 600 };
const CABINET = { width: 80, height: 130, spacing: 124 };
const PLAYER_SPEED = 180;
const INTERACT_DISTANCE = 92;

/**
 * v0.1 feel-test scene. A top-down arcade room with a row of cabinets, each one
 * a game in SAMPLE_LIBRARY. Walk with WASD, press E or click a cabinet to launch.
 */
export class ArcadeScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private playerVisual!: Phaser.GameObjects.Container;
  private playerNose!: Phaser.GameObjects.Arc;
  private playerFacing: Facing = 'down';
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
  };
  private cabinets: Cabinet[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private ritualActive = false;
  private ritualNodes: Phaser.GameObjects.GameObject[] = [];
  private onWindowFocus?: () => void;

  constructor() {
    super('arcade');
  }

  preload() {
    // Steam's header.jpg is hotlinkable from cdn.cloudflare.steamstatic.com.
    // Using Canvas2D (set in main.ts) means we don't need CORS to render these.
    for (const game of SAMPLE_LIBRARY) {
      this.load.image(`header-${game.appid}`, headerImageUrl(game.appid));
    }
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn('[LibraryWorld] failed to load asset', file.key, file.url);
    });
  }

  create() {
    this.drawRoom();
    this.spawnCabinets();
    this.spawnPlayer();
    this.bindInput();
    this.bindReturnTrip();
    this.drawHud();
  }

  private drawRoom() {
    this.add.rectangle(0, 0, ROOM.width, ROOM.height, 0x0f0f1e).setOrigin(0);

    const grid = this.add.graphics();
    grid.lineStyle(1, 0x1c1c38, 0.7);
    for (let x = 0; x <= ROOM.width; x += 32) grid.lineBetween(x, 0, x, ROOM.height);
    for (let y = 0; y <= ROOM.height; y += 32) grid.lineBetween(0, y, ROOM.width, y);

    const wallColor = 0x2a1a3a;
    const wallAccent = 0xff66cc;
    this.add.rectangle(0, 0, ROOM.width, 16, wallColor).setOrigin(0);
    this.add.rectangle(0, ROOM.height - 16, ROOM.width, 16, wallColor).setOrigin(0);
    this.add.rectangle(0, 0, 16, ROOM.height, wallColor).setOrigin(0);
    this.add.rectangle(ROOM.width - 16, 0, 16, ROOM.height, wallColor).setOrigin(0);
    this.add.rectangle(16, 14, ROOM.width - 32, 2, wallAccent, 0.6).setOrigin(0);
  }

  private spawnCabinets() {
    const startX = (ROOM.width - (SAMPLE_LIBRARY.length - 1) * CABINET.spacing) / 2;
    const cabinetY = 160;
    SAMPLE_LIBRARY.forEach((game, i) => {
      const x = startX + i * CABINET.spacing;
      this.cabinets.push(this.makeCabinet(x, cabinetY, game));
    });
  }

  private makeCabinet(x: number, y: number, game: GameEntry): Cabinet {
    const W = CABINET.width;
    const H = CABINET.height;
    const accent = Phaser.Display.Color.HexStringToColor(game.ritualColor ?? '#ff88cc').color;

    const container = this.add.container(x, y);
    container.setSize(W, H);
    this.physics.add.existing(container, true);

    // Drop shadow
    const shadow = this.add.ellipse(0, H / 2 + 8, W * 0.95, 14, 0x000000, 0.4);
    container.add(shadow);

    // Cabinet body
    const body = this.add.rectangle(0, 0, W, H, 0x1a1226).setStrokeStyle(2, 0x4a3458);
    container.add(body);

    // Marquee strip (lit nameplate at top of cabinet)
    const marqueeY = -H / 2 + 14;
    const marqueeBg = this.add.rectangle(0, marqueeY, W - 10, 16, 0x05030a)
      .setStrokeStyle(1, 0x4a3458);
    const marquee = this.add.rectangle(0, marqueeY, W - 14, 12, accent, 0.75);
    container.add([marqueeBg, marquee]);

    // Screen + glow
    const screenW = W - 14;
    const screenH = Math.round(screenW * 215 / 460);
    const screenY = -H / 2 + 44;
    const glow = this.add.rectangle(0, screenY, screenW + 10, screenH + 10, accent, 0.4);
    container.add(glow);

    const textureKey = `header-${game.appid}`;
    const screen: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle =
      this.textures.exists(textureKey)
        ? this.add.image(0, screenY, textureKey).setDisplaySize(screenW, screenH)
        : this.add.rectangle(0, screenY, screenW, screenH, 0x4a3a6a);
    container.add(screen);

    const bezel = this.add.rectangle(0, screenY, screenW + 2, screenH + 2, 0x000000, 0)
      .setStrokeStyle(1, 0x000000);
    container.add(bezel);

    // Control panel
    const panelY = H / 2 - 30;
    const panel = this.add.rectangle(0, panelY, W - 8, 32, 0x100a18)
      .setStrokeStyle(1, 0x4a3458);
    container.add(panel);

    // Joystick + buttons + coin slot
    const joyBase = this.add.circle(-18, panelY - 2, 4, 0x222222).setStrokeStyle(1, 0x666666);
    const joyTop = this.add.circle(-18, panelY - 4, 2.5, 0xff4444);
    const btn1 = this.add.circle(6, panelY - 2, 2.5, 0xffcc44);
    const btn2 = this.add.circle(14, panelY - 2, 2.5, 0x44ccff);
    const btn3 = this.add.circle(22, panelY - 2, 2.5, 0xff44cc);
    const coin = this.add.rectangle(0, panelY + 10, 12, 2, 0x444444);
    container.add([joyBase, joyTop, btn1, btn2, btn3, coin]);

    // Nameplate panel below
    this.add.rectangle(x, y + H / 2 + 22, W + 4, 16, 0x0a0a14)
      .setStrokeStyle(1, 0x4a3458);
    const label = this.add.text(x, y + H / 2 + 22, game.name, {
      fontSize: '10px',
      color: '#dddddd',
      fontFamily: 'ui-monospace, monospace',
    }).setOrigin(0.5);

    const cabinet: Cabinet = { container, screen, label, game };

    container.setInteractive(
      new Phaser.Geom.Rectangle(-W / 2, -H / 2, W, H),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on('pointerdown', () => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
      if (dist < INTERACT_DISTANCE) this.launchRitual(cabinet);
    });

    // Subtle pulse so the room feels alive
    this.tweens.add({
      targets: [marquee, glow],
      alpha: { from: 0.5, to: 0.85 },
      duration: 1300 + Math.random() * 600,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    return cabinet;
  }

  private spawnPlayer() {
    const c = this.add.container(ROOM.width / 2, ROOM.height - 100);
    c.setSize(16, 16);

    const shadow = this.add.ellipse(0, 9, 18, 6, 0x000000, 0.45);

    // visual is a child container so we can bob it while walking without
    // moving the physics body.
    const visual = this.add.container(0, 0);
    const body = this.add.rectangle(0, 2, 13, 11, 0x4a6a9a).setStrokeStyle(1, 0x1a2a4a);
    const head = this.add.circle(0, -6, 6, 0xeac596).setStrokeStyle(1, 0x1a1a1a);
    // Hair: back-of-head arc that wraps the top hemisphere.
    const hair = this.add.arc(0, -6, 6, 200, 340, false, 0x3a2a1a);
    // Nose: a small dark dot we move around the head to indicate facing.
    const nose = this.add.circle(0, -2, 1.4, 0x1a1a1a);
    visual.add([body, head, hair, nose]);

    c.add([shadow, visual]);

    this.physics.add.existing(c);
    this.playerBody = c.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setSize(14, 12);
    this.playerBody.setOffset(-7, -2);
    this.playerBody.setCollideWorldBounds(true);
    this.physics.world.setBounds(16, 16, ROOM.width - 32, ROOM.height - 32);

    for (const cab of this.cabinets) {
      this.physics.add.collider(c, cab.container);
    }

    this.player = c;
    this.playerVisual = visual;
    this.playerNose = nose;
    this.applyFacing();
  }

  private bindInput() {
    this.wasd = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      E: Phaser.Input.Keyboard.KeyCodes.E,
    }) as typeof this.wasd;
  }

  private bindReturnTrip() {
    // Tab regained focus after a launch — replay the return ritual.
    // Small lie: any focus event fires it. v1 desktop wrapper fixes it.
    this.onWindowFocus = () => {
      if (this.ritualActive && this.ritualNodes.length > 0) this.returnRitual();
    };
    window.addEventListener('focus', this.onWindowFocus);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.onWindowFocus) window.removeEventListener('focus', this.onWindowFocus);
    });
  }

  private drawHud() {
    this.prompt = this.add.text(ROOM.width / 2, ROOM.height - 40, '', {
      fontSize: '14px',
      color: '#ffe6a8',
      fontFamily: 'ui-monospace, monospace',
    }).setOrigin(0.5).setAlpha(0).setDepth(500);

    this.add.text(ROOM.width / 2, 32, 'LibraryWorld — v0.1 feel test', {
      fontSize: '16px',
      color: '#ff88cc',
      fontFamily: 'ui-monospace, monospace',
    }).setOrigin(0.5).setDepth(500);

    this.add.text(ROOM.width / 2, 54, 'WASD to move · E or click to launch', {
      fontSize: '11px',
      color: '#777',
      fontFamily: 'ui-monospace, monospace',
    }).setOrigin(0.5).setDepth(500);
  }

  update() {
    if (this.ritualActive) {
      this.playerBody.setVelocity(0, 0);
      return;
    }

    const left = this.wasd.A.isDown;
    const right = this.wasd.D.isDown;
    const up = this.wasd.W.isDown;
    const down = this.wasd.S.isDown;
    const vx = (left ? -1 : 0) + (right ? 1 : 0);
    const vy = (up ? -1 : 0) + (down ? 1 : 0);
    const len = Math.hypot(vx, vy) || 1;
    this.playerBody.setVelocity((vx / len) * PLAYER_SPEED, (vy / len) * PLAYER_SPEED);

    // Update facing direction (dominant velocity component)
    if (vx !== 0 || vy !== 0) {
      if (Math.abs(vx) >= Math.abs(vy)) this.playerFacing = vx > 0 ? 'right' : 'left';
      else this.playerFacing = vy > 0 ? 'down' : 'up';
      this.applyFacing();
    }

    // Walking bob — only when moving
    if (vx !== 0 || vy !== 0) {
      this.playerVisual.y = Math.sin(this.time.now / 90) * 1.3;
    } else {
      this.playerVisual.y = 0;
    }

    // Interact prompt + E to launch
    const nearest = this.nearestCabinet();
    if (nearest) {
      const d = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        nearest.container.x, nearest.container.y,
      );
      if (d < INTERACT_DISTANCE) {
        this.prompt.setText(`[E] Launch ${nearest.game.name}`).setAlpha(1);
        if (Phaser.Input.Keyboard.JustDown(this.wasd.E)) this.launchRitual(nearest);
        return;
      }
    }
    this.prompt.setAlpha(0);
  }

  private applyFacing() {
    // Move the nose dot around the head to indicate facing.
    const r = 4;
    switch (this.playerFacing) {
      case 'up':    this.playerNose.setPosition(0,  -6 - r); break;
      case 'down':  this.playerNose.setPosition(0,  -6 + r - 1); break;
      case 'left':  this.playerNose.setPosition(-r, -6); break;
      case 'right': this.playerNose.setPosition( r, -6); break;
    }
  }

  private nearestCabinet(): Cabinet | null {
    let best: Cabinet | null = null;
    let bestDist = Infinity;
    for (const cab of this.cabinets) {
      const d = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, cab.container.x, cab.container.y,
      );
      if (d < bestDist) {
        bestDist = d;
        best = cab;
      }
    }
    return best;
  }

  private launchRitual(cab: Cabinet) {
    if (this.ritualActive) return;
    this.ritualActive = true;
    this.prompt.setAlpha(0);
    const style = cab.game.ritualStyle ?? 'tint';
    if (style === 'casefile') this.casefileRitual(cab);
    else this.tintRitual(cab);
  }

  private fireSteam(appid: number) {
    console.log(`[LibraryWorld] launching steam://run/${appid}`);
    window.location.href = `steam://run/${appid}`;
  }

  /**
   * Default ritual: full-screen overlay tints to the game's color over 1.5s, then
   * fires steam://run. The overlay stays up until the return ritual fades it.
   */
  private tintRitual(cab: Cabinet) {
    const colorHex = cab.game.ritualColor ?? '#ffaa66';
    const color = Phaser.Display.Color.HexStringToColor(colorHex).color;
    const overlay = this.add.rectangle(0, 0, ROOM.width, ROOM.height, color, 0)
      .setOrigin(0)
      .setDepth(1000);
    this.ritualNodes = [overlay];
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 1500,
      ease: 'Sine.easeIn',
      onComplete: () => this.fireSteam(cab.game.appid),
    });
  }

  /**
   * Casefile ritual (Disco Elysium): dim the room, slide a manila folder up from
   * the bottom with the case header + redacted lines + CONFIDENTIAL stamp, then
   * fire steam://run. The folder stays on screen until the return ritual fades it.
   */
  private casefileRitual(cab: Cabinet) {
    const dim = this.add.rectangle(0, 0, ROOM.width, ROOM.height, 0x000000, 0)
      .setOrigin(0)
      .setDepth(1000);
    this.tweens.add({ targets: dim, alpha: 0.75, duration: 280, ease: 'Sine.easeOut' });

    const folderW = 360;
    const folderH = 440;
    const folder = this.add.container(ROOM.width / 2, ROOM.height + folderH)
      .setDepth(1001);

    const tab = this.add.rectangle(-folderW / 2 + 70, -folderH / 2 - 6, 96, 18, 0xb89465)
      .setStrokeStyle(1, 0x4a3015)
      .setOrigin(0.5, 1);
    const paper = this.add.rectangle(0, 0, folderW, folderH, 0xd9c69a)
      .setStrokeStyle(2, 0x4a3015);
    const inner = this.add.rectangle(0, 12, folderW - 30, folderH - 50, 0xe8d9af)
      .setStrokeStyle(1, 0xa8895a);

    const header = this.add.text(0, -folderH / 2 + 36, 'CASE FILE', {
      fontSize: '22px',
      color: '#3a2a1a',
      fontFamily: 'ui-monospace, monospace',
    }).setOrigin(0.5);
    const sep = this.add.rectangle(0, -folderH / 2 + 64, folderW - 60, 1, 0x4a3015);
    const titleText = this.add.text(0, -folderH / 2 + 100, cab.game.name.toUpperCase(), {
      fontSize: '18px',
      color: '#3a2a1a',
      fontFamily: 'ui-monospace, monospace',
    }).setOrigin(0.5);
    const appidText = this.add.text(0, -folderH / 2 + 128, `APPID ${cab.game.appid}`, {
      fontSize: '11px',
      color: '#6a4a1a',
      fontFamily: 'ui-monospace, monospace',
    }).setOrigin(0.5);

    // Decorative redacted text lines
    const lines: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < 6; i++) {
      const lineY = -folderH / 2 + 168 + i * 18;
      const width = folderW - 80 - (i === 5 ? 80 : 0);
      lines.push(this.add.rectangle(0, lineY, width, 4, 0x4a3015, 0.4));
    }

    // CONFIDENTIAL stamp
    const stamp = this.add.text(folderW / 2 - 80, folderH / 2 - 110, 'CONFIDENTIAL', {
      fontSize: '14px',
      color: '#9a2020',
      fontFamily: 'ui-monospace, monospace',
    }).setOrigin(0.5);
    stamp.setRotation(-0.18);
    const stampBorder = this.add.rectangle(stamp.x, stamp.y, stamp.width + 14, stamp.height + 6, 0x9a2020, 0)
      .setStrokeStyle(2, 0x9a2020);
    stampBorder.setRotation(-0.18);

    const opening = this.add.text(0, folderH / 2 - 40, 'OPENING...', {
      fontSize: '14px',
      color: '#3a2a1a',
      fontFamily: 'ui-monospace, monospace',
    }).setOrigin(0.5);

    folder.add([tab, paper, inner, header, sep, titleText, appidText, ...lines, stampBorder, stamp, opening]);

    this.ritualNodes = [dim, folder];

    this.tweens.add({
      targets: folder,
      y: ROOM.height / 2,
      duration: 560,
      ease: 'Cubic.easeOut',
    });
    this.tweens.add({
      targets: opening,
      alpha: 0.25,
      yoyo: true,
      repeat: -1,
      duration: 380,
    });

    this.time.delayedCall(1600, () => this.fireSteam(cab.game.appid));
  }

  /**
   * Return ritual: tab regained focus after launch. Fade every ritual node out
   * (whatever style fired), destroy them, return control to the player.
   */
  private returnRitual() {
    if (this.ritualNodes.length === 0) {
      this.ritualActive = false;
      return;
    }
    const nodes = this.ritualNodes;
    this.tweens.killTweensOf(nodes);
    this.tweens.add({
      targets: nodes,
      alpha: 0,
      duration: 800,
      ease: 'Sine.easeOut',
      onComplete: () => {
        for (const n of nodes) n.destroy();
        this.ritualNodes = [];
        this.ritualActive = false;
      },
    });
  }
}
