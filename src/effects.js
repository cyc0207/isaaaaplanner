// 小特效：打勾時噴出星星，記帳成功時撒一點紙花。系統設定「減少動態效果」時全部關閉。
const COLORS = ['#c4502f', '#e0a526', '#2d6a6a', '#f6dd9a', '#e57a55'];
const SHAPES = ['✦', '★', '✧', '●', '♥'];

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function burst(x, y, count = 14, spread = 70) {
  if (reduced()) return;
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'fx-particle';
    p.textContent = SHAPES[i % SHAPES.length];
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = spread * (0.6 + Math.random() * 0.6);
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.color = COLORS[i % COLORS.length];
    p.style.fontSize = `${10 + Math.random() * 12}px`;
    p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * dist - 20}px`);
    p.style.setProperty('--rot', `${(Math.random() - 0.5) * 540}deg`);
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 900);
}

export function installEffects() {
  // 勾選框被勾起來時（任務、每日固定、每週固定）
  document.addEventListener(
    'click',
    (e) => {
      const input = e.target.closest?.('.check input[type=checkbox]');
      if (input && input.checked) {
        // 勾選框在 click 事件前就已經切換狀態，這裡是「剛被勾起來」
        const r = input.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2);
        input.closest('.task, .reminder')?.classList.add('fx-pop');
        setTimeout(() => input.closest('.task, .reminder')?.classList.remove('fx-pop'), 500);
        return;
      }
      const cat = e.target.closest?.('.cat:not(:disabled), .btn.primary:not(:disabled), .energy button');
      if (cat) {
        const r = cat.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, 10, 50);
      }
    },
    true,
  );
}
