import { useMemo, useState } from 'react';
import { useData } from '../data.jsx';
import { KINDS, affixLabel, groupByAffix } from '../lib/affix.js';
import { practicable } from '../lib/english.js';
import { AffixWord, AffixLegend } from './EnglishToday.jsx';

// 單字卡：依字首、字根、字尾分組，一組一組翻
export default function AffixCards() {
  const { englishItems } = useData();
  const [kind, setKind] = useState('prefix');
  const [open, setOpen] = useState(null);
  const cards = useMemo(() => englishItems.filter((it) => practicable(it) || it.pending), [englishItems]);
  const groups = useMemo(() => groupByAffix(cards, kind), [cards, kind]);

  if (open) {
    const g = groupByAffix(cards, open.kind).find((x) => x.key === open.key);
    return <GroupDeck group={g} onBack={() => setOpen(null)} />;
  }

  return (
    <div>
      <div className="seg three-mini affix-kinds">
        {Object.entries(KINDS).map(([k, l]) => (
          <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
            {l}
          </button>
        ))}
      </div>
      <p className="muted small">
        把你卡片裡的字依{KINDS[kind]}分組。點一組，一張一張翻；<span className="af af-prefix">字首</span>、
        <span className="af af-root">字根</span>、<span className="af af-suffix">字尾</span>會用不同顏色標出來。
      </p>
      {!groups.length && <p className="muted">還沒有可以分組的字。先在「今天」學幾個新字。</p>}
      <div className="affix-grid">
        {groups.map((g) => (
          <button key={g.key} className={`affix-tile af-tile-${kind}`} onClick={() => setOpen({ key: g.key, kind })}>
            <span className="affix-part">{affixLabel(g.affix)}</span>
            <span className="affix-zh">{g.affix.zh}</span>
            <span className="affix-count num">{g.cards.length} 張</span>
            <span className="affix-sample">{g.cards.slice(0, 3).map((c) => c.front).join('・')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GroupDeck({ group, onBack }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [order, setOrder] = useState(() => group?.cards || []);
  if (!group) return <button className="btn" onClick={onBack}>回到分組</button>;
  const c = order[i];
  const go = (n) => {
    setI(n);
    setFlipped(false);
  };
  return (
    <div className="new-deck">
      <div className="row between">
        <button className="link" onClick={onBack}>
          ← 所有分組
        </button>
        <button
          className="link"
          onClick={() => {
            setOrder([...order].sort(() => Math.random() - 0.5));
            go(0);
          }}
        >
          打亂
        </button>
      </div>
      <div className={`group-head af-tile-${group.affix.kind}`}>
        <span className="affix-part">{affixLabel(group.affix)}</span>
        <span>{group.affix.zh}</span>
        <span className="muted small">
          {i + 1} / {order.length}
        </span>
      </div>
      <div className={`flash big-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)}>
        <div className="row between">
          <span className="chip">{(c.tags || [])[0] || '卡片'}</span>
          {c.pos && <span className="muted small">{c.pos}</span>}
        </div>
        <p className="flash-front big-word">
          {c.front.split(/(\s+)/).map((part, j) => (/\s/.test(part) ? part : <AffixWord key={j} word={part} />))}
        </p>
        <AffixLegend word={c.front.split(/\s+/).sort((a, b) => b.length - a.length)[0]} />
        {flipped ? (
          <div className="flash-back">
            <p className="flash-answer">{c.back || '（沒有寫意思）'}</p>
            {c.collocation && <div className="word-line"><span className="word-tag">搭配</span>{c.collocation}</div>}
            {c.root && <div className="word-line"><span className="word-tag">字根</span>{c.root}</div>}
            {c.example && <p className="flash-example">{c.example}</p>}
          </div>
        ) : (
          <p className="muted small flash-tap">先想想意思，點一下翻面</p>
        )}
      </div>
      <div className="row gap">
        <button className="btn grow" disabled={!i} onClick={() => go(i - 1)}>
          上一張
        </button>
        <button className="btn primary grow" disabled={i >= order.length - 1} onClick={() => go(i + 1)}>
          下一張
        </button>
      </div>
    </div>
  );
}
