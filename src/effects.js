// 打勾時噴出幾片小紙片。系統設定「減少動態效果」時不播。
const COLORS = ['#e8337f', '#e3a15f', '#17958f', '#3d5a94'];

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function confetti(x, y) {
  if (reduced()) return;
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  for (let i = 0; i < 7; i++) {
    const p = document.createElement('span');
    p.className = 'fx-bit';
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const dist = 28 + Math.random() * 26;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = COLORS[i % COLORS.length];
    p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * dist + 18}px`);
    p.style.setProperty('--rot', `${(Math.random() - 0.5) * 360}deg`);
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 700);
}

export function installEffects() {
  document.addEventListener(
    'click',
    (e) => {
      // 勾選框在 click 事件前就已經切換狀態，checked 代表「剛被勾起來」
      const input = e.target.closest?.('.check input[type=checkbox]');
      if (!input?.checked) return;
      const r = input.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2);
    },
    true,
  );
}
