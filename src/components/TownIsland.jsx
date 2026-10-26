// 牛仔小鎮的浮空沙漠島（等角視角，純色＋墨線，沒有漸層）
const INK = '#2b2118';
const TW = 44; // 一格的寬
const TH = 22; // 一格的高
const N = 7; // 島 7×7 格

// 每種顏色三個面：上、左（+y 面）、右（+x 面）
export const PAL = {
  sand: ['#f3d89c', '#d9864f', '#b8603a'],
  rock: ['#b8603a', '#8e3f28', '#6e2f1e'],
  wood: ['#d9a066', '#b07a45', '#8a5a30'],
  pink: ['#ff8fc0', '#ff5fa2', '#d93f82'],
  turq: ['#8fe0d6', '#3fb8b0', '#2a8a84'],
  chrome: ['#ecebf2', '#c9c8d6', '#9f9eb3'],
  brick: ['#e8835e', '#c4502f', '#9b3b22'],
  gold: ['#ffd76a', '#e9b23a', '#b8841a'],
  cream: ['#fbf5e6', '#efe2c4', '#d9c8a2'],
  cactus: ['#7fbf6a', '#4f9a4a', '#357334'],
};
const LOT_COLORS = ['pink', 'turq', 'wood', 'chrome', 'brick', 'gold'];

const pt = (ox, oy) => (x, y, z = 0) => [ox + (x - y) * (TW / 2), oy + (x + y) * (TH / 2) - z];
const pts = (list) => list.map((p) => p.join(',')).join(' ');

// 立方體：(x0,y0)-(x1,y1)，高度 z0 到 z1
function Box({ P, x0, y0, x1, y1, z0 = 0, z1, c, sw = 1.4, top = true }) {
  return (
    <g stroke={INK} strokeWidth={sw} strokeLinejoin="round">
      <polygon fill={c[1]} points={pts([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)])} />
      <polygon fill={c[2]} points={pts([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)])} />
      {top && <polygon fill={c[0]} points={pts([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)])} />}
    </g>
  );
}

// 金字塔屋頂（帳篷、木屋）
function Roof({ P, x0, y0, x1, y1, z, h, c }) {
  const apex = P((x0 + x1) / 2, (y0 + y1) / 2, z + h);
  return (
    <g stroke={INK} strokeWidth="1.4" strokeLinejoin="round">
      <polygon fill={c[1]} points={pts([P(x0, y1, z), P(x1, y1, z), apex])} />
      <polygon fill={c[2]} points={pts([P(x1, y0, z), P(x1, y1, z), apex])} />
    </g>
  );
}

// 牆面上的窗：u 是沿著牆的位置（0–1），z 是高度
function windowsOn(P, face, b, floors, cols, fh, z0, fill) {
  const out = [];
  const { x0, y0, x1, y1 } = b;
  const at = (u, z) => (face === 'L' ? P(x0 + u * (x1 - x0), y1, z) : P(x1, y0 + u * (y1 - y0), z));
  for (let f = 0; f < floors; f++) {
    for (let k = 0; k < cols; k++) {
      const u0 = (k + 0.3) / cols;
      const u1 = (k + 0.7) / cols;
      const za = z0 + f * fh + fh * 0.3;
      const zb = za + fh * 0.45;
      out.push(<polygon key={`${face}${f}-${k}`} fill={fill} stroke={INK} strokeWidth="1" points={pts([at(u0, za), at(u1, za), at(u1, zb), at(u0, zb)])} />);
    }
  }
  return out;
}

// 西部店面的假門面：正面（+y 面）往上多蓋一截招牌牆
function FalseFront({ P, x0, x1, y1, z, h, c, sign }) {
  const m = (x0 + x1) / 2;
  return (
    <g stroke={INK} strokeWidth="1.4" strokeLinejoin="round">
      <polygon fill={c[1]} points={pts([P(x0, y1, z), P(x1, y1, z), P(x1, y1, z + h * 0.7), P(m, y1, z + h), P(x0, y1, z + h * 0.7)])} />
      {sign && <polygon fill={PAL.cream[0]} strokeWidth="1" points={pts([P(x0 + 0.2, y1, z + 2), P(x1 - 0.2, y1, z + 2), P(x1 - 0.2, y1, z + h * 0.55), P(x0 + 0.2, y1, z + h * 0.55)])} />}
    </g>
  );
}

function Door({ P, x0, x1, y1, h = 9, fill = INK }) {
  const m = (x0 + x1) / 2;
  const w = Math.min(0.18, (x1 - x0) / 4);
  return <polygon fill={fill} stroke={INK} strokeWidth="1" points={pts([P(m - w, y1, 0), P(m + w, y1, 0), P(m + w, y1, h), P(m - w, y1, h)])} />;
}

// 一棟建築：key 是等級，站在 (gx,gy)，佔 s 格
export function Building({ P, gx, gy, s = 1.3, level, color = 'pink' }) {
  const c = PAL[color];
  const b = { x0: gx, y0: gy, x1: gx + s, y1: gy + s };
  const [fx, fy] = P(gx + s / 2, gy + s / 2);
  switch (level) {
    case 'lot':
      return (
        <g>
          <polygon fill={PAL.sand[1]} stroke={INK} strokeWidth="1" points={pts([P(b.x0 + 0.2, b.y0 + 0.2, 1), P(b.x1 - 0.2, b.y0 + 0.2, 1), P(b.x1 - 0.2, b.y1 - 0.2, 1), P(b.x0 + 0.2, b.y1 - 0.2, 1)])} strokeDasharray="3 2" />
          <line x1={fx} y1={fy} x2={fx} y2={fy - 26} stroke={INK} strokeWidth="2" />
          <polygon fill={c[1]} stroke={INK} strokeWidth="1.2" points={pts([[fx, fy - 26], [fx + 14, fy - 21], [fx, fy - 16]])} />
        </g>
      );
    case 'tent':
      return (
        <g>
          <Roof P={P} {...b} z={0} h={22} c={c} />
          <polygon fill={INK} points={pts([P(gx + s * 0.4, b.y1, 0), P(gx + s * 0.6, b.y1, 0), P(gx + s / 2, gy + s * 0.75, 12)])} />
        </g>
      );
    case 'cabin':
      return (
        <g>
          <Box P={P} {...b} z1={14} c={PAL.wood} top={false} />
          {[4, 8, 12].map((z) => (
            <line key={z} x1={P(b.x0, b.y1, z)[0]} y1={P(b.x0, b.y1, z)[1]} x2={P(b.x1, b.y1, z)[0]} y2={P(b.x1, b.y1, z)[1]} stroke={INK} strokeWidth="0.7" />
          ))}
          <Roof P={P} x0={b.x0 - 0.05} y0={b.y0 - 0.05} x1={b.x1 + 0.05} y1={b.y1 + 0.05} z={14} h={14} c={c} />
          <Door P={P} {...b} />
        </g>
      );
    case 'store':
    case 'saloon': {
      const h = level === 'store' ? 18 : 26;
      return (
        <g>
          <Box P={P} {...b} z1={h} c={level === 'store' ? PAL.wood : c} />
          {windowsOn(P, 'R', b, level === 'store' ? 1 : 2, 2, h / (level === 'store' ? 1.3 : 2.2), 2, PAL.turq[0])}
          <FalseFront P={P} x0={b.x0} x1={b.x1} y1={b.y1} z={h} h={12} c={level === 'store' ? PAL.wood : c} sign />
          {level === 'saloon' && <Box P={P} x0={b.x0} y0={b.y1} x1={b.x1} y1={b.y1 + 0.25} z0={11} z1={12.5} c={PAL.chrome} />}
          <Door P={P} {...b} h={10} fill={level === 'saloon' ? PAL.gold[1] : INK} />
        </g>
      );
    }
    case 'hotel':
    case 'clock':
    case 'gold': {
      const floors = { hotel: 3, clock: 4, gold: 6 }[level];
      const fh = 13;
      const h = floors * fh;
      const body = level === 'gold' ? PAL.gold : c;
      return (
        <g>
          <Box P={P} {...b} z1={h} c={body} />
          {windowsOn(P, 'L', b, floors, 3, fh, 0, PAL.cream[0])}
          {windowsOn(P, 'R', b, floors, 3, fh, 0, PAL.turq[0])}
          {level === 'hotel' && <FalseFront P={P} x0={b.x0} x1={b.x1} y1={b.y1} z={h} h={10} c={c} sign />}
          {level === 'clock' && (
            <>
              <Box P={P} x0={b.x0 + s * 0.3} y0={b.y0 + s * 0.3} x1={b.x1 - s * 0.3} y1={b.y1 - s * 0.3} z0={h} z1={h + 16} c={PAL.chrome} />
              <circle cx={P(b.x0 + s / 2, b.y1 - s * 0.3, h + 8)[0]} cy={P(b.x0 + s / 2, b.y1 - s * 0.3, h + 8)[1]} r="4" fill={PAL.cream[0]} stroke={INK} strokeWidth="1" />
              <Roof P={P} x0={b.x0 + s * 0.3} y0={b.y0 + s * 0.3} x1={b.x1 - s * 0.3} y1={b.y1 - s * 0.3} z={h + 16} h={10} c={PAL.brick} />
            </>
          )}
          {level === 'gold' && (
            <>
              <Box P={P} x0={b.x0 + s * 0.2} y0={b.y0 + s * 0.2} x1={b.x1 - s * 0.2} y1={b.y1 - s * 0.2} z0={h} z1={h + 12} c={PAL.pink} />
              <line x1={P(gx + s / 2, gy + s / 2, h + 12)[0]} y1={P(gx + s / 2, gy + s / 2, h + 12)[1]} x2={P(gx + s / 2, gy + s / 2, h + 30)[0]} y2={P(gx + s / 2, gy + s / 2, h + 30)[1]} stroke={INK} strokeWidth="2" />
              <circle cx={P(gx + s / 2, gy + s / 2, h + 31)[0]} cy={P(gx + s / 2, gy + s / 2, h + 31)[1]} r="3" fill={PAL.pink[1]} stroke={INK} strokeWidth="1" />
            </>
          )}
          <Door P={P} {...b} h={10} />
        </g>
      );
    }
    default:
      return null;
  }
}

// 仙人掌（守住生活費的月份）
function Cactus({ P, gx, gy }) {
  const [x, y] = P(gx, gy);
  const g = PAL.cactus;
  return (
    <g stroke={INK} strokeWidth="1.3" strokeLinejoin="round">
      <rect x={x - 3.5} y={y - 24} width="7" height="24" rx="3.5" fill={g[1]} />
      <path d={`M${x - 3.5} ${y - 12} h-4 a2.5 2.5 0 0 1 -2.5 -2.5 v-6 a2.5 2.5 0 0 1 5 0 v3.5 h1.5`} fill={g[1]} />
      <path d={`M${x + 3.5} ${y - 9} h4 a2.5 2.5 0 0 0 2.5 -2.5 v-8 a2.5 2.5 0 0 0 -5 0 v5.5 h-1.5`} fill={g[2]} />
      <circle cx={x} cy={y - 25} r="2.6" fill={PAL.pink[1]} />
    </g>
  );
}

// 風滾草（超支的月份）
function Tumbleweed({ P, gx, gy }) {
  const [x, y] = P(gx, gy);
  return (
    <g stroke={PAL.wood[2]} strokeWidth="1.4" fill="none">
      <circle cx={x} cy={y - 7} r="7" fill={PAL.sand[0]} stroke={INK} />
      <path d={`M${x - 5} ${y - 10} L${x + 5} ${y - 4} M${x - 5} ${y - 4} L${x + 4} ${y - 11} M${x} ${y - 14} L${x - 1} ${y}`} />
    </g>
  );
}

// 金礦：礦坑口＋金塊堆，等級越高金塊越多
function GoldMine({ P, gx, gy, level }) {
  const bars = [
    [0, 0, 0], [0.45, 0, 0], [0, 0.45, 0], [0.45, 0.45, 0],
    [0.2, 0.2, 7], [0.6, 0.2, 7], [0.2, 0.6, 7],
    [0.4, 0.4, 14], [0.9, 0, 0], [0, 0.9, 0], [0.9, 0.45, 0],
    [0.65, 0.65, 7], [0.45, 0.45, 21],
  ];
  const count = [2, 4, 7, 10, 13][level] ?? 2;
  return (
    <g>
      <Box P={P} x0={gx - 1.1} y0={gy - 0.2} x1={gx - 0.1} y1={gy + 0.6} z1={20} c={PAL.rock} />
      <polygon fill={INK} points={pts([P(gx - 0.85, gy + 0.6, 0), P(gx - 0.35, gy + 0.6, 0), P(gx - 0.35, gy + 0.6, 11), P(gx - 0.6, gy + 0.6, 15), P(gx - 0.85, gy + 0.6, 11)])} />
      {bars.slice(0, count).map(([dx, dy, z], i) => (
        <Box key={i} P={P} x0={gx + dx} y0={gy + dy} x1={gx + dx + 0.4} y1={gy + dy + 0.4} z0={z} z1={z + 7} c={PAL.gold} sw={1.1} />
      ))}
    </g>
  );
}

function Sky({ kind }) {
  const cloud = (x, y, fill) => (
    <path d={`M${x} ${y} h46 a8 8 0 0 0 -8 -10 a11 11 0 0 0 -20 -4 a9 9 0 0 0 -16 6 a6 6 0 0 0 -2 8 z`} fill={fill} stroke={INK} strokeWidth="1.4" />
  );
  if (kind === 'sun' || kind === 'none')
    return (
      <g>
        <circle cx="282" cy="34" r="15" fill={PAL.gold[1]} stroke={INK} strokeWidth="1.5" />
        {cloud(34, 46, PAL.cream[0])}
      </g>
    );
  return (
    <g>
      {cloud(236, 46, kind === 'storm' ? PAL.chrome[2] : PAL.sand[0])}
      {cloud(30, 40, kind === 'storm' ? PAL.chrome[1] : PAL.cream[1])}
      {kind === 'dust' ? (
        <g stroke={PAL.sand[1]} strokeWidth="2" strokeLinecap="round">
          <line x1="240" y1="58" x2="230" y2="58" /><line x1="262" y1="64" x2="244" y2="64" /><line x1="252" y1="70" x2="238" y2="70" />
        </g>
      ) : (
        <polygon fill={PAL.gold[0]} stroke={INK} strokeWidth="1.2" points="262,50 252,68 260,68 254,84 272,62 263,62 270,50" />
      )}
    </g>
  );
}

// 本月有投入：飛一顆桃紅愛心熱氣球
function Balloon({ x, y }) {
  return (
    <g stroke={INK} strokeWidth="1.4" strokeLinejoin="round">
      <path d={`M${x} ${y + 22} C${x - 22} ${y + 6} ${x - 16} ${y - 12} ${x} ${y - 2} C${x + 16} ${y - 12} ${x + 22} ${y + 6} ${x} ${y + 22} z`} fill={PAL.pink[1]} />
      <line x1={x - 4} y1={y + 22} x2={x - 4} y2={y + 30} />
      <line x1={x + 4} y1={y + 22} x2={x + 4} y2={y + 30} />
      <rect x={x - 5} y={y + 30} width="10" height="6" fill={PAL.wood[1]} />
    </g>
  );
}

// 地產格位（後排先畫）：最多 6 塊
export const LOT_SLOTS = [[0.4, 0.4], [2.4, 0.4], [0.4, 2.4], [4.4, 0.4], [2.4, 2.4], [0.4, 4.4]];
const PARK_SLOTS = [[0.9, 6.6], [2, 6.6], [3.1, 6.6], [4.2, 6.6], [6.6, 3.4], [6.6, 2.3]];

export default function TownIsland({ t, label }) {
  const ox = N * (TW / 2) + 10;
  const oy = 120;
  const P = pt(ox, oy);
  const items = [];
  t.lots.slice(0, LOT_SLOTS.length).forEach((lot, i) => {
    const [gx, gy] = LOT_SLOTS[i];
    items.push({ d: gx + gy, el: <Building key={`lot${i}`} P={P} gx={gx} gy={gy} level={lot.key} color={LOT_COLORS[i % LOT_COLORS.length]} /> });
  });
  for (let i = t.lots.length; i < 2; i++) {
    const [gx, gy] = LOT_SLOTS[i];
    items.push({ d: gx + gy, el: <Building key={`empty${i}`} P={P} gx={gx} gy={gy} level="lot" color="chrome" /> });
  }
  items.push({ d: 4.8 + 4.4, el: <GoldMine key="mine" P={P} gx={4.8} gy={4.4} level={t.vault.level} /> });
  t.park.slice(-PARK_SLOTS.length).forEach((m, i) => {
    const [gx, gy] = PARK_SLOTS[i];
    items.push({ d: gx + gy, el: m.kept ? <Cactus key={m.key} P={P} gx={gx} gy={gy} /> : <Tumbleweed key={m.key} P={P} gx={gx} gy={gy} /> });
  });
  items.sort((a, b) => a.d - b.d);

  // 小路：從前面一路走到金礦
  const road = pts([P(3.6, 7, 0), P(4.3, 7, 0), P(4.3, 4.6, 0), P(3.6, 4.6, 0)]);

  return (
    <svg viewBox="0 0 328 300" className="town-svg" role="img" aria-label={label}>
      <Sky kind={t.weather.kind} />
      {t.builtThisMonth > 0 && <Balloon x={64} y={70} />}
      {/* 島：沙地＋三層岩層（台地） */}
      <Box P={P} x0={0} y0={0} x1={N} y1={N} z0={-34} z1={-22} c={PAL.rock} top={false} />
      <Box P={P} x0={0} y0={0} x1={N} y1={N} z0={-22} z1={-8} c={[PAL.sand[0], PAL.brick[1], PAL.brick[2]]} top={false} />
      <Box P={P} x0={0} y0={0} x1={N} y1={N} z0={-8} z1={0} c={PAL.sand} />
      <polygon points={road} fill={PAL.sand[1]} stroke={INK} strokeWidth="1" strokeDasharray="4 3" />
      {items.map((it) => it.el)}
    </svg>
  );
}

// 卡片上的單棟小圖
export function BuildingIcon({ level, color = 'pink' }) {
  const P = pt(40, 52);
  return (
    <svg viewBox="0 -45 80 145" className="town-icon" aria-hidden="true">
      <polygon fill={PAL.sand[0]} stroke={INK} strokeWidth="1.2" points={pts([P(-0.1, -0.1), P(1.6, -0.1), P(1.6, 1.6), P(-0.1, 1.6)])} />
      <Building P={P} gx={0.1} gy={0.1} s={1.3} level={level} color={color} />
    </svg>
  );
}

export { LOT_COLORS };
