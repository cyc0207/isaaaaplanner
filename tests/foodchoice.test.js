import { describe, it, expect } from 'vitest';
import { slotsOf, slotFields, toggleSlot, weekSlotCounts, slotLabel, nameFromMapsUrl, favByUrl, startHow, howOf } from '../src/lib/foodlog.js';
import { drinkOdds } from '../src/lib/drinks.js';
import { weekStats } from '../src/lib/recap.js';

describe('打卡類別多選', () => {
  it('舊資料只有 slot 也讀得懂，新的照固定順序', () => {
    expect(slotsOf({ slot: 'dinner' })).toEqual(['dinner']);
    expect(slotsOf({ slot: 'drink', slots: ['drink', 'dinner'] })).toEqual(['dinner', 'drink']);
    expect(slotLabel({ slots: ['drink', 'dinner'] })).toBe('晚餐＋飲料');
    expect(slotFields(['drink', 'dinner'])).toEqual({ slots: ['dinner', 'drink'], slot: 'dinner' });
  });
  it('點一下加、再點拿掉，最後一個拿不掉', () => {
    expect(toggleSlot(['dinner'], 'drink')).toEqual(['dinner', 'drink']);
    expect(toggleSlot(['dinner', 'drink'], 'dinner')).toEqual(['drink']);
    expect(toggleSlot(['drink'], 'drink')).toEqual(['drink']);
  });
  it('晚餐＋飲料那張，兩類各算一次，飲料杯數也算', () => {
    const items = [{ date: '2026-10-13', slots: ['dinner', 'drink'], slot: 'dinner', sugar: '全糖' }, { date: '2026-10-12', slot: 'drink' }];
    const c = weekSlotCounts(items, '2026-10-13');
    expect(c.dinner).toBe(1);
    expect(c.drink).toBe(2);
    const o = drinkOdds({ budget: {}, expenses: [], day: '2026-10-13', logs: items });
    expect(o.cups).toBe(2);
    expect(o.today).toBe(1);
    expect(weekStats(items).topSlot).toBe('飲料');
  });
});

describe('今天選擇', () => {
  it('從 Google 地圖網址抓店名', () => {
    expect(nameFromMapsUrl('https://www.google.com/maps/place/%E6%9D%B1%E8%91%89%E8%B1%AC%E8%85%B3%E9%A3%AF/@25.0,121.5,17z')).toBe('東葉豬腳飯');
    expect(nameFromMapsUrl('https://www.google.com/maps/search/?api=1&query=%E8%B1%90%E7%A6%BE%E4%BE%BF%E7%95%B6&query_place_id=abc')).toBe('豐禾便當');
    expect(nameFromMapsUrl('https://maps.google.com/?q=25.07,121.57')).toBe('');
    expect(nameFromMapsUrl('https://maps.app.goo.gl/xyz')).toBe('');
    expect(nameFromMapsUrl('不是網址')).toBe('');
  });
  it('貼的網址是收藏的店就用收藏的名字', () => {
    const favs = [{ id: 'ChIJabc', key: 'ChIJabc', name: '東葉豬腳飯', url: 'https://maps.google.com/?cid=1' }];
    expect(favByUrl(favs, 'https://maps.google.com/?cid=1').name).toBe('東葉豬腳飯');
    expect(favByUrl(favs, 'https://www.google.com/maps/place/?q=place_id:ChIJabc').name).toBe('東葉豬腳飯');
    expect(favByUrl(favs, 'https://maps.app.goo.gl/xyz')).toBe(null);
  });
  it('轉盤和今天選擇都有，用比較晚的；舊資料用 fromWheel 判斷', () => {
    const spin = { source: 'near', name: 'A', at: 1 };
    const choice = { name: 'B', url: 'u', at: 2 };
    expect(startHow(spin, choice)).toMatchObject({ how: 'today', wheelPick: 'B', note: 'B', url: 'u' });
    expect(startHow({ ...spin, at: 3 }, choice)).toMatchObject({ how: 'wheel', wheelPick: 'A', fromWheel: true });
    expect(startHow(null, null).how).toBe('self');
    expect(howOf({ fromWheel: true })).toBe('wheel');
    expect(howOf({})).toBe('self');
    expect(howOf({ how: 'today' })).toBe('today');
  });
});
