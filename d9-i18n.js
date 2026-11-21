/* Amalgam language layer (d9 pages). Additive: translates the English page text at runtime, so the HTML/CSS stay untouched.
   Native language = device language (navigator.languages), fallback English. A saved choice lives in localStorage "amalgam.lang".
   Whenever the page is NOT in the user's native language, a "back to <native>" chip sits under the header, written in the native language itself.
   Add a language: add its code to L, its native name to NAMES, and one entry per row in T (same order as L minus English), UP, DN.
   Translations are machine-drafted and need native-speaker review before launch (especially the disclaimer). */
(function(){
'use strict';
var L=['en','es','fr','de','pt','it','ru','zh','ja','ko','ar','hi'];
var NAMES={en:'English',es:'Español',fr:'Français',de:'Deutsch',pt:'Português',it:'Italiano',ru:'Русский',zh:'中文(简体)',ja:'日本語',ko:'한국어',ar:'العربية',hi:'हिन्दी'};
var RTL={ar:1},CASED={es:1,fr:1,de:1,pt:1,it:1,ru:1};
/* key = English text, lower-case. value order: es fr de pt it ru zh ja ko ar hi. All-caps English source => upper-cased automatically for Latin/Cyrillic. */
var T={
"7-day streak":["racha de 7 días","série de 7 jours","7-Tage-Serie","sequência de 7 dias","serie di 7 giorni","серия 7 дней","连续7天","7日連続","7일 연속","سلسلة 7 أيام","7 दिन की लय"],
"the briefing":["El resumen","Le briefing","Das Briefing","O resumo","Il briefing","Брифинг","今日简报","今日のブリーフィング","브리핑","الموجز","ब्रीफ़िंग"],
"3 oddities · 60 seconds":["3 rarezas · 60 segundos","3 anomalías · 60 secondes","3 Auffälligkeiten · 60 Sekunden","3 curiosidades · 60 segundos","3 anomalie · 60 secondi","3 аномалии · 60 секунд","3个异常 · 60秒","3つの異変 · 60秒","이상 신호 3개 · 60초","3 غرائب · 60 ثانية","3 अजीब बातें · 60 सेकंड"],
"credit spreads widened three days running while small caps rose. what connects them?":["Los diferenciales de crédito se ampliaron tres días seguidos mientras subían las small caps. ¿Qué los conecta?","Les spreads de crédit se sont creusés trois jours de suite pendant que les petites capitalisations montaient. Qu'est-ce qui les relie ?","Die Kreditaufschläge weiteten sich drei Tage in Folge aus, während Nebenwerte stiegen. Was verbindet beides?","Os spreads de crédito aumentaram por três dias seguidos enquanto as small caps subiam. O que os liga?","Gli spread creditizi si sono allargati per tre giorni di fila mentre le small cap salivano. Cosa li collega?","Кредитные спреды расширялись три дня подряд, пока акции малой капитализации росли. Что их связывает?","信用利差连续三天走阔,而小盘股却在上涨。两者之间有什么联系?","信用スプレッドが3日続けて拡大する一方、小型株は上昇しました。両者をつなぐものは何でしょう?","신용 스프레드가 사흘 연속 확대되는 동안 소형주는 올랐습니다. 둘은 어떻게 연결될까요?","اتسعت فروق الائتمان ثلاثة أيام متتالية بينما ارتفعت أسهم الشركات الصغيرة. ما الذي يربط بينهما؟","क्रेडिट स्प्रेड लगातार तीन दिन चौड़े हुए, जबकि स्मॉल कैप शेयर चढ़े। इन दोनों को क्या जोड़ता है?"],
"tanker rates jumped while crude barely moved. who feels that first?":["Las tarifas de los petroleros se dispararon mientras el crudo apenas se movió. ¿Quién lo nota primero?","Les tarifs des pétroliers ont bondi alors que le brut a à peine bougé. Qui le ressent en premier ?","Die Tankerraten sprangen, während Rohöl sich kaum bewegte. Wen trifft das zuerst?","As tarifas de petroleiros dispararam enquanto o petróleo bruto quase não se mexeu. Quem sente isso primeiro?","Le tariffe delle petroliere sono balzate mentre il greggio si è mosso appena. Chi lo avverte per primo?","Ставки на танкеры подскочили, а нефть почти не изменилась. Кто почувствует это первым?","油轮运价大幅跳升,而原油价格几乎没动。谁会最先感受到?","タンカー運賃が急伸した一方、原油はほとんど動きませんでした。最初に影響を受けるのは誰でしょう?","유조선 운임이 급등했지만 원유 가격은 거의 움직이지 않았습니다. 누가 가장 먼저 영향을 받을까요?","قفزت أسعار شحن الناقلات بينما بالكاد تحرك الخام. من سيشعر بذلك أولاً؟","टैंकर किराये उछल गए, जबकि कच्चा तेल लगभग टस से मस नहीं हुआ। इसका असर सबसे पहले किस पर पड़ेगा?"],
"gold and the dollar rose together. when did that last happen?":["El oro y el dólar subieron juntos. ¿Cuándo pasó eso por última vez?","L'or et le dollar ont monté ensemble. Quand cela s'est-il produit pour la dernière fois ?","Gold und Dollar stiegen gemeinsam. Wann war das zuletzt der Fall?","O ouro e o dólar subiram juntos. Quando isso aconteceu pela última vez?","Oro e dollaro sono saliti insieme. Quando è successo l'ultima volta?","Золото и доллар выросли одновременно. Когда такое было в последний раз?","黄金和美元同时上涨。上一次出现这种情况是什么时候?","金とドルがそろって上昇しました。前回そうなったのはいつでしょう?","금과 달러가 함께 올랐습니다. 마지막으로 이런 일이 있었던 건 언제일까요?","ارتفع الذهب والدولار معاً. متى حدث ذلك آخر مرة؟","सोना और डॉलर साथ-साथ चढ़े। ऐसा पिछली बार कब हुआ था?"],
"rose alongside its supplier group while the broad index slipped. who else moved with it?":["Subió junto a su grupo de proveedores mientras el índice general caía. ¿Quién más se movió con ella?","A progressé avec son groupe de fournisseurs alors que l'indice large reculait. Qui d'autre a suivi ?","Stieg zusammen mit ihrer Zuliefergruppe, während der Gesamtindex nachgab. Wer bewegte sich noch mit?","Subiu junto com seu grupo de fornecedores enquanto o índice amplo recuou. Quem mais se moveu com ela?","È salita insieme al suo gruppo di fornitori mentre l'indice generale scendeva. Chi altro si è mosso con lei?","Выросла вместе со своими поставщиками, пока широкий индекс снижался. Кто ещё двигался вместе с ней?","在大盘下滑时,它与供应商群体一同上涨。还有谁与它同步?","指数全体が下落するなか、サプライヤー群とともに上昇しました。ほかに同じ動きをしたのは誰でしょう?","시장 전체 지수가 하락하는 동안 공급업체 그룹과 함께 올랐습니다. 또 누가 함께 움직였을까요?","ارتفع مع مجموعة مورّديه بينما تراجع المؤشر العام. من الذي تحرك معه أيضاً؟","व्यापक सूचकांक फिसलने के बीच यह अपने आपूर्तिकर्ता समूह के साथ चढ़ा। और कौन इसके साथ चला?"],
"sample":["ejemplo","exemple","Beispiel","exemplo","esempio","пример","示例","サンプル","샘플","عينة","नमूना"],
"market heat":["Calor del mercado","Chaleur du marché","Marktwärme","Calor do mercado","Calore del mercato","Тепловая карта рынка","市场热度","市場ヒート","시장 히트","خريطة حرارة السوق","बाज़ार की गर्मी"],
"chips":["Chips","Puces","Chips","Chips","Chip","Чипы","芯片","半導体","반도체","الرقائق","चिप्स"],
"energy":["Energía","Énergie","Energie","Energia","Energia","Энергия","能源","エネルギー","에너지","الطاقة","ऊर्जा"],
"tech":["Tecnología","Tech","Tech","Tecnologia","Tecnologia","Техно","科技","テック","기술","التقنية","टेक"],
"gold":["Oro","Or","Gold","Ouro","Oro","Золото","黄金","金","금","الذهب","सोना"],
"small":["Pequeñas","Petites","Small","Pequenas","Piccole","Малые","小盘","小型","소형주","الصغيرة","छोटी"],
"small caps":["Small caps","Petites caps","Small Caps","Small caps","Small cap","Малая капитализация","小盘股","小型株","소형주","الشركات الصغيرة","स्मॉल कैप"],
"banks":["Bancos","Banques","Banken","Bancos","Banche","Банки","银行","銀行","은행","البنوك","बैंक"],
"utils":["Servicios","Services","Versorger","Serviços","Utility","Коммунал.","公用","公益","유틸리티","المرافق","यूटिलिटी"],
"utilities":["Servicios públicos","Services publics","Versorger","Serviços públicos","Utility","Коммунальные услуги","公用事业","公益事業","유틸리티","المرافق العامة","यूटिलिटीज़"],
"airlines":["Aerolíneas","Aérien","Airlines","Aéreas","Aeree","Авиа","航空","航空","항공","الطيران","एयरलाइन"],
"world":["Mundo","Monde","Welt","Mundo","Mondo","Мир","世界","世界","세계","العالم","दुनिया"],
"market":["Mercado","Marché","Markt","Mercado","Mercato","Рынок","市场","市場","시장","السوق","बाज़ार"],
"company":["Empresa","Société","Firma","Empresa","Azienda","Компания","公司","企業","기업","الشركة","कंपनी"],
"score":["Puntos","Score","Punkte","Pontos","Punti","Счёт","得分","スコア","점수","النتيجة","स्कोर"],
"information and education only. not investment advice.":["Solo información y educación. No es asesoramiento de inversión.","À titre d'information et d'éducation uniquement. Ne constitue pas un conseil en investissement.","Nur zur Information und Bildung. Keine Anlageberatung.","Apenas informação e educação. Não é aconselhamento de investimento.","Solo a scopo informativo ed educativo. Non è consulenza finanziaria.","Только для информации и обучения. Не является инвестиционной рекомендацией.","仅供信息和教育用途,不构成投资建议。","情報提供と教育のみを目的としています。投資助言ではありません。","정보 및 교육 목적일 뿐이며 투자 조언이 아닙니다.","للمعلومات والتعليم فقط. ليست نصيحة استثمارية.","केवल जानकारी और शिक्षा के लिए। यह निवेश सलाह नहीं है।"],
"today":["Hoy","Aujourd'hui","Heute","Hoje","Oggi","Сегодня","今日","今日","오늘","اليوم","आज"],
"week":["Semana","Semaine","Woche","Semana","Settimana","Неделя","本周","今週","주간","الأسبوع","सप्ताह"],
"month":["Mes","Mois","Monat","Mês","Mese","Месяц","本月","今月","월간","الشهر","महीना"],
"your score":["Tu puntuación","Votre score","Deine Punkte","Sua pontuação","Il tuo punteggio","Ваш счёт","你的得分","あなたのスコア","내 점수","نتيجتك","आपका स्कोर"],
"smpl · sample data":["SMPL · datos de ejemplo","SMPL · données d'exemple","SMPL · Beispieldaten","SMPL · dados de exemplo","SMPL · dati di esempio","SMPL · пример данных","SMPL · 示例数据","SMPL · サンプルデータ","SMPL · 샘플 데이터","SMPL · بيانات تجريبية","SMPL · नमूना डेटा"],
"volume":["Volumen","Volume","Volumen","Volume","Volume","Объём","成交量","出来高","거래량","حجم التداول","वॉल्यूम"],
"range":["Rango","Fourchette","Spanne","Faixa","Intervallo","Диапазон","区间","レンジ","범위","النطاق","दायरा"],
"peers":["Pares","Pairs","Peers","Pares","Simili","Аналоги","同业","同業他社","동종업체","النظراء","समकक्ष"],
"oddities explored · this week":["rarezas exploradas · esta semana","anomalías exploradas · esta semana","Auffälligkeiten erkundet · diese Woche","curiosidades exploradas · esta semana","anomalie esplorate · questa settimana","изучено аномалий · за неделю","已探索的异常 · 本周","調べた異変 · 今週","탐색한 이상 신호 · 이번 주","غرائب تم استكشافها · هذا الأسبوع","खोजी गई अजीब बातें · इस सप्ताह"],
"streak":["Racha","Série","Serie","Sequência","Serie","Серия","连续","連続","연속","السلسلة","लय"],
"best":["Mejor","Record","Beste","Melhor","Migliore","Лучшая","最佳","最高","최고","الأفضل","सर्वश्रेष्ठ"],
"total":["Total","Total","Gesamt","Total","Totale","Всего","总计","合計","합계","الإجمالي","कुल"],
"7 days":["7 días","7 jours","7 Tage","7 dias","7 giorni","7 дней","7天","7日","7일","7 أيام","7 दिन"],
"9 days":["9 días","9 jours","9 Tage","9 dias","9 giorni","9 дней","9天","9日","9일","9 أيام","9 दिन"],
"language":["Idioma","Langue","Sprache","Idioma","Lingua","Язык","语言","言語","언어","اللغة","भाषा"],
"your language":["Tu idioma","Votre langue","Deine Sprache","Seu idioma","La tua lingua","Ваш язык","你的语言","お使いの言語","내 언어","لغتك","आपकी भाषा"],
"close":["Cerrar","Fermer","Schließen","Fechar","Chiudi","Закрыть","关闭","閉じる","닫기","إغلاق","बंद करें"],
"today's oddities":["Rarezas de hoy","Anomalies du jour","Auffälligkeiten von heute","Curiosidades de hoje","Anomalie di oggi","Аномалии дня","今日异常","今日の異変","오늘의 이상 신호","غرائب اليوم","आज की अजीब बातें"],
"amalgam star":["Estrella de Amalgam","Étoile Amalgam","Amalgam-Stern","Estrela Amalgam","Stella Amalgam","Звезда Amalgam","Amalgam 星标","Amalgamの星","Amalgam 별","نجمة Amalgam","Amalgam तारा"],
"main":["Principal","Principale","Hauptmenü","Principal","Principale","Главное меню","主导航","メイン","메인","الرئيسية","मुख्य"],
"time range":["Intervalo de tiempo","Période","Zeitraum","Período","Intervallo di tempo","Период","时间范围","期間","기간","النطاق الزمني","समय सीमा"],
"sector moves":["Movimientos por sector","Mouvements par secteur","Sektorbewegungen","Movimentos por setor","Movimenti per settore","Движение секторов","板块涨跌","セクター別の動き","섹터별 움직임","تحركات القطاعات","सेक्टर की चाल"],
"price history":["Historial de precios","Historique des prix","Kursverlauf","Histórico de preços","Storico dei prezzi","История цены","价格走势","価格推移","가격 추이","سجل الأسعار","मूल्य इतिहास"],
"key figures":["Cifras clave","Chiffres clés","Kennzahlen","Números-chave","Dati chiave","Ключевые показатели","关键数据","主要指標","주요 수치","أرقام رئيسية","मुख्य आंकड़े"],
"price line, rising over twelve points":["Línea de precio, en ascenso a lo largo de doce puntos","Courbe de prix, en hausse sur douze points","Kurslinie, über zwölf Punkte steigend","Linha de preço, subindo ao longo de doze pontos","Linea del prezzo, in crescita su dodici punti","Линия цены, рост за двенадцать точек","价格线,十二个点持续上升","価格ライン、12点を通じて上昇","가격 선, 12개 지점에 걸쳐 상승","خط السعر، صاعد عبر اثنتي عشرة نقطة","मूल्य रेखा, बारह बिंदुओं में ऊपर की ओर"],
"oddities explored this week":["Rarezas exploradas esta semana","Anomalies explorées cette semaine","Diese Woche erkundete Auffälligkeiten","Curiosidades exploradas esta semana","Anomalie esplorate questa settimana","Изучено аномалий за неделю","本周已探索的异常","今週調べた異変","이번 주 탐색한 이상 신호","الغرائب المستكشفة هذا الأسبوع","इस सप्ताह खोजी गई अजीब बातें"],
"streak days":["Días de racha","Jours de série","Serientage","Dias de sequência","Giorni di serie","Дни серии","连续天数","連続日数","연속 일수","أيام السلسلة","लय के दिन"],
"streak figures":["Cifras de racha","Chiffres de la série","Serienwerte","Números da sequência","Dati della serie","Показатели серии","连续数据","連続記録","연속 기록","أرقام السلسلة","लय के आंकड़े"],
"oddities per day":["Rarezas por día","Anomalies par jour","Auffälligkeiten pro Tag","Curiosidades por dia","Anomalie al giorno","Аномалий в день","每日异常数","1日あたりの異変","일별 이상 신호","الغرائب يومياً","प्रति दिन अजीब बातें"]
};
var UP=["{n}, sube {x} %","{n}, en hausse de {x} %","{n}, plus {x} %","{n}, sobe {x}%","{n}, in rialzo del {x}%","{n}, рост {x}%","{n},上涨{x}%","{n}、{x}%上昇","{n}, {x}% 상승","{n}، ارتفع {x}%","{n}, {x}% की बढ़त"];
var DN=["{n}, baja {x} %","{n}, en baisse de {x} %","{n}, minus {x} %","{n}, cai {x}%","{n}, in ribasso del {x}%","{n}, снижение {x}%","{n},下跌{x}%","{n}、{x}%下落","{n}, {x}% 하락","{n}، انخفض {x}%","{n}, {x}% की गिरावट"];

function pick(code){var l=String(code||'').toLowerCase().split('-')[0];return L.indexOf(l)>-1?l:null}
function detect(){var a=(navigator.languages&&navigator.languages.length)?navigator.languages:[navigator.language||'en'];for(var i=0;i<a.length;i++){var p=pick(a[i]);if(p)return p}return 'en'}
var NATIVE=detect(),cur=NATIVE;
function saved(){try{return pick(localStorage.getItem('amalgam.lang'))}catch(e){return null}}
function save(l){try{if(l===NATIVE)localStorage.removeItem('amalgam.lang');else localStorage.setItem('amalgam.lang',l)}catch(e){}}
var qm=/[?&]lang=([A-Za-z-]+)/.exec(location.search);
cur=(qm&&pick(qm[1]))||saved()||NATIVE;

function look(key,lang){var e=T[key.toLowerCase()];if(!e||lang==='en')return null;return e[L.indexOf(lang)-1]||null}
function tr(s,lang){
  if(lang==='en')return s;
  var m=/^(\s*(?:·\s*)?)([\s\S]*?)(\s*)$/.exec(s),core=m[2];if(!core)return s;
  var v=look(core,lang);if(v==null)return s;
  if(CASED[lang]&&core===core.toUpperCase()&&/[A-Za-z]/.test(core))v=v.toUpperCase();
  return m[1]+v+m[3];
}
function trAria(s,lang){
  if(lang==='en')return s;
  var m=/^(.+?) (up|down) ([\d.]+) percent, sample data$/.exec(s),smp=look('sample',lang);
  if(m){var nm=look(m[1],lang)||m[1],i=L.indexOf(lang)-1;return (m[2]==='up'?UP:DN)[i].replace('{n}',nm).replace('{x}',m[3])+' ('+smp+')'}
  var re=/(, sample data|, sample| \(sample data\)| \(sample\))/,f=re.test(s),core=s.replace(re,''),v=look(core,lang);
  if(v==null)return s;
  return v+(f?' ('+smp+')':'');
}

var origT=new WeakMap(),origA=new WeakMap(),ui=null,titleEn=document.title;
function inUI(n){var e=n.nodeType===1?n:n.parentNode;return !!(e&&e.closest&&e.closest('#d9-i18n-ui,#d9-back,.d9-lang'))}
function walk(){
  var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),n,list=[];
  while((n=w.nextNode())){var p=n.parentNode;if(!p||/^(SCRIPT|STYLE)$/.test(p.nodeName)||inUI(n))continue;list.push(n)}
  list.forEach(function(n){if(!origT.has(n))origT.set(n,n.nodeValue);var o=origT.get(n);if(o.trim())n.nodeValue=tr(o,cur)});
  [].forEach.call(document.querySelectorAll('[aria-label],[alt]'),function(el){
    if(inUI(el))return;var rec=origA.get(el);if(!rec){rec={};origA.set(el,rec)}
    ['aria-label','alt'].forEach(function(a){if(!el.hasAttribute(a))return;if(rec[a]==null)rec[a]=el.getAttribute(a);el.setAttribute(a,trAria(rec[a],cur))});
  });
  var parts=titleEn.split(' · ');document.title=parts.length>1?parts[0]+' · '+tr(parts[1],cur):titleEn;
}

var css='.d9-hr{display:flex;align-items:center;gap:4px}'+
'.d9-lang{width:44px;height:44px;margin:-6px -10px -6px 0;background:none;border:0;color:#7e889a;display:flex;align-items:center;justify-content:center;border-radius:12px;cursor:pointer;padding:0}'+
'[dir=rtl] .d9-lang{margin:-6px 0 -6px -10px}'+
'.d9-lang svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:1.6}.d9-lang:active{color:#fff}'+
'.d9-back{display:flex;margin:10px 0 0}'+
'.d9-backbtn{font:600 12px var(--d9-mono,monospace);letter-spacing:.06em;color:#5cc8ff;border:1px solid #2c3340;border-radius:999px;padding:11px 16px;background:none;cursor:pointer;min-height:44px}.d9-backbtn:active{background:#0c0f14;border-color:#3a4458}'+
'#d9-sheet{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.62);display:none;align-items:flex-end;justify-content:center}#d9-sheet.on{display:flex}'+
'.d9-sp{width:100%;max-width:430px;max-height:82vh;overflow-y:auto;background:#12151b;border:1px solid #232833;border-bottom:0;border-radius:18px 18px 0 0;padding:6px 16px calc(16px + env(safe-area-inset-bottom));box-shadow:inset 0 1px 0 rgba(255,255,255,.045)}'+
'.d9-sh{display:flex;justify-content:space-between;align-items:center;padding:10px 4px 6px;font:600 12px var(--d9-mono,monospace);letter-spacing:.16em;color:#7e889a;text-transform:uppercase}'+
'.d9-x{width:44px;height:44px;background:none;border:0;color:#7e889a;font-size:22px;cursor:pointer;margin:-6px -10px -6px 0}'+
'.d9-li{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:50px;padding:0 6px;background:none;border:0;border-top:1px solid #1c212a;color:#e8ecf2;font:500 17px Inter,system-ui,sans-serif;text-align:start;cursor:pointer}'+
'.d9-li:active{background:#0c0f14}.d9-li small{font:600 10px var(--d9-mono,monospace);letter-spacing:.1em;color:#5cc8ff;margin:0 10px;text-transform:uppercase}.d9-li .ck{color:#5cc8ff;font-weight:700;min-width:1.2em;text-align:end}'+
'.d9-word,.d9-tile .v,.d9-row .v,.d9-price{direction:ltr;unicode-bidi:isolate}html:lang(ar) *,html:lang(hi) *{letter-spacing:0!important}html:lang(zh) *,html:lang(ja) *,html:lang(ko) *{letter-spacing:.02em!important}';

function build(){
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  var top=document.querySelector('.d9-top'),streak=top&&top.querySelector('.d9-streak');
  ui=document.createElement('div');ui.id='d9-i18n-ui';
  var globe=document.createElement('button');globe.type='button';globe.className='d9-lang d9-p';
  globe.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>';
  if(top){var right=document.createElement('div');right.className='d9-hr';if(streak){top.insertBefore(right,streak);right.appendChild(streak)}else top.appendChild(right);right.appendChild(globe)}
  var back=document.createElement('div');back.className='d9-back';back.id='d9-back';
  if(top&&top.parentNode)top.parentNode.insertBefore(back,top.nextSibling);
  var sheet=document.createElement('div');sheet.id='d9-sheet';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');
  ui.appendChild(sheet);document.body.appendChild(ui);
  function close(){sheet.classList.remove('on');globe.focus()}
  function open(){
    var order=[NATIVE].concat(L.filter(function(l){return l!==NATIVE})),h='';
    h+='<div class="d9-sp"><div class="d9-sh"><span>'+(look('language',NATIVE)||'Language')+'</span><button type="button" class="d9-x d9-p" aria-label="'+(look('close',NATIVE)||'Close')+'">×</button></div>';
    order.forEach(function(l){h+='<button type="button" class="d9-li d9-p" data-l="'+l+'" lang="'+l+'" dir="'+(RTL[l]?'rtl':'ltr')+'"><span>'+NAMES[l]+(l===NATIVE?'<small>'+(look('your language',NATIVE)||'Your language')+'</small>':'')+'</span><span class="ck">'+(l===cur?'✓':'')+'</span></button>'});
    sheet.innerHTML=h+'</div>';sheet.classList.add('on');var b=sheet.querySelector('.d9-li');if(b)b.focus();
  }
  globe.addEventListener('click',open);
  sheet.addEventListener('click',function(e){
    var li=e.target.closest&&e.target.closest('.d9-li');
    if(li){set(li.getAttribute('data-l'));close();return}
    if(e.target===sheet||(e.target.closest&&e.target.closest('.d9-x')))close();
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&sheet.classList.contains('on'))close()});
  back.addEventListener('click',function(e){if(e.target.closest('button'))set(NATIVE)});
  globe.setAttribute('aria-label',(look('language',NATIVE)||'Language'));
}
function chip(){
  var b=document.getElementById('d9-back');if(!b)return;
  b.innerHTML=cur===NATIVE?'':'<button type="button" class="d9-backbtn d9-p" lang="'+NATIVE+'" dir="'+(RTL[NATIVE]?'rtl':'ltr')+'" aria-label="'+NAMES[NATIVE]+'">↩ '+NAMES[NATIVE]+'</button>';
}
function apply(){
  var d=document.documentElement;d.setAttribute('lang',cur);d.setAttribute('dir',RTL[cur]?'rtl':'ltr');
  var o=mo;if(o)o.disconnect();walk();chip();if(o)attach();
}
function set(l){if(!pick(l))return;cur=l;save(l);apply()}
var mo=null;
function attach(){if(mo)mo.observe(document.body,{childList:true,subtree:true})}
function init(){
  build();
  mo=new MutationObserver(function(muts){
    for(var i=0;i<muts.length;i++){if(!inUI(muts[i].target)){apply();return}}
  });
  apply();attach();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.AmalgamLang={set:set,get:function(){return cur},native:NATIVE,languages:L.slice()};
})();
