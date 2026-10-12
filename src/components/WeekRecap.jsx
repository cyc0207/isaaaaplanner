import { useEffect, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useData } from '../data.jsx';
import { today, addDays, weekDays, WEEKDAY_NAMES, weekday } from '../lib/date.js';
import { LOG_SLOTS, ateAt } from '../lib/foodlog.js';
import { FORMATS, pickPhotos, gridFor, weekStats } from '../lib/recap.js';
import { Sheet } from './ui.jsx';

// 復古配色（和網站一樣，畫在 canvas 上不能用 CSS 變數）
const C = { bg: '#f2e8d2', dot: '#e2d3b0', ink: '#2b2118', paper: '#fbf5e6', brick: '#c4502f', mustard: '#e0a526', teal: '#2d6a6a', muted: '#7a6a55' };
const SERIF = "'Noto Serif TC', serif";
const SANS = "'Noto Sans TC', sans-serif";
const PIXEL = "'VT323', monospace";

const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// 照片裁成正方形塞進格子
function drawCover(ctx, img, x, y, s) {
  const r = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - r) / 2, (img.height - r) / 2, r, r, x, y, s, s);
}

export function drawRecap(ctx, { format, days, photos, images, stats }) {
  const { w, h } = FORMATS[format];
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);
  // 網點底
  ctx.fillStyle = C.dot;
  for (let y = 12; y < h; y += 22) for (let x = (y / 22) % 2 ? 23 : 12; x < w; x += 22) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill(); }
  // 外框
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 6;
  ctx.strokeRect(30, 30, w - 60, h - 60);

  // 標題：麥克筆底線
  const story = format === 'story';
  const ty = story ? 190 : 150;
  ctx.font = `900 ${story ? 112 : 92}px ${SERIF}`;
  ctx.textBaseline = 'alphabetic';
  const title = '一週吃什麼';
  const tw = ctx.measureText(title).width;
  ctx.fillStyle = C.mustard;
  ctx.fillRect(70, ty - (story ? 40 : 32), tw + 16, story ? 46 : 38);
  ctx.fillStyle = C.ink;
  ctx.fillText(title, 78, ty);
  // 日期：像素字
  ctx.font = `${story ? 64 : 54}px ${PIXEL}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${md(days[0])} - ${md(days[6])}`, w - 70, ty);
  ctx.textAlign = 'left';

  // 標籤機貼條：統計
  const chips = [`${stats.meals} 餐`, `${stats.days} 天有打卡`];
  if (stats.wheel) chips.push(`轉盤 ${stats.wheel} 次`);
  if (story && stats.good) chips.push(`好吃 ${stats.good} 家`);
  ctx.font = `700 ${story ? 34 : 28}px ${SANS}`;
  let cx = 72;
  const cy = ty + (story ? 46 : 34);
  for (const t of chips) {
    const cw = ctx.measureText(t).width + 30;
    ctx.fillStyle = C.ink;
    ctx.fillRect(cx, cy, cw, story ? 52 : 44);
    ctx.fillStyle = C.paper;
    ctx.fillText(t, cx + 15, cy + (story ? 38 : 32));
    cx += cw + 14;
  }

  // 拍立得格子
  const { cols, rows } = gridFor(photos.length, format);
  const areaTop = cy + (story ? 100 : 76);
  const bottom = h - (story ? 190 : 70);
  const gap = story ? 34 : 26;
  const capH = story ? 64 : 52;
  const pad = story ? 16 : 14;
  const cellW = (w - 140 - gap * (cols - 1)) / cols;
  const maxH = (bottom - areaTop - gap * (rows - 1)) / rows;
  const frame = Math.min(cellW, maxH - capH + pad);
  const photoS = frame - pad * 2;
  const frameH = photoS + pad + capH;
  // 整組置中，不留一大塊空白
  const gridW = cols * frame + (cols - 1) * gap;
  const gridH = rows * frameH + (rows - 1) * gap;
  const left = (w - gridW) / 2;
  const top = areaTop + (bottom - areaTop - gridH) / 2;
  photos.slice(0, cols * rows).forEach((p, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // 最後一列不滿就置中
    const inRow = Math.min(cols, photos.length - row * cols);
    const x = left + (cols - inRow) * (frame + gap) / 2 + col * (frame + gap);
    const y = top + row * (frameH + gap);
    ctx.save();
    ctx.translate(x + frame / 2, y + frameH / 2);
    ctx.rotate(((i % 3) - 1) * 0.025);
    ctx.translate(-frame / 2, -frameH / 2);
    ctx.fillStyle = C.ink;
    ctx.fillRect(8, 8, frame, frameH);
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, frame, frameH);
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, frame, frameH);
    const img = images[i];
    if (img) drawCover(ctx, img, pad, pad, photoS);
    else { ctx.fillStyle = C.dot; ctx.fillRect(pad, pad, photoS, photoS); }
    ctx.lineWidth = 3;
    ctx.strokeRect(pad, pad, photoS, photoS);
    // 說明：星期＋餐別＋吃了什麼
    const label = `週${WEEKDAY_NAMES[weekday(p.date)]} ${LOG_SLOTS[p.slot] || ''}`.trim();
    const fs = Math.max(20, Math.min(story ? 30 : 26, photoS / 9));
    ctx.font = `700 ${fs}px ${SANS}`;
    ctx.fillStyle = C.ink;
    ctx.fillText(label, pad, pad + photoS + capH * 0.66);
    const name = ateAt(p).name;
    if (name) {
      ctx.font = `400 ${fs * 0.85}px ${SANS}`;
      ctx.fillStyle = C.muted;
      ctx.font = `700 ${fs}px ${SANS}`;
      const lw = ctx.measureText(label).width + fs * 0.6;
      ctx.font = `400 ${fs * 0.85}px ${SANS}`;
      let t = name;
      while (t.length > 1 && ctx.measureText(t).width > photoS - lw) t = t.slice(0, -1);
      ctx.fillText(t === name ? t : `${t.slice(0, -1)}…`, pad + lw, pad + photoS + capH * 0.66);
    }
    if (p.fromWheel) {
      ctx.font = `900 ${fs * 0.8}px ${SANS}`;
      const bw = ctx.measureText('轉盤').width + 18;
      ctx.fillStyle = C.mustard;
      ctx.fillRect(frame - pad - bw - 6, pad + 8, bw, fs * 1.3);
      ctx.strokeRect(frame - pad - bw - 6, pad + 8, bw, fs * 1.3);
      ctx.fillStyle = C.ink;
      ctx.fillText('轉盤', frame - pad - bw + 3, pad + 8 + fs * 1.0);
    }
    ctx.restore();
  });

  if (story) {
    if (stats.topSlot) {
      ctx.font = `900 52px ${SERIF}`;
      ctx.fillStyle = C.brick;
      ctx.fillText(`最常打卡：${stats.topSlot}`, 72, h - 82);
    }
  }
}

export default function WeekRecap({ items, onClose }) {
  const { uid } = useData();
  const [week, setWeek] = useState('this');
  const [format, setFormat] = useState('square');
  const [status, setStatus] = useState('loading');
  const [blob, setBlob] = useState(null);
  const canvas = useRef(null);
  const t = today();
  const days = weekDays(week === 'this' ? t : addDays(t, -7));
  const inWeek = items.filter((i) => i.date >= days[0] && i.date <= days[6]);
  const { cols, rows } = gridFor(inWeek.length, format);
  const photos = pickPhotos(inWeek, cols * rows);
  const key = `${week}:${format}:${photos.map((p) => p.id).join(',')}`;

  useEffect(() => {
    let alive = true;
    (async () => {
      setStatus('loading');
      setBlob(null);
      await Promise.all([`900 92px ${SERIF}`, `700 28px ${SANS}`, `54px ${PIXEL}`].map((f) => document.fonts?.load(f, '一週吃什麼0123').catch(() => {})));
      // 用原圖畫，比縮圖清楚；讀不到就用縮圖
      const images = await Promise.all(photos.map(async (p) => {
        const full = await getDoc(doc(db, 'users', uid, 'foodPhotos', p.id)).then((d) => d.data()?.data).catch(() => null);
        return loadImage(full || p.thumb);
      }));
      if (!alive || !canvas.current) return;
      const { w, h } = FORMATS[format];
      canvas.current.width = w;
      canvas.current.height = h;
      drawRecap(canvas.current.getContext('2d'), { format, days, photos, images, stats: weekStats(inWeek) });
      canvas.current.toBlob((b) => { if (alive) { setBlob(b); setStatus('ok'); } }, 'image/png');
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, uid]);

  const fileName = `week-food-${days[0]}-${format}.png`;
  const share = async () => {
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: '一週吃什麼' });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    download();
  };
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <Sheet title="一週吃什麼" onClose={onClose}>
      <div className="seg two">
        <button className={week === 'this' ? 'on' : ''} onClick={() => setWeek('this')}>這週</button>
        <button className={week === 'last' ? 'on' : ''} onClick={() => setWeek('last')}>上週</button>
      </div>
      <div className="seg two recap-format">
        {Object.entries(FORMATS).map(([k, f]) => (
          <button key={k} className={format === k ? 'on' : ''} onClick={() => setFormat(k)}>{f.label}</button>
        ))}
      </div>
      {!inWeek.length ? (
        <p className="hint warn">{week === 'this' ? '這週' : '上週'}還沒有打卡照片。</p>
      ) : (
        <>
          <canvas ref={canvas} className={`recap-canvas ${format}`} aria-label={`一週吃什麼 ${photos.length} 張照片`} />
          <p className="muted small">{inWeek.length > photos.length ? `這週有 ${inWeek.length} 張，挑了 ${photos.length} 張（每天輪流挑）。` : `共 ${photos.length} 張。`}</p>
          <button className="btn primary big wide" onClick={share} disabled={status !== 'ok'}>
            {status === 'ok' ? '分享到 IG／存到相簿' : '排版中…'}
          </button>
          <button className="btn wide" onClick={download} disabled={status !== 'ok'}>下載圖片</button>
        </>
      )}
    </Sheet>
  );
}
