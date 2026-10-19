// 每日英文任務的原創題庫（自己寫的，不是 ETS 或任何出版社的題目，licenseStatus: 'original'）。
// 題型仿照 TOEIC Listening Part 2／3／4 的形式，用瀏覽器內建的英文朗讀播放。
// 這是非官方練習：只算正確率，不換算多益分數。
// answer 是選項的索引（0 = A）。level 1～3 是大概的難度。

export const LIBRARY_META = {
  source: '陳陳專屬app 原創題庫',
  licenseStatus: 'original',
  lastVerifiedAt: '2026-10-18',
  audio: 'tts', // 瀏覽器朗讀；沒有英文語音的裝置不派聽力題
};

// ---- Part 2：一句問題或直述句，三個回應選一個最適合的 ----
export const PART2 = [
  // Wh 問句
  { id: 'p2-01', tag: 'wh', level: 1, q: 'Where should I put these boxes?', options: ['About twenty boxes.', 'Yes, I put them there.', 'By the door in the storage room.'], answer: 2, explain: 'Where 問地點，C 回答位置。B 用 Yes 回答 Wh 問句，A 回答數量。', phrases: [{ en: 'storage room', zh: '儲藏室' }] },
  { id: 'p2-02', tag: 'wh', level: 1, q: 'When does the training session start?', options: ['Right after lunch.', 'It was very useful.', 'In the main conference room.'], answer: 0, explain: 'When 問時間，A 回答「午餐後」。C 是地點，B 是感想。', phrases: [{ en: 'training session', zh: '訓練課程' }, { en: 'right after', zh: '緊接在…之後' }] },
  { id: 'p2-03', tag: 'wh', level: 1, q: 'Who is in charge of the new project?', options: ['It starts next month.', 'Ms. Chen from the product team.', 'Yes, I charged my phone.'], answer: 1, explain: 'Who 問人，B 回答負責的人。C 用 charge 製造同音陷阱。', phrases: [{ en: 'in charge of', zh: '負責' }] },
  { id: 'p2-04', tag: 'wh', level: 2, q: 'Why was the client meeting moved?', options: ['To the third floor.', 'The client had a scheduling conflict.', 'I moved last year.'], answer: 1, explain: 'Why 問原因，B 說客戶時間衝突。A 誤把 moved 聽成「搬到哪裡」，C 重複 moved。', phrases: [{ en: 'scheduling conflict', zh: '時間衝突' }] },
  { id: 'p2-05', tag: 'wh', level: 2, q: 'How long will the system update take?', options: ['Yes, it was a long day.', 'It updates automatically.', 'About two hours, I think.'], answer: 2, explain: 'How long 問多久，C 回答時間長度。B 回答怎麼更新，A 重複 long。', phrases: [{ en: 'system update', zh: '系統更新' }] },
  { id: 'p2-06', tag: 'wh', level: 2, q: 'Which supplier did we choose for the packaging?', options: ['The one we met in Taichung.', 'We chose it carefully.', 'The packages arrived yesterday.'], answer: 0, explain: 'Which 問哪一個，A 用 the one… 指出是哪家。C 用 packages 製造相似字陷阱。', phrases: [{ en: 'supplier', zh: '供應商' }, { en: 'packaging', zh: '包裝' }] },
  { id: 'p2-07', tag: 'wh', level: 1, q: "What's the password for the guest Wi-Fi?", options: ['It\'s written on the board in the lobby.', 'Yes, the Wi-Fi is fast.', 'The guests left early.'], answer: 0, explain: 'What 問內容，A 告訴你哪裡可以看到密碼，是常見的「間接回答」。', phrases: [{ en: 'lobby', zh: '大廳' }] },
  { id: 'p2-08', tag: 'wh', level: 2, q: 'How often do you send the sales report?', options: ['To the regional manager.', 'Every Friday afternoon.', 'Sales were higher this month.'], answer: 1, explain: 'How often 問頻率，B 回答每週五。A 回答給誰，C 重複 sales。', phrases: [{ en: 'sales report', zh: '業務報告' }, { en: 'regional manager', zh: '區域經理' }] },
  { id: 'p2-09', tag: 'wh', level: 3, q: 'Where can I find the updated budget figures?', options: ['I found it on the floor.', 'The budget was approved.', 'Jason hasn\'t finished them yet.'], answer: 2, explain: '問在哪裡找，C 說「還沒做好」，間接表示目前找不到。這種「沒有直接回答」的選項常是正解。', phrases: [{ en: 'budget figures', zh: '預算數字' }] },
  { id: 'p2-10', tag: 'wh', level: 2, q: 'Who should I ask about the parking permit?', options: ['The park closes at six.', 'The front desk handles that.', 'Yes, you can park here.'], answer: 1, explain: 'Who 問找誰，B 回答櫃檯負責。A 用 park 製造相似音，C 用 Yes 回答 Wh 問句。', phrases: [{ en: 'parking permit', zh: '停車許可證' }, { en: 'handle', zh: '處理' }] },
  { id: 'p2-11', tag: 'wh', level: 3, q: 'When will the new version of the app be released?', options: ['It depends on the test results.', 'The release notes are attached.', 'We released three new features.'], answer: 0, explain: '問什麼時候，A 說「看測試結果」，沒有給日期但合理。B、C 都重複 release。', phrases: [{ en: 'release', zh: '發布、上線' }, { en: 'it depends on', zh: '看…而定' }] },
  { id: 'p2-12', tag: 'wh', level: 2, q: 'Why did the customer call this morning?', options: ['I\'ll call you back.', 'At around nine thirty.', 'She wanted to change her delivery address.'], answer: 2, explain: 'Why 問原因，C 說要改地址。B 是時間，A 重複 call。', phrases: [{ en: 'delivery address', zh: '送貨地址' }] },
  { id: 'p2-13', tag: 'wh', level: 3, q: 'How did the user interviews go?', options: ['They\'re going to the airport.', 'We interviewed eight people.', 'Better than we expected.'], answer: 2, explain: 'How did … go 問進行得如何，C 回答結果。B 回答人數，A 用 going 製造陷阱。', phrases: [{ en: 'user interview', zh: '使用者訪談' }, { en: 'better than we expected', zh: '比預期好' }] },
  { id: 'p2-14', tag: 'wh', level: 1, q: "What time does the store open on Saturdays?", options: ['It opens at ten.', 'Yes, it is open.', 'On the second floor.'], answer: 0, explain: 'What time 問時間，A 回答十點。', phrases: [] },
  { id: 'p2-15', tag: 'wh', level: 3, q: 'Whose turn is it to prepare the weekly update?', options: ['Turn left at the corner.', 'I prepared it last week.', 'Every Monday.'], answer: 1, explain: '問輪到誰，B 說「我上週做了」，暗示不是自己。A 用 turn 的另一個意思（轉彎）。', phrases: [{ en: 'whose turn is it', zh: '輪到誰' }, { en: 'weekly update', zh: '每週進度報告' }] },
  { id: 'p2-16', tag: 'wh', level: 2, q: 'How much does it cost to ship this overseas?', options: ['About three to five days.', 'It depends on the weight.', 'The ship is very large.'], answer: 1, explain: 'How much 問價錢，B 說看重量。A 回答時間，C 把 ship（寄送）聽成船。', phrases: [{ en: 'ship overseas', zh: '寄到國外' }, { en: 'weight', zh: '重量' }] },

  // Yes/No 問句
  { id: 'p2-17', tag: 'yesno', level: 1, q: 'Did you finish the slides for tomorrow?', options: ['The slides are on the playground.', 'Tomorrow at ten.', 'Almost, I just need to add the charts.'], answer: 2, explain: 'C 說「快好了」，是 Yes/No 問句很自然的回答。B 只回答時間。', phrases: [{ en: 'slides', zh: '簡報投影片' }] },
  { id: 'p2-18', tag: 'yesno', level: 2, q: 'Is the printer on the fifth floor working again?', options: ['No, the technician is coming this afternoon.', 'Print two copies, please.', 'I work on the fifth floor.'], answer: 0, explain: 'A 回答還沒修好並補充原因。C、B 重複 work、print。', phrases: [{ en: 'technician', zh: '技術人員' }] },
  { id: 'p2-19', tag: 'yesno', level: 2, q: 'Have you met our new intern?', options: ['Yes, she\'s sitting next to me.', 'The internet is down.', 'We\'ll meet at the station.'], answer: 0, explain: 'A 回答見過並補充。B 用 internet 對 intern 製造相似音。', phrases: [{ en: 'intern', zh: '實習生' }] },
  { id: 'p2-20', tag: 'yesno', level: 3, q: 'Are we still using the old reporting template?', options: ['The report was submitted.', 'Only until the end of this month.', 'It is a very old building.'], answer: 1, explain: 'B 說「只用到月底」，表示是但快換了。A、C 重複 report、old。', phrases: [{ en: 'template', zh: '範本' }] },
  { id: 'p2-21', tag: 'yesno', level: 2, q: 'Does this price include tax?', options: ['The prices went up.', 'A taxi will be here soon.', 'Yes, everything is included.'], answer: 2, explain: 'C 直接回答。B 用 taxi 對 tax 製造相似音。', phrases: [{ en: 'include tax', zh: '含稅' }] },
  { id: 'p2-22', tag: 'yesno', level: 3, q: 'Will the developers have time to fix this bug before Friday?', options: ['They fixed the window.', 'I\'ll check with their team lead.', 'Friday is a holiday.'], answer: 1, explain: 'B 說「我去問他們的組長」，常見的「不知道，我去確認」型回答。', phrases: [{ en: 'fix a bug', zh: '修正程式錯誤' }, { en: 'check with', zh: '向…確認' }] },

  // 間接問句、Do you know… 開頭
  { id: 'p2-23', tag: 'indirect', level: 2, q: 'Do you know where the marketing team moved to?', options: ['They\'re on the eighth floor now.', 'Yes, the market is very busy.', 'They moved last Monday.'], answer: 0, explain: '重點是 where，所以要回答地點。C 回答時間，是常見陷阱。', phrases: [{ en: 'move to', zh: '搬到' }] },
  { id: 'p2-24', tag: 'indirect', level: 2, q: 'Can you tell me when the next shuttle leaves?', options: ['Yes, I can tell.', 'From the north entrance.', 'Every fifteen minutes.'], answer: 2, explain: '重點是 when，C 回答多久一班。B 是地點，A 只回答 Can you。', phrases: [{ en: 'shuttle', zh: '接駁車' }] },
  { id: 'p2-25', tag: 'indirect', level: 3, q: "I'm not sure who approved this purchase.", options: ['Yes, it\'s approved.', 'It was purchased online.', 'Let me look at the request form.'], answer: 2, explain: '直述句表達不確定，C 說「我看一下申請單」幫忙查。', phrases: [{ en: 'approve a purchase', zh: '核准採購' }, { en: 'request form', zh: '申請單' }] },
  { id: 'p2-26', tag: 'indirect', level: 3, q: 'Do you remember how many people signed up for the workshop?', options: ['Around thirty, I believe.', 'Sign here, please.', 'The workshop was in March.'], answer: 0, explain: '重點是 how many，A 回答人數。B 重複 sign。', phrases: [{ en: 'sign up for', zh: '報名' }, { en: 'workshop', zh: '工作坊' }] },
  { id: 'p2-27', tag: 'indirect', level: 2, q: 'Could you find out why the delivery is late?', options: ['It was delivered yesterday.', "Sure, I'll call the courier.", "It's too late to go out."], answer: 1, explain: '請對方查原因，B 答應並說要打給快遞。C 重複 late。', phrases: [{ en: 'find out', zh: '查出' }, { en: 'courier', zh: '快遞公司' }] },
  { id: 'p2-28', tag: 'indirect', level: 3, q: 'Do you happen to know which room the interview is in?', options: ['I happened to see him.', 'It\'s in Room 302.', 'The interview went well.'], answer: 1, explain: '重點是 which room，B 回答房號。A 重複 happen。', phrases: [{ en: 'do you happen to know', zh: '你剛好知道…嗎（禮貌問法）' }] },

  // 請求、建議、邀請
  { id: 'p2-29', tag: 'request', level: 1, q: 'Could you send me the meeting notes?', options: ['I met him yesterday.', 'The notes are very short.', 'Sure, right after this call.'], answer: 2, explain: '請求要回答答應或拒絕，C 答應。A 用 met 對 meeting 製造陷阱。', phrases: [{ en: 'meeting notes', zh: '會議紀錄' }] },
  { id: 'p2-30', tag: 'request', level: 2, q: "Why don't we order lunch for the team?", options: ['That\'s a great idea.', 'The team lunch was fun.', 'Because it was ordered.'], answer: 0, explain: 'Why don\'t we… 是提議，不是問原因。A 贊成。C 用 Because 回答是陷阱。', phrases: [{ en: "why don't we", zh: '我們要不要…（提議）' }] },
  { id: 'p2-31', tag: 'request', level: 2, q: 'Would you like me to print the agenda?', options: ['Thanks, but I\'ve already printed it.', 'The printer is new.', 'I like this agenda.'], answer: 0, explain: 'Would you like me to… 是主動幫忙，A 道謝並說已經印了。', phrases: [{ en: 'agenda', zh: '會議議程' }] },
  { id: 'p2-32', tag: 'request', level: 3, q: 'How about moving the review to Thursday?', options: ['We reviewed it on Thursday.', 'Thursday works better for me, too.', 'About two hours.'], answer: 1, explain: 'How about… 是提議，B 贊成。C 把 How about 聽成 How long。', phrases: [{ en: 'how about', zh: '…如何（提議）' }, { en: 'works for me', zh: '我可以' }] },
  { id: 'p2-33', tag: 'request', level: 2, q: 'Can I borrow your charger for a minute?', options: ['I borrowed a book.', 'It takes a minute.', 'Of course, here you go.'], answer: 2, explain: 'C 答應並遞給對方。', phrases: [{ en: 'here you go', zh: '拿去吧' }] },
  { id: 'p2-34', tag: 'request', level: 3, q: 'Would you mind reviewing my test cases before I submit them?', options: ['I mind the store on weekends.', 'Not at all. Send them over.', 'The test was difficult.'], answer: 1, explain: 'Would you mind…? 回答 Not at all 表示「不介意、可以」。', phrases: [{ en: 'would you mind', zh: '你介意…嗎' }, { en: 'test case', zh: '測試案例' }] },

  // 直述句
  { id: 'p2-35', tag: 'statement', level: 2, q: 'The projector in Room B is not working.', options: ['I\'ll call IT for you.', 'I worked in Room B.', 'The project is on time.'], answer: 0, explain: '直述句說出問題，A 提出解決方式。C 用 project 對 projector 製造陷阱。', phrases: [{ en: 'projector', zh: '投影機' }] },
  { id: 'p2-36', tag: 'statement', level: 2, q: "I can't find the file you shared yesterday.", options: ['Yesterday was busy.', 'The files were shared fairly.', 'Let me send it again.'], answer: 2, explain: 'C 說要再傳一次，是自然的回應。', phrases: [] },
  { id: 'p2-37', tag: 'statement', level: 3, q: 'The users keep asking for a dark mode.', options: ['They asked me yesterday.', 'It gets dark early in winter.', 'Then we should add it to the backlog.'], answer: 2, explain: 'C 說「那加進待辦清單」，回應使用者需求。B 用 dark 的另一個意思。', phrases: [{ en: 'backlog', zh: '待辦需求清單' }, { en: 'keep asking for', zh: '一直要求' }] },
  { id: 'p2-38', tag: 'statement', level: 2, q: "I think we're running out of paper.", options: ['I\'ll order some more today.', 'He runs every morning.', 'The paper was published.'], answer: 0, explain: 'A 說要補貨。B 重複 run。', phrases: [{ en: 'run out of', zh: '用完' }] },
  { id: 'p2-39', tag: 'statement', level: 3, q: 'The deadline for the proposal has been extended.', options: ['It was extended to the parking lot.', "Good, that gives us more time to test it.", 'The proposal was rejected last year.'], answer: 1, explain: '延期了，B 回應「好，多了時間測試」。', phrases: [{ en: 'deadline is extended', zh: '期限延後' }, { en: 'proposal', zh: '提案' }] },
  { id: 'p2-40', tag: 'statement', level: 1, q: "It's really cold in this meeting room.", options: ['The meeting is at two.', 'I\'ll turn down the air conditioning.', 'I have a cold.'], answer: 1, explain: 'B 提出調整冷氣。C 用 cold（感冒）製造陷阱。', phrases: [{ en: 'turn down', zh: '調低' }] },

  // 選擇疑問句
  { id: 'p2-41', tag: 'choice', level: 2, q: 'Should we meet online or in the office?', options: ['The office is closed on Sunday.', 'Yes, we should.', 'Online is easier for everyone.'], answer: 2, explain: '選擇疑問句要選一個，C 選線上。B 用 Yes 回答是錯的。', phrases: [] },
  { id: 'p2-42', tag: 'choice', level: 2, q: 'Do you want the report today or tomorrow morning?', options: ['Tomorrow morning is fine.', 'Yes, I want it.', 'The report was long.'], answer: 0, explain: 'A 選明天早上。', phrases: [] },
  { id: 'p2-43', tag: 'choice', level: 3, q: 'Is the launch event in Taipei or Kaohsiung this year?', options: ['They haven\'t decided yet.', 'It was launched last year.', 'Yes, this year.'], answer: 0, explain: '選擇疑問句也可以回答「還沒決定」。B 重複 launch。', phrases: [{ en: 'launch event', zh: '發表會' }] },
  { id: 'p2-44', tag: 'choice', level: 3, q: 'Would you prefer a window seat or an aisle seat?', options: ['I prefer to fly early.', 'Either is fine with me.', 'The window is open.'], answer: 1, explain: 'B「都可以」是選擇疑問句常見的正解。', phrases: [{ en: 'aisle seat', zh: '靠走道座位' }, { en: 'either is fine', zh: '都可以' }] },

  // 附加問句、否定問句
  { id: 'p2-45', tag: 'tag', level: 2, q: "You've worked with Jira before, haven't you?", options: ['Before the meeting.', 'It works very well.', 'Yes, during my internship.'], answer: 2, explain: '附加問句是在確認，C 回答有並補充在哪裡用過。', phrases: [{ en: "haven't you?", zh: '不是嗎？（附加問句）' }] },
  { id: 'p2-46', tag: 'tag', level: 3, q: "Isn't the UAT supposed to start today?", options: ['The users are supposed to come.', 'It was moved to next Monday.', 'Today is Tuesday.'], answer: 1, explain: '否定問句也是在確認，B 說改到下週一。A 重複 supposed to。', phrases: [{ en: 'be supposed to', zh: '照理說應該' }, { en: 'UAT', zh: '使用者驗收測試' }] },
  { id: 'p2-47', tag: 'tag', level: 2, q: "The store doesn't open until ten, does it?", options: ['No, it opens at nine today.', 'I stored it there.', 'Ten dollars each.'], answer: 0, explain: 'A 更正開門時間。B 用 stored 製造陷阱，C 重複 ten。', phrases: [{ en: 'not until', zh: '直到…才' }] },
  { id: 'p2-48', tag: 'tag', level: 3, q: "Didn't you say the data looked wrong?", options: ['The date is wrong.', 'I looked for it everywhere.', 'Yes, the totals don\'t match the source file.'], answer: 2, explain: 'C 確認並說明問題。A 用 date 對 data 製造相似音。', phrases: [{ en: "don't match", zh: '對不上' }, { en: 'source file', zh: '原始檔案' }] },
];

// ---- Part 3（對話）／Part 4（獨白）：先聽一段，再回答三題 ----
// speakers：W = 女聲、M = 男聲、W2／M2 = 第二位女聲／男聲；narrator 是獨白
export const PART34 = [
  {
    id: 'p3-01', type: 'conversation', level: 1, title: '印表機壞了', tags: ['detail', 'next'],
    lines: [
      { sp: 'W', text: "Hi Tom, the printer on our floor isn't working again. I need to print the contracts for the two o'clock meeting." },
      { sp: 'M', text: "Oh no. The technician can't come until tomorrow. But you can use the one in the design department on the third floor." },
      { sp: 'W', text: "Great, I'll do that. Do I need a code to use it?" },
      { sp: 'M', text: "Yes, it's 4-5-2-1. I'll send it to you in a message so you don't forget." },
    ],
    questions: [
      { q: 'What does the woman need to print?', options: ['Contracts', 'Invoices', 'A floor plan', 'Name tags'], answer: 0, tag: 'detail', explain: '女生一開始說 I need to print the contracts。' },
      { q: 'When will the technician come?', options: ['This morning', 'At two o\'clock', 'Next week', 'Tomorrow'], answer: 3, explain: "男生說 The technician can't come until tomorrow。", tag: 'detail' },
      { q: 'What will the man do next?', options: ['Fix the printer', 'Go to the meeting', 'Call the design department', 'Send a message'], answer: 3, tag: 'next', explain: "最後男生說 I'll send it to you in a message。" },
    ],
  },
  {
    id: 'p3-02', type: 'conversation', level: 2, title: '使用者回報的問題', tags: ['main', 'detail', 'intent'],
    lines: [
      { sp: 'M', text: "Lisa, several users reported that the checkout page freezes when they use a discount code." },
      { sp: 'W', text: "Is it happening on both the app and the website?" },
      { sp: 'M', text: "Only on the app, and mostly on older phones. The developers are busy with the new release, though." },
      { sp: 'W', text: "Well, this affects payments, so it should come first. Let's write down the steps to reproduce it and bring it to the stand-up tomorrow morning." },
    ],
    questions: [
      { q: 'What problem are the speakers discussing?', options: ['A wrong price', 'A late delivery', 'A page that freezes', 'A broken phone'], answer: 2, tag: 'main', explain: '男生說 the checkout page freezes。' },
      { q: 'Where does the problem happen?', options: ['Only on the website', 'On both the app and the website', 'Only on the app', 'Only on new phones'], answer: 2, tag: 'detail', explain: 'Only on the app, and mostly on older phones。' },
      { q: 'Why does the woman say, "this affects payments"?', options: ['To complain about the price', 'To explain why the issue is a priority', 'To ask for a refund', 'To change the payment method'], answer: 1, tag: 'intent', explain: '她接著說 so it should come first，表示這件事要優先處理。' },
    ],
  },
  {
    id: 'p3-03', type: 'conversation', level: 1, title: '訂會議室', tags: ['detail', 'inference'],
    lines: [
      { sp: 'W', text: "Hello, I'd like to book a meeting room for eight people on Thursday afternoon." },
      { sp: 'M', text: "Let me check. Room A is free from one to three, but it only has six seats. Room C is bigger, but it's available only after four." },
      { sp: 'W', text: "Hmm, we need at least two hours, and we have to finish before five. I'll take Room A and bring two extra chairs." },
      { sp: 'M', text: "No problem. I'll put your name down." },
    ],
    questions: [
      { q: 'How many people will attend the meeting?', options: ['Six', 'Eight', 'Two', 'Five'], answer: 1, tag: 'detail', explain: 'a meeting room for eight people。' },
      { q: 'Which room does the woman choose?', options: ['Room A', 'Room B', 'Room C', 'She does not choose one'], answer: 0, tag: 'detail', explain: "I'll take Room A。" },
      { q: 'What can be inferred about the meeting?', options: ['It will end before five.', 'It will be held online.', 'It will start at four.', 'It will last one hour.'], answer: 0, tag: 'inference', explain: '她說 we have to finish before five，而且選了一點到三點的會議室。' },
    ],
  },
  {
    id: 'p3-04', type: 'conversation', level: 2, title: '新同事的第一週', tags: ['detail', 'next', 'inference'],
    lines: [
      { sp: 'M', text: "Hi, I'm Kevin. It's my first week here. Could you tell me how to request access to the project folders?" },
      { sp: 'W', text: "Sure. You need to fill out a form on the IT portal. Your manager has to approve it, so it usually takes a day." },
      { sp: 'M', text: "A day? I was hoping to start on the test plan this afternoon." },
      { sp: 'W', text: "Then I'll share my copy of the test plan with you by email for now. You can read it while you wait." },
    ],
    questions: [
      { q: 'What does the man want to do?', options: ['Join a training', 'Meet his manager', 'Change his password', 'Get access to project folders'], answer: 3, tag: 'detail', explain: 'how to request access to the project folders。' },
      { q: 'Why does the man say, "A day?"', options: ['He is happy it is fast.', 'He wants to leave early.', 'He forgot the date.', 'He thinks it will take too long.'], answer: 3, tag: 'inference', explain: '他接著說本來想今天下午就開始，表示覺得太久。' },
      { q: 'What will the woman do?', options: ['Approve the form', 'Call IT', 'Email the test plan', 'Write a new plan'], answer: 2, tag: 'next', explain: "I'll share my copy of the test plan with you by email。" },
    ],
  },
  {
    id: 'p3-05', type: 'conversation', level: 3, title: '需求優先順序', tags: ['main', 'detail', 'next'],
    lines: [
      { sp: 'W', text: "Marcus, the sales team wants us to add an export button to the dashboard before the end of the month." },
      { sp: 'M', text: "That's tight. We're already fixing the login issues that customer support flagged last week." },
      { sp: 'W', text: "I know. But they said three big clients asked for it. Maybe we could do a simple version first, just exporting to a spreadsheet." },
      { sp: 'M', text: "That could work. Let me ask the developers for a rough estimate, and we can decide at Friday's planning meeting." },
    ],
    questions: [
      { q: 'What does the sales team want?', options: ['A new login page', 'More clients', 'An export button', 'A planning meeting'], answer: 2, tag: 'main', explain: 'the sales team wants us to add an export button。' },
      { q: 'What is the team working on now?', options: ['A spreadsheet', 'Login issues', 'A sales report', 'A new dashboard'], answer: 1, tag: 'detail', explain: "We're already fixing the login issues。" },
      { q: 'What will the man do next?', options: ['Call the clients', 'Ask for an estimate', 'Cancel the meeting', 'Build the button himself'], answer: 1, tag: 'next', explain: 'Let me ask the developers for a rough estimate。' },
    ],
  },
  {
    id: 'p3-06', type: 'conversation', level: 2, title: '出差訂機票', tags: ['detail', 'inference', 'next'],
    lines: [
      { sp: 'M', text: "Amy, have you booked your flight to Singapore for the conference?" },
      { sp: 'W', text: "Not yet. The morning flight on Monday is almost full, and the evening one arrives too late for the opening dinner." },
      { sp: 'M', text: "What about flying on Sunday? The company pays for an extra night at the hotel if it's cheaper overall." },
      { sp: 'W', text: "Really? Then I'll compare the prices and send the details to the travel desk today." },
    ],
    questions: [
      { q: 'Where is the conference?', options: ['Singapore', 'Tokyo', 'Hong Kong', 'Seoul'], answer: 0, tag: 'detail', explain: 'your flight to Singapore for the conference。' },
      { q: 'What is the problem with the evening flight?', options: ['It arrives too late.', 'It is full.', 'It is too expensive.', 'It was canceled.'], answer: 0, tag: 'detail', explain: 'the evening one arrives too late for the opening dinner。' },
      { q: 'What will the woman probably do today?', options: ['Book a hotel', 'Call the conference', 'Cancel her trip', 'Compare flight prices'], answer: 3, tag: 'next', explain: "I'll compare the prices and send the details。" },
    ],
  },
  {
    id: 'p3-07', type: 'conversation', level: 3, title: '三人對話：測試延期', tags: ['main', 'detail', 'intent'],
    lines: [
      { sp: 'W', text: "Before we start, I have some news. The client asked to move the user acceptance testing to next week." },
      { sp: 'M', text: "That's actually good for us. We found two calculation errors in the report yesterday." },
      { sp: 'W2', text: "Right, I've fixed one of them already. The other one needs the finance team to confirm the formula." },
      { sp: 'W', text: "Okay. Jenny, can you set up a short call with finance today? I'd like everything ready by Wednesday." },
    ],
    questions: [
      { q: 'What is the main news?', options: ['A new client has signed.', 'A team member is leaving.', 'The report was approved.', 'Testing has been moved.'], answer: 3, tag: 'main', explain: 'move the user acceptance testing to next week。' },
      { q: 'What did the team find yesterday?', options: ['A design problem', 'A missing file', 'Calculation errors', 'A budget increase'], answer: 2, tag: 'detail', explain: 'We found two calculation errors。' },
      { q: 'Why does the man say, "That\'s actually good for us"?', options: ['The client is paying more.', 'They want to finish early.', 'They need more time to fix problems.', 'He likes the client.'], answer: 2, tag: 'intent', explain: '他接著說找到兩個錯誤，延期剛好有時間修。' },
    ],
  },
  {
    id: 'p3-08', type: 'conversation', level: 2, title: '餐廳訂位', tags: ['detail', 'inference'],
    lines: [
      { sp: 'M', text: "Good evening, Bistro Garden. How can I help you?" },
      { sp: 'W', text: "Hi, I'd like to reserve a table for four this Saturday at seven. It's for a birthday." },
      { sp: 'M', text: "Seven is fully booked, I'm afraid. We have a table at six thirty or at eight fifteen." },
      { sp: 'W', text: "Six thirty is fine. Could you also prepare a small cake? My friend loves chocolate." },
    ],
    questions: [
      { q: 'Why is the woman calling?', options: ['To cancel an order', 'To make a reservation', 'To ask about a job', 'To complain about food'], answer: 1, tag: 'detail', explain: "I'd like to reserve a table。" },
      { q: 'What time will the woman arrive?', options: ['At seven', 'At six thirty', 'At eight fifteen', 'At six'], answer: 1, tag: 'detail', explain: 'Six thirty is fine。' },
      { q: 'What can be inferred about the event?', options: ['It is a birthday celebration.', 'It is a business dinner.', 'It is a wedding.', 'It is a farewell party.'], answer: 0, tag: 'inference', explain: "It's for a birthday，還訂了蛋糕。" },
    ],
  },
  // ---- Part 4 獨白 ----
  {
    id: 'p4-01', type: 'talk', level: 1, title: '辦公室公告：停電', tags: ['main', 'detail', 'next'],
    lines: [
      { sp: 'narrator', text: "Good morning, everyone. This is a quick announcement from building management. There will be a power outage this Saturday from eight a.m. to noon because of maintenance work. Please turn off your computers before you leave on Friday. The elevators will not work during this time, so if you need to come in on Saturday, please use the stairs on the east side. Thank you for your understanding." },
    ],
    questions: [
      { q: 'What is the announcement mainly about?', options: ['A power outage', 'A new elevator', 'A fire drill', 'A holiday party'], answer: 0, tag: 'main', explain: 'There will be a power outage this Saturday。' },
      { q: 'What are listeners asked to do on Friday?', options: ['Work late', 'Use the stairs', 'Call building management', 'Turn off their computers'], answer: 3, tag: 'detail', explain: 'Please turn off your computers before you leave on Friday。' },
      { q: 'When will the power be back?', options: ['At eight a.m.', 'On Sunday evening', 'On Friday', 'At noon'], answer: 3, tag: 'detail', explain: 'from eight a.m. to noon。' },
    ],
  },
  {
    id: 'p4-02', type: 'talk', level: 2, title: '語音留言：面試時間', tags: ['main', 'detail', 'next'],
    lines: [
      { sp: 'narrator', text: "Hi, this is Rachel Lin from the HR team at Northstar Digital. I'm calling about your application for the business analyst internship. We'd like to invite you to a video interview next Tuesday at three p.m. The interview will take about forty minutes, and you'll meet our product manager. Please reply to the email I sent this morning to confirm the time. If Tuesday doesn't work for you, let me know and we'll find another slot. Thanks, and have a good day." },
    ],
    questions: [
      { q: 'What position did the listener apply for?', options: ['Product manager', 'HR assistant', 'Business analyst intern', 'Software engineer'], answer: 2, tag: 'main', explain: 'your application for the business analyst internship。' },
      { q: 'How long will the interview take?', options: ['About fifteen minutes', 'About thirty minutes', 'About forty minutes', 'About an hour'], answer: 2, tag: 'detail', explain: 'The interview will take about forty minutes。' },
      { q: 'What should the listener do next?', options: ['Call Rachel back', 'Reply to an email', 'Visit the office', 'Send a resume'], answer: 1, tag: 'next', explain: 'Please reply to the email I sent this morning。' },
    ],
  },
  {
    id: 'p4-03', type: 'talk', level: 3, title: '產品更新說明', tags: ['main', 'detail', 'inference'],
    lines: [
      { sp: 'narrator', text: "Thanks for joining today's product update. Last month, many of you told us that finding past orders in the app took too many steps. So in version 4.2, we added a search bar to the order history page, and you can now filter orders by date and status. Early test results show that users find their orders much faster. We're still working on the export feature that some of you asked about. We expect to release it in the next update, but the timing depends on the feedback we get this week." },
    ],
    questions: [
      { q: 'What problem did users report?', options: ['Payments failed.', 'Finding past orders took too many steps.', 'The app was too expensive.', 'Orders arrived late.'], answer: 1, tag: 'main', explain: 'finding past orders in the app took too many steps。' },
      { q: 'What was added in version 4.2?', options: ['A search bar', 'An export feature', 'A new payment method', 'A chat function'], answer: 0, tag: 'detail', explain: 'we added a search bar to the order history page。' },
      { q: 'What does the speaker imply about the export feature?', options: ['Its release date is not fixed.', 'It has been canceled.', 'It is already available.', 'Only managers can use it.'], answer: 0, tag: 'inference', explain: 'the timing depends on the feedback，日期還沒確定。' },
    ],
  },
  {
    id: 'p4-04', type: 'talk', level: 2, title: '工作坊開場', tags: ['main', 'detail', 'next'],
    lines: [
      { sp: 'narrator', text: "Welcome to today's workshop on writing clear user stories. My name is David, and I've been a product owner for six years. We'll start with a short presentation, and then you'll work in small groups to rewrite a few real examples. Each group will share their results at the end. Before we begin, please take a name card from the table by the door and write your first name on it. Also, the Wi-Fi password is on the screen behind me." },
    ],
    questions: [
      { q: 'What is the workshop about?', options: ['Hiring interns', 'Designing websites', 'Public speaking', 'Writing user stories'], answer: 3, tag: 'main', explain: 'a workshop on writing clear user stories。' },
      { q: 'What will listeners do after the presentation?', options: ['Take a test', 'Have lunch', 'Watch a video', 'Work in small groups'], answer: 3, tag: 'detail', explain: "you'll work in small groups。" },
      { q: 'What are listeners asked to do first?', options: ['Connect to the Wi-Fi', 'Read a report', 'Write their name on a card', 'Introduce themselves'], answer: 2, tag: 'next', explain: 'please take a name card … and write your first name on it。' },
    ],
  },
];

// ---- 星期一 Free Talk 的題目：生活、DBS 實習、產品開發、職涯輪流 ----
// topic 對應口說教練的主題（src/lib/speak.js 的 TOPICS），追問照口說教練的規則
export const FREE_TALK_PROMPTS = [
  { id: 'ft-01', topic: 'life', q: 'What did you do this weekend, and what was the best part?' },
  { id: 'ft-02', topic: 'work', q: 'Tell me about a normal day during your internship at DBS. What did you do first in the morning?' },
  { id: 'ft-03', topic: 'career', q: 'Why do you enjoy real work more than sitting in class?' },
  { id: 'ft-04', topic: 'work', q: 'Tell me about a feature you worked on in DECORATE ME. Why did your team build it?' },
  { id: 'ft-05', topic: 'life', q: 'What is a small thing that made you happy this week?' },
  { id: 'ft-06', topic: 'career', q: 'What kind of PM or BA do you want to be in five years?' },
  { id: 'ft-07', topic: 'work', q: 'Tell me about a mistake you made at work or school. What did you learn from it?' },
  { id: 'ft-08', topic: 'free', q: 'Think about an app you use every day. What is one thing you would change about it?' },
  { id: 'ft-09', topic: 'life', q: 'How do you usually spend a quiet weekday evening?' },
  { id: 'ft-10', topic: 'career', q: 'What did you learn from studying information management that helps you at work?' },
  { id: 'ft-11', topic: 'work', q: 'How did you find out what your users really needed in your graduation project?' },
  { id: 'ft-12', topic: 'free', q: 'What is something you changed your mind about recently?' },
  { id: 'ft-13', topic: 'career', q: 'What do you think makes a good team leader?' },
  { id: 'ft-14', topic: 'life', q: 'Tell me about a place in Taiwan you love to visit. Why do you like it?' },
  { id: 'ft-15', topic: 'work', q: 'What did you write in your daily reports during your internship, and who read them?' },
  { id: 'ft-16', topic: 'free', q: 'If you could learn any new skill in one month, what would it be and why?' },
];

// ---- 星期四面試題：用你自己的經驗（DBS 實習、DECORATE ME），題目只問、不假設細節 ----
export const INTERVIEW_QUESTIONS = [
  { id: 'iv-01', topic: 'career', area: '自我介紹', q: 'Could you briefly introduce yourself and tell me why you are interested in this role?' },
  { id: 'iv-02', topic: 'career', area: 'DBS 實習', q: 'Tell me about your internship at DBS. What were your main responsibilities?' },
  { id: 'iv-03', topic: 'career', area: 'DECORATE ME', q: 'You led the DECORATE ME project. How did you divide the work in your team?' },
  { id: 'iv-04', topic: 'career', area: '使用者需求', q: 'How do you find out what users really need, instead of what they say they want?' },
  { id: 'iv-05', topic: 'career', area: 'UAT', q: 'What is UAT, and what did you learn from being involved in it?' },
  { id: 'iv-06', topic: 'career', area: '團隊衝突', q: 'Tell me about a time you disagreed with a teammate. How did you handle it?' },
  { id: 'iv-07', topic: 'career', area: '專案管理', q: 'How did you keep your graduation project on schedule when the team was under pressure?' },
  { id: 'iv-08', topic: 'career', area: '需求優先順序', q: 'A user reports an urgent issue, but the development team has limited resources. What would you do?' },
  { id: 'iv-09', topic: 'career', area: '跨部門溝通', q: 'How would you explain a technical problem to someone from the business side?' },
  { id: 'iv-10', topic: 'career', area: '產品改善', q: 'Pick a feature you built or used. How would you measure whether it is successful?' },
  { id: 'iv-11', topic: 'career', area: '工作錯誤', q: 'Tell me about a mistake you made during your internship and what you changed afterward.' },
  { id: 'iv-12', topic: 'career', area: '使用者訪談', q: 'Walk me through how you prepared for and ran a user interview.' },
  { id: 'iv-13', topic: 'career', area: '需求優先順序', q: 'If two stakeholders ask for different features at the same time, how do you decide what to do first?' },
  { id: 'iv-14', topic: 'career', area: '數據問題', q: 'Have you ever found a problem in data or a calculation? What did you do next?' },
  { id: 'iv-15', topic: 'career', area: '動機', q: 'Why do you want to work in product or business analysis rather than engineering?' },
  { id: 'iv-16', topic: 'career', area: '團隊領導', q: 'As a team leader, how did you handle a teammate who was falling behind?' },
];
