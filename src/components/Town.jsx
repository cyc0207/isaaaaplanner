import { Link } from 'react-router-dom';
import { useData } from '../data.jsx';
import { today } from '../lib/date.js';
import { town, INVEST_HINT } from '../lib/town.js';
import { money } from './ui.jsx';
import TownIsland, { BuildingIcon, LOT_COLORS, LOT_SLOTS } from './TownIsland.jsx';

const WEATHER = {
  sun: '晴天：這個月生活費照進度花',
  dust: '起沙塵：這個月生活費花得比進度快',
  storm: '暴風：這個月生活費已經超過了',
  none: '還沒設定薪水，天氣先放晴',
};

// 牛仔小鎮：投資標的蓋房子、存款挖金礦、守住生活費種仙人掌
export default function Town() {
  const { expenses, accounts, budget, fixedItems } = useData();
  const t = town({ expenses, accounts, budget, fixedItems, day: today() });
  const w = t.weather;

  return (
    <section className="section town">
      <div className="card town-scene">
        <TownIsland t={t} label={`${t.title}，${t.lots.length} 塊地，${t.trees} 棵仙人掌`} />
        <div className="town-worth">
          <span className="town-badge">{t.title}</span>
          <div className="big num">{money(t.worth)}</div>
          <div className="label">小鎮身價＝投資累計 {money(t.investTotal)}＋存款 {money(t.vault.amount)}</div>
        </div>
      </div>
      <p className={`town-weather ${w.kind}`}>
        {WEATHER[w.kind]}
        {w.kind !== 'none' && (
          <span className="muted small">
            {' '}（花了 {money(w.spent)}，照進度可以花到 {money(w.pace)}）
          </span>
        )}
      </p>
      {t.builtThisMonth > 0 && <p className="muted small">本月投入 {money(t.builtThisMonth)}，島上飛了一顆熱氣球。</p>}

      <h3>我的地產</h3>
      {t.lots.length ? (
        <ul className="town-lots">
          {t.lots.map((lot, i) => (
            <li key={lot.name} className="card town-lot">
              <BuildingIcon level={lot.key} color={i < LOT_SLOTS.length ? LOT_COLORS[i % LOT_COLORS.length] : 'chrome'} />
              <div className="town-lot-body">
                <div className="row between">
                  <strong>{lot.name}</strong>
                  <span className="town-level">Lv.{lot.level + 1} {lot.levelName}</span>
                </div>
                <div className="num town-amt">{money(lot.total)}</div>
                <div className="invest-tbar">
                  <div style={{ width: `${lot.progress * 100}%` }} />
                </div>
                <span className="muted small">{lot.next ? `再投 ${money(lot.toNext)} 升級成${lot.next.name}` : '已經是最高級了'}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">還沒有地。{INVEST_HINT}</p>
      )}
      {t.lots.length > LOT_SLOTS.length && <p className="muted small">島上放得下前 {LOT_SLOTS.length} 塊地，其他的列在上面。</p>}

      <h3>金礦（存款）</h3>
      <div className="card town-lot">
        <div className="town-lot-body">
          <div className="row between">
            <strong>{t.vault.levelName}</strong>
            <span className="town-level">Lv.{t.vault.level + 1}</span>
          </div>
          <div className="num town-amt">{money(t.vault.amount)}</div>
          <div className="invest-tbar">
            <div style={{ width: `${t.vault.progress * 100}%` }} />
          </div>
          <span className="muted small">{t.vault.next ? `再存 ${money(t.vault.toNext)} 變成${t.vault.next.name}` : '金子堆成山了'}</span>
        </div>
      </div>

      <h3>仙人掌園（最近 6 個月）</h3>
      {t.park.length ? (
        <>
          <ul className="list town-park">
            {t.park.map((m) => (
              <li key={m.key} className="row between">
                <span>
                  {Number(m.key.slice(5))} 月 {m.kept ? '種了一棵仙人掌' : '滾來一團風滾草'}
                </span>
                <span className={`num ${m.kept ? '' : 'over'}`}>{m.kept ? `省 ${money(m.saved)}` : `超 ${money(-m.saved)}`}</span>
              </li>
            ))}
          </ul>
          {t.parkSaved > 0 && <p className="muted small">守住的月份一共省下 {money(t.parkSaved)}。</p>}
        </>
      ) : (
        <p className="muted small">上個月開始有記帳、而且有填薪水，月底結算後就會長出第一棵仙人掌。</p>
      )}

      <p className="muted small">
        規則：每個<Link to="/money?tab=invest">投資</Link>標的是一塊地，累計投入越多房子越大；投資帳戶以外的帳戶餘額是金礦；
        每個月生活費沒超過預算就種一棵仙人掌，超過就是風滾草。全部從記帳算出來，不用另外輸入。
      </p>
    </section>
  );
}
