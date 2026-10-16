// 內建卡組：自己編寫的內容（不是從 NGSL／BSL 複製），可以自由使用。
// 每行：英文|詞性|中文|搭配詞（; 分隔）|字根提示|例句
// 順序就是學習順序：越前面越常用、越先學。

import { IELTS, TOEIC, TOEFL } from './examDecks.js';

const LIFE = `
afford|v.|負擔得起|can't afford to; afford the time|－|I can't afford to eat out every day this month.
suggest|v.|建議|suggest that; suggest a place|sug-（下面）+ gest（帶）：從下面帶出想法|Can you suggest a good place for brunch?
recommend|v.|推薦|highly recommend; recommend someone to|re-（再）+ commend（稱讚）|I highly recommend this café near the MRT station.
mention|v.|提到|mention briefly; as I mentioned|－|As I mentioned yesterday, I'll be late tonight.
realize|v.|意識到、發現|suddenly realize; realize a dream|real（真的）+ -ize（使…）|I suddenly realized I had left my wallet at home.
expect|v.|預期、期待|expect to; as expected|ex-（向外）+ spect（看）|The weather was better than I expected.
prefer|v.|比較喜歡|prefer A to B; would prefer to|pre-（前面）+ fer（帶）|I prefer tea to coffee in the afternoon.
avoid|v.|避免|avoid doing; avoid the rush hour|－|I leave early to avoid the rush hour.
manage|v.|設法做到、管理|manage to; manage time|man（手）：用手處理|I managed to finish everything before dinner.
handle|v.|處理|handle a situation; handle stress|－|She handled the situation really well.
deal with|phr.|處理、應付|deal with a problem; deal with stress|－|How do you deal with stress after work?
figure out|phr.|想出、搞懂|figure out how to; figure out a way|－|I need to figure out how to get there by bus.
look forward to|phr.|期待|look forward to seeing you; really look forward to|to 後面接名詞或 V-ing|I'm looking forward to seeing you this weekend.
get used to|phr.|習慣於|get used to doing; take time to get used to|to 後面接名詞或 V-ing|It took me a week to get used to the time difference.
run out of|phr.|用完|run out of time; run out of money|－|We ran out of milk, so I bought some on the way home.
catch up|phr.|敘舊、趕上進度|catch up with someone; catch up on sleep|－|Let's grab coffee and catch up soon.
hang out|phr.|出去玩、閒晃|hang out with friends; hang out at|－|We usually hang out at the night market on Fridays.
convenient|adj.|方便的|convenient for; a convenient time|con-（一起）+ ven（來）|Is 7 p.m. a convenient time for you?
available|adj.|有空的、可取得的|available on; available for a call|avail（有用）+ -able（可以）|Are you available on Saturday afternoon?
familiar|adj.|熟悉的|familiar with; look familiar|famil（家人）：像家人一樣熟|Are you familiar with this neighborhood?
comfortable|adj.|舒適的、自在的|feel comfortable; comfortable with|com-（加強）+ fort（強）+ -able|I feel more comfortable speaking English now.
nervous|adj.|緊張的|feel nervous; nervous about|nerv（神經）+ -ous（充滿）|I was nervous about my first presentation.
curious|adj.|好奇的|curious about; just curious|cur（關心）+ -ious|I'm curious about how you started your career.
exhausted|adj.|筋疲力盡的|completely exhausted; feel exhausted|ex-（出去）+ haust（汲取）：被抽乾|I was completely exhausted after the long commute.
crowded|adj.|擁擠的|crowded with; a crowded train|crowd（人群）+ -ed|The train was so crowded this morning.
affordable|adj.|價格合理的|affordable price; affordable housing|afford（負擔）+ -able（可以）|This place has good food at an affordable price.
honestly|adv.|老實說|to be honest; honestly speaking|honest（誠實）+ -ly|Honestly, I didn't expect it to be this good.
actually|adv.|其實|actually, I think; I actually like|actual（實際）+ -ly|Actually, I've never been to Kaohsiung.
basically|adv.|基本上|basically means; basically the same|basic（基本）+ -ally|Basically, we need to leave before six.
probably|adv.|很可能|will probably; most probably|prob（證明）+ -ably|I'll probably stay home and rest tonight.
eventually|adv.|最後、終於|eventually decide; eventually get|event（結果）+ -ually|We eventually found a quiet café.
experience|n./v.|經驗；經歷|gain experience; a great experience|ex-（出）+ peri（嘗試）|Studying in Canada was a great experience for me.
opportunity|n.|機會|take the opportunity; a great opportunity|op-（向）+ port（港口）：船進港的好時機|I took the opportunity to practice my English.
habit|n.|習慣|a good habit; break a habit|－|Reading before bed is a good habit.
routine|n.|日常作息|daily routine; morning routine|route（路線）：每天走的路|My morning routine starts with a glass of water.
schedule|n./v.|行程；排定|a busy schedule; schedule a meeting|－|I have a busy schedule this week.
plan|n./v.|計畫|make plans; plan to|－|Do you have any plans for the long weekend?
decision|n.|決定|make a decision; a tough decision|de-（離開）+ cis（切）：切斷其他選擇|It was a tough decision, but I'm happy with it.
mistake|n.|錯誤|make a mistake; by mistake|mis-（錯）+ take（拿）|I took the wrong bus by mistake.
advice|n.|建議（不可數）|give advice; a piece of advice|ad-（向）+ vice（看）|Can I give you a piece of advice?
attention|n.|注意|pay attention to; get attention|at-（向）+ tent（伸展）|Please pay attention to the announcement.
effort|n.|努力|make an effort; put effort into|ef-（出）+ fort（力量）|I'm making an effort to speak more in meetings.
goal|n.|目標|set a goal; achieve a goal|－|My goal this year is to reach TOEIC 850.
reason|n.|理由|the main reason; for some reason|－|For some reason, the app won't open.
difference|n.|差別|make a difference; the difference between|dif-（分開）+ fer（帶）|Small habits can make a big difference.
chance|n.|機會、可能性|have a chance to; a good chance|－|I didn't have a chance to reply to your message.
weather|n.|天氣|the weather forecast; bad weather|－|The weather forecast says it'll rain tomorrow.
traffic|n.|交通|heavy traffic; stuck in traffic|－|Sorry I'm late, I got stuck in traffic.
appointment|n.|約診、預約|make an appointment; a doctor's appointment|ap-（向）+ point（指定）|I have a doctor's appointment at 3 p.m.
reservation|n.|訂位|make a reservation; under the name of|re-（回）+ serve（保留）|I made a reservation for two under the name Chen.
recipe|n.|食譜|follow a recipe; a simple recipe|－|This is a simple recipe that takes 15 minutes.
ingredient|n.|材料|fresh ingredients; main ingredient|in-（進）+ gred（走）|The main ingredient is chicken.
receipt|n.|收據|keep the receipt; ask for a receipt|re-（回）+ ceipt（拿）|Could I have a receipt, please?
refund|n./v.|退款|get a refund; ask for a refund|re-（回）+ fund（錢）|I asked for a refund because the shoes didn't fit.
delay|n./v.|延誤|a short delay; be delayed|－|The flight was delayed by two hours.
improve|v.|改善、進步|improve skills; improve a lot|im-（使）+ prove（有益）|My listening has improved a lot this year.
practice|v./n.|練習|practice speaking; in practice|－|I practice speaking by talking to myself in English.
explain|v.|解釋|explain why; explain to someone|ex-（出）+ plain（平、清楚）|Could you explain that again more slowly?
describe|v.|描述|describe a person; hard to describe|de-（下）+ scribe（寫）|Can you describe what happened?
agree|v.|同意|agree with; totally agree|－|I totally agree with you.
complain|v.|抱怨|complain about; complain to|－|He always complains about the weather.
apologize|v.|道歉|apologize for; apologize to|apo-（離開）+ log（話）|I apologize for the late reply.
appreciate|v.|感激、欣賞|really appreciate; appreciate it|ap-（向）+ preci（價值）|I really appreciate your help.
remind|v.|提醒|remind someone to; remind me of|re-（再）+ mind（想）|Can you remind me to call my mom tonight?
borrow|v.|借（入）|borrow from; borrow money|－|Can I borrow your charger for a minute?
lend|v.|借（出）|lend someone something; lend a hand|－|Could you lend me your umbrella?
share|v.|分享|share with; share an idea|－|Thanks for sharing your experience with me.
mean|v.|意思是|what do you mean; I mean|－|What do you mean by "soon"?
by the way|phr.|順帶一提|by the way, did you…|－|By the way, did you finish the report?
it depends|phr.|看情況|it depends on; that depends|－|It depends on how busy I am this week.
make sense|phr.|合理、說得通|it makes sense; make sense of|－|That makes sense, thanks for explaining.
on the other hand|phr.|另一方面|on the one hand…on the other hand|－|The job pays well; on the other hand, the hours are long.
as long as|phr.|只要|as long as you…|－|You can join us as long as you're free by seven.
`;

const WORK = `
deadline|n.|截止期限|meet a deadline; miss a deadline; tight deadline|dead（死）+ line（線）：不能越過的線|We need to meet the deadline by Friday.
priority|n.|優先事項|top priority; set priorities|prior（在前）+ -ity|This bug is our top priority this week.
stakeholder|n.|利害關係人|key stakeholders; align with stakeholders|stake（利害）+ holder（持有者）|We need to update key stakeholders before the launch.
requirement|n.|需求|business requirements; gather requirements|re-（再）+ quire（尋求）|As a BA, I gather business requirements from users.
deliverable|n.|交付項目|key deliverables; project deliverables|deliver（交付）+ -able|What are the key deliverables for this phase?
scope|n.|範圍|in scope; out of scope; scope creep|－|That feature is out of scope for this release.
milestone|n.|里程碑|reach a milestone; project milestone|mile（哩）+ stone（石）：路邊的里程石|We reached an important milestone last week.
timeline|n.|時程|project timeline; tight timeline|time + line|The timeline is tight, so let's focus on the essentials.
update|n./v.|進度更新|give an update; quick update|－|Let me give you a quick update on the project.
follow up|phr.|後續追蹤|follow up on; follow up with someone|－|I'll follow up with the vendor this afternoon.
align|v.|對齊、取得共識|align on; align with|a-（向）+ line（線）|Let's align on the next steps before we leave.
clarify|v.|釐清|clarify a point; could you clarify|clar（清楚）+ -ify（使）|Could you clarify what you mean by "real-time"?
confirm|v.|確認|confirm the details; confirm with|con-（加強）+ firm（堅定）|Can you confirm the meeting time with the client?
assign|v.|指派|assign a task to; be assigned to|as-（向）+ sign（標記）|I was assigned to the UAT workstream.
review|v./n.|審閱、檢討|review a document; code review|re-（再）+ view（看）|Please review the document and leave comments.
approve|v.|核准|approve a request; get approved|ap-（向）+ prove（證明）|The budget was approved by the manager.
escalate|v.|上報、升級處理|escalate an issue; escalate to|scale（梯子）：往上爬|If the vendor doesn't reply, we'll escalate the issue.
prioritize|v.|排定優先順序|prioritize tasks; prioritize the backlog|prior（在前）+ -itize|We need to prioritize the most urgent tasks.
implement|v.|實施、導入|implement a system; implement changes|im-（進）+ ple（填滿）|The bank plans to implement the new system next year.
launch|v./n.|上線、推出|launch a product; go-live launch|－|We will launch the new app in March.
feedback|n.|回饋|give feedback; get feedback on|feed（餵）+ back（回）|Thanks for the feedback on my slides.
agenda|n.|議程|on the agenda; set the agenda|ag（做）：要做的事|What's on the agenda for today's meeting?
minutes|n.|會議紀錄|take minutes; meeting minutes|－|Could you take minutes for this meeting?
action item|n.|待辦事項|assign action items; follow up on action items|－|Let's go through the action items before we finish.
workstream|n.|工作流、子專案|lead a workstream; workstream owner|work + stream（流）|I'm supporting the data migration workstream.
user acceptance testing|n.|使用者驗收測試（UAT）|run UAT; UAT sign-off|－|Users will start user acceptance testing next Monday.
test case|n.|測試案例|write test cases; pass a test case|－|I wrote twenty test cases for the new feature.
defect|n.|缺陷、錯誤|log a defect; fix a defect|de-（離開）+ fect（做）：沒做好|Please log the defect in Jira with screenshots.
sign-off|n.|簽核、正式同意|get sign-off; final sign-off|－|We need business sign-off before go-live.
go-live|n.|正式上線|go-live date; after go-live|－|The go-live date has been moved to next month.
rollout|n.|推行、上線|phased rollout; rollout plan|roll（滾）+ out|We'll do a phased rollout across branches.
workaround|n.|暫時的替代做法|find a workaround; temporary workaround|work + around（繞過）|There's a temporary workaround until the fix is ready.
bottleneck|n.|瓶頸|identify a bottleneck; a major bottleneck|bottle（瓶子）+ neck（頸）|Manual approval is the main bottleneck in this process.
process|n.|流程|streamline a process; approval process|pro-（向前）+ cess（走）|We want to streamline the approval process.
efficiency|n.|效率|improve efficiency; operational efficiency|ef-（出）+ fic（做）|Automation can improve operational efficiency.
digital transformation|n.|數位轉型|drive digital transformation; digital transformation strategy|trans-（轉）+ form（形狀）|The bank is investing heavily in digital transformation.
user story|n.|使用者故事|write a user story; acceptance criteria|－|Each user story should have clear acceptance criteria.
acceptance criteria|n.|驗收條件|define acceptance criteria; meet acceptance criteria|criteria 是 criterion 的複數|The feature doesn't meet the acceptance criteria yet.
backlog|n.|待辦清單|product backlog; groom the backlog|－|Let's add this request to the backlog.
roadmap|n.|產品藍圖|product roadmap; on the roadmap|road + map|Mobile notifications are on the roadmap for Q3.
dashboard|n.|儀表板|build a dashboard; sales dashboard|－|I built a dashboard to track weekly sales.
insight|n.|洞察|gain insight into; key insights|in（向內）+ sight（看）|The survey gave us useful insights into customer needs.
metric|n.|指標|key metrics; track metrics|metr（測量）|Which metrics should we track for this campaign?
KPI|n.|關鍵績效指標|set KPIs; meet KPIs|Key Performance Indicator|Our main KPI is monthly active users.
proposal|n.|提案|submit a proposal; business proposal|pro-（向前）+ pos（放）|I'm working on a proposal for the competition.
presentation|n.|簡報|give a presentation; presentation slides|pre-（前）+ sent（存在）|I'll give a short presentation on our findings.
workload|n.|工作量|heavy workload; manage workload|work + load（負荷）|My workload is heavy during month-end.
colleague|n.|同事|a former colleague; work with colleagues|col-（一起）+ league（聯盟）|My colleague helped me set up the system.
supervisor|n.|主管|my direct supervisor; report to|super（上）+ vis（看）|My supervisor reviews my work every Friday.
internship|n.|實習|do an internship; internship program|intern（實習生）+ -ship|I'm doing an internship in wealth management.
responsible for|phr.|負責|be responsible for; take responsibility|re-（回）+ spons（承諾）|I'm responsible for preparing the weekly report.
in charge of|phr.|主管、負責|be in charge of a project|－|Who is in charge of the UAT schedule?
on track|phr.|進度正常|be on track; keep on track|－|The project is on track to finish next month.
behind schedule|phr.|進度落後|fall behind schedule; slightly behind|－|We're slightly behind schedule because of the defects.
touch base|phr.|簡單聯絡一下|touch base with; touch base next week|－|Let's touch base next week after the demo.
loop in|phr.|把人加進討論|loop someone in; keep someone in the loop|－|I'll loop in the IT team on this email.
heads-up|n.|事先提醒|give someone a heads-up|－|Thanks for the heads-up about the system downtime.
bandwidth|n.|（人力上的）餘裕|have the bandwidth; no bandwidth|band（帶）+ width（寬）|I don't have the bandwidth to take on another task this week.
take ownership|phr.|主動負責|take ownership of a task|own（擁有）+ -ership|She takes ownership of every task she's given.
cross-functional|adj.|跨部門的|cross-functional team; cross-functional collaboration|cross（跨）+ function（職能）|I work in a cross-functional team with IT and operations.
collaborate|v.|合作|collaborate with; collaborate on|col-（一起）+ labor（工作）|We collaborate closely with the product team.
negotiate|v.|談判、協商|negotiate a deal; negotiate with|neg（否）+ oti（閒）：不閒著，忙著談|We need to negotiate the timeline with the vendor.
compliance|n.|法遵、合規|regulatory compliance; compliance team|comply（遵守）+ -ance|All products must pass a compliance review.
I'd like to add|phr.|我想補充|I'd like to add that…|－|I'd like to add one more point about the budget.
could you walk me through|phr.|可以帶我看一遍嗎|walk someone through a process|－|Could you walk me through the approval process?
`;

const FINANCE = `
wealth management|n.|財富管理|wealth management services; wealth management team|－|I'm interning in the wealth management team.
asset|n.|資產|financial assets; asset class|－|Stocks and bonds are different asset classes.
asset allocation|n.|資產配置|review asset allocation; strategic asset allocation|al-（向）+ locate（放）|Asset allocation depends on the client's risk profile.
portfolio|n.|投資組合|diversified portfolio; rebalance a portfolio|port（帶）+ folio（紙）：裝文件的夾子|She has a diversified portfolio of stocks and bonds.
diversify|v.|分散|diversify investments; diversify risk|di-（分開）+ vers（轉）|It's wise to diversify your investments.
diversification|n.|分散投資|portfolio diversification|diversify 的名詞|Diversification helps reduce risk.
risk appetite|n.|風險偏好|high risk appetite; assess risk appetite|appetite（胃口）|Clients with a low risk appetite prefer bonds.
risk profile|n.|風險屬性|client risk profile; update a risk profile|－|We review each client's risk profile every year.
return|n.|報酬|annual return; expected return; return on investment|－|The fund had an annual return of 6%.
yield|n.|殖利率、收益率|bond yield; dividend yield|－|Bond yields rose after the announcement.
dividend|n.|股利|pay a dividend; dividend yield|divid（分）：分給股東的錢|The company pays a dividend twice a year.
interest rate|n.|利率|raise interest rates; cut interest rates|－|The central bank decided to raise interest rates.
inflation|n.|通貨膨脹|high inflation; inflation rate|in-（進）+ flat（吹氣）：吹大|High inflation reduces your purchasing power.
equity|n.|股票、股權|equity market; equity fund|equ（相等）|Equities are riskier than bonds in the short term.
stock|n.|股票|buy stocks; stock market|－|He invests a small amount in stocks every month.
bond|n.|債券|government bond; corporate bond; bond fund|－|Government bonds are considered low risk.
fund|n.|基金|mutual fund; invest in a fund|－|This fund invests mainly in Asian markets.
mutual fund|n.|共同基金|invest in a mutual fund|mutual（共同）|A mutual fund pools money from many investors.
ETF|n.|指數股票型基金|buy an ETF; low-cost ETF|Exchange-Traded Fund|Many young investors start with a low-cost ETF.
index|n.|指數|stock index; track an index|－|This ETF tracks the S&P 500 index.
volatility|n.|波動|high volatility; market volatility|vol（飛）：飛來飛去|Market volatility increased this week.
liquidity|n.|流動性|high liquidity; liquidity risk|liqu（液體）|Cash has the highest liquidity.
capital|n.|資本、本金|capital gain; protect capital|capit（頭）：最主要的錢|Capital-protected products suit conservative clients.
principal|n.|本金|repay the principal; principal-protected|princip（首要）|You may lose part of your principal.
capital gain|n.|資本利得|realize a capital gain|－|He made a capital gain when he sold the shares.
maturity|n.|到期（日）|maturity date; at maturity|mature（成熟）+ -ity|The bond reaches maturity in five years.
currency|n.|貨幣|foreign currency; currency risk|curr（流動）|Investing abroad involves currency risk.
exchange rate|n.|匯率|exchange rate fluctuation|ex-（互相）+ change|The exchange rate affects overseas returns.
foreign exchange|n.|外匯（FX）|foreign exchange market; FX trading|－|The bank offers foreign exchange services.
deposit|n./v.|存款；存入|time deposit; fixed deposit|de-（下）+ posit（放）|She put her savings into a one-year time deposit.
time deposit|n.|定期存款|open a time deposit|－|Time deposits pay higher interest than savings accounts.
insurance|n.|保險|life insurance; insurance policy|in-（使）+ sure（確定）|Insurance is part of a complete financial plan.
premium|n.|保費、溢價|pay a premium; insurance premium|－|The monthly premium is about NT$3,000.
financial planning|n.|財務規劃|retirement planning; financial planning advice|－|Good financial planning starts with a budget.
retirement|n.|退休|retirement plan; save for retirement|re-（退）+ tire（拉）|It's never too early to save for retirement.
compound interest|n.|複利|benefit from compound interest|com-（一起）+ pound（放）|Compound interest makes long-term saving powerful.
net worth|n.|淨資產|high net worth; calculate net worth|net（淨）+ worth（價值）|High-net-worth clients receive dedicated advisors.
HNWI|n.|高資產客戶|serve HNWIs|High-Net-Worth Individual|The private bank serves HNWIs across Asia.
relationship manager|n.|理財專員、客戶經理|RM; assigned relationship manager|－|Each client has a dedicated relationship manager.
advisory|adj./n.|顧問的；顧問服務|investment advisory; advisory fee|advise（建議）+ -ory|They charge an annual advisory fee.
suitability|n.|適合度（商品是否適合客戶）|suitability assessment; suitability check|suit（適合）+ -ability|A suitability assessment is required before selling the product.
KYC|n.|認識你的客戶（客戶身分審查）|complete KYC; KYC documents|Know Your Customer|New clients must complete KYC before opening an account.
AML|n.|反洗錢|AML checks; AML policy|Anti-Money Laundering|All transfers go through AML checks.
regulation|n.|法規|financial regulation; comply with regulations|reg（規則）|Banks must comply with strict regulations.
disclosure|n.|揭露|risk disclosure; disclosure statement|dis-（打開）+ close（關）|Please read the risk disclosure carefully.
fee|n.|手續費|management fee; transaction fee|－|The fund charges a 1.5% management fee.
transaction|n.|交易|complete a transaction; transaction history|trans-（穿過）+ act（做）|The transaction was completed successfully.
statement|n.|對帳單|monthly statement; bank statement|state（陳述）+ -ment|Please check your monthly statement.
balance|n.|餘額|account balance; check the balance|－|I check my account balance every week.
budget|n./v.|預算|on a budget; stick to a budget|－|I'm trying to stick to a monthly budget.
expense|n.|支出|monthly expenses; cut expenses|ex-（出）+ pense（花費）|Rent is my biggest monthly expense.
revenue|n.|營收|generate revenue; annual revenue|re-（回）+ venue（來）：回來的錢|Wealth management generates a large part of the bank's revenue.
profit|n.|利潤|make a profit; net profit|－|The company made a record profit last year.
loss|n.|損失|make a loss; cut losses|－|Investors made a loss when the market fell.
bull market|n.|多頭市場|in a bull market|bull（牛）：往上頂|Many people invest during a bull market.
bear market|n.|空頭市場|enter a bear market|bear（熊）：往下壓|Stocks entered a bear market last year.
rebalance|v.|再平衡|rebalance a portfolio; rebalance annually|re-（再）+ balance|We rebalance the portfolio every six months.
hedge|v./n.|避險|hedge against; hedge currency risk|hedge（樹籬）：圍起來保護|Gold is often used to hedge against inflation.
outperform|v.|表現優於|outperform the market; outperform the benchmark|out-（超過）+ perform|The fund outperformed its benchmark this year.
benchmark|n.|基準指標|compare against a benchmark|bench（長凳）+ mark：測量時的標記|We compare the fund's return against a benchmark.
long-term|adj.|長期的|long-term investment; in the long term|－|Index funds are a good long-term investment.
`;

function parse(text, deck) {
  return text
    .trim()
    .split('\n')
    .map((line, i) => {
      const [front, pos, back, col, root, example] = line.split('|');
      return {
        deck, order: i, front, pos, back,
        collocation: (col || '').split(';').map((s) => s.trim()).filter(Boolean).join('; '),
        root: root === '－' ? '' : root || '', example: example || '',
        type: /\s/.test(front) || pos === 'phr.' ? 'phrase' : 'word',
      };
    });
}

export const THEMES = {
  life: { label: '生活', words: parse(LIFE, 'life') },
  work: { label: '職場', words: parse(WORK, 'work') },
  finance: { label: '金融', words: parse(FINANCE, 'finance') },
  ielts: { label: '雅思', words: parse(IELTS, 'ielts'), exam: true },
  toeic: { label: '多益', words: parse(TOEIC, 'toeic'), exam: true },
  toefl: { label: '托福', words: parse(TOEFL, 'toefl'), exam: true },
};
// 每週輪替只用這三個；考試卡組要自己選「固定」
export const THEME_ORDER = ['life', 'work', 'finance'];
export const ALL_THEMES = [...THEME_ORDER, 'ielts', 'toeic', 'toefl'];
