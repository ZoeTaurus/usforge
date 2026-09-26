'use strict';
// ============================================================
//  Languages. Every string drawn with drawText() goes through
//  tr(): exact matches first, then templates such as
//  "DAY {#0}" ({#n} = a number, {n} = any text, itself translated).
// ============================================================

const LANGS = [
  { id: 'en', name: 'ENGLISH' }, { id: 'es', name: 'ESPAÑOL' }, { id: 'fr', name: 'FRANÇAIS' },
  { id: 'de', name: 'DEUTSCH' }, { id: 'pt', name: 'PORTUGUÊS' }, { id: 'it', name: 'ITALIANO' },
  { id: 'ru', name: 'РУССКИЙ' }, { id: 'zh', name: '中文', wide: true }, { id: 'ja', name: '日本語', wide: true },
];

// English key -> [es, fr, de, pt, it, ru, zh, ja]
const I18N = {
"~ A COZY FISHING ADVENTURE ~": [
"~ UNA ACOGEDORA AVENTURA DE PESCA ~",
"~ UNE DOUCE AVENTURE DE PÊCHE ~",
"~ EIN GEMÜTLICHES ANGELABENTEUER ~",
"~ UMA AVENTURA DE PESCA ACONCHEGANTE ~",
"~ UN'ACCOGLIENTE AVVENTURA DI PESCA ~",
"~ УЮТНОЕ РЫБАЦКОЕ ПРИКЛЮЧЕНИЕ ~",
"~ 温馨的钓鱼冒险 ~",
"~ ほっこり釣りアドベンチャー ~"
],
"CONTINUE": [
"CONTINUAR",
"CONTINUER",
"WEITER",
"CONTINUAR",
"CONTINUA",
"ПРОДОЛЖИТЬ",
"继续",
"つづきから"
],
"NEW GAME": [
"NUEVA PARTIDA",
"NOUVELLE PARTIE",
"NEUES SPIEL",
"NOVO JOGO",
"NUOVA PARTITA",
"НОВАЯ ИГРА",
"新游戏",
"はじめから"
],
"START": [
"EMPEZAR",
"JOUER",
"START",
"COMEÇAR",
"INIZIA",
"НАЧАТЬ",
"开始",
"スタート"
],
"PLAYERS: {#0}": [
"JUGADORES: {0}",
"JOUEURS: {0}",
"SPIELER: {0}",
"JOGADORES: {0}",
"GIOCATORI: {0}",
"ИГРОКИ: {0}",
"玩家：{0}",
"プレイヤー：{0}"
],
"HOW TO PLAY": [
"CÓMO JUGAR",
"COMMENT JOUER",
"ANLEITUNG",
"COMO JOGAR",
"COME GIOCARE",
"КАК ИГРАТЬ",
"玩法说明",
"あそびかた"
],
"COZY (EASY)": [
"TRANQUILO (FÁCIL)",
"DOUILLET (FACILE)",
"GEMÜTLICH (LEICHT)",
"TRANQUILO (FÁCIL)",
"RILASSANTE (FACILE)",
"УЮТНО (ЛЕГКО)",
"休闲（简单）",
"のんびり（かんたん）"
],
"NORMAL": [
"NORMAL",
"NORMAL",
"NORMAL",
"NORMAL",
"NORMALE",
"НОРМАЛЬНО",
"普通",
"ふつう"
],
"BACK": [
"VOLVER",
"RETOUR",
"ZURÜCK",
"VOLTAR",
"INDIETRO",
"НАЗАД",
"返回",
"もどる"
],
"LANGUAGE": [
"IDIOMA",
"LANGUE",
"SPRACHE",
"IDIOMA",
"LINGUA",
"ЯЗЫК",
"语言",
"言語"
],
"M: MUTE   L: LANGUAGE": [
"M: SILENCIO   L: IDIOMA",
"M: MUET   L: LANGUE",
"M: TON AUS   L: SPRACHE",
"M: MUDO   L: IDIOMA",
"M: MUTO   L: LINGUA",
"M: БЕЗ ЗВУКА   L: ЯЗЫК",
"M：静音   L：语言",
"M：ミュート   L：言語"
],
"TWO PLAYERS! P2 USES ENTER + ARROWS": [
"¡DOS JUGADORES! P2: ENTER + FLECHAS",
"DEUX JOUEURS! P2: ENTRÉE + FLÈCHES",
"ZWEI SPIELER! P2: ENTER + PFEILE",
"DOIS JOGADORES! P2: ENTER + SETAS",
"DUE GIOCATORI! P2: INVIO + FRECCE",
"ДВА ИГРОКА! P2: ENTER + СТРЕЛКИ",
"双人模式！P2用回车+方向键",
"2人プレイ！P2はENTER+矢印"
],
"ONE PLAYER": [
"UN JUGADOR",
"UN JOUEUR",
"EIN SPIELER",
"UM JOGADOR",
"UN GIOCATORE",
"ОДИН ИГРОК",
"单人模式",
"1人プレイ"
],
"PICK A DIFFICULTY": [
"ELIGE LA DIFICULTAD",
"CHOISIS LA DIFFICULTÉ",
"WÄHLE DIE SCHWIERIGKEIT",
"ESCOLHE A DIFICULDADE",
"SCEGLI LA DIFFICOLTÀ",
"ВЫБЕРИ СЛОЖНОСТЬ",
"选择难度",
"むずかしさを選んでね"
],
"PICK A DIFFICULTY. YOUR OLD SAVE WILL BE REPLACED.": [
"ELIGE LA DIFICULTAD. SE BORRARÁ TU PARTIDA.",
"CHOISIS LA DIFFICULTÉ. TA SAUVEGARDE SERA REMPLACÉE.",
"WÄHLE DIE SCHWIERIGKEIT. DEIN SPIELSTAND WIRD ERSETZT.",
"ESCOLHE A DIFICULDADE. O TEU JOGO SERÁ SUBSTITUÍDO.",
"SCEGLI LA DIFFICOLTÀ. IL SALVATAGGIO SARÀ SOSTITUITO.",
"ВЫБЕРИ СЛОЖНОСТЬ. СТАРОЕ СОХРАНЕНИЕ ПРОПАДЁТ.",
"选择难度。旧存档将被覆盖。",
"むずかしさを選んでね。古いセーブは消えます。"
],
"SOUND OFF": [
"SIN SONIDO",
"SON COUPÉ",
"TON AUS",
"SEM SOM",
"AUDIO SPENTO",
"ЗВУК ВЫКЛ",
"声音关",
"サウンドOFF"
],
"SOUND ON": [
"CON SONIDO",
"SON ACTIVÉ",
"TON AN",
"COM SOM",
"AUDIO ACCESO",
"ЗВУК ВКЛ",
"声音开",
"サウンドON"
],
"FISHING": [
"PESCA",
"PÊCHE",
"ANGELN",
"PESCA",
"PESCA",
"РЫБАЛКА",
"钓鱼",
"釣り"
],
"HOLD SPACE / MOUSE TO CHARGE, RELEASE TO CAST.": [
"MANTÉN ESPACIO/RATÓN PARA CARGAR, SUELTA PARA LANZAR.",
"MAINTIENS ESPACE/SOURIS POUR CHARGER, LÂCHE POUR LANCER.",
"LEERTASTE/MAUS HALTEN ZUM AUSHOLEN, LOSLASSEN ZUM WERFEN.",
"SEGURA ESPAÇO/RATO PARA CARREGAR, SOLTA PARA LANÇAR.",
"TIENI SPAZIO/MOUSE PER CARICARE, RILASCIA PER LANCIARE.",
"ДЕРЖИ ПРОБЕЛ/МЫШЬ ДЛЯ ЗАМАХА, ОТПУСТИ ДЛЯ ЗАБРОСА.",
"按住空格/鼠标蓄力，松开抛竿。",
"スペース/マウス長押しでため、はなして投げる。"
],
"WHEN THE BOBBER DUNKS - PRESS FAST TO HOOK!": [
"CUANDO EL CORCHO SE HUNDA, ¡PULSA RÁPIDO!",
"QUAND LE FLOTTEUR PLONGE, APPUIE VITE!",
"WENN DER SCHWIMMER TAUCHT: SCHNELL DRÜCKEN!",
"QUANDO A BOIA AFUNDAR, CARREGA RÁPIDO!",
"QUANDO IL GALLEGGIANTE AFFONDA, PREMI SUBITO!",
"КОГДА ПОПЛАВОК НЫРНЁТ - ЖМИ БЫСТРЕЕ!",
"浮漂下沉时——快按提竿！",
"ウキが沈んだら、すばやく押して合わせよう！"
],
"HOLD TO REEL. KEEP THE TENSION OUT OF THE RED.": [
"MANTÉN PARA RECOGER. QUE LA TENSIÓN NO LLEGUE AL ROJO.",
"MAINTIENS POUR MOULINER. ÉVITE LA ZONE ROUGE.",
"HALTEN ZUM EINHOLEN. SPANNUNG NICHT INS ROTE!",
"SEGURA PARA RECOLHER. EVITA A TENSÃO NO VERMELHO.",
"TIENI PER RIAVVOLGERE. EVITA LA TENSIONE NEL ROSSO.",
"ДЕРЖИ, ЧТОБЫ ТЯНУТЬ. НЕ ДОВОДИ НАТЯЖЕНИЕ ДО КРАСНОГО.",
"按住收线。别让拉力进入红区。",
"長押しで巻く。テンションを赤にしないで。"
],
"FISH GO IN YOUR COOLER - SELL THEM AT THE SHOP.": [
"LOS PECES VAN A LA NEVERA. VÉNDELOS EN LA TIENDA.",
"LES POISSONS VONT EN GLACIÈRE. VENDS-LES À LA BOUTIQUE.",
"FISCHE KOMMEN IN DIE KÜHLBOX. VERKAUF SIE IM LADEN.",
"OS PEIXES VÃO PARA A GELEIRA. VENDE-OS NA LOJA.",
"I PESCI VANNO NEL FRIGO. VENDILI AL NEGOZIO.",
"РЫБА ИДЁТ В ХОЛОДИЛЬНИК. ПРОДАВАЙ ЕЁ В ЛАВКЕ.",
"鱼会放进冷藏箱——去商店卖掉。",
"魚はクーラーへ。お店で売ろう。"
],
"HUGE SHADOWS ARE BIG FISH. THEY PULL YOU IN!": [
"LAS SOMBRAS ENORMES SON PECES GIGANTES. ¡TE ARRASTRAN!",
"LES GRANDES OMBRES SONT DES MONSTRES. ILS T'ENTRAÎNENT!",
"RIESIGE SCHATTEN SIND GROSSE FISCHE. SIE ZIEHEN DICH REIN!",
"SOMBRAS ENORMES SÃO PEIXES GIGANTES. PUXAM-TE!",
"LE OMBRE ENORMI SONO PESCI GIGANTI. TI TRASCINANO GIÙ!",
"ОГРОМНЫЕ ТЕНИ - ЭТО БОЛЬШИЕ РЫБЫ. ОНИ УТАЩАТ ТЕБЯ!",
"巨大的影子是大鱼。它会把你拖下水！",
"大きな影は大物。水中に引きずりこまれるぞ！"
],
"B SHOP  J JOURNAL  A AQUARIUM  T TRAVEL": [
"B TIENDA  J DIARIO  A ACUARIO  T VIAJAR",
"B BOUTIQUE  J JOURNAL  A AQUARIUM  T VOYAGE",
"B LADEN  J TAGEBUCH  A AQUARIUM  T REISEN",
"B LOJA  J DIÁRIO  A AQUÁRIO  T VIAJAR",
"B NEGOZIO  J DIARIO  A ACQUARIO  T VIAGGIO",
"B ЛАВКА  J ЖУРНАЛ  A АКВАРИУМ  T ПУТЬ",
"B 商店  J 图鉴  A 水族箱  T 旅行",
"B ショップ  J ずかん  A 水そう  T 旅"
],
"Q TALK TO OLD SALT  X SHOO GULLS  1-3 BAIT": [
"Q HABLAR CON LOBO DE MAR  X ESPANTAR GAVIOTAS  1-3 CEBO",
"Q PARLER AU VIEUX LOUP  X CHASSER MOUETTES  1-3 APPÂT",
"Q MIT DEM SEEBÄR REDEN  X MÖWEN VERJAGEN  1-3 KÖDER",
"Q FALAR COM O VELHO LOBO  X ESPANTAR GAIVOTAS  1-3 ISCO",
"Q PARLA COL VECCHIO LUPO  X SCACCIA GABBIANI  1-3 ESCA",
"Q ГОВОРИТЬ С МОРЯКОМ  X ПРОГНАТЬ ЧАЕК  1-3 НАЖИВКА",
"Q 找老水手  X 赶走海鸥  1-3 鱼饵",
"Q 老船乗りと話す  X カモメを追い払う  1-3 エサ"
],
"M MUTE   ESC MENU": [
"M SILENCIO   ESC MENÚ",
"M MUET   ÉCHAP MENU",
"M TON AUS   ESC MENÜ",
"M MUDO   ESC MENU",
"M MUTO   ESC MENU",
"M ЗВУК   ESC МЕНЮ",
"M 静音   ESC 菜单",
"M ミュート   ESC メニュー"
],
"UNDERWATER": [
"BAJO EL AGUA",
"SOUS L'EAU",
"UNTER WASSER",
"DEBAIXO DE ÁGUA",
"SOTT'ACQUA",
"ПОД ВОДОЙ",
"水下",
"水中"
],
"WASD/ARROWS SWIM   J/SPACE/CLICK THROW HOOK": [
"WASD/FLECHAS NADAR   J/ESPACIO/CLIC LANZAR ANZUELO",
"WASD/FLÈCHES NAGER   J/ESPACE/CLIC LANCER L'HAMEÇON",
"WASD/PFEILE SCHWIMMEN   J/LEER/KLICK HAKEN WERFEN",
"WASD/SETAS NADAR   J/ESPAÇO/CLIQUE LANÇAR ANZOL",
"WASD/FRECCE NUOTA   J/SPAZIO/CLIC LANCIA AMO",
"WASD/СТРЕЛКИ ПЛЫТЬ   J/ПРОБЕЛ/КЛИК КРЮЧОК",
"WASD/方向键游泳   J/空格/点击 甩钩",
"WASD/矢印で泳ぐ   J/スペース/クリックで針を投げる"
],
"K/SHIFT DASH   GRAB BIG BUBBLES FOR AIR": [
"K/SHIFT TURBO   COGE BURBUJAS PARA RESPIRAR",
"K/MAJ TURBO   ATTRAPE LES BULLES POUR L'AIR",
"K/SHIFT SPURT   GROSSE BLASEN GEBEN LUFT",
"K/SHIFT TURBO   APANHA BOLHAS PARA RESPIRAR",
"K/SHIFT TURBO   PRENDI LE BOLLE PER L'ARIA",
"K/SHIFT РЫВОК   ЛОВИ ПУЗЫРИ ДЛЯ ВОЗДУХА",
"K/SHIFT 冲刺   抓住大气泡补充空气",
"K/SHIFT ダッシュ   大きな泡で空気を補給"
],
"BEAT THE BEAST AND IT DROPS A BETTER ROD!": [
"¡VENCE A LA BESTIA Y SOLTARÁ UNA CAÑA MEJOR!",
"BATS LA BÊTE: ELLE LAISSE UNE MEILLEURE CANNE!",
"BESIEGE DAS BIEST: ES LÄSST EINE BESSERE ANGEL FALLEN!",
"VENCE A FERA E ELA DEIXA UMA CANA MELHOR!",
"SCONFIGGI LA BESTIA E LASCERÀ UNA CANNA MIGLIORE!",
"ПОБЕДИ ЧУДОВИЩЕ - ПОЛУЧИШЬ УДОЧКУ ЛУЧШЕ!",
"打败巨兽，它会掉落更好的鱼竿！",
"怪物を倒すと、もっといい竿を落とすよ！"
],
"ON A PHONE: JOYSTICK ON THE LEFT, BUTTONS RIGHT": [
"EN EL MÓVIL: JOYSTICK A LA IZQUIERDA, BOTONES A LA DERECHA",
"SUR MOBILE: JOYSTICK À GAUCHE, BOUTONS À DROITE",
"AM HANDY: JOYSTICK LINKS, KNÖPFE RECHTS",
"NO TELEMÓVEL: JOYSTICK À ESQUERDA, BOTÕES À DIREITA",
"SU TELEFONO: JOYSTICK A SINISTRA, TASTI A DESTRA",
"НА ТЕЛЕФОНЕ: ДЖОЙСТИК СЛЕВА, КНОПКИ СПРАВА",
"手机上：左边摇杆，右边按钮",
"スマホ：左にスティック、右にボタン"
],
"2 PLAYERS (ONE KEYBOARD)": [
"2 JUGADORES (UN TECLADO)",
"2 JOUEURS (UN CLAVIER)",
"2 SPIELER (EINE TASTATUR)",
"2 JOGADORES (UM TECLADO)",
"2 GIOCATORI (UNA TASTIERA)",
"2 ИГРОКА (ОДНА КЛАВИАТУРА)",
"2 名玩家（同一键盘）",
"2人プレイ（キーボード1台）"
],
"P1: SPACE FISH - WASD + SPACE HOOK + L-SHIFT DASH": [
"P1: ESPACIO PESCA - WASD + ESPACIO ANZUELO + SHIFT IZQ TURBO",
"P1: ESPACE PÊCHE - WASD + ESPACE HAMEÇON + MAJ G TURBO",
"P1: LEER ANGELN - WASD + LEER HAKEN + SHIFT L SPURT",
"P1: ESPAÇO PESCA - WASD + ESPAÇO ANZOL + SHIFT ESQ TURBO",
"P1: SPAZIO PESCA - WASD + SPAZIO AMO + SHIFT SX TURBO",
"P1: ПРОБЕЛ ЛОВИТЬ - WASD + ПРОБЕЛ КРЮЧОК + ЛЕВ SHIFT РЫВОК",
"P1：空格钓鱼 - WASD + 空格甩钩 + 左SHIFT冲刺",
"P1：スペースで釣り - WASD + スペースで針 + 左SHIFTでダッシュ"
],
"P2: ENTER FISH - ARROWS + ENTER HOOK + R-SHIFT DASH": [
"P2: ENTER PESCA - FLECHAS + ENTER ANZUELO + SHIFT DER TURBO",
"P2: ENTRÉE PÊCHE - FLÈCHES + ENTRÉE HAMEÇON + MAJ D TURBO",
"P2: ENTER ANGELN - PFEILE + ENTER HAKEN + SHIFT R SPURT",
"P2: ENTER PESCA - SETAS + ENTER ANZOL + SHIFT DIR TURBO",
"P2: INVIO PESCA - FRECCE + INVIO AMO + SHIFT DX TURBO",
"P2: ENTER ЛОВИТЬ - СТРЕЛКИ + ENTER КРЮЧОК + ПРАВ SHIFT РЫВОК",
"P2：回车钓鱼 - 方向键 + 回车甩钩 + 右SHIFT冲刺",
"P2：ENTERで釣り - 矢印 + ENTERで針 + 右SHIFTでダッシュ"
],
"SWIM INTO A KNOCKED-OUT FRIEND TO REVIVE THEM": [
"NADA HASTA UN AMIGO NOQUEADO PARA REANIMARLO",
"NAGE VERS UN AMI K.O. POUR LE RÉANIMER",
"SCHWIMM ZU EINEM K.O.-FREUND, UM IHN ZU RETTEN",
"NADA ATÉ UM AMIGO K.O. PARA O REANIMAR",
"NUOTA VERSO UN AMICO K.O. PER RIANIMARLO",
"ПОДПЛЫВИ К ДРУГУ БЕЗ СОЗНАНИЯ, ЧТОБЫ СПАСТИ",
"游到昏迷的伙伴身边就能救起他",
"気絶した仲間に泳いで触れると復活"
],
"SPACE: NEXT PAGE": [
"ESPACIO: SIGUIENTE",
"ESPACE: PAGE SUIVANTE",
"LEERTASTE: WEITER",
"ESPAÇO: SEGUINTE",
"SPAZIO: AVANTI",
"ПРОБЕЛ: ДАЛЕЕ",
"空格：下一页",
"スペース：次へ"
],
"SPACE: CLOSE": [
"ESPACIO: CERRAR",
"ESPACE: FERMER",
"LEERTASTE: SCHLIESSEN",
"ESPAÇO: FECHAR",
"SPAZIO: CHIUDI",
"ПРОБЕЛ: ЗАКРЫТЬ",
"空格：关闭",
"スペース：とじる"
],
"HOLD SPACE (OR TAP) TO CHARGE A CAST": [
"MANTÉN ESPACIO (O TOCA) PARA CARGAR",
"MAINTIENS ESPACE (OU TOUCHE) POUR CHARGER",
"LEERTASTE HALTEN (ODER TIPPEN) ZUM AUSHOLEN",
"SEGURA ESPAÇO (OU TOCA) PARA CARREGAR",
"TIENI SPAZIO (O TOCCA) PER CARICARE",
"ДЕРЖИ ПРОБЕЛ (ИЛИ ЭКРАН) ДЛЯ ЗАМАХА",
"按住空格（或点击屏幕）蓄力抛竿",
"スペース長押し（またはタップ）でためる"
],
"WELCOME TO {0}!": [
"¡BIENVENIDO A {0}!",
"BIENVENUE À {0}!",
"WILLKOMMEN: {0}!",
"BEM-VINDO A {0}!",
"BENVENUTO A {0}!",
"ДОБРО ПОЖАЛОВАТЬ: {0}!",
"欢迎来到{0}！",
"{0}へようこそ！"
],
"DAY {#0} - GOOD MORNING!": [
"DÍA {0} - ¡BUENOS DÍAS!",
"JOUR {0} - BONJOUR!",
"TAG {0} - GUTEN MORGEN!",
"DIA {0} - BOM DIA!",
"GIORNO {0} - BUONGIORNO!",
"ДЕНЬ {0} - ДОБРОЕ УТРО!",
"第{0}天 - 早上好！",
"{0}日目 - おはよう！"
],
"NIGHT FALLS... NIGHT FISH ARE OUT": [
"CAE LA NOCHE... SALEN LOS PECES NOCTURNOS",
"LA NUIT TOMBE... LES POISSONS DE NUIT SORTENT",
"DIE NACHT BRICHT AN... NACHTFISCHE KOMMEN",
"CAI A NOITE... OS PEIXES NOTURNOS SAEM",
"CALA LA NOTTE... ESCONO I PESCI NOTTURNI",
"НАСТУПАЕТ НОЧЬ... НОЧНАЯ РЫБА ПРОСНУЛАСЬ",
"夜幕降临……夜行鱼出来了",
"夜になった…夜の魚が出てきたよ"
],
"THE SUN IS UP": [
"SALIÓ EL SOL",
"LE SOLEIL SE LÈVE",
"DIE SONNE GEHT AUF",
"O SOL NASCEU",
"È SORTO IL SOLE",
"ВСТАЛО СОЛНЦЕ",
"太阳升起来了",
"朝日がのぼった"
],
"NO {0} LEFT - VISIT THE SHOP (B)": [
"NO QUEDA {0} - VE A LA TIENDA (B)",
"PLUS DE {0} - VA À LA BOUTIQUE (B)",
"KEIN {0} MEHR - AB IN DEN LADEN (B)",
"SEM {0} - VAI À LOJA (B)",
"NIENTE {0} - VAI AL NEGOZIO (B)",
"НЕТ: {0} - ЗАГЛЯНИ В ЛАВКУ (B)",
"{0}用完了 - 去商店看看（B）",
"{0}がない - ショップへ（B）"
],
"{0} EVERYTHING BITES!": [
"{0} ¡TODO PICA!",
"{0} TOUT MORD!",
"{0} ALLES BEISST!",
"{0} TUDO MORDE!",
"{0} ABBOCCA TUTTO!",
"{0} КЛЮЁТ ВСЁ!",
"{0}所有鱼都在咬钩！",
"{0}なんでも釣れる！"
],
"SUNRISE FEEDING FRENZY!": [
"¡FRENESÍ DEL AMANECER!",
"FRÉNÉSIE DE L'AUBE!",
"FRESSRAUSCH IM MORGENGRAUEN!",
"FRENESIM DO AMANHECER!",
"FRENESIA DELL'ALBA!",
"УТРЕННИЙ ЖОР!",
"日出觅食狂潮！",
"夜明けの食いつきタイム！"
],
"A FAMILIAR GIANT RETURNS...": [
"VUELVE UN GIGANTE CONOCIDO...",
"UN GÉANT FAMILIER REVIENT...",
"EIN BEKANNTER RIESE KEHRT ZURÜCK...",
"UM GIGANTE CONHECIDO VOLTA...",
"TORNA UN GIGANTE FAMILIARE...",
"ЗНАКОМЫЙ ГИГАНТ ВЕРНУЛСЯ...",
"熟悉的巨兽回来了……",
"見覚えのある巨大魚が戻ってきた…"
],
"A HUGE SHADOW LURKS IN THE WATER...": [
"UNA SOMBRA ENORME ACECHA EN EL AGUA...",
"UNE OMBRE ÉNORME RÔDE DANS L'EAU...",
"EIN RIESIGER SCHATTEN LAUERT IM WASSER...",
"UMA SOMBRA ENORME ESPREITA NA ÁGUA...",
"UN'OMBRA ENORME SI AGGIRA NELL'ACQUA...",
"В ВОДЕ ТАИТСЯ ОГРОМНАЯ ТЕНЬ...",
"水中潜伏着巨大的影子……",
"水中に巨大な影がひそんでいる…"
],
"CAST NEAR IT... IF YOU DARE!": [
"LANZA CERCA... ¡SI TE ATREVES!",
"LANCE PRÈS D'ELLE... SI TU OSES!",
"WIRF IN DIE NÄHE... WENN DU DICH TRAUST!",
"LANÇA PERTO... SE TIVERES CORAGEM!",
"LANCIA VICINO... SE HAI CORAGGIO!",
"ЗАБРОСЬ РЯДОМ... ЕСЛИ ОСМЕЛИШЬСЯ!",
"在它附近抛竿……如果你敢的话！",
"近くに投げてみよう…勇気があれば！"
],
"A SEAGULL WANTS YOUR FISH! CLICK IT OR PRESS X": [
"¡UNA GAVIOTA QUIERE TU PEZ! HAZ CLIC O PULSA X",
"UNE MOUETTE VEUT TON POISSON! CLIQUE OU APPUIE SUR X",
"EINE MÖWE WILL DEINEN FISCH! KLICK SIE ODER DRÜCK X",
"UMA GAIVOTA QUER O TEU PEIXE! CLICA OU CARREGA X",
"UN GABBIANO VUOLE IL TUO PESCE! CLICCALO O PREMI X",
"ЧАЙКА ХОЧЕТ ТВОЮ РЫБУ! КЛИКНИ ИЛИ ЖМИ X",
"海鸥想偷你的鱼！点它或按X",
"カモメが魚をねらってる！クリックかXキー"
],
"THE GULL STOLE YOUR {0}!": [
"¡LA GAVIOTA ROBÓ: {0}!",
"LA MOUETTE A VOLÉ: {0}!",
"DIE MÖWE KLAUTE: {0}!",
"A GAIVOTA ROUBOU: {0}!",
"IL GABBIANO HA RUBATO: {0}!",
"ЧАЙКА УКРАЛА: {0}!",
"海鸥偷走了你的{0}！",
"カモメに{0}を盗まれた！"
],
"A BOTTLE IS BOBBING BY... CAST AT IT!": [
"FLOTA UNA BOTELLA... ¡LÁNZALE!",
"UNE BOUTEILLE FLOTTE... LANCE DESSUS!",
"EINE FLASCHE TREIBT VORBEI... WIRF DANACH!",
"PASSA UMA GARRAFA... LANÇA PARA ELA!",
"GALLEGGIA UNA BOTTIGLIA... LANCIA LÌ!",
"МИМО ПЛЫВЁТ БУТЫЛКА... ЗАБРОСЬ К НЕЙ!",
"漂来一个瓶子……朝它抛竿！",
"ビンが流れてきた…ねらって投げよう！"
],
"SHOO! SHOO!": [
"¡FUERA! ¡FUERA!",
"OUSTE! OUSTE!",
"HUSCH! HUSCH!",
"XÔ! XÔ!",
"SCIÒ! SCIÒ!",
"КЫШ! КЫШ!",
"嘘！走开！",
"シッシッ！"
],
"A FEW COINS ROLL OUT!": [
"¡SALEN UNAS MONEDAS!",
"QUELQUES PIÈCES TOMBENT!",
"EIN PAAR MÜNZEN ROLLEN HERAUS!",
"SAEM ALGUMAS MOEDAS!",
"ESCONO ALCUNE MONETE!",
"ВЫКАТИЛИСЬ МОНЕТКИ!",
"滚出来几枚金币！",
"コインが転がり出た！"
],
"+{#0} COINS": [
"+{0} MONEDAS",
"+{0} PIÈCES",
"+{0} MÜNZEN",
"+{0} MOEDAS",
"+{0} MONETE",
"+{0} МОНЕТ",
"+{0}金币",
"+{0}コイン"
],
"SOMEONE SENT YOU BAIT?!": [
"¿ALGUIEN TE ENVÍA CEBO?",
"QUELQU'UN T'ENVOIE DES APPÂTS?!",
"JEMAND SCHICKT DIR KÖDER?!",
"ALGUÉM TE MANDOU ISCO?!",
"QUALCUNO TI MANDA ESCHE?!",
"КТО-ТО ПРИСЛАЛ НАЖИВКУ?!",
"有人送你鱼饵？！",
"だれかがエサを送ってくれた？！"
],
"+{#0} {1}": [
"+{0} {1}",
"+{0} {1}",
"+{0} {1}",
"+{0} {1}",
"+{0} {1}",
"+{0} {1}",
"+{0} {1}",
"+{0} {1}"
],
"A TREASURE MAP!": [
"¡UN MAPA DEL TESORO!",
"UNE CARTE AU TRÉSOR!",
"EINE SCHATZKARTE!",
"UM MAPA DO TESOURO!",
"UNA MAPPA DEL TESORO!",
"КАРТА СОКРОВИЩ!",
"一张藏宝图！",
"宝の地図だ！"
],
"X MARKS THE SPOT: YOUR NEXT": [
"LA X MARCA EL LUGAR: TU PRÓXIMA",
"LE X MARQUE L'ENDROIT: TA PROCHAINE",
"X MARKIERT DIE STELLE: DEIN NÄCHSTER",
"O X MARCA O LOCAL: A TUA PRÓXIMA",
"LA X SEGNA IL PUNTO: LA TUA PROSSIMA",
"КРЕСТИК НА КАРТЕ: ТВОЙ СЛЕДУЮЩИЙ",
"X标记了宝藏：你下一次",
"Xが宝のしるし：次に"
],
"CATCH WILL BE TREASURE!": [
"CAPTURA SERÁ UN TESORO!",
"PRISE SERA UN TRÉSOR!",
"FANG WIRD EIN SCHATZ!",
"CAPTURA SERÁ UM TESOURO!",
"PRESA SARÀ UN TESORO!",
"УЛОВ БУДЕТ СОКРОВИЩЕМ!",
"钓到的会是宝藏！",
"釣れるのは宝物！"
],
"\"HELP! A KRAKEN ATE MY BOAT.\"": [
"\"¡SOCORRO! UN KRAKEN SE COMIÓ MI BARCO.\"",
"\"À L'AIDE! UN KRAKEN A MANGÉ MON BATEAU.\"",
"\"HILFE! EIN KRAKE HAT MEIN BOOT GEFRESSEN.\"",
"\"SOCORRO! UM KRAKEN COMEU O MEU BARCO.\"",
"\"AIUTO! UN KRAKEN HA MANGIATO LA MIA BARCA.\"",
"\"ПОМОГИТЕ! КРАКЕН СЪЕЛ МОЮ ЛОДКУ.\"",
"\"救命！海怪吃了我的船。\"",
"「助けて！クラーケンに船を食べられた。」"
],
"- CAPTAIN P.": [
"- CAPITÁN P.",
"- CAPITAINE P.",
"- KAPITÄN S.",
"- CAPITÃO P.",
"- CAPITANO P.",
"- КАПИТАН О.",
"- P船长",
"- P船長"
],
"\"THE GHOST WHALE HATES LIGHT...\"": [
"\"LA BALLENA FANTASMA ODIA LA LUZ...\"",
"\"LA BALEINE FANTÔME DÉTESTE LA LUMIÈRE...\"",
"\"DER GEISTERWAL HASST LICHT...\"",
"\"A BALEIA FANTASMA ODEIA A LUZ...\"",
"\"LA BALENA FANTASMA ODIA LA LUCE...\"",
"\"КИТ-ПРИЗРАК БОИТСЯ СВЕТА...\"",
"\"幽灵鲸怕光……\"",
"「幽霊クジラは光がきらい…」"
],
"- A SCARED PIRATE": [
"- UN PIRATA ASUSTADO",
"- UN PIRATE EFFRAYÉ",
"- EIN ÄNGSTLICHER PIRAT",
"- UM PIRATA ASSUSTADO",
"- UN PIRATA SPAVENTATO",
"- ИСПУГАННЫЙ ПИРАТ",
"- 一个害怕的海盗",
"- こわがりの海賊"
],
"\"CRABS CANNOT JUMP FOREVER.\"": [
"\"LOS CANGREJOS NO SALTAN SIEMPRE.\"",
"\"LES CRABES NE SAUTENT PAS TOUJOURS.\"",
"\"KRABBEN KÖNNEN NICHT EWIG SPRINGEN.\"",
"\"OS CARANGUEJOS NÃO SALTAM SEMPRE.\"",
"\"I GRANCHI NON SALTANO PER SEMPRE.\"",
"\"КРАБЫ НЕ МОГУТ ПРЫГАТЬ ВЕЧНО.\"",
"\"螃蟹不能一直跳。\"",
"「カニはずっとは跳べない。」"
],
"- A WISE PENGUIN": [
"- UN PINGÜINO SABIO",
"- UN MANCHOT SAGE",
"- EIN WEISER PINGUIN",
"- UM PINGUIM SÁBIO",
"- UN PINGUINO SAGGIO",
"- МУДРЫЙ ПИНГВИН",
"- 一只聪明的企鹅",
"- かしこいペンギン"
],
"\"THE CAT RUNS THIS BEACH.\"": [
"\"EL GATO MANDA EN ESTA PLAYA.\"",
"\"LE CHAT DIRIGE CETTE PLAGE.\"",
"\"DIE KATZE REGIERT DIESEN STRAND.\"",
"\"O GATO MANDA NESTA PRAIA.\"",
"\"IL GATTO COMANDA QUESTA SPIAGGIA.\"",
"\"ЭТИМ ПЛЯЖЕМ ПРАВИТ КОТ.\"",
"\"这片海滩归猫管。\"",
"「このビーチのボスはネコ。」"
],
"- EVERYONE": [
"- TODO EL MUNDO",
"- TOUT LE MONDE",
"- ALLE",
"- TODA A GENTE",
"- TUTTI",
"- ВСЕ",
"- 所有人",
"- みんな"
],
"\"DEAR DIARY, CAUGHT A BOOT AGAIN.\"": [
"\"QUERIDO DIARIO: OTRA BOTA PESCADA.\"",
"\"CHER JOURNAL, ENCORE UNE BOTTE.\"",
"\"LIEBES TAGEBUCH, WIEDER EIN STIEFEL.\"",
"\"QUERIDO DIÁRIO, OUTRA BOTA.\"",
"\"CARO DIARIO, UN ALTRO STIVALE.\"",
"\"ДОРОГОЙ ДНЕВНИК, ОПЯТЬ САПОГ.\"",
"\"亲爱的日记，又钓到一只靴子。\"",
"「日記さん、またブーツが釣れたよ。」"
],
"- OLD SALT": [
"- LOBO DE MAR",
"- VIEUX LOUP",
"- ALTER SEEBÄR",
"- VELHO LOBO",
"- VECCHIO LUPO",
"- СТАРЫЙ МОРЯК",
"- 老水手",
"- 老船乗り"
],
"TOO EARLY! YOU SPOOKED IT": [
"¡DEMASIADO PRONTO! LO ASUSTASTE",
"TROP TÔT! TU L'AS EFFRAYÉ",
"ZU FRÜH! DU HAST IHN VERSCHRECKT",
"CEDO DEMAIS! ASSUSTASTE-O",
"TROPPO PRESTO! L'HAI SPAVENTATO",
"РАНО! ТЫ ЕЁ СПУГНУЛ",
"太早了！鱼被吓跑了",
"早すぎ！魚がにげた"
],
"TOO SLOW... IT STOLE THE BAIT": [
"DEMASIADO LENTO... SE LLEVÓ EL CEBO",
"TROP LENT... IL A VOLÉ L'APPÂT",
"ZU LANGSAM... KÖDER GEKLAUT",
"LENTO DEMAIS... ROUBOU O ISCO",
"TROPPO LENTO... HA RUBATO L'ESCA",
"МЕДЛЕННО... НАЖИВКУ УКРАЛИ",
"太慢了……鱼饵被偷了",
"おそい…エサを取られた"
],
"IT'S ENORMOUS!!": [
"¡¡ES ENORME!!",
"C'EST ÉNORME!!",
"DER IST RIESIG!!",
"É ENORME!!",
"È ENORME!!",
"ОН ОГРОМНЫЙ!!",
"好大啊！！",
"でかい！！"
],
"HOLD TO REEL - RELEASE WHEN IT THRASHES!": [
"MANTÉN PARA RECOGER - ¡SUELTA SI SE AGITA!",
"MAINTIENS POUR MOULINER - LÂCHE S'IL SE DÉBAT!",
"HALTEN ZUM EINHOLEN - LOSLASSEN, WENN ER ZAPPELT!",
"SEGURA PARA RECOLHER - SOLTA SE SE DEBATER!",
"TIENI PER RIAVVOLGERE - MOLLA SE SI DIMENA!",
"ДЕРЖИ, ЧТОБЫ ТЯНУТЬ - ОТПУСТИ, КОГДА БЬЁТСЯ!",
"按住收线 - 鱼挣扎时松手！",
"長押しで巻く - 暴れたらはなして！"
],
"SNAP! THE LINE BROKE...": [
"¡CRAC! SE ROMPIÓ EL SEDAL...",
"CRAC! LE FIL A CASSÉ...",
"SCHNAPP! DIE SCHNUR IST GERISSEN...",
"CRAC! A LINHA PARTIU...",
"CRAC! LA LENZA SI È SPEZZATA...",
"ЩЁЛК! ЛЕСКА ПОРВАЛАСЬ...",
"啪！线断了……",
"プチッ！糸が切れた…"
],
"IT GOT AWAY...": [
"SE ESCAPÓ...",
"IL S'EST ÉCHAPPÉ...",
"ER IST ENTKOMMEN...",
"FUGIU...",
"È SCAPPATO...",
"УШЛА...",
"它逃走了……",
"にげられた…"
],
"X MARKS THE SPOT! TREASURE!": [
"¡LA X MARCA EL LUGAR! ¡TESORO!",
"LE X MARQUE L'ENDROIT! TRÉSOR!",
"X MARKIERT DIE STELLE! SCHATZ!",
"O X MARCA O LOCAL! TESOURO!",
"LA X SEGNA IL PUNTO! TESORO!",
"КРЕСТИК! СОКРОВИЩЕ!",
"X标记处！宝藏！",
"Xのしるし！宝物だ！"
],
"COOLER FULL! SELL FISH AT THE SHOP (B)": [
"¡NEVERA LLENA! VENDE EN LA TIENDA (B)",
"GLACIÈRE PLEINE! VENDS À LA BOUTIQUE (B)",
"KÜHLBOX VOLL! VERKAUFE IM LADEN (B)",
"GELEIRA CHEIA! VENDE NA LOJA (B)",
"FRIGO PIENO! VENDI AL NEGOZIO (B)",
"ХОЛОДИЛЬНИК ПОЛОН! ПРОДАЙ В ЛАВКЕ (B)",
"冷藏箱满了！去商店卖鱼（B）",
"クーラーがいっぱい！ショップで売ろう（B）"
],
"WHOA!! IT'S PULLING US IN!": [
"¡¡UAU!! ¡NOS ARRASTRA!",
"OUAH!! IL NOUS ENTRAÎNE!",
"WOAH!! ER ZIEHT UNS REIN!",
"EIA!! ESTÁ A PUXAR-NOS!",
"WOW!! CI TRASCINA GIÙ!",
"ОГО!! ОН ТЯНЕТ НАС!",
"哇！！它把我们拖下去了！",
"うわっ！！引きずりこまれる！"
],
"WHOA!! IT'S PULLING ME IN!": [
"¡¡UAU!! ¡ME ARRASTRA!",
"OUAH!! IL M'ENTRAÎNE!",
"WOAH!! ER ZIEHT MICH REIN!",
"EIA!! ESTÁ A PUXAR-ME!",
"WOW!! MI TRASCINA GIÙ!",
"ОГО!! ОН ТЯНЕТ МЕНЯ!",
"哇！！它把我拖下去了！",
"うわっ！！引きずりこまれる！"
],
"AHOY THERE, YOUNG ONE!": [
"¡AHOY, GRUMETE!",
"OHÉ, MOUSSAILLON!",
"AHOI, JUNGSPUND!",
"OLÁ, GRUMETE!",
"AHOY, GIOVANOTTO!",
"ЭЙ, ЮНГА!",
"你好呀，小家伙！",
"よう、若いの！"
],
"THE SEA PROVIDES, IF YOU ASK NICELY.": [
"EL MAR DA, SI PIDES CON AMABILIDAD.",
"LA MER DONNE, SI TU DEMANDES GENTIMENT.",
"DAS MEER GIBT, WENN DU NETT FRAGST.",
"O MAR DÁ, SE PEDIRES COM JEITO.",
"IL MARE DONA, SE CHIEDI GENTILMENTE.",
"МОРЕ ДАЁТ, ЕСЛИ ВЕЖЛИВО ПОПРОСИТЬ.",
"大海会给予，只要你好好请求。",
"海はめぐみをくれる。ていねいにたのめばな。"
],
"BACK IN MY DAY WE FISHED WITH OUR TEETH.": [
"EN MIS TIEMPOS PESCÁBAMOS CON LOS DIENTES.",
"DE MON TEMPS, ON PÊCHAIT AVEC LES DENTS.",
"FRÜHER HABEN WIR MIT DEN ZÄHNEN GEANGELT.",
"NO MEU TEMPO PESCÁVAMOS COM OS DENTES.",
"AI MIEI TEMPI PESCAVAMO COI DENTI.",
"В МОЁ ВРЕМЯ МЫ ЛОВИЛИ ЗУБАМИ.",
"想当年我们是用牙钓鱼的。",
"昔は歯で魚を釣ったもんじゃ。"
],
"FANCY A LITTLE JOB?": [
"¿TE APETECE UN TRABAJITO?",
"UN PETIT BOULOT, ÇA TE DIT?",
"LUST AUF EINEN KLEINEN JOB?",
"QUERES UM TRABALHINHO?",
"TI VA UN LAVORETTO?",
"ХОЧЕШЬ ПОДРАБОТАТЬ?",
"想做点小活儿吗？",
"ちょっと仕事をしてみんか？"
],
"ME KNEES SAY A STORM IS COMING...": [
"MIS RODILLAS DICEN QUE VIENE TORMENTA...",
"MES GENOUX SENTENT L'ORAGE...",
"MEINE KNIE SPÜREN EINEN STURM...",
"OS MEUS JOELHOS DIZEM QUE VEM TEMPESTADE...",
"LE MIE GINOCCHIA SENTONO LA TEMPESTA...",
"КОЛЕНИ ЧУЮТ БУРЮ...",
"我的膝盖说暴风雨要来了……",
"ひざがうずく…嵐が来るぞ…"
],
"FIND ME AN OLD BOOT. I LOST MINE!": [
"ENCUÉNTRAME UNA BOTA VIEJA. ¡PERDÍ LA MÍA!",
"TROUVE-MOI UNE VIEILLE BOTTE. J'AI PERDU LA MIENNE!",
"FINDE MIR EINEN ALTEN STIEFEL. MEINER IST WEG!",
"ENCONTRA-ME UMA BOTA VELHA. PERDI A MINHA!",
"TROVAMI UNO STIVALE VECCHIO. HO PERSO IL MIO!",
"НАЙДИ МНЕ СТАРЫЙ САПОГ. Я СВОЙ ПОТЕРЯЛ!",
"帮我找只旧靴子。我的丢了！",
"古いブーツを探してくれ。なくしたんじゃ！"
],
"CATCH {#0} {1} (ANY SIZE)": [
"PESCA {0}: {1} (CUALQUIER TAMAÑO)",
"ATTRAPE {0} X {1} (TOUTE TAILLE)",
"FANG {0}X {1} (JEDE GRÖSSE)",
"APANHA {0}: {1} (QUALQUER TAMANHO)",
"PRENDI {0}: {1} (QUALSIASI TAGLIA)",
"ПОЙМАЙ {0}: {1} (ЛЮБОГО РАЗМЕРА)",
"钓{0}条{1}（大小不限）",
"{1}を{0}匹釣る（サイズ自由）"
],
"CATCH {#0} {1}": [
"PESCA {0}: {1}",
"ATTRAPE {0} X {1}",
"FANG {0}X {1}",
"APANHA {0}: {1}",
"PRENDI {0}: {1}",
"ПОЙМАЙ {0}: {1}",
"钓{0}条{1}",
"{1}を{0}匹釣る"
],
"CATCH A {0} OVER {#1} CM": [
"PESCA: {0} DE MÁS DE {1} CM",
"ATTRAPE: {0} DE PLUS DE {1} CM",
"FANG: {0} ÜBER {1} CM",
"APANHA: {0} COM MAIS DE {1} CM",
"PRENDI: {0} OLTRE {1} CM",
"ПОЙМАЙ: {0} БОЛЬШЕ {1} СМ",
"钓一条超过{1}厘米的{0}",
"{1}CM以上の{0}を釣る"
],
"CATCH 3 FISH AT NIGHT": [
"PESCA 3 PECES DE NOCHE",
"ATTRAPE 3 POISSONS LA NUIT",
"FANG 3 FISCHE IN DER NACHT",
"APANHA 3 PEIXES À NOITE",
"PRENDI 3 PESCI DI NOTTE",
"ПОЙМАЙ 3 РЫБЫ НОЧЬЮ",
"晚上钓3条鱼",
"夜に魚を3匹釣る"
],
"CATCH 4 FISH AT {0}": [
"PESCA 4 PECES EN {0}",
"ATTRAPE 4 POISSONS: {0}",
"FANG 4 FISCHE: {0}",
"APANHA 4 PEIXES EM {0}",
"PRENDI 4 PESCI A {0}",
"ПОЙМАЙ 4 РЫБЫ: {0}",
"在{0}钓4条鱼",
"{0}で魚を4匹釣る"
],
"DEFEAT ANY SEA BEAST": [
"DERROTA A UNA BESTIA MARINA",
"VAINS UNE BÊTE DES MERS",
"BESIEGE EIN SEEUNGEHEUER",
"DERROTA UMA FERA MARINHA",
"SCONFIGGI UNA BESTIA MARINA",
"ПОБЕДИ МОРСКОЕ ЧУДОВИЩЕ",
"打败任意一只海洋巨兽",
"海の怪物を1体たおす"
],
"QUEST DONE! TALK TO OLD SALT AT THE PIER (Q)": [
"¡MISIÓN HECHA! HABLA CON LOBO DE MAR (Q)",
"QUÊTE FINIE! PARLE AU VIEUX LOUP (Q)",
"AUFTRAG ERLEDIGT! SPRICH MIT DEM SEEBÄR (Q)",
"MISSÃO FEITA! FALA COM O VELHO LOBO (Q)",
"MISSIONE FATTA! PARLA COL VECCHIO LUPO (Q)",
"ЗАДАНИЕ ВЫПОЛНЕНО! ИДИ К МОРЯКУ (Q)",
"任务完成！去码头找老水手（Q）",
"クエスト達成！老船乗りと話そう（Q）"
],
"JOURNAL ROW COMPLETE! +100 COINS": [
"¡FILA DEL DIARIO COMPLETA! +100 MONEDAS",
"LIGNE DU JOURNAL COMPLÈTE! +100 PIÈCES",
"TAGEBUCHREIHE VOLL! +100 MÜNZEN",
"LINHA DO DIÁRIO COMPLETA! +100 MOEDAS",
"RIGA DEL DIARIO COMPLETA! +100 MONETE",
"РЯД ЖУРНАЛА СОБРАН! +100 МОНЕТ",
"图鉴一行完成！+100金币",
"ずかんの列コンプリート！+100コイン"
],
"NOT ENOUGH COINS": [
"NO TIENES SUFICIENTES MONEDAS",
"PAS ASSEZ DE PIÈCES",
"NICHT GENUG MÜNZEN",
"MOEDAS INSUFICIENTES",
"MONETE INSUFFICIENTI",
"НЕ ХВАТАЕТ МОНЕТ",
"金币不够",
"コインが足りない"
],
"BOUGHT {0}!": [
"¡COMPRADO: {0}!",
"ACHETÉ: {0}!",
"GEKAUFT: {0}!",
"COMPRADO: {0}!",
"COMPRATO: {0}!",
"КУПЛЕНО: {0}!",
"买下了{0}！",
"{0}を買った！"
],
"SHRIMP BAIT X5": [
"CEBO DE GAMBA X5",
"CREVETTES X5",
"GARNELENKÖDER X5",
"ISCO DE CAMARÃO X5",
"ESCA GAMBERO X5",
"КРЕВЕТКИ X5",
"虾饵 X5",
"エビのエサ X5"
],
"FISH BITE TWICE AS FAST.": [
"LOS PECES PICAN EL DOBLE DE RÁPIDO.",
"LES POISSONS MORDENT DEUX FOIS PLUS VITE.",
"FISCHE BEISSEN DOPPELT SO SCHNELL.",
"OS PEIXES MORDEM DUAS VEZES MAIS RÁPIDO.",
"I PESCI ABBOCCANO DUE VOLTE PIÙ IN FRETTA.",
"РЫБА КЛЮЁТ ВДВОЕ БЫСТРЕЕ.",
"鱼咬钩快一倍。",
"魚が2倍早く食いつく。"
],
"GLOW BAIT X5": [
"CEBO BRILLANTE X5",
"APPÂT LUMINEUX X5",
"LEUCHTKÖDER X5",
"ISCO BRILHANTE X5",
"ESCA LUMINOSA X5",
"СВЕТЯЩАЯСЯ НАЖИВКА X5",
"荧光饵 X5",
"光るエサ X5"
],
"RARE FISH AND HUGE SHADOWS LOVE IT.": [
"LES ENCANTA A PECES RAROS Y SOMBRAS GIGANTES.",
"LES POISSONS RARES ET GRANDES OMBRES ADORENT.",
"SELTENE FISCHE UND RIESENSCHATTEN LIEBEN ES.",
"PEIXES RAROS E SOMBRAS GIGANTES ADORAM.",
"PIACE AI PESCI RARI E ALLE OMBRE ENORMI.",
"ЕЁ ОБОЖАЮТ РЕДКИЕ РЫБЫ И ОГРОМНЫЕ ТЕНИ.",
"稀有鱼和巨大影子都爱它。",
"レア魚と巨大な影が大好き。"
],
"AIR TANK": [
"BOMBONA DE AIRE",
"BOUTEILLE D'AIR",
"LUFTFLASCHE",
"GARRAFA DE AR",
"BOMBOLA",
"БАЛЛОН",
"氧气瓶",
"空気ボンベ"
],
"+50% AIR IN YOUR NEXT BIG FIGHT.": [
"+50% DE AIRE EN TU PRÓXIMA GRAN PELEA.",
"+50% D'AIR POUR TON PROCHAIN COMBAT.",
"+50% LUFT IM NÄCHSTEN GROSSEN KAMPF.",
"+50% DE AR NA PRÓXIMA GRANDE LUTA.",
"+50% ARIA NELLA PROSSIMA GRANDE LOTTA.",
"+50% ВОЗДУХА В СЛЕДУЮЩЕЙ БИТВЕ.",
"下一场大战空气+50%。",
"次の大バトルで空気+50%。"
],
"FISH TACO": [
"TACO DE PESCADO",
"TACO DE POISSON",
"FISCHTACO",
"TACO DE PEIXE",
"TACO DI PESCE",
"ТАКО С РЫБОЙ",
"鱼肉卷饼",
"フィッシュタコス"
],
"+1 HEART IN YOUR NEXT BIG FIGHT.": [
"+1 CORAZÓN EN TU PRÓXIMA GRAN PELEA.",
"+1 COEUR POUR TON PROCHAIN COMBAT.",
"+1 HERZ IM NÄCHSTEN GROSSEN KAMPF.",
"+1 CORAÇÃO NA PRÓXIMA GRANDE LUTA.",
"+1 CUORE NELLA PROSSIMA GRANDE LOTTA.",
"+1 СЕРДЦЕ В СЛЕДУЮЩЕЙ БИТВЕ.",
"下一场大战+1颗心。",
"次の大バトルでハート+1。"
],
"FASTER REEL": [
"CARRETE RÁPIDO",
"MOULINET RAPIDE",
"SCHNELLE ROLLE",
"CARRETO RÁPIDO",
"MULINELLO VELOCE",
"БЫСТРАЯ КАТУШКА",
"快速卷线器",
"はやいリール"
],
"+15% REEL SPEED PER LEVEL.": [
"+15% DE VELOCIDAD POR NIVEL.",
"+15% DE VITESSE PAR NIVEAU.",
"+15% ROLLTEMPO PRO STUFE.",
"+15% DE VELOCIDADE POR NÍVEL.",
"+15% VELOCITÀ PER LIVELLO.",
"+15% СКОРОСТИ ЗА УРОВЕНЬ.",
"每级收线速度+15%。",
"レベルごとに巻く速さ+15%。"
],
"STRONGER LINE": [
"SEDAL FUERTE",
"FIL SOLIDE",
"STÄRKERE SCHNUR",
"LINHA FORTE",
"LENZA FORTE",
"КРЕПКАЯ ЛЕСКА",
"更结实的线",
"じょうぶな糸"
],
"+15% LINE STRENGTH PER LEVEL.": [
"+15% DE RESISTENCIA POR NIVEL.",
"+15% DE SOLIDITÉ PAR NIVEAU.",
"+15% SCHNURSTÄRKE PRO STUFE.",
"+15% DE RESISTÊNCIA POR NÍVEL.",
"+15% RESISTENZA PER LIVELLO.",
"+15% ПРОЧНОСТИ ЗА УРОВЕНЬ.",
"每级线的强度+15%。",
"レベルごとに糸の強さ+15%。"
],
"BIGGER COOLER": [
"NEVERA GRANDE",
"GRANDE GLACIÈRE",
"GRÖSSERE KÜHLBOX",
"GELEIRA MAIOR",
"FRIGO GRANDE",
"БОЛЬШОЙ ХОЛОДИЛЬНИК",
"更大的冷藏箱",
"大きなクーラー"
],
"+6 FISH OF COOLER SPACE.": [
"+6 HUECOS EN LA NEVERA.",
"+6 PLACES DANS LA GLACIÈRE.",
"+6 PLÄTZE IN DER KÜHLBOX.",
"+6 LUGARES NA GELEIRA.",
"+6 POSTI NEL FRIGO.",
"+6 МЕСТ В ХОЛОДИЛЬНИКЕ.",
"冷藏箱+6个空位。",
"クーラーの空き+6。"
],
"{0} NOW: {#1}": [
"{0} AHORA: {1}",
"{0} ACTUEL: {1}",
"{0} JETZT: {1}",
"{0} AGORA: {1}",
"{0} ORA: {1}",
"{0} СЕЙЧАС: {1}",
"{0} 当前：{1}",
"{0} いま：{1}"
],
"MAX": [
"MÁX",
"MAX",
"MAX",
"MÁX",
"MAX",
"МАКС",
"满级",
"MAX"
],
"ROWBOAT": [
"BOTE",
"BARQUE",
"RUDERBOOT",
"BARCO A REMOS",
"BARCA A REMI",
"ЛОДКА",
"小划艇",
"ボート"
],
"A ROWBOAT": [
"UN BOTE",
"UNE BARQUE",
"EIN RUDERBOOT",
"UM BARCO",
"UNA BARCA",
"ЛОДКА",
"一艘小划艇",
"ボート"
],
"ROW TO NEW SPOTS WITH T!": [
"¡REMA A NUEVOS LUGARES CON T!",
"RAME VERS DE NOUVEAUX COINS AVEC T!",
"RUDERE MIT T ZU NEUEN ORTEN!",
"REMA PARA NOVOS LOCAIS COM T!",
"REMA VERSO NUOVI POSTI CON T!",
"ПЛЫВИ В НОВЫЕ МЕСТА: T!",
"按T划到新地点！",
"Tで新しい場所へ！"
],
"OLD GNARLY": [
"VIEJO NUDOSO",
"VIEUX NOUEUX",
"ALTER KNORRIG",
"VELHO NODOSO",
"VECCHIO NODOSO",
"СТАРЫЙ КОРЯГА",
"老疙瘩",
"ゴツゴツじいさん"
],
"CAPTAIN POINTY": [
"CAPITÁN PUNTAS",
"CAPITAINE POINTU",
"KAPITÄN SPITZ",
"CAPITÃO PONTUDO",
"CAPITANO PUNTUTO",
"КАПИТАН ОСТРЯК",
"尖尖船长",
"トンガリ船長"
],
"LANTERNA": [
"LINTERNA",
"LANTERNA",
"LATERNA",
"LANTERNA",
"LANTERNA",
"ЛАНТЕРНА",
"提灯鱼",
"ランタンナ"
],
"BIG CHOMP": [
"GRAN MORDISCO",
"GROS CROC",
"GROSSER HAPPS",
"GRANDE DENTADA",
"GRANDE MORSO",
"БОЛЬШОЙ ХРУМ",
"大嚼嚼",
"ビッグガブリ"
],
"THE KRAKEN": [
"EL KRAKEN",
"LE KRAKEN",
"DER KRAKE",
"O KRAKEN",
"IL KRAKEN",
"КРАКЕН",
"海怪",
"クラーケン"
],
"BLUBBERBEARD": [
"BARBAGRASA",
"BARBEGRAS",
"SPECKBART",
"BARBAGORDA",
"BARBAGRASSA",
"ЖИРОБОРОД",
"油胡子",
"アブラヒゲ"
],
"KING PINCH": [
"REY PELLIZCO",
"ROI PINCE",
"KÖNIG ZWICK",
"REI BELISCÃO",
"RE PIZZICO",
"КОРОЛЬ ЩИПОК",
"钳子王",
"ハサミ王"
],
"SCORCHSCALE": [
"ESCAMARDIENTE",
"ÉCAILLEFEU",
"GLUTSCHUPPE",
"ESCAMARDENTE",
"SQUAMARDENTE",
"ЖАРОЧЕШУЙ",
"灼鳞",
"コゲウロコ"
],
"BEAT OLD GNARLY TO UNLOCK.": [
"VENCE AL VIEJO NUDOSO PARA DESBLOQUEAR.",
"BATS LE VIEUX NOUEUX POUR DÉBLOQUER.",
"BESIEGE DEN ALTEN KNORRIG ZUM FREISCHALTEN.",
"VENCE O VELHO NODOSO PARA DESBLOQUEAR.",
"SCONFIGGI IL VECCHIO NODOSO PER SBLOCCARE.",
"ПОБЕДИ СТАРОГО КОРЯГУ, ЧТОБЫ ОТКРЫТЬ.",
"打败老疙瘩来解锁。",
"ゴツゴツじいさんを倒すと解放。"
],
"BEAT OLD GNARLY FIRST!": [
"¡PRIMERO VENCE AL VIEJO NUDOSO!",
"BATS D'ABORD LE VIEUX NOUEUX!",
"BESIEGE ZUERST DEN ALTEN KNORRIG!",
"PRIMEIRO VENCE O VELHO NODOSO!",
"PRIMA SCONFIGGI IL VECCHIO NODOSO!",
"СНАЧАЛА ПОБЕДИ СТАРОГО КОРЯГУ!",
"先打败老疙瘩！",
"まずゴツゴツじいさんを倒そう！"
],
"ROW TO FARAWAY FISHING SPOTS!": [
"¡REMA A LUGARES DE PESCA LEJANOS!",
"RAME VERS DES COINS DE PÊCHE LOINTAINS!",
"RUDERE ZU FERNEN ANGELPLÄTZEN!",
"REMA ATÉ LOCAIS DE PESCA DISTANTES!",
"REMA VERSO POSTI DI PESCA LONTANI!",
"ПЛЫВИ К ДАЛЁКИМ МЕСТАМ ДЛЯ РЫБАЛКИ!",
"划到远方的钓鱼点！",
"遠くの釣り場へこぎ出そう！"
],
"OWNED": [
"TUYO",
"ACQUIS",
"GEKAUFT",
"TEU",
"TUO",
"ЕСТЬ",
"已拥有",
"持ってる"
],
"PRESS T TO TRAVEL!": [
"¡PULSA T PARA VIAJAR!",
"APPUIE SUR T POUR VOYAGER!",
"DRÜCK T ZUM REISEN!",
"CARREGA T PARA VIAJAR!",
"PREMI T PER VIAGGIARE!",
"ЖМИ T ДЛЯ ПУТЕШЕСТВИЯ!",
"按T去旅行！",
"Tで旅に出よう！"
],
"WEARING IT.": [
"LO LLEVAS PUESTO.",
"TU LE PORTES.",
"DU TRÄGST IHN.",
"ESTÁS A USÁ-LO.",
"LO INDOSSI.",
"НАДЕТА.",
"正戴着。",
"かぶってる。"
],
"PICK TO WEAR.": [
"ELÍGELO PARA PONÉRTELO.",
"CHOISIS POUR LE PORTER.",
"WÄHLEN ZUM TRAGEN.",
"ESCOLHE PARA USAR.",
"SCEGLI PER INDOSSARLO.",
"ВЫБЕРИ, ЧТОБЫ НАДЕТЬ.",
"选中就能戴上。",
"選ぶとかぶるよ。"
],
"LOOK SHARP ON THE PIER.": [
"LUCE ELEGANTE EN EL MUELLE.",
"SOIS CLASSE SUR LE PONTON.",
"SIEH SCHICK AUS AM STEG.",
"FICA ELEGANTE NO CAIS.",
"SII ELEGANTE SUL MOLO.",
"БУДЬ ЩЁГОЛЕМ НА ПРИЧАЛЕ.",
"在码头上帅气亮相。",
"桟橋でおしゃれに決めよう。"
],
"WORN": [
"PUESTO",
"PORTÉ",
"GETRAGEN",
"USADO",
"INDOSSATO",
"НАДЕТО",
"已戴上",
"着用中"
],
"IN USE.": [
"EN USO.",
"UTILISÉ.",
"IN BENUTZUNG.",
"EM USO.",
"IN USO.",
"ИСПОЛЬЗУЕТСЯ.",
"使用中。",
"使用中。"
],
"IN USE": [
"EN USO",
"UTILISÉ",
"AKTIV",
"EM USO",
"IN USO",
"АКТИВЕН",
"使用中",
"使用中"
],
"PICK TO USE.": [
"ELÍGELO PARA USARLO.",
"CHOISIS POUR L'UTILISER.",
"WÄHLEN ZUM BENUTZEN.",
"ESCOLHE PARA USAR.",
"SCEGLI PER USARLO.",
"ВЫБЕРИ, ЧТОБЫ ИСПОЛЬЗОВАТЬ.",
"选中就能使用。",
"選ぶと使うよ。"
],
"A FRESH COAT OF PAINT.": [
"UNA MANO DE PINTURA NUEVA.",
"UN COUP DE PEINTURE NEUF.",
"EIN NEUER ANSTRICH.",
"UMA NOVA DEMÃO DE TINTA.",
"UNA MANO DI VERNICE NUOVA.",
"СВЕЖАЯ КРАСКА.",
"刷一层新漆。",
"ぬりたてピカピカ。"
],
"STRAW HAT": [
"SOMBRERO DE PAJA",
"CHAPEAU DE PAILLE",
"STROHHUT",
"CHAPÉU DE PALHA",
"CAPPELLO DI PAGLIA",
"СОЛОМЕННАЯ ШЛЯПА",
"草帽",
"麦わら帽子"
],
"SUNSET HAT": [
"SOMBRERO ATARDECER",
"CHAPEAU COUCHANT",
"ABENDROT-HUT",
"CHAPÉU PÔR DO SOL",
"CAPPELLO TRAMONTO",
"ЗАКАТНАЯ ШЛЯПА",
"夕阳帽",
"夕焼け帽子"
],
"OCEAN HAT": [
"SOMBRERO OCÉANO",
"CHAPEAU OCÉAN",
"OZEAN-HUT",
"CHAPÉU OCEANO",
"CAPPELLO OCEANO",
"ОКЕАНСКАЯ ШЛЯПА",
"海洋帽",
"海の帽子"
],
"BUBBLEGUM HAT": [
"SOMBRERO CHICLE",
"CHAPEAU CHEWING-GUM",
"KAUGUMMI-HUT",
"CHAPÉU CHICLETE",
"CAPPELLO GOMMA",
"ЖВАЧНАЯ ШЛЯПА",
"泡泡糖帽",
"ガム色帽子"
],
"PIRATE HAT": [
"SOMBRERO PIRATA",
"CHAPEAU DE PIRATE",
"PIRATENHUT",
"CHAPÉU PIRATA",
"CAPPELLO PIRATA",
"ПИРАТСКАЯ ШЛЯПА",
"海盗帽",
"海賊帽子"
],
"GOLDEN HAT": [
"SOMBRERO DORADO",
"CHAPEAU DORÉ",
"GOLDENER HUT",
"CHAPÉU DOURADO",
"CAPPELLO D'ORO",
"ЗОЛОТАЯ ШЛЯПА",
"金帽子",
"金の帽子"
],
"RED BOBBER": [
"CORCHO ROJO",
"FLOTTEUR ROUGE",
"ROTER SCHWIMMER",
"BOIA VERMELHA",
"GALLEGGIANTE ROSSO",
"КРАСНЫЙ ПОПЛАВОК",
"红色浮漂",
"赤いウキ"
],
"LIME BOBBER": [
"CORCHO LIMA",
"FLOTTEUR CITRON VERT",
"LIMETTEN-SCHWIMMER",
"BOIA LIMA",
"GALLEGGIANTE LIME",
"ЛАЙМОВЫЙ ПОПЛАВОК",
"青柠浮漂",
"ライムのウキ"
],
"VIOLET BOBBER": [
"CORCHO VIOLETA",
"FLOTTEUR VIOLET",
"VIOLETTER SCHWIMMER",
"BOIA VIOLETA",
"GALLEGGIANTE VIOLA",
"ФИОЛЕТОВЫЙ ПОПЛАВОК",
"紫色浮漂",
"むらさきのウキ"
],
"GOLD BOBBER": [
"CORCHO DORADO",
"FLOTTEUR DORÉ",
"GOLDENER SCHWIMMER",
"BOIA DOURADA",
"GALLEGGIANTE D'ORO",
"ЗОЛОТОЙ ПОПЛАВОК",
"金色浮漂",
"金のウキ"
],
"RUBBER DUCK": [
"PATITO DE GOMA",
"CANARD EN PLASTIQUE",
"QUIETSCHEENTE",
"PATINHO DE BORRACHA",
"PAPERELLA",
"РЕЗИНОВАЯ УТОЧКА",
"橡皮鸭",
"おもちゃのアヒル"
],
"KELP GARDEN": [
"JARDÍN DE ALGAS",
"JARDIN D'ALGUES",
"TANGGARTEN",
"JARDIM DE ALGAS",
"GIARDINO DI ALGHE",
"САД ВОДОРОСЛЕЙ",
"海藻花园",
"海藻ガーデン"
],
"SAND CASTLE": [
"CASTILLO DE ARENA",
"CHÂTEAU DE SABLE",
"SANDBURG",
"CASTELO DE AREIA",
"CASTELLO DI SABBIA",
"ПЕСОЧНЫЙ ЗАМОК",
"沙堡",
"砂の城"
],
"DIVER HELMET": [
"CASCO DE BUZO",
"CASQUE DE PLONGÉE",
"TAUCHERHELM",
"CAPACETE DE MERGULHO",
"ELMO DA PALOMBARO",
"ВОДОЛАЗНЫЙ ШЛЕМ",
"潜水头盔",
"潜水ヘルメット"
],
"TREASURE PILE": [
"MONTÓN DE TESORO",
"TAS DE TRÉSOR",
"SCHATZHAUFEN",
"MONTE DE TESOURO",
"MUCCHIO DI TESORI",
"ГОРА СОКРОВИЩ",
"宝藏堆",
"宝の山"
],
"IN YOUR AQUARIUM (A).": [
"EN TU ACUARIO (A).",
"DANS TON AQUARIUM (A).",
"IN DEINEM AQUARIUM (A).",
"NO TEU AQUÁRIO (A).",
"NEL TUO ACQUARIO (A).",
"В ТВОЁМ АКВАРИУМЕ (A).",
"在你的水族箱里（A）。",
"水そうにあるよ（A）。"
],
"FOR YOUR AQUARIUM.": [
"PARA TU ACUARIO.",
"POUR TON AQUARIUM.",
"FÜR DEIN AQUARIUM.",
"PARA O TEU AQUÁRIO.",
"PER IL TUO ACQUARIO.",
"ДЛЯ ТВОЕГО АКВАРИУМА.",
"放进你的水族箱。",
"きみの水そう用。"
],
"SELL ALL ({#0}/{#1})": [
"VENDER TODO ({0}/{1})",
"TOUT VENDRE ({0}/{1})",
"ALLES VERKAUFEN ({0}/{1})",
"VENDER TUDO ({0}/{1})",
"VENDI TUTTO ({0}/{1})",
"ПРОДАТЬ ВСЁ ({0}/{1})",
"全部卖掉（{0}/{1}）",
"ぜんぶ売る（{0}/{1}）"
],
"TODAY THE CAT WANTS {0}: X2!": [
"HOY EL GATO QUIERE {0}: ¡X2!",
"AUJOURD'HUI LE CHAT VEUT {0}: X2!",
"HEUTE WILL DIE KATZE {0}: X2!",
"HOJE O GATO QUER {0}: X2!",
"OGGI IL GATTO VUOLE {0}: X2!",
"СЕГОДНЯ КОТ ХОЧЕТ {0}: X2!",
"今天猫想要{0}：X2！",
"今日のネコのお目当て：{0} X2！"
],
"SOLD! +{#0} COINS": [
"¡VENDIDO! +{0} MONEDAS",
"VENDU! +{0} PIÈCES",
"VERKAUFT! +{0} MÜNZEN",
"VENDIDO! +{0} MOEDAS",
"VENDUTO! +{0} MONETE",
"ПРОДАНО! +{0} МОНЕТ",
"卖掉了！+{0}金币",
"売れた！+{0}コイン"
],
"{0} X{#1}": [
"{0} X{1}",
"{0} X{1}",
"{0} X{1}",
"{0} X{1}",
"{0} X{1}",
"{0} X{1}",
"{0} X{1}",
"{0} X{1}"
],
"WANTED TODAY! DOUBLE PRICE.": [
"¡BUSCADO HOY! PRECIO DOBLE.",
"DEMANDÉ AUJOURD'HUI! PRIX DOUBLE.",
"HEUTE GESUCHT! DOPPELTER PREIS.",
"PROCURADO HOJE! PREÇO A DOBRAR.",
"RICERCATO OGGI! PREZZO DOPPIO.",
"СЕГОДНЯ В ЦЕНЕ! ДВОЙНАЯ ЦЕНА.",
"今日抢手！双倍价格。",
"今日の人気！2倍の値段。"
],
"LEAVE": [
"SALIR",
"PARTIR",
"GEHEN",
"SAIR",
"ESCI",
"УЙТИ",
"离开",
"出る"
],
"YOU NEED A ROWBOAT": [
"NECESITAS UN BOTE",
"IL TE FAUT UNE BARQUE",
"DU BRAUCHST EIN RUDERBOOT",
"PRECISAS DE UM BARCO",
"TI SERVE UNA BARCA",
"НУЖНА ЛОДКА",
"你需要一艘小划艇",
"ボートが必要だよ"
],
"DEFEAT {0} FIRST": [
"PRIMERO DERROTA A {0}",
"BATS D'ABORD {0}",
"BESIEGE ZUERST {0}",
"PRIMEIRO DERROTA {0}",
"PRIMA SCONFIGGI {0}",
"СНАЧАЛА ПОБЕДИ: {0}",
"先打败{0}",
"まず{0}を倒そう"
],
"WELL DONE! HERE, TAKE THIS.": [
"¡BIEN HECHO! TOMA, PARA TI.",
"BIEN JOUÉ! TIENS, PRENDS ÇA.",
"GUT GEMACHT! HIER, NIMM DAS.",
"MUITO BEM! TOMA, É PARA TI.",
"BEN FATTO! TIENI, PRENDI.",
"МОЛОДЕЦ! ВОТ, ДЕРЖИ.",
"干得好！给，拿着。",
"よくやった！ほれ、これをやろう。"
],
"REWARD: +{#0} COINS": [
"RECOMPENSA: +{0} MONEDAS",
"RÉCOMPENSE: +{0} PIÈCES",
"BELOHNUNG: +{0} MÜNZEN",
"RECOMPENSA: +{0} MOEDAS",
"RICOMPENSA: +{0} MONETE",
"НАГРАДА: +{0} МОНЕТ",
"奖励：+{0}金币",
"ほうび：+{0}コイン"
],
"REWARD: +{#0} COINS +3 GLOW BAIT": [
"RECOMPENSA: +{0} MONEDAS +3 CEBO BRILLANTE",
"RÉCOMPENSE: +{0} PIÈCES +3 APPÂTS LUMINEUX",
"BELOHNUNG: +{0} MÜNZEN +3 LEUCHTKÖDER",
"RECOMPENSA: +{0} MOEDAS +3 ISCO BRILHANTE",
"RICOMPENSA: +{0} MONETE +3 ESCA LUMINOSA",
"НАГРАДА: +{0} МОНЕТ +3 СВЕТ. НАЖИВКИ",
"奖励：+{0}金币 +3荧光饵",
"ほうび：+{0}コイン +光るエサ3"
],
"AND ANOTHER THING...": [
"Y OTRA COSA...",
"ET AUTRE CHOSE...",
"UND NOCH WAS...",
"E OUTRA COISA...",
"E UN'ALTRA COSA...",
"И ЕЩЁ КОЕ-ЧТО...",
"还有一件事……",
"それからもうひとつ…"
],
"OLD SALT IS BACK AT THE PIER": [
"LOBO DE MAR ESTÁ EN EL MUELLE",
"LE VIEUX LOUP EST AU PONTON",
"DER SEEBÄR IST AM STEG",
"O VELHO LOBO ESTÁ NO CAIS",
"IL VECCHIO LUPO È AL MOLO",
"МОРЯК ЖДЁТ НА ПРИЧАЛЕ",
"老水手在码头等你",
"老船乗りは桟橋にいるよ"
],
"BUY A ROWBOAT AT THE SHOP FIRST (GEAR TAB)": [
"COMPRA UN BOTE EN LA TIENDA (PESTAÑA EQUIPO)",
"ACHÈTE UNE BARQUE À LA BOUTIQUE (ONGLET MATÉRIEL)",
"KAUF ERST EIN RUDERBOOT IM LADEN (AUSRÜSTUNG)",
"COMPRA UM BARCO NA LOJA (EQUIPAMENTO)",
"COMPRA UNA BARCA AL NEGOZIO (ATTREZZI)",
"КУПИ ЛОДКУ В ЛАВКЕ (СНАСТИ)",
"先在商店买艘小划艇（装备页）",
"まずショップでボートを買おう（そうび）"
],
"HOLD SPACE TO CAST   1-3 BAIT   Q QUEST   ESC MENU": [
"MANTÉN ESPACIO: LANZAR  1-3 CEBO  Q MISIÓN  ESC MENÚ",
"MAINTIENS ESPACE: LANCER  1-3 APPÂT  Q QUÊTE  ÉCHAP MENU",
"LEERTASTE: WERFEN  1-3 KÖDER  Q AUFTRAG  ESC MENÜ",
"SEGURA ESPAÇO: LANÇAR  1-3 ISCO  Q MISSÃO  ESC MENU",
"TIENI SPAZIO: LANCIA  1-3 ESCA  Q MISSIONE  ESC MENU",
"ДЕРЖИ ПРОБЕЛ: ЗАБРОС  1-3 НАЖИВКА  Q ЗАДАНИЕ  ESC МЕНЮ",
"按住空格抛竿  1-3 鱼饵  Q 任务  ESC 菜单",
"スペース長押しで投げる  1-3 エサ  Q クエスト  ESC メニュー"
],
"P1: HOLD SPACE   P2: HOLD ENTER   TO CAST": [
"P1: MANTÉN ESPACIO   P2: MANTÉN ENTER   PARA LANZAR",
"P1: MAINTIENS ESPACE   P2: MAINTIENS ENTRÉE   POUR LANCER",
"P1: LEERTASTE   P2: ENTER   HALTEN ZUM WERFEN",
"P1: SEGURA ESPAÇO   P2: SEGURA ENTER   PARA LANÇAR",
"P1: TIENI SPAZIO   P2: TIENI INVIO   PER LANCIARE",
"P1: ПРОБЕЛ   P2: ENTER   ДЕРЖИ ДЛЯ ЗАБРОСА",
"P1：按住空格   P2：按住回车   抛竿",
"P1：スペース長押し   P2：ENTER長押し   で投げる"
],
"RELEASE TO CAST!": [
"¡SUELTA PARA LANZAR!",
"LÂCHE POUR LANCER!",
"LOSLASSEN ZUM WERFEN!",
"SOLTA PARA LANÇAR!",
"RILASCIA PER LANCIARE!",
"ОТПУСТИ ДЛЯ ЗАБРОСА!",
"松开抛竿！",
"はなして投げる！"
],
"PRESS NOW!!": [
"¡¡PULSA YA!!",
"APPUIE MAINTENANT!!",
"JETZT DRÜCKEN!!",
"CARREGA JÁ!!",
"PREMI ORA!!",
"ЖМИ СЕЙЧАС!!",
"快按！！",
"いま押して！！"
],
"WAIT FOR A BITE...  (PRESS TO REEL IN)": [
"ESPERA A QUE PIQUE...  (PULSA PARA RECOGER)",
"ATTENDS UNE TOUCHE...  (APPUIE POUR RAMENER)",
"WARTE AUF EINEN BISS...  (DRÜCKEN: EINHOLEN)",
"ESPERA QUE MORDA...  (CARREGA PARA RECOLHER)",
"ASPETTA CHE ABBOCCHI...  (PREMI PER RECUPERARE)",
"ЖДИ ПОКЛЁВКУ...  (ЖМИ, ЧТОБЫ СМОТАТЬ)",
"等鱼咬钩……（按键收回）",
"アタリを待とう…（押すと回収）"
],
"HOLD ON!!!": [
"¡¡AGUANTA!!!",
"TIENS BON!!!",
"FESTHALTEN!!!",
"AGUENTA!!!",
"RESISTI!!!",
"ДЕРЖИСЬ!!!",
"坚持住！！！",
"がんばれ！！！"
],
"HOLD TO REEL - LET GO IF TENSION GETS HIGH": [
"MANTÉN PARA RECOGER - SUELTA SI LA TENSIÓN SUBE",
"MAINTIENS POUR MOULINER - LÂCHE SI ÇA TIRE TROP",
"HALTEN ZUM EINHOLEN - LOSLASSEN BEI HOHER SPANNUNG",
"SEGURA PARA RECOLHER - SOLTA SE A TENSÃO SUBIR",
"TIENI PER RIAVVOLGERE - MOLLA SE LA TENSIONE SALE",
"ДЕРЖИ, ЧТОБЫ ТЯНУТЬ - ОТПУСКАЙ ПРИ НАТЯЖЕНИИ",
"按住收线 - 拉力太高就松手",
"長押しで巻く - テンションが高ければはなす"
],
"WAIT FOR THE BOBBER TO DUNK, THEN PRESS!": [
"ESPERA A QUE SE HUNDA EL CORCHO Y ¡PULSA!",
"ATTENDS QUE LE FLOTTEUR PLONGE, PUIS APPUIE!",
"WARTE, BIS DER SCHWIMMER TAUCHT, DANN DRÜCKEN!",
"ESPERA QUE A BOIA AFUNDE E CARREGA!",
"ASPETTA CHE IL GALLEGGIANTE AFFONDI, POI PREMI!",
"ЖДИ, ПОКА ПОПЛАВОК НЫРНЁТ, ПОТОМ ЖМИ!",
"等浮漂沉下去，然后按！",
"ウキが沈んだら押そう！"
],
"WANTED:{0}": [
"BUSCADO:{0}",
"DEMANDE:{0}",
"GESUCHT:{0}",
"PROCURA:{0}",
"RICHIESTO:{0}",
"СПРОС:{0}",
"抢手：{0}",
"人気：{0}"
],
"DONE! SEE OLD SALT": [
"¡HECHO! VE CON LOBO DE MAR",
"FINI! VOIS LE VIEUX LOUP",
"FERTIG! ZUM SEEBÄR",
"FEITO! VAI AO VELHO LOBO",
"FATTO! VAI DAL VECCHIO LUPO",
"ГОТОВО! К МОРЯКУ",
"完成！去找老水手",
"達成！老船乗りへ"
],
"{0} {#1}/{#2}": [
"{0} {1}/{2}",
"{0} {1}/{2}",
"{0} {1}/{2}",
"{0} {1}/{2}",
"{0} {1}/{2}",
"{0} {1}/{2}",
"{0} {1}/{2}",
"{0} {1}/{2}"
],
"DAY {#0}": [
"DÍA {0}",
"JOUR {0}",
"TAG {0}",
"DIA {0}",
"GIORNO {0}",
"ДЕНЬ {0}",
"第{0}天",
"{0}日目"
],
"FRENZY {#0}": [
"FRENESÍ {0}",
"FRÉNÉSIE {0}",
"RAUSCH {0}",
"FRENESIM {0}",
"FRENESIA {0}",
"ЖОР {0}",
"狂潮 {0}",
"食いつき {0}"
],
"TREASURE MAP!": [
"¡MAPA DEL TESORO!",
"CARTE AU TRÉSOR!",
"SCHATZKARTE!",
"MAPA DO TESOURO!",
"MAPPA DEL TESORO!",
"КАРТА СОКРОВИЩ!",
"藏宝图！",
"宝の地図！"
],
"SHOP (B)": [
"TIENDA (B)",
"BOUTIQUE (B)",
"LADEN (B)",
"LOJA (B)",
"NEGOZIO (B)",
"ЛАВКА (B)",
"商店（B）",
"ショップ（B）"
],
"JOURNAL (J)": [
"DIARIO (J)",
"JOURNAL (J)",
"TAGEBUCH (J)",
"DIÁRIO (J)",
"DIARIO (J)",
"ЖУРНАЛ (J)",
"图鉴（J）",
"ずかん（J）"
],
"AQUARIUM (A)": [
"ACUARIO (A)",
"AQUARIUM (A)",
"AQUARIUM (A)",
"AQUÁRIO (A)",
"ACQUARIO (A)",
"АКВАРИУМ (A)",
"水族箱（A）",
"水そう（A）"
],
"AQUARIUM": [
"ACUARIO",
"AQUARIUM",
"AQUARIUM",
"AQUÁRIO",
"ACQUARIO",
"АКВАРИУМ",
"水族箱",
"水そう"
],
"TRAVEL (T)": [
"VIAJAR (T)",
"VOYAGE (T)",
"REISEN (T)",
"VIAJAR (T)",
"VIAGGIO (T)",
"ПУТЬ (T)",
"旅行（T）",
"旅（T）"
],
"TENSION": [
"TENSIÓN",
"TENSION",
"SPANNUNG",
"TENSÃO",
"TENSIONE",
"НАТЯЖЕНИЕ",
"拉力",
"テンション"
],
"P{#0} TENSION": [
"P{0} TENSIÓN",
"P{0} TENSION",
"P{0} SPANNUNG",
"P{0} TENSÃO",
"P{0} TENSIONE",
"P{0} НАТЯЖЕНИЕ",
"P{0} 拉力",
"P{0} テンション"
],
"LINE": [
"SEDAL",
"FIL",
"SCHNUR",
"LINHA",
"LENZA",
"ЛЕСКА",
"线",
"糸"
],
"POWER": [
"FUERZA",
"PUISSANCE",
"KRAFT",
"FORÇA",
"POTENZA",
"СИЛА",
"力量",
"パワー"
],
"MESSAGE IN A BOTTLE": [
"MENSAJE EN UNA BOTELLA",
"BOUTEILLE À LA MER",
"FLASCHENPOST",
"MENSAGEM NUMA GARRAFA",
"MESSAGGIO IN BOTTIGLIA",
"ПОСЛАНИЕ В БУТЫЛКЕ",
"瓶中信",
"ビンの手紙"
],
"SPACE": [
"ESPACIO",
"ESPACE",
"LEERTASTE",
"ESPAÇO",
"SPAZIO",
"ПРОБЕЛ",
"空格",
"スペース"
],
"CAUGHT": [
"CAPTURA",
"PRISE",
"GEFANGEN",
"APANHADO",
"PESCATO",
"ПОЙМАНО",
"钓到了",
"釣れた"
],
"P{#0} CAUGHT": [
"P{0} CAPTURA",
"P{0} PRISE",
"P{0} GEFANGEN",
"P{0} APANHADO",
"P{0} PESCATO",
"P{0} ПОЙМАНО",
"P{0} 钓到了",
"P{0} 釣れた"
],
"{#0} CM": [
"{0} CM",
"{0} CM",
"{0} CM",
"{0} CM",
"{0} CM",
"{0} СМ",
"{0}厘米",
"{0}CM"
],
"WORTH {#0}": [
"VALE {0}",
"VAUT {0}",
"WERT {0}",
"VALE {0}",
"VALE {0}",
"ЦЕНА {0}",
"价值 {0}",
"ねだん {0}"
],
"WORTH {#0} WANTED!": [
"VALE {0} ¡BUSCADO!",
"VAUT {0} DEMANDÉ!",
"WERT {0} GESUCHT!",
"VALE {0} PROCURADO!",
"VALE {0} RICHIESTO!",
"ЦЕНА {0} В СПРОСЕ!",
"价值 {0} 抢手！",
"ねだん {0} 人気！"
],
"COOLER FULL: RELEASED": [
"NEVERA LLENA: LIBERADO",
"GLACIÈRE PLEINE: RELÂCHÉ",
"KÜHLBOX VOLL: FREIGELASSEN",
"GELEIRA CHEIA: SOLTO",
"FRIGO PIENO: LIBERATO",
"ХОЛОДИЛЬНИК ПОЛОН: ОТПУЩЕНА",
"冷藏箱满了：放生",
"クーラー満杯：リリース"
],
"INTO THE COOLER": [
"A LA NEVERA",
"DANS LA GLACIÈRE",
"IN DIE KÜHLBOX",
"PARA A GELEIRA",
"NEL FRIGO",
"В ХОЛОДИЛЬНИК",
"放进冷藏箱",
"クーラーへ"
],
"NEW!": [
"¡NUEVO!",
"NOUVEAU!",
"NEU!",
"NOVO!",
"NUOVO!",
"НОВАЯ!",
"新！",
"NEW！"
],
"RECORD!": [
"¡RÉCORD!",
"RECORD!",
"REKORD!",
"RECORDE!",
"RECORD!",
"РЕКОРД!",
"纪录！",
"新記録！"
],
"THE CAT'S SHOP": [
"LA TIENDA DEL GATO",
"LA BOUTIQUE DU CHAT",
"DER KATZENLADEN",
"A LOJA DO GATO",
"IL NEGOZIO DEL GATTO",
"ЛАВКА КОТА",
"猫咪商店",
"ネコのお店"
],
"BAIT": [
"CEBO",
"APPÂTS",
"KÖDER",
"ISCO",
"ESCHE",
"НАЖИВКА",
"鱼饵",
"エサ"
],
"GEAR": [
"EQUIPO",
"MATÉRIEL",
"AUSRÜSTUNG",
"EQUIPAMENTO",
"ATTREZZI",
"СНАСТИ",
"装备",
"そうび"
],
"STYLE": [
"ESTILO",
"STYLE",
"STIL",
"ESTILO",
"STILE",
"СТИЛЬ",
"造型",
"おしゃれ"
],
"DECOR": [
"DECORACIÓN",
"DÉCOR",
"DEKO",
"DECORAÇÃO",
"ARREDI",
"ДЕКОР",
"装饰",
"かざり"
],
"SELL": [
"VENDER",
"VENDRE",
"VERKAUF",
"VENDER",
"VENDI",
"ПРОДАТЬ",
"出售",
"売る"
],
"V MORE": [
"V MÁS",
"V PLUS",
"V MEHR",
"V MAIS",
"V ALTRO",
"V ЕЩЁ",
"V 更多",
"V もっと"
],
"ARROWS: TAB / ITEM   SPACE: BUY   ESC: LEAVE": [
"FLECHAS: PESTAÑA/OBJETO  ESPACIO: COMPRAR  ESC: SALIR",
"FLÈCHES: ONGLET/ARTICLE  ESPACE: ACHETER  ÉCHAP: PARTIR",
"PFEILE: REITER/ARTIKEL  LEER: KAUFEN  ESC: GEHEN",
"SETAS: SEPARADOR/ITEM  ESPAÇO: COMPRAR  ESC: SAIR",
"FRECCE: SCHEDA/OGGETTO  SPAZIO: COMPRA  ESC: ESCI",
"СТРЕЛКИ: ВКЛАДКА/ТОВАР  ПРОБЕЛ: КУПИТЬ  ESC: УЙТИ",
"方向键：分页/物品   空格：购买   ESC：离开",
"矢印：タブ/品物   スペース：買う   ESC：出る"
],
"PIER FISH": [
"PECES MUELLE",
"POISSONS PONTON",
"STEG-FISCHE",
"PEIXES DO CAIS",
"PESCI DEL MOLO",
"РЫБЫ ПРИЧАЛА",
"码头鱼",
"桟橋の魚"
],
"FARAWAY FISH": [
"PECES LEJANOS",
"POISSONS LOIN",
"FERNE FISCHE",
"PEIXES LONGE",
"PESCI LONTANI",
"ДАЛЬНИЕ РЫБЫ",
"远方鱼",
"遠くの魚"
],
"TROPHIES": [
"TROFEOS",
"TROPHÉES",
"TROPHÄEN",
"TROFÉUS",
"TROFEI",
"ТРОФЕИ",
"收藏品",
"トロフィー"
],
"{#0}/{#1} FISH": [
"{0}/{1} PECES",
"{0}/{1} POISSONS",
"{0}/{1} FISCHE",
"{0}/{1} PEIXES",
"{0}/{1} PESCI",
"{0}/{1} РЫБ",
"{0}/{1} 种鱼",
"{0}/{1} 種"
],
"{#0} FISH": [
"{0} PECES",
"{0} POISSONS",
"{0} FISCHE",
"{0} PEIXES",
"{0} PESCI",
"{0} РЫБ",
"{0} 条鱼",
"{0} 匹"
],
"CAUGHT: {#0}   BEST: {#1} CM": [
"PESCADOS: {0}   RÉCORD: {1} CM",
"PRIS: {0}   RECORD: {1} CM",
"GEFANGEN: {0}   BESTER: {1} CM",
"APANHADOS: {0}   RECORDE: {1} CM",
"PESCATI: {0}   RECORD: {1} CM",
"ПОЙМАНО: {0}   РЕКОРД: {1} СМ",
"钓到：{0}   最大：{1}厘米",
"釣った数：{0}   最大：{1}CM"
],
"~{#0}  WANTED TODAY: X2!": [
"~{0}  BUSCADO HOY: ¡X2!",
"~{0}  DEMANDÉ AUJOURD'HUI: X2!",
"~{0}  HEUTE GESUCHT: X2!",
"~{0}  PROCURADO HOJE: X2!",
"~{0}  RICHIESTO OGGI: X2!",
"~{0}  СЕГОДНЯ В СПРОСЕ: X2!",
"~{0}  今日抢手：X2！",
"~{0}  今日の人気：X2！"
],
"NEEDS A BETTER ROD": [
"NECESITA UNA CAÑA MEJOR",
"IL FAUT UNE MEILLEURE CANNE",
"BRAUCHT EINE BESSERE ANGEL",
"PRECISA DE UMA CANA MELHOR",
"SERVE UNA CANNA MIGLIORE",
"НУЖНА УДОЧКА ЛУЧШЕ",
"需要更好的鱼竿",
"もっといい竿が必要"
],
"FOUND AT A FARAWAY SPOT": [
"VIVE EN UN LUGAR LEJANO",
"VIT DANS UN COIN LOINTAIN",
"LEBT AN EINEM FERNEN ORT",
"VIVE NUM LOCAL DISTANTE",
"VIVE IN UN POSTO LONTANO",
"ВОДИТСЯ В ДАЛЁКИХ МЕСТАХ",
"生活在远方的钓点",
"遠くの釣り場にいる"
],
"NOT CAUGHT YET": [
"AÚN NO PESCADO",
"PAS ENCORE PRIS",
"NOCH NICHT GEFANGEN",
"AINDA NÃO APANHADO",
"NON ANCORA PESCATO",
"ЕЩЁ НЕ ПОЙМАНА",
"还没钓到",
"まだ釣っていない"
],
"A FULL ROW = +100 COINS": [
"FILA COMPLETA = +100 MONEDAS",
"LIGNE COMPLÈTE = +100 PIÈCES",
"VOLLE REIHE = +100 MÜNZEN",
"LINHA COMPLETA = +100 MOEDAS",
"RIGA COMPLETA = +100 MONETE",
"ПОЛНЫЙ РЯД = +100 МОНЕТ",
"一整行 = +100金币",
"1列そろうと +100コイン"
],
"TAB: PAGE   ESC: CLOSE": [
"TAB: PÁGINA   ESC: CERRAR",
"TAB: PAGE   ÉCHAP: FERMER",
"TAB: SEITE   ESC: SCHLIESSEN",
"TAB: PÁGINA   ESC: FECHAR",
"TAB: PAGINA   ESC: CHIUDI",
"TAB: СТРАНИЦА   ESC: ЗАКРЫТЬ",
"TAB：翻页   ESC：关闭",
"TAB：ページ   ESC：とじる"
],
"RODS": [
"CAÑAS",
"CANNES",
"ANGELN",
"CANAS",
"CANNE",
"УДОЧКИ",
"鱼竿",
"釣り竿"
],
"CHARMS": [
"AMULETOS",
"AMULETTES",
"TALISMANE",
"AMULETOS",
"AMULETI",
"АМУЛЕТЫ",
"护身符",
"お守り"
],
"SEA BEASTS": [
"BESTIAS MARINAS",
"BÊTES DES MERS",
"SEEUNGEHEUER",
"FERAS MARINHAS",
"BESTIE MARINE",
"МОРСКИЕ ЧУДОВИЩА",
"海洋巨兽",
"海の怪物"
],
"DAYS: {#0}   CATCHES: {#1}   QUESTS: {#2}": [
"DÍAS {0}  PECES {1}  MISIONES {2}",
"JOURS {0}  PRISES {1}  QUÊTES {2}",
"TAGE {0}  FÄNGE {1}  AUFTR. {2}",
"DIAS {0}  PEIXES {1}  MISSÕES {2}",
"GIORNI {0}  PESCI {1}  MISS. {2}",
"ДНИ {0}  УЛОВ {1}  ЗАДАНИЯ {2}",
"天数{0}  渔获{1}  任务{2}",
"{0}日  釣果{1}  クエスト{2}"
],
"BEAST TROPHIES: {#0}/{#1}": [
"TROFEOS DE BESTIAS: {0}/{1}",
"TROPHÉES DE BÊTES: {0}/{1}",
"MONSTER-TROPHÄEN: {0}/{1}",
"TROFÉUS DE FERAS: {0}/{1}",
"TROFEI BESTIE: {0}/{1}",
"ТРОФЕИ ЧУДОВИЩ: {0}/{1}",
"巨兽收藏：{0}/{1}",
"怪物トロフィー：{0}/{1}"
],
"PIER": [
"MUELLE",
"PONTON",
"STEG",
"CAIS",
"MOLO",
"ПРИЧАЛ",
"码头",
"桟橋"
],
"WRECK": [
"NAUFRAGIO",
"ÉPAVE",
"WRACK",
"NAUFRÁGIO",
"RELITTO",
"КОРАБЛЬ",
"沉船",
"難破船"
],
"ICE": [
"HIELO",
"GLACE",
"EIS",
"GELO",
"GHIACCIO",
"ЛЁД",
"冰湖",
"氷"
],
"VOLCANO": [
"VOLCÁN",
"VOLCAN",
"VULKAN",
"VULCÃO",
"VULCANO",
"ВУЛКАН",
"火山",
"火山"
],
"YOUR AQUARIUM": [
"TU ACUARIO",
"TON AQUARIUM",
"DEIN AQUARIUM",
"O TEU AQUÁRIO",
"IL TUO ACQUARIO",
"ТВОЙ АКВАРИУМ",
"你的水族箱",
"きみの水そう"
],
"CATCH SOME FISH TO FILL IT!": [
"¡PESCA PECES PARA LLENARLO!",
"ATTRAPE DES POISSONS POUR LE REMPLIR!",
"FANG FISCHE, UM ES ZU FÜLLEN!",
"APANHA PEIXES PARA O ENCHER!",
"PESCA QUALCOSA PER RIEMPIRLO!",
"ЛОВИ РЫБУ, ЧТОБЫ ЗАПОЛНИТЬ ЕГО!",
"钓些鱼来装满它吧！",
"魚を釣って水そうをいっぱいにしよう！"
],
"BUY DECORATIONS AT THE SHOP": [
"COMPRA ADORNOS EN LA TIENDA",
"ACHÈTE DES DÉCORS À LA BOUTIQUE",
"KAUF DEKO IM LADEN",
"COMPRA DECORAÇÕES NA LOJA",
"COMPRA ARREDI AL NEGOZIO",
"КУПИ ДЕКОР В ЛАВКЕ",
"在商店买装饰品",
"ショップでかざりを買おう"
],
"BUY A ROWBOAT FIRST.": [
"PRIMERO COMPRA UN BOTE.",
"ACHÈTE D'ABORD UNE BARQUE.",
"KAUF ERST EIN RUDERBOOT.",
"PRIMEIRO COMPRA UM BARCO.",
"PRIMA COMPRA UNA BARCA.",
"СНАЧАЛА КУПИ ЛОДКУ.",
"先买一艘小划艇。",
"まずボートを買おう。"
],
"DEFEAT {0} TO FIND THIS PLACE.": [
"DERROTA A {0} PARA HALLAR ESTE LUGAR.",
"BATS {0} POUR TROUVER CET ENDROIT.",
"BESIEGE {0}, UM DIESEN ORT ZU FINDEN.",
"DERROTA {0} PARA ENCONTRAR ESTE LOCAL.",
"SCONFIGGI {0} PER TROVARE QUESTO POSTO.",
"ПОБЕДИ {0}, ЧТОБЫ НАЙТИ ЭТО МЕСТО.",
"打败{0}才能找到这里。",
"{0}を倒すと見つかるよ。"
],
"ARROWS + SPACE TO ROW THERE   ESC: CLOSE": [
"FLECHAS + ESPACIO PARA REMAR   ESC: CERRAR",
"FLÈCHES + ESPACE POUR RAMER   ÉCHAP: FERMER",
"PFEILE + LEER ZUM RUDERN   ESC: SCHLIESSEN",
"SETAS + ESPAÇO PARA REMAR   ESC: FECHAR",
"FRECCE + SPAZIO PER REMARE   ESC: CHIUDI",
"СТРЕЛКИ + ПРОБЕЛ - ПЛЫТЬ   ESC: ЗАКРЫТЬ",
"方向键+空格划过去   ESC：关闭",
"矢印+スペースでこいで行く   ESC：とじる"
],
"SUNNY PIER": [
"MUELLE SOLEADO",
"PONTON ENSOLEILLÉ",
"SONNENSTEG",
"CAIS SOLARENGO",
"MOLO SOLEGGIATO",
"СОЛНЕЧНЫЙ ПРИЧАЛ",
"阳光码头",
"ひなたの桟橋"
],
"SHIPWRECK COVE": [
"CALA DEL NAUFRAGIO",
"CRIQUE DE L'ÉPAVE",
"WRACKBUCHT",
"ENSEADA DO NAUFRÁGIO",
"CALA DEL RELITTO",
"БУХТА КРУШЕНИЯ",
"沉船湾",
"難破船の入り江"
],
"FROSTBITE LAKE": [
"LAGO ESCARCHA",
"LAC GIVRÉ",
"FROSTBISS-SEE",
"LAGO GELADO",
"LAGO GELIDO",
"ЛЕДЯНОЕ ОЗЕРО",
"冰霜湖",
"こおりの湖"
],
"MAGMA LAGOON": [
"LAGUNA DE MAGMA",
"LAGON DE MAGMA",
"MAGMALAGUNE",
"LAGOA DE MAGMA",
"LAGUNA DI MAGMA",
"ЛАГУНА МАГМЫ",
"岩浆泻湖",
"マグマの潟"
],
"HOME SWEET HOME.": [
"HOGAR, DULCE HOGAR.",
"ON EST BIEN CHEZ SOI.",
"TRAUTES HEIM.",
"LAR, DOCE LAR.",
"CASA DOLCE CASA.",
"ДОМ, МИЛЫЙ ДОМ.",
"家，甜蜜的家。",
"やっぱり我が家がいちばん。"
],
"SPOOKY, FOGGY WATER. A GHOST WHALE HAUNTS IT.": [
"AGUAS BRUMOSAS. LAS RONDA UNA BALLENA FANTASMA.",
"EAUX BRUMEUSES, HANTÉES PAR UNE BALEINE FANTÔME.",
"NEBLIGES WASSER. EIN GEISTERWAL SPUKT HIER.",
"ÁGUAS COM NEVOEIRO. HÁ UMA BALEIA FANTASMA.",
"ACQUE NEBBIOSE. C'È UNA BALENA FANTASMA.",
"ТУМАННЫЕ ВОДЫ. ТУТ БРОДИТ КИТ-ПРИЗРАК.",
"阴森多雾的水域，幽灵鲸在此出没。",
"霧の不気味な海。幽霊クジラが出るらしい。"
],
"BRRR! A GIANT CRAB RULES THE ICE.": [
"¡BRRR! UN CANGREJO GIGANTE REINA EN EL HIELO.",
"BRRR! UN CRABE GÉANT RÈGNE SUR LA GLACE.",
"BRRR! EINE RIESENKRABBE HERRSCHT ÜBERS EIS.",
"BRRR! UM CARANGUEJO GIGANTE REINA NO GELO.",
"BRRR! UN GRANCHIO GIGANTE REGNA SUL GHIACCIO.",
"БРРР! НАД ЛЬДОМ ЦАРИТ ГИГАНТСКИЙ КРАБ.",
"好冷！巨型螃蟹统治着冰面。",
"ブルル！巨大ガニが氷を支配している。"
],
"HOT HOT HOT. SOMETHING SLITHERS IN THE LAVA.": [
"QUEMA, QUEMA. ALGO SE ARRASTRA EN LA LAVA.",
"ÇA BRÛLE! QUELQUE CHOSE RAMPE DANS LA LAVE.",
"HEISS! ETWAS SCHLÄNGELT SICH IN DER LAVA.",
"QUE CALOR! ALGO RASTEJA NA LAVA.",
"CHE CALDO! QUALCOSA STRISCIA NELLA LAVA.",
"ЖАРКО! ЧТО-ТО ПОЛЗАЕТ В ЛАВЕ.",
"好烫好烫！有东西在岩浆里游动。",
"アチチ！溶岩の中で何かがうごめく。"
],
"OLD SALT": [
"LOBO DE MAR",
"VIEUX LOUP",
"ALTER SEEBÄR",
"VELHO LOBO",
"VECCHIO LUPO",
"СТАРЫЙ МОРЯК",
"老水手",
"老船乗り"
],
"QUEST:": [
"MISIÓN:",
"QUÊTE:",
"AUFTRAG:",
"MISSÃO:",
"MISSIONE:",
"ЗАДАНИЕ:",
"任务：",
"クエスト："
],
"PROGRESS: {#0}/{#1}": [
"PROGRESO: {0}/{1}",
"PROGRÈS: {0}/{1}",
"FORTSCHRITT: {0}/{1}",
"PROGRESSO: {0}/{1}",
"PROGRESSI: {0}/{1}",
"ПРОГРЕСС: {0}/{1}",
"进度：{0}/{1}",
"しんちょく：{0}/{1}"
],
"{#0} +GLOW BAIT": [
"{0} +CEBO BRILLANTE",
"{0} +APPÂT LUMINEUX",
"{0} +LEUCHTKÖDER",
"{0} +ISCO BRILHANTE",
"{0} +ESCA LUMINOSA",
"{0} +НАЖИВКА",
"{0} +荧光饵",
"{0} +光るエサ"
],
"SPACE: CLAIM REWARD": [
"ESPACIO: RECOGER PREMIO",
"ESPACE: PRENDRE LA RÉCOMPENSE",
"LEER: BELOHNUNG HOLEN",
"ESPAÇO: RECEBER PRÉMIO",
"SPAZIO: RITIRA PREMIO",
"ПРОБЕЛ: ЗАБРАТЬ НАГРАДУ",
"空格：领取奖励",
"スペース：ほうびをもらう"
],
"SPACE: OK": [
"ESPACIO: VALE",
"ESPACE: OK",
"LEER: OK",
"ESPAÇO: OK",
"SPAZIO: OK",
"ПРОБЕЛ: ОК",
"空格：好的",
"スペース：OK"
],
"QUESTS DONE: {#0}": [
"MISIONES HECHAS: {0}",
"QUÊTES FINIES: {0}",
"ERLEDIGT: {0}",
"MISSÕES FEITAS: {0}",
"MISSIONI FATTE: {0}",
"ВЫПОЛНЕНО: {0}",
"已完成任务：{0}",
"達成したクエスト：{0}"
],
"NEW ROD!": [
"¡CAÑA NUEVA!",
"NOUVELLE CANNE!",
"NEUE ANGEL!",
"CANA NOVA!",
"NUOVA CANNA!",
"НОВАЯ УДОЧКА!",
"新鱼竿！",
"新しい竿！"
],
"REEL SPEED X{#0}": [
"VELOCIDAD DE CARRETE X{0}",
"VITESSE DU MOULINET X{0}",
"ROLLTEMPO X{0}",
"VELOCIDADE DO CARRETO X{0}",
"VELOCITÀ MULINELLO X{0}",
"СКОРОСТЬ КАТУШКИ X{0}",
"收线速度 X{0}",
"巻く速さ X{0}"
],
"LINE STRENGTH X{#0}": [
"RESISTENCIA DEL SEDAL X{0}",
"SOLIDITÉ DU FIL X{0}",
"SCHNURSTÄRKE X{0}",
"RESISTÊNCIA DA LINHA X{0}",
"RESISTENZA LENZA X{0}",
"ПРОЧНОСТЬ ЛЕСКИ X{0}",
"线的强度 X{0}",
"糸の強さ X{0}"
],
"LUCK +{#0}%": [
"SUERTE +{0}%",
"CHANCE +{0}%",
"GLÜCK +{0}%",
"SORTE +{0}%",
"FORTUNA +{0}%",
"УДАЧА +{0}%",
"幸运 +{0}%",
"運 +{0}%"
],
"HOOK DAMAGE {#0}": [
"DAÑO DEL ANZUELO {0}",
"DÉGÂTS DE L'HAMEÇON {0}",
"HAKENSCHADEN {0}",
"DANO DO ANZOL {0}",
"DANNO AMO {0}",
"УРОН КРЮЧКА {0}",
"钩子伤害 {0}",
"針のダメージ {0}"
],
"SPECIAL: {0}": [
"ESPECIAL: {0}",
"SPÉCIAL: {0}",
"SPEZIAL: {0}",
"ESPECIAL: {0}",
"SPECIALE: {0}",
"ОСОБОЕ: {0}",
"特技：{0}",
"とくしゅ：{0}"
],
"TWIG ROD": [
"CAÑA DE RAMITA",
"CANNE BRINDILLE",
"ZWEIG-ANGEL",
"CANA DE GRAVETO",
"CANNA RAMETTO",
"УДОЧКА-ВЕТКА",
"树枝鱼竿",
"小枝の竿"
],
"BAMBOO ROD": [
"CAÑA DE BAMBÚ",
"CANNE EN BAMBOU",
"BAMBUSANGEL",
"CANA DE BAMBU",
"CANNA DI BAMBÙ",
"БАМБУКОВАЯ УДОЧКА",
"竹鱼竿",
"竹の竿"
],
"CORAL ROD": [
"CAÑA DE CORAL",
"CANNE DE CORAIL",
"KORALLENANGEL",
"CANA DE CORAL",
"CANNA DI CORALLO",
"КОРАЛЛОВАЯ УДОЧКА",
"珊瑚鱼竿",
"サンゴの竿"
],
"GLOWLIGHT ROD": [
"CAÑA LUMINOSA",
"CANNE LUMINEUSE",
"LEUCHTANGEL",
"CANA LUMINOSA",
"CANNA LUMINOSA",
"СВЕТЯЩАЯСЯ УДОЧКА",
"荧光鱼竿",
"光る竿"
],
"SHARKTOOTH ROD": [
"CAÑA COLMILLO",
"CANNE DENT-DE-REQUIN",
"HAIZAHNANGEL",
"CANA DE TUBARÃO",
"CANNA DI SQUALO",
"УДОЧКА ЗУБ АКУЛЫ",
"鲨齿鱼竿",
"サメの歯の竿"
],
"KRAKEN'S TRIDENT": [
"TRIDENTE DEL KRAKEN",
"TRIDENT DU KRAKEN",
"KRAKEN-DREIZACK",
"TRIDENTE DO KRAKEN",
"TRIDENTE DEL KRAKEN",
"ТРЕЗУБЕЦ КРАКЕНА",
"海怪三叉戟",
"クラーケンの三叉槍"
],
"NONE. IT IS A STICK.": [
"NINGUNO. ES UN PALO.",
"AUCUN. C'EST UN BÂTON.",
"KEINS. ES IST EIN STOCK.",
"NENHUM. É UM PAU.",
"NESSUNO. È UN BASTONE.",
"НЕТ. ЭТО ПАЛКА.",
"没有。它只是根棍子。",
"なし。ただの棒。"
],
"LONG HOOK THROW": [
"LANZAMIENTO LARGO",
"LANCER LONG",
"WEITER HAKENWURF",
"LANÇAMENTO LONGO",
"LANCIO LUNGO",
"ДАЛЬНИЙ БРОСОК",
"甩钩更远",
"針を遠くまで投げる"
],
"HOOK HITS RESTORE AIR": [
"LOS GOLPES DAN AIRE",
"LES COUPS RENDENT DE L'AIR",
"TREFFER GEBEN LUFT",
"ACERTOS DÃO AR",
"I COLPI DANNO ARIA",
"УДАРЫ ДАЮТ ВОЗДУХ",
"击中恢复空气",
"当てると空気回復"
],
"HOMING HOOK + LIGHT": [
"ANZUELO TELEDIRIGIDO + LUZ",
"HAMEÇON GUIDÉ + LUMIÈRE",
"ZIELHAKEN + LICHT",
"ANZOL TELEGUIADO + LUZ",
"AMO A RICERCA + LUCE",
"САМОНАВОДЯЩИЙСЯ КРЮЧОК + СВЕТ",
"追踪鱼钩+照明",
"追尾する針+ライト"
],
"YOUR DASH BITES FOES": [
"TU TURBO MUERDE",
"TON TURBO MORD",
"DEIN SPURT BEISST",
"O TEU TURBO MORDE",
"IL TUO TURBO MORDE",
"РЫВОК КУСАЕТ ВРАГОВ",
"冲刺会咬敌人",
"ダッシュで敵にかみつく"
],
"THROWS 3 HOOKS AT ONCE": [
"LANZA 3 ANZUELOS A LA VEZ",
"LANCE 3 HAMEÇONS À LA FOIS",
"WIRFT 3 HAKEN AUF EINMAL",
"LANÇA 3 ANZÓIS DE UMA VEZ",
"LANCIA 3 AMI INSIEME",
"БРОСАЕТ 3 КРЮЧКА СРАЗУ",
"一次甩出3个钩",
"針を3本同時に投げる"
],
"NEW CHARM!": [
"¡AMULETO NUEVO!",
"NOUVELLE AMULETTE!",
"NEUER TALISMAN!",
"AMULETO NOVO!",
"NUOVO AMULETO!",
"НОВЫЙ АМУЛЕТ!",
"新护身符！",
"新しいお守り！"
],
"ALWAYS ACTIVE. SPACE": [
"SIEMPRE ACTIVO. ESPACIO",
"TOUJOURS ACTIF. ESPACE",
"IMMER AKTIV. LEERTASTE",
"SEMPRE ATIVO. ESPAÇO",
"SEMPRE ATTIVO. SPAZIO",
"ДЕЙСТВУЕТ ВСЕГДА. ПРОБЕЛ",
"永久生效。空格",
"いつでも効果あり。スペース"
],
"GHOST LANTERN": [
"FAROL FANTASMA",
"LANTERNE FANTÔME",
"GEISTERLATERNE",
"LANTERNA FANTASMA",
"LANTERNA FANTASMA",
"ПРИЗРАЧНЫЙ ФОНАРЬ",
"幽灵灯笼",
"幽霊ランタン"
],
"FROST CHARM": [
"AMULETO DE ESCARCHA",
"AMULETTE DE GIVRE",
"FROSTTALISMAN",
"AMULETO DE GELO",
"AMULETO DI BRINA",
"ЛЕДЯНОЙ АМУЛЕТ",
"冰霜护符",
"こおりのお守り"
],
"MAGMA HOOK": [
"ANZUELO DE MAGMA",
"HAMEÇON DE MAGMA",
"MAGMAHAKEN",
"ANZOL DE MAGMA",
"AMO DI MAGMA",
"МАГМОВЫЙ КРЮЧОК",
"岩浆鱼钩",
"マグマの針"
],
"+1 HEART IN EVERY FIGHT": [
"+1 CORAZÓN EN CADA PELEA",
"+1 COEUR À CHAQUE COMBAT",
"+1 HERZ IN JEDEM KAMPF",
"+1 CORAÇÃO EM CADA LUTA",
"+1 CUORE IN OGNI LOTTA",
"+1 СЕРДЦЕ В КАЖДОЙ БИТВЕ",
"每场战斗+1颗心",
"毎バトル ハート+1"
],
"+50% AIR IN EVERY FIGHT": [
"+50% DE AIRE EN CADA PELEA",
"+50% D'AIR À CHAQUE COMBAT",
"+50% LUFT IN JEDEM KAMPF",
"+50% DE AR EM CADA LUTA",
"+50% ARIA IN OGNI LOTTA",
"+50% ВОЗДУХА В КАЖДОЙ БИТВЕ",
"每场战斗空气+50%",
"毎バトル 空気+50%"
],
"+2 HOOK DAMAGE": [
"+2 DE DAÑO DEL ANZUELO",
"+2 DÉGÂTS D'HAMEÇON",
"+2 HAKENSCHADEN",
"+2 DE DANO DO ANZOL",
"+2 DANNO AMO",
"+2 УРОНА КРЮЧКА",
"钩子伤害+2",
"針のダメージ+2"
],
"LEGEND OF THE SEA": [
"LEYENDA DEL MAR",
"LÉGENDE DES MERS",
"LEGENDE DES MEERES",
"LENDA DO MAR",
"LEGGENDA DEL MARE",
"ЛЕГЕНДА МОРЕЙ",
"大海传说",
"海の伝説"
],
"THE KRAKEN IS BEATEN AND THE TRIDENT IS YOURS.": [
"EL KRAKEN HA CAÍDO Y EL TRIDENTE ES TUYO.",
"LE KRAKEN EST VAINCU, LE TRIDENT EST À TOI.",
"DER KRAKE IST BESIEGT, DER DREIZACK GEHÖRT DIR.",
"O KRAKEN FOI VENCIDO E O TRIDENTE É TEU.",
"IL KRAKEN È SCONFITTO E IL TRIDENTE È TUO.",
"КРАКЕН ПОВЕРЖЕН, ТРЕЗУБЕЦ ТВОЙ.",
"海怪被打败了，三叉戟归你了。",
"クラーケンを倒し、三叉槍を手に入れた。"
],
"BUT THE SEA IS BIG...": [
"PERO EL MAR ES GRANDE...",
"MAIS LA MER EST GRANDE...",
"ABER DAS MEER IST GROSS...",
"MAS O MAR É GRANDE...",
"MA IL MARE È GRANDE...",
"НО МОРЕ ВЕЛИКО...",
"但大海很大……",
"でも海は広い…"
],
"ROW TO FARAWAY SPOTS (T) TO FIND NEW": [
"REMA A LUGARES LEJANOS (T) PARA HALLAR",
"RAME VERS DES COINS LOINTAINS (T): NOUVEAUX",
"RUDERE ZU FERNEN ORTEN (T) FÜR NEUE",
"REMA PARA LOCAIS DISTANTES (T): NOVOS",
"REMA VERSO POSTI LONTANI (T) PER NUOVI",
"ПЛЫВИ ДАЛЕКО (T), ТАМ ЖДУТ НОВЫЕ",
"划去远方的钓点（T）寻找新的",
"遠くの釣り場（T）へこぎ出して、新しい"
],
"FISH AND THREE MORE SEA BEASTS.": [
"PECES NUEVOS Y TRES BESTIAS MÁS.",
"POISSONS ET TROIS AUTRES BÊTES.",
"FISCHE UND DREI WEITERE UNGEHEUER.",
"PEIXES E MAIS TRÊS FERAS.",
"PESCI E ALTRE TRE BESTIE.",
"РЫБЫ И ЕЩЁ ТРИ ЧУДОВИЩА.",
"鱼和另外三只海洋巨兽。",
"魚とあと3体の怪物を見つけよう。"
],
"OLD BEASTS MAY RETURN - WITH TREASURE!": [
"LAS BESTIAS PUEDEN VOLVER... ¡CON TESOROS!",
"LES BÊTES PEUVENT REVENIR, AVEC DES TRÉSORS!",
"ALTE UNGEHEUER KEHREN ZURÜCK - MIT SCHÄTZEN!",
"AS FERAS PODEM VOLTAR - COM TESOUROS!",
"LE BESTIE POSSONO TORNARE - CON TESORI!",
"ЧУДОВИЩА ВЕРНУТСЯ - С СОКРОВИЩАМИ!",
"老巨兽可能会回来——带着宝藏！",
"昔の怪物がまた来るかも——宝物を持って！"
],
"CLEAR SKIES": [
"CIELO DESPEJADO",
"CIEL DÉGAGÉ",
"KLARER HIMMEL",
"CÉU LIMPO",
"CIELO SERENO",
"ЯСНО",
"晴朗",
"快晴"
],
"A LOVELY DAY FOR FISHING.": [
"UN DÍA PRECIOSO PARA PESCAR.",
"UNE BELLE JOURNÉE POUR PÊCHER.",
"EIN HERRLICHER ANGELTAG.",
"UM DIA LINDO PARA PESCAR.",
"UNA BELLA GIORNATA PER PESCARE.",
"ЧУДЕСНЫЙ ДЕНЬ ДЛЯ РЫБАЛКИ.",
"钓鱼的好天气。",
"釣り日和だ。"
],
"CLOUDY": [
"NUBLADO",
"NUAGEUX",
"BEWÖLKT",
"NUBLADO",
"NUVOLOSO",
"ОБЛАЧНО",
"多云",
"くもり"
],
"FISH ARE A LITTLE HUNGRIER.": [
"LOS PECES TIENEN MÁS HAMBRE.",
"LES POISSONS ONT UN PEU PLUS FAIM.",
"FISCHE SIND ETWAS HUNGRIGER.",
"OS PEIXES TÊM MAIS FOME.",
"I PESCI HANNO PIÙ FAME.",
"РЫБА ЧУТЬ ГОЛОДНЕЕ.",
"鱼儿更饿了一点。",
"魚が少しおなかをすかせている。"
],
"RAIN": [
"LLUVIA",
"PLUIE",
"REGEN",
"CHUVA",
"PIOGGIA",
"ДОЖДЬ",
"下雨",
"雨"
],
"FISH BITE MUCH FASTER IN THE RAIN!": [
"¡CON LLUVIA PICAN MUCHO MÁS RÁPIDO!",
"SOUS LA PLUIE, ÇA MORD BIEN PLUS VITE!",
"IM REGEN BEISSEN FISCHE VIEL SCHNELLER!",
"À CHUVA OS PEIXES MORDEM MAIS DEPRESSA!",
"CON LA PIOGGIA ABBOCCANO MOLTO PRIMA!",
"В ДОЖДЬ КЛЮЁТ ГОРАЗДО БЫСТРЕЕ!",
"下雨时鱼咬钩快多了！",
"雨の日は魚がどんどん食いつく！"
],
"THUNDERSTORM": [
"TORMENTA",
"ORAGE",
"GEWITTER",
"TROVOADA",
"TEMPORALE",
"ГРОЗА",
"雷暴",
"かみなり"
],
"HUGE SHADOWS LOVE STORMS...": [
"A LAS SOMBRAS GIGANTES LES ENCANTAN LAS TORMENTAS...",
"LES GRANDES OMBRES ADORENT LES ORAGES...",
"RIESENSCHATTEN LIEBEN STÜRME...",
"AS SOMBRAS GIGANTES ADORAM TEMPESTADES...",
"LE OMBRE ENORMI AMANO I TEMPORALI...",
"ОГРОМНЫЕ ТЕНИ ЛЮБЯТ ГРОЗУ...",
"巨大的影子喜欢暴风雨……",
"巨大な影は嵐が好き…"
],
"FOG": [
"NIEBLA",
"BROUILLARD",
"NEBEL",
"NEVOEIRO",
"NEBBIA",
"ТУМАН",
"大雾",
"霧"
],
"RARE FISH COME OUT IN THE FOG.": [
"CON NIEBLA SALEN PECES RAROS.",
"LES POISSONS RARES SORTENT DANS LE BROUILLARD.",
"IM NEBEL KOMMEN SELTENE FISCHE.",
"NO NEVOEIRO SAEM PEIXES RAROS.",
"CON LA NEBBIA ESCONO PESCI RARI.",
"В ТУМАНЕ ВЫХОДИТ РЕДКАЯ РЫБА.",
"雾里会出现稀有鱼。",
"霧の日はレア魚が出てくる。"
],
"SNOW": [
"NIEVE",
"NEIGE",
"SCHNEE",
"NEVE",
"NEVE",
"СНЕГ",
"下雪",
"雪"
],
"QUIET SNOW. RARE FISH STIR.": [
"NIEVE TRANQUILA. SE MUEVEN PECES RAROS.",
"NEIGE CALME. LES POISSONS RARES S'ÉVEILLENT.",
"STILLER SCHNEE. SELTENE FISCHE REGEN SICH.",
"NEVE CALMA. PEIXES RAROS AGITAM-SE.",
"NEVE QUIETA. I PESCI RARI SI MUOVONO.",
"ТИХИЙ СНЕГ. РЕДКАЯ РЫБА ОЖИВАЕТ.",
"静静的雪。稀有鱼在活动。",
"しんしんと雪。レア魚が動き出す。"
],
"BLIZZARD": [
"VENTISCA",
"BLIZZARD",
"SCHNEESTURM",
"NEVASCA",
"BUFERA",
"МЕТЕЛЬ",
"暴风雪",
"ふぶき"
],
"SOMETHING BIG STIRS UNDER THE ICE...": [
"ALGO GRANDE SE MUEVE BAJO EL HIELO...",
"QUELQUE CHOSE DE GROS BOUGE SOUS LA GLACE...",
"ETWAS GROSSES REGT SICH UNTER DEM EIS...",
"ALGO GRANDE MEXE-SE SOB O GELO...",
"QUALCOSA DI GROSSO SI MUOVE SOTTO IL GHIACCIO...",
"ПОДО ЛЬДОМ ШЕВЕЛИТСЯ ЧТО-ТО БОЛЬШОЕ...",
"冰下有大家伙在动……",
"氷の下で何か大きなものが動く…"
],
"ASHFALL": [
"LLUVIA DE CENIZA",
"PLUIE DE CENDRES",
"ASCHEREGEN",
"CHUVA DE CINZA",
"PIOGGIA DI CENERE",
"ПЕПЕЛ",
"火山灰",
"火山灰"
],
"WARM ASH. FISH GET FEISTY.": [
"CENIZA TIBIA. LOS PECES SE ANIMAN.",
"CENDRE TIÈDE. LES POISSONS S'AGITENT.",
"WARME ASCHE. FISCHE WERDEN WILD.",
"CINZA MORNA. OS PEIXES ANIMAM-SE.",
"CENERE TIEPIDA. I PESCI SI AGITANO.",
"ТЁПЛЫЙ ПЕПЕЛ. РЫБА ОЖИВИЛАСЬ.",
"温暖的灰烬。鱼儿更凶猛了。",
"あたたかい灰。魚が元気になる。"
],
"ERUPTION!": [
"¡ERUPCIÓN!",
"ÉRUPTION!",
"AUSBRUCH!",
"ERUPÇÃO!",
"ERUZIONE!",
"ИЗВЕРЖЕНИЕ!",
"火山爆发！",
"噴火！"
],
"THE VOLCANO RUMBLES. BEASTS AWAKE!": [
"EL VOLCÁN RUGE. ¡DESPIERTAN LAS BESTIAS!",
"LE VOLCAN GRONDE. LES BÊTES S'ÉVEILLENT!",
"DER VULKAN GROLLT. UNGEHEUER ERWACHEN!",
"O VULCÃO RONCA. AS FERAS DESPERTAM!",
"IL VULCANO RUGGISCE. LE BESTIE SI SVEGLIANO!",
"ВУЛКАН ГРОХОЧЕТ. ЧУДОВИЩА ПРОСЫПАЮТСЯ!",
"火山在轰鸣。巨兽醒了！",
"火山がゴロゴロ。怪物が目を覚ます！"
],
"WORM": [
"LOMBRIZ",
"VER",
"WURM",
"MINHOCA",
"VERME",
"ЧЕРВЬ",
"蚯蚓",
"ミミズ"
],
"SHRIMP": [
"GAMBA",
"CREVETTE",
"GARNELE",
"CAMARÃO",
"GAMBERO",
"КРЕВЕТКА",
"虾",
"エビ"
],
"GLOW BAIT": [
"CEBO BRILLANTE",
"APPÂT LUMINEUX",
"LEUCHTKÖDER",
"ISCO BRILHANTE",
"ESCA LUMINOSA",
"СВЕТ. НАЖИВКА",
"荧光饵",
"光るエサ"
],
"{0} IS DEFEATED!": [
"¡{0} HA SIDO DERROTADO!",
"{0} EST VAINCU!",
"{0} IST BESIEGT!",
"{0} FOI DERROTADO!",
"{0} È SCONFITTO!",
"{0} ПОВЕРЖЕН!",
"{0}被打败了！",
"{0}をたおした！"
],
"YOU BLACKED OUT...": [
"TE DESMAYASTE...",
"TU T'ES ÉVANOUI...",
"DU BIST OHNMÄCHTIG...",
"DESMAIASTE...",
"SEI SVENUTO...",
"ТЫ ПОТЕРЯЛ СОЗНАНИЕ...",
"你昏过去了……",
"気を失った…"
],
"YOU BOTH BLACKED OUT...": [
"OS DESMAYASTEIS LOS DOS...",
"VOUS VOUS ÊTES ÉVANOUIS...",
"IHR SEID BEIDE OHNMÄCHTIG...",
"DESMAIARAM OS DOIS...",
"SIETE SVENUTI ENTRAMBI...",
"ВЫ ОБА ПОТЕРЯЛИ СОЗНАНИЕ...",
"你们俩都昏过去了……",
"ふたりとも気を失った…"
],
"P{#0} IS KNOCKED OUT! SWIM TO THEM TO REVIVE!": [
"¡P{0} ESTÁ K.O.! ¡NADA HASTA ÉL!",
"P{0} EST K.O.! NAGE JUSQU'À LUI!",
"P{0} IST K.O.! SCHWIMM HIN ZUM RETTEN!",
"P{0} ESTÁ K.O.! NADA ATÉ ELE!",
"P{0} È K.O.! NUOTA DA LUI!",
"P{0} БЕЗ СОЗНАНИЯ! ПОДПЛЫВИ К НЕМУ!",
"P{0}昏迷了！游过去救他！",
"P{0}が気絶！泳いで助けよう！"
],
"IT DROPPED A ROD! GRAB IT!": [
"¡SOLTÓ UNA CAÑA! ¡CÓGELA!",
"ELLE A LAISSÉ UNE CANNE! PRENDS-LA!",
"EINE ANGEL IST GEFALLEN! SCHNAPP SIE!",
"DEIXOU CAIR UMA CANA! APANHA-A!",
"HA LASCIATO UNA CANNA! PRENDILA!",
"ВЫПАЛА УДОЧКА! ХВАТАЙ!",
"它掉了一根鱼竿！快拿！",
"竿を落とした！取ろう！"
],
"IT DROPPED A CHARM! GRAB IT!": [
"¡SOLTÓ UN AMULETO! ¡CÓGELO!",
"ELLE A LAISSÉ UNE AMULETTE! PRENDS-LA!",
"EIN TALISMAN IST GEFALLEN! SCHNAPP IHN!",
"DEIXOU CAIR UM AMULETO! APANHA-O!",
"HA LASCIATO UN AMULETO! PRENDILO!",
"ВЫПАЛ АМУЛЕТ! ХВАТАЙ!",
"它掉了一个护身符！快拿！",
"お守りを落とした！取ろう！"
],
"IT DROPPED TREASURE! GRAB IT!": [
"¡SOLTÓ UN TESORO! ¡CÓGELO!",
"ELLE A LAISSÉ UN TRÉSOR! PRENDS-LE!",
"EIN SCHATZ IST GEFALLEN! SCHNAPP IHN!",
"DEIXOU CAIR UM TESOURO! APANHA-O!",
"HA LASCIATO UN TESORO! PRENDILO!",
"ВЫПАЛО СОКРОВИЩЕ! ХВАТАЙ!",
"它掉了宝藏！快拿！",
"宝物を落とした！取ろう！"
],
"YOU SWAM BACK UP!": [
"¡VOLVISTE A LA SUPERFICIE!",
"TU ES REMONTÉ!",
"DU BIST WIEDER AUFGETAUCHT!",
"VOLTASTE À SUPERFÍCIE!",
"SEI RISALITO IN SUPERFICIE!",
"ТЫ ВСПЛЫЛ!",
"你游回了水面！",
"水面にもどった！"
],
"TREASURE! +{#0} COINS": [
"¡TESORO! +{0} MONEDAS",
"TRÉSOR! +{0} PIÈCES",
"SCHATZ! +{0} MÜNZEN",
"TESOURO! +{0} MOEDAS",
"TESORO! +{0} MONETE",
"СОКРОВИЩЕ! +{0} МОНЕТ",
"宝藏！+{0}金币",
"宝物！+{0}コイン"
],
"YOU WASHED ASHORE...": [
"EL MAR TE DEVOLVIÓ A LA ORILLA...",
"TU T'ES ÉCHOUÉ SUR LA PLAGE...",
"DU WURDEST AN LAND GESPÜLT...",
"DESTE À COSTA...",
"IL MARE TI HA RIPORTATO A RIVA...",
"ТЕБЯ ВЫБРОСИЛО НА БЕРЕГ...",
"你被冲上了岸……",
"浜辺に打ち上げられた…"
],
"YOU WASHED ASHORE... LOST {#0} COINS": [
"A LA ORILLA... PERDISTE {0} MONEDAS",
"ÉCHOUÉ SUR LA PLAGE... {0} PIÈCES PERDUES",
"AN LAND GESPÜLT... {0} MÜNZEN VERLOREN",
"DESTE À COSTA... PERDESTE {0} MOEDAS",
"FINITO A RIVA... PERSE {0} MONETE",
"ВЫБРОСИЛО НА БЕРЕГ... ПОТЕРЯНО {0} МОНЕТ",
"你被冲上了岸……丢了{0}金币",
"浜辺に打ち上げられた…{0}コインなくした"
],
"USED: {0}": [
"USADO: {0}",
"UTILISÉ: {0}",
"BENUTZT: {0}",
"USADO: {0}",
"USATO: {0}",
"ИСПОЛЬЗОВАНО: {0}",
"已使用：{0}",
"使った：{0}"
],
"{0} + {1}": [
"{0} + {1}",
"{0} + {1}",
"{0} + {1}",
"{0} + {1}",
"{0} + {1}",
"{0} + {1}",
"{0} + {1}",
"{0} + {1}"
],
"WASD SWIM - J/CLICK HOOK - K/SHIFT DASH": [
"WASD NADAR - J/CLIC ANZUELO - K/SHIFT TURBO",
"WASD NAGER - J/CLIC HAMEÇON - K/MAJ TURBO",
"WASD SCHWIMMEN - J/KLICK HAKEN - K/SHIFT SPURT",
"WASD NADAR - J/CLIQUE ANZOL - K/SHIFT TURBO",
"WASD NUOTA - J/CLIC AMO - K/SHIFT TURBO",
"WASD ПЛЫТЬ - J/КЛИК КРЮЧОК - K/SHIFT РЫВОК",
"WASD游泳 - J/点击甩钩 - K/SHIFT冲刺",
"WASDで泳ぐ - J/クリックで針 - K/SHIFTでダッシュ"
],
"JOYSTICK TO SWIM - HOOK AND DASH BUTTONS": [
"JOYSTICK PARA NADAR - BOTONES ANZUELO Y TURBO",
"JOYSTICK POUR NAGER - BOUTONS HAMEÇON ET TURBO",
"JOYSTICK ZUM SCHWIMMEN - KNÖPFE HAKEN UND SPURT",
"JOYSTICK PARA NADAR - BOTÕES ANZOL E TURBO",
"JOYSTICK PER NUOTARE - TASTI AMO E TURBO",
"ДЖОЙСТИК - ПЛЫТЬ, КНОПКИ - КРЮЧОК И РЫВОК",
"摇杆游泳 - 甩钩和冲刺按钮",
"スティックで泳ぐ - 針とダッシュのボタン"
],
"P{#0} IS BACK!": [
"¡P{0} HA VUELTO!",
"P{0} EST DE RETOUR!",
"P{0} IST ZURÜCK!",
"P{0} VOLTOU!",
"P{0} È TORNATO!",
"P{0} СНОВА В СТРОЮ!",
"P{0}回来了！",
"P{0}が復活！"
],
"IT BONKED THE WALL - HIT IT FOR DOUBLE!": [
"¡SE DIO CONTRA LA PARED! ¡DAÑO DOBLE!",
"IL S'EST COGNÉ AU MUR - DÉGÂTS DOUBLES!",
"GEGEN DIE WAND GEKNALLT - DOPPELTER SCHADEN!",
"BATEU NA PAREDE - DANO A DOBRAR!",
"HA SBATTUTO CONTRO IL MURO - DANNO DOPPIO!",
"ВРЕЗАЛСЯ В СТЕНУ - БЕЙ ВДВОЙНЕ!",
"它撞墙了——打它双倍伤害！",
"壁にぶつかった——今なら2倍ダメージ！"
],
"HE IS EXHAUSTED - STRIKE!": [
"¡ESTÁ AGOTADO! ¡ATACA!",
"IL EST ÉPUISÉ - FRAPPE!",
"ER IST ERSCHÖPFT - ZUSCHLAGEN!",
"ESTÁ EXAUSTO - ATACA!",
"È ESAUSTO - COLPISCI!",
"ОН ВЫДОХСЯ - БЕЙ!",
"它累坏了——快攻击！",
"バテている——今だ！"
],
"PIRANHAS!": [
"¡PIRAÑAS!",
"PIRANHAS!",
"PIRANHAS!",
"PIRANHAS!",
"PIRANHA!",
"ПИРАНЬИ!",
"食人鱼！",
"ピラニア！"
],
"GHOST FISH! ARRR!": [
"¡PECES FANTASMA! ¡ARRR!",
"POISSONS FANTÔMES! ARRR!",
"GEISTERFISCHE! ARRR!",
"PEIXES FANTASMA! ARRR!",
"PESCI FANTASMA! ARRR!",
"РЫБЫ-ПРИЗРАКИ! АРРР!",
"幽灵鱼！啊哈！",
"幽霊魚だ！アーッ！"
],
"CLAWS STUCK IN THE ICE!": [
"¡PINZAS ATASCADAS EN EL HIELO!",
"PINCES COINCÉES DANS LA GLACE!",
"SCHEREN IM EIS STECKEN!",
"PINÇAS PRESAS NO GELO!",
"CHELE BLOCCATE NEL GHIACCIO!",
"КЛЕШНИ ЗАСТРЯЛИ ВО ЛЬДУ!",
"钳子卡在冰里了！",
"ハサミが氷にはさまった！"
],
"{0} IS ENRAGED!": [
"¡{0} ESTÁ FURIOSO!",
"{0} EST FURIEUX!",
"{0} IST WÜTEND!",
"{0} ESTÁ FURIOSO!",
"{0} È FURIOSO!",
"{0} В ЯРОСТИ!",
"{0}发怒了！",
"{0}が怒った！"
],
"HELP!": [
"¡AYUDA!",
"À L'AIDE!",
"HILFE!",
"SOCORRO!",
"AIUTO!",
"ПОМОГИ!",
"救命！",
"たすけて！"
],
"NO AIR!": [
"¡SIN AIRE!",
"PLUS D'AIR!",
"KEINE LUFT!",
"SEM AR!",
"NIENTE ARIA!",
"НЕТ ВОЗДУХА!",
"没有空气！",
"空気がない！"
],
"LOW AIR!": [
"¡POCO AIRE!",
"PEU D'AIR!",
"WENIG LUFT!",
"POUCO AR!",
"POCA ARIA!",
"МАЛО ВОЗДУХА!",
"空气不足！",
"空気が少ない！"
],
"+AIR": [
"+AIRE",
"+AIR",
"+LUFT",
"+AR",
"+ARIA",
"+ВОЗДУХ",
"+空气",
"+空気"
],
"CRIT {#0}": [
"CRÍTICO {0}",
"CRIT {0}",
"KRIT {0}",
"CRÍTICO {0}",
"CRITICO {0}",
"КРИТ {0}",
"暴击 {0}",
"クリティカル {0}"
],
"GRAB THE ROD!": [
"¡COGE LA CAÑA!",
"PRENDS LA CANNE!",
"SCHNAPP DIR DIE ANGEL!",
"APANHA A CANA!",
"PRENDI LA CANNA!",
"ХВАТАЙ УДОЧКУ!",
"快拿鱼竿！",
"竿を取ろう！"
],
"GRAB THE CHARM!": [
"¡COGE EL AMULETO!",
"PRENDS L'AMULETTE!",
"SCHNAPP DIR DEN TALISMAN!",
"APANHA O AMULETO!",
"PRENDI L'AMULETO!",
"ХВАТАЙ АМУЛЕТ!",
"快拿护身符！",
"お守りを取ろう！"
],
"GRAB THE TREASURE!": [
"¡COGE EL TESORO!",
"PRENDS LE TRÉSOR!",
"SCHNAPP DIR DEN SCHATZ!",
"APANHA O TESOURO!",
"PRENDI IL TESORO!",
"ХВАТАЙ СОКРОВИЩЕ!",
"快拿宝藏！",
"宝物を取ろう！"
],
"HOOK": [
"ANZUELO",
"HAMEÇON",
"HAKEN",
"ANZOL",
"AMO",
"КРЮЧОК",
"甩钩",
"針"
],
"DASH": [
"TURBO",
"TURBO",
"SPURT",
"TURBO",
"TURBO",
"РЫВОК",
"冲刺",
"ダッシュ"
],
"THE BASS THAT ATE A BOAT": [
"LA LUBINA QUE SE COMIÓ UN BARCO",
"LE BAR QUI A MANGÉ UN BATEAU",
"DER BARSCH, DER EIN BOOT FRASS",
"O ROBALO QUE COMEU UM BARCO",
"IL PERSICO CHE MANGIÒ UNA BARCA",
"ОКУНЬ, КОТОРЫЙ СЪЕЛ ЛОДКУ",
"吃掉一艘船的鲈鱼",
"船を食べたバス"
],
"SWORDFISH OF THE SEVEN SEAS": [
"PEZ ESPADA DE LOS SIETE MARES",
"ESPADON DES SEPT MERS",
"SCHWERTFISCH DER SIEBEN MEERE",
"ESPADARTE DOS SETE MARES",
"PESCE SPADA DEI SETTE MARI",
"МЕЧ-РЫБА СЕМИ МОРЕЙ",
"七海的剑鱼",
"七つの海のカジキ"
],
"LIGHT OF THE ABYSS": [
"LUZ DEL ABISMO",
"LUMIÈRE DES ABYSSES",
"LICHT DER TIEFE",
"LUZ DO ABISMO",
"LUCE DEGLI ABISSI",
"СВЕТ БЕЗДНЫ",
"深渊之光",
"深淵の光"
],
"KING OF THE REEF": [
"REY DEL ARRECIFE",
"ROI DU RÉCIF",
"KÖNIG DES RIFFS",
"REI DO RECIFE",
"RE DELLA BARRIERA",
"КОРОЛЬ РИФА",
"珊瑚礁之王",
"サンゴ礁の王"
],
"TERROR OF THE DEEP": [
"TERROR DE LAS PROFUNDIDADES",
"TERREUR DES PROFONDEURS",
"SCHRECKEN DER TIEFE",
"TERROR DAS PROFUNDEZAS",
"TERRORE DEGLI ABISSI",
"УЖАС ГЛУБИН",
"深海的恐怖",
"深海の恐怖"
],
"THE GHOST PIRATE WHALE": [
"LA BALLENA PIRATA FANTASMA",
"LA BALEINE PIRATE FANTÔME",
"DER GEISTERPIRATENWAL",
"A BALEIA PIRATA FANTASMA",
"LA BALENA PIRATA FANTASMA",
"КИТ-ПИРАТ ПРИЗРАК",
"幽灵海盗鲸",
"幽霊海賊クジラ"
],
"EMPEROR OF THE FROZEN DEEP": [
"EMPERADOR DEL ABISMO HELADO",
"EMPEREUR DES ABYSSES GELÉS",
"KAISER DER EISIGEN TIEFE",
"IMPERADOR DO ABISMO GELADO",
"IMPERATORE DEGLI ABISSI GELATI",
"ИМПЕРАТОР ЛЕДЯНЫХ ГЛУБИН",
"冰冻深渊的皇帝",
"凍てつく深海の皇帝"
],
"THE MAGMA SERPENT": [
"LA SERPIENTE DE MAGMA",
"LE SERPENT DE MAGMA",
"DIE MAGMASCHLANGE",
"A SERPENTE DE MAGMA",
"IL SERPENTE DI MAGMA",
"МАГМОВЫЙ ЗМЕЙ",
"岩浆巨蛇",
"マグマの大蛇"
],
"SANDY MINNOW": [
"PECECILLO DE ARENA",
"VAIRON DES SABLES",
"SANDELRITZE",
"PEIXINHO DA AREIA",
"PESCIOLINO DI SABBIA",
"ПЕСЧАНЫЙ ГОЛЬЯН",
"沙地小鱼",
"スナハヤ"
],
"EVERYWHERE. ALWAYS HUNGRY.": [
"EN TODAS PARTES. SIEMPRE CON HAMBRE.",
"PARTOUT. TOUJOURS AFFAMÉ.",
"ÜBERALL. IMMER HUNGRIG.",
"EM TODO O LADO. SEMPRE COM FOME.",
"OVUNQUE. SEMPRE AFFAMATO.",
"ВЕЗДЕ. ВСЕГДА ГОЛОДЕН.",
"到处都有，永远很饿。",
"どこにでもいる。いつも腹ぺこ。"
],
"SUNNY PERCH": [
"PERCA SOLAR",
"PERCHE SOLEIL",
"SONNENBARSCH",
"PERCA-SOL",
"PERSICO SOLE",
"СОЛНЕЧНЫЙ ОКУНЬ",
"阳光鲈",
"ひだまりパーチ"
],
"LOVES WARM SHALLOW WATER.": [
"LE ENCANTA EL AGUA TIBIA Y POCO PROFUNDA.",
"ADORE L'EAU CHAUDE ET PEU PROFONDE.",
"LIEBT WARMES, SEICHTES WASSER.",
"ADORA ÁGUA QUENTE E RASA.",
"AMA L'ACQUA CALDA E BASSA.",
"ЛЮБИТ ТЁПЛОЕ МЕЛКОВОДЬЕ.",
"喜欢温暖的浅水。",
"あたたかい浅瀬が好き。"
],
"OLD BOOT": [
"BOTA VIEJA",
"VIEILLE BOTTE",
"ALTER STIEFEL",
"BOTA VELHA",
"STIVALE VECCHIO",
"СТАРЫЙ САПОГ",
"旧靴子",
"古いブーツ"
],
"SOMEONE LOST THEIR SHOE...": [
"ALGUIEN PERDIÓ SU ZAPATO...",
"QUELQU'UN A PERDU SA CHAUSSURE...",
"JEMAND HAT SEINEN SCHUH VERLOREN...",
"ALGUÉM PERDEU O SAPATO...",
"QUALCUNO HA PERSO LA SCARPA...",
"КТО-ТО ПОТЕРЯЛ БОТИНОК...",
"有人丢了鞋……",
"だれかが靴をなくしたみたい…"
],
"BLUE TANG": [
"CIRUJANO AZUL",
"CHIRURGIEN BLEU",
"PALETTENDOKTOR",
"CIRURGIÃO-PATELA",
"PESCE CHIRURGO",
"СИНИЙ ХИРУРГ",
"蓝倒吊",
"ナンヨウハギ"
],
"JUST KEEPS SWIMMING.": [
"SIGUE NADANDO Y NADANDO.",
"CONTINUE DE NAGER.",
"EINFACH WEITERSCHWIMMEN.",
"CONTINUA A NADAR.",
"CONTINUA A NUOTARE.",
"ПРОСТО ПЛЫВЁТ ДАЛЬШЕ.",
"一直游啊游。",
"ずっと泳ぎつづける。"
],
"CLOWNFISH": [
"PEZ PAYASO",
"POISSON-CLOWN",
"CLOWNFISCH",
"PEIXE-PALHAÇO",
"PESCE PAGLIACCIO",
"РЫБА-КЛОУН",
"小丑鱼",
"クマノミ"
],
"NEEDS A BAMBOO ROD OR BETTER.": [
"NECESITA CAÑA DE BAMBÚ O MEJOR.",
"IL FAUT UNE CANNE EN BAMBOU OU MIEUX.",
"BRAUCHT BAMBUSANGEL ODER BESSER.",
"PRECISA DE CANA DE BAMBU OU MELHOR.",
"SERVE LA CANNA DI BAMBÙ O MEGLIO.",
"НУЖНА БАМБУКОВАЯ УДОЧКА ИЛИ ЛУЧШЕ.",
"需要竹鱼竿或更好的。",
"竹の竿以上が必要。"
],
"PUFFERFISH": [
"PEZ GLOBO",
"POISSON-GLOBE",
"KUGELFISCH",
"BAIACU",
"PESCE PALLA",
"РЫБА-ФУГУ",
"河豚",
"フグ"
],
"DO NOT HUG. BAMBOO ROD+.": [
"NO ABRAZAR. CAÑA DE BAMBÚ+.",
"NE PAS CÂLINER. CANNE BAMBOU+.",
"NICHT KUSCHELN. BAMBUSANGEL+.",
"NÃO ABRAÇAR. CANA DE BAMBU+.",
"NON ABBRACCIARE. CANNA DI BAMBÙ+.",
"НЕ ОБНИМАТЬ. БАМБУК+.",
"别抱它。竹鱼竿+。",
"だっこ禁止。竹の竿+。"
],
"RED SNAPPER": [
"PARGO ROJO",
"VIVANEAU ROUGE",
"ROTER SCHNAPPER",
"LUTJANO-VERMELHO",
"LUTIANIDE ROSSO",
"КРАСНЫЙ ЛУЦИАН",
"红鲷鱼",
"アカフエダイ"
],
"FEISTY. BAMBOO ROD+.": [
"PELEÓN. CAÑA DE BAMBÚ+.",
"BAGARREUR. CANNE BAMBOU+.",
"KAMPFLUSTIG. BAMBUSANGEL+.",
"BRIGÃO. CANA DE BAMBU+.",
"COMBATTIVO. CANNA DI BAMBÙ+.",
"ЗАДИРА. БАМБУК+.",
"很凶。竹鱼竿+。",
"気が強い。竹の竿+。"
],
"MOONFISH": [
"PEZ LUNA",
"POISSON-LUNE",
"MONDFISCH",
"PEIXE-LUA",
"PESCE LUNA",
"РЫБА-ЛУНА",
"月亮鱼",
"ツキウオ"
],
"ONLY BITES AT NIGHT.": [
"SOLO PICA DE NOCHE.",
"NE MORD QUE LA NUIT.",
"BEISST NUR NACHTS.",
"SÓ MORDE À NOITE.",
"ABBOCCA SOLO DI NOTTE.",
"КЛЮЁТ ТОЛЬКО НОЧЬЮ.",
"只在晚上咬钩。",
"夜にしか釣れない。"
],
"MACKEREL": [
"CABALLA",
"MAQUEREAU",
"MAKRELE",
"CAVALA",
"SGOMBRO",
"СКУМБРИЯ",
"鲭鱼",
"サバ"
],
"FAST SWIMMER. CORAL ROD+.": [
"NADADORA VELOZ. CAÑA DE CORAL+.",
"NAGEUR RAPIDE. CANNE CORAIL+.",
"SCHNELLER SCHWIMMER. KORALLENANGEL+.",
"NADADORA RÁPIDA. CANA DE CORAL+.",
"NUOTATORE VELOCE. CANNA DI CORALLO+.",
"БЫСТРО ПЛАВАЕТ. КОРАЛЛ+.",
"游得快。珊瑚鱼竿+。",
"泳ぎが速い。サンゴの竿+。"
],
"RAINBOW TROUT": [
"TRUCHA ARCOÍRIS",
"TRUITE ARC-EN-CIEL",
"REGENBOGENFORELLE",
"TRUTA ARCO-ÍRIS",
"TROTA IRIDEA",
"РАДУЖНАЯ ФОРЕЛЬ",
"虹鳟",
"ニジマス"
],
"SHIMMERS. CORAL ROD+.": [
"BRILLA. CAÑA DE CORAL+.",
"CHATOIE. CANNE CORAIL+.",
"SCHIMMERT. KORALLENANGEL+.",
"CINTILA. CANA DE CORAL+.",
"LUCCICA. CANNA DI CORALLO+.",
"ПЕРЕЛИВАЕТСЯ. КОРАЛЛ+.",
"闪闪发光。珊瑚鱼竿+。",
"キラキラ。サンゴの竿+。"
],
"GLOW SQUID": [
"CALAMAR BRILLANTE",
"CALMAR LUMINEUX",
"LEUCHTKALMAR",
"LULA BRILHANTE",
"CALAMARO LUMINOSO",
"СВЕТЯЩИЙСЯ КАЛЬМАР",
"荧光鱿鱼",
"ホタルイカ"
],
"NIGHT ONLY. CORAL ROD+.": [
"SOLO DE NOCHE. CAÑA DE CORAL+.",
"LA NUIT. CANNE CORAIL+.",
"NUR NACHTS. KORALLENANGEL+.",
"SÓ À NOITE. CANA DE CORAL+.",
"SOLO DI NOTTE. CANNA DI CORALLO+.",
"ТОЛЬКО НОЧЬЮ. КОРАЛЛ+.",
"只在夜晚。珊瑚鱼竿+。",
"夜だけ。サンゴの竿+。"
],
"TREASURE CHEST": [
"COFRE DEL TESORO",
"COFFRE AU TRÉSOR",
"SCHATZTRUHE",
"BAÚ DO TESOURO",
"FORZIERE",
"СУНДУК С СОКРОВИЩАМИ",
"宝箱",
"宝箱"
],
"ARR! VERY RARE. CORAL ROD+.": [
"¡ARR! MUY RARO. CAÑA DE CORAL+.",
"ARR! TRÈS RARE. CANNE CORAIL+.",
"ARR! SEHR SELTEN. KORALLENANGEL+.",
"ARR! MUITO RARO. CANA DE CORAL+.",
"ARR! RARISSIMO. CANNA DI CORALLO+.",
"АРР! ОЧЕНЬ РЕДКИЙ. КОРАЛЛ+.",
"啊哈！非常稀有。珊瑚鱼竿+。",
"アーッ！超レア。サンゴの竿+。"
],
"GOLDEN KOI": [
"KOI DORADO",
"KOI DORÉ",
"GOLDENER KOI",
"KOI DOURADO",
"KOI D'ORO",
"ЗОЛОТОЙ КОИ",
"金锦鲤",
"金のコイ"
],
"LUCKY! GLOWLIGHT ROD+.": [
"¡DA SUERTE! CAÑA LUMINOSA+.",
"PORTE-BONHEUR! CANNE LUMINEUSE+.",
"GLÜCKSBRINGER! LEUCHTANGEL+.",
"DÁ SORTE! CANA LUMINOSA+.",
"PORTAFORTUNA! CANNA LUMINOSA+.",
"К УДАЧЕ! СВЕТЯЩАЯСЯ+.",
"好运！荧光鱼竿+。",
"ラッキー！光る竿+。"
],
"GHOST FISH": [
"PEZ FANTASMA",
"POISSON FANTÔME",
"GEISTERFISCH",
"PEIXE FANTASMA",
"PESCE FANTASMA",
"РЫБА-ПРИЗРАК",
"幽灵鱼",
"幽霊魚"
],
"BOO. NIGHT, GLOWLIGHT ROD+.": [
"BU. NOCHE, CAÑA LUMINOSA+.",
"BOUH. NUIT, CANNE LUMINEUSE+.",
"BUH. NACHTS, LEUCHTANGEL+.",
"BU. NOITE, CANA LUMINOSA+.",
"BU. NOTTE, CANNA LUMINOSA+.",
"БУ. НОЧЬЮ, СВЕТЯЩАЯСЯ+.",
"嘘。夜晚，荧光鱼竿+。",
"ばあ。夜、光る竿+。"
],
"CRYSTAL EEL": [
"ANGUILA DE CRISTAL",
"ANGUILLE DE CRISTAL",
"KRISTALLAAL",
"ENGUIA DE CRISTAL",
"ANGUILLA DI CRISTALLO",
"ХРУСТАЛЬНЫЙ УГОРЬ",
"水晶鳗",
"クリスタルウナギ"
],
"LEGENDARY. SHARKTOOTH ROD+.": [
"LEGENDARIA. CAÑA COLMILLO+.",
"LÉGENDAIRE. CANNE DENT-DE-REQUIN+.",
"LEGENDÄR. HAIZAHNANGEL+.",
"LENDÁRIA. CANA DE TUBARÃO+.",
"LEGGENDARIA. CANNA DENTE DI SQUALO+.",
"ЛЕГЕНДА. ЗУБ АКУЛЫ+.",
"传说级。鲨齿鱼竿+。",
"伝説級。サメの歯の竿+。"
],
"PIRATE PERCH": [
"PERCA PIRATA",
"PERCHE PIRATE",
"PIRATENBARSCH",
"PERCA PIRATA",
"PERSICO PIRATA",
"ОКУНЬ-ПИРАТ",
"海盗鲈",
"海賊パーチ"
],
"ARR. LURKS IN THE OLD WRECK.": [
"ARR. ACECHA EN EL VIEJO NAUFRAGIO.",
"ARR. RÔDE DANS LA VIEILLE ÉPAVE.",
"ARR. LAUERT IM ALTEN WRACK.",
"ARR. ESPREITA NO VELHO NAUFRÁGIO.",
"ARR. SI NASCONDE NEL VECCHIO RELITTO.",
"АРР. ПРЯЧЕТСЯ В СТАРОМ КОРАБЛЕ.",
"啊哈。潜伏在旧沉船里。",
"アーッ。古い難破船にひそむ。"
],
"BARNACLE BASS": [
"LUBINA PERCEBE",
"BAR À BERNACLES",
"SEEPOCKENBARSCH",
"ROBALO-CRACA",
"SPIGOLA CIRRIPEDE",
"ОКУНЬ В РАКУШКАХ",
"藤壶鲈",
"フジツボバス"
],
"COVERED IN CRUSTY BARNACLES.": [
"CUBIERTA DE PERCEBES.",
"COUVERT DE BERNACLES.",
"VOLLER SEEPOCKEN.",
"COBERTO DE CRACAS.",
"COPERTA DI CIRRIPEDI.",
"ВЕСЬ В РАКУШКАХ.",
"满身硬硬的藤壶。",
"ゴツゴツのフジツボだらけ。"
],
"RUSTY ANCHOR": [
"ANCLA OXIDADA",
"ANCRE ROUILLÉE",
"ROSTIGER ANKER",
"ÂNCORA FERRUGENTA",
"ANCORA ARRUGGINITA",
"РЖАВЫЙ ЯКОРЬ",
"生锈的锚",
"さびた錨"
],
"HEAVY. VERY HEAVY.": [
"PESADA. MUY PESADA.",
"LOURDE. TRÈS LOURDE.",
"SCHWER. SEHR SCHWER.",
"PESADA. MUITO PESADA.",
"PESANTE. MOLTO PESANTE.",
"ТЯЖЁЛЫЙ. ОЧЕНЬ.",
"重。非常重。",
"重い。とても重い。"
],
"SPOOKFIN": [
"ALETASUSTO",
"NAGEOIRE-FRISSON",
"SPUKFLOSSE",
"BARBATANA-SUSTO",
"PINNASPETTRO",
"ЖУТЬПЛАВНИК",
"怪鳍鱼",
"オバケビレ"
],
"A GHOST FISH. NIGHT ONLY.": [
"UN PEZ FANTASMA. SOLO DE NOCHE.",
"UN POISSON FANTÔME. LA NUIT.",
"EIN GEISTERFISCH. NUR NACHTS.",
"UM PEIXE FANTASMA. SÓ À NOITE.",
"UN PESCE FANTASMA. SOLO DI NOTTE.",
"РЫБА-ПРИЗРАК. ТОЛЬКО НОЧЬЮ.",
"幽灵鱼。只在夜晚。",
"幽霊の魚。夜だけ。"
],
"GOLD DOUBLOON": [
"DOBLÓN DE ORO",
"DOUBLON D'OR",
"GOLDDUBLONE",
"DOBRÃO DE OURO",
"DOBLONE D'ORO",
"ЗОЛОТОЙ ДУБЛОН",
"金币达布隆",
"金のドブロン金貨"
],
"PIRATE GOLD! SUPER RARE.": [
"¡ORO PIRATA! SÚPER RARO.",
"OR DE PIRATE! SUPER RARE.",
"PIRATENGOLD! SUPERSELTEN.",
"OURO PIRATA! SUPER RARO.",
"ORO PIRATA! RARISSIMO.",
"ПИРАТСКОЕ ЗОЛОТО! СУПЕРРЕДКОЕ.",
"海盗的黄金！超级稀有。",
"海賊の金貨！超レア。"
],
"ARCTIC CHAR": [
"SALVELINO ÁRTICO",
"OMBLE ARCTIQUE",
"SEESAIBLING",
"SALVELINO ÁRTICO",
"SALMERINO ARTICO",
"АРКТИЧЕСКИЙ ГОЛЕЦ",
"北极红点鲑",
"ホッキョクイワナ"
],
"LOVES ICY WATER.": [
"LE ENCANTA EL AGUA HELADA.",
"ADORE L'EAU GLACÉE.",
"LIEBT EISIGES WASSER.",
"ADORA ÁGUA GELADA.",
"AMA L'ACQUA GELIDA.",
"ЛЮБИТ ЛЕДЯНУЮ ВОДУ.",
"喜欢冰冷的水。",
"つめたい水が好き。"
],
"ICE COD": [
"BACALAO DE HIELO",
"MORUE DES GLACES",
"EISKABELJAU",
"BACALHAU DO GELO",
"MERLUZZO DEL GHIACCIO",
"ЛЕДЯНАЯ ТРЕСКА",
"冰鳕鱼",
"こおりのタラ"
],
"CHILL. VERY CHILL.": [
"TRANQUILO. MUY TRANQUILO.",
"COOL. TRÈS COOL.",
"CHILLIG. SEHR CHILLIG.",
"FRESCO. MUITO FRESCO.",
"TRANQUILLO. MOLTO TRANQUILLO.",
"СПОКОЕН. ОЧЕНЬ.",
"淡定。非常淡定。",
"クール。とてもクール。"
],
"SNOW CRAB": [
"CANGREJO DE NIEVE",
"CRABE DES NEIGES",
"SCHNEEKRABBE",
"CARANGUEJO-DA-NEVE",
"GRANCHIO DELLE NEVI",
"СНЕЖНЫЙ КРАБ",
"雪蟹",
"ズワイガニ"
],
"SNIP SNAP.": [
"CLIC CLAC.",
"CLIC CLAC.",
"SCHNIPP SCHNAPP.",
"CLIC CLAC.",
"CLIC CLAC.",
"ЩЁЛК-ЩЁЛК.",
"咔嚓咔嚓。",
"チョキチョキ。"
],
"FROST PIKE": [
"LUCIO DE ESCARCHA",
"BROCHET DU GIVRE",
"FROSTHECHT",
"LÚCIO GELADO",
"LUCCIO DI BRINA",
"ЛЕДЯНАЯ ЩУКА",
"冰霜梭鱼",
"こおりのカワカマス"
],
"LONG AND SNAPPY.": [
"LARGO Y MORDEDOR.",
"LONG ET HARGNEUX.",
"LANG UND BISSIG.",
"LONGO E MORDEDOR.",
"LUNGO E MORDACE.",
"ДЛИННАЯ И ЗУБАСТАЯ.",
"又长又凶。",
"長くてかみつく。"
],
"AURORA TROUT": [
"TRUCHA AURORA",
"TRUITE AURORE",
"POLARLICHTFORELLE",
"TRUTA AURORA",
"TROTA AURORA",
"ФОРЕЛЬ-СИЯНИЕ",
"极光鳟鱼",
"オーロラマス"
],
"GLOWS LIKE THE NORTHERN LIGHTS.": [
"BRILLA COMO LA AURORA BOREAL.",
"BRILLE COMME UNE AURORE BORÉALE.",
"LEUCHTET WIE POLARLICHT.",
"BRILHA COMO A AURORA BOREAL.",
"BRILLA COME L'AURORA BOREALE.",
"СИЯЕТ КАК СЕВЕРНОЕ СИЯНИЕ.",
"像北极光一样发光。",
"オーロラのように光る。"
],
"EMBER GUPPY": [
"GUPPY ASCUA",
"GUPPY BRAISE",
"GLUT-GUPPY",
"GUPPY BRASA",
"GUPPY BRACE",
"УГОЛЬКОВЫЙ ГУППИ",
"余烬孔雀鱼",
"火の粉グッピー"
],
"WARM TO THE TOUCH.": [
"TIBIO AL TACTO.",
"TIÈDE AU TOUCHER.",
"WARM ZUM ANFASSEN.",
"MORNO AO TOQUE.",
"TIEPIDO AL TATTO.",
"ТЁПЛЫЙ НА ОЩУПЬ.",
"摸起来暖暖的。",
"さわるとあたたかい。"
],
"CINDER SNAPPER": [
"PARGO CENIZA",
"VIVANEAU CENDRÉ",
"ASCHESCHNAPPER",
"LUTJANO-CINZA",
"LUTIANIDE CENERE",
"ПЕПЕЛЬНЫЙ ЛУЦИАН",
"灰烬鲷鱼",
"灰のフエダイ"
],
"SMOKY FLAVOUR.": [
"SABOR AHUMADO.",
"SAVEUR FUMÉE.",
"RAUCHIGER GESCHMACK.",
"SABOR FUMADO.",
"SAPORE AFFUMICATO.",
"КОПЧЁНЫЙ ВКУС.",
"烟熏风味。",
"スモーキーな味。"
],
"MAGMA PUFFER": [
"PEZ GLOBO DE MAGMA",
"GLOBE DE MAGMA",
"MAGMA-KUGELFISCH",
"BAIACU DE MAGMA",
"PESCE PALLA DI MAGMA",
"МАГМОВЫЙ ФУГУ",
"岩浆河豚",
"マグマフグ"
],
"PUFFS UP. GETS HOT.": [
"SE INFLA. SE CALIENTA.",
"IL GONFLE. IL CHAUFFE.",
"BLÄHT SICH AUF. WIRD HEISS.",
"INCHA. AQUECE.",
"SI GONFIA. SI SCALDA.",
"РАЗДУВАЕТСЯ. ГОРЯЧИЙ.",
"一鼓起来就发烫。",
"ふくらむと熱くなる。"
],
"LAVA LOBSTER": [
"LANGOSTA DE LAVA",
"HOMARD DE LAVE",
"LAVAHUMMER",
"LAGOSTA DE LAVA",
"ARAGOSTA DI LAVA",
"ЛАВОВЫЙ ОМАР",
"熔岩龙虾",
"溶岩ロブスター"
],
"ALREADY COOKED?": [
"¿YA COCINADA?",
"DÉJÀ CUIT?",
"SCHON GEKOCHT?",
"JÁ COZINHADA?",
"GIÀ COTTA?",
"УЖЕ СВАРЕН?",
"已经煮熟了？",
"もう焼けてる？"
],
"PHOENIX KOI": [
"KOI FÉNIX",
"KOI PHÉNIX",
"PHÖNIX-KOI",
"KOI FÉNIX",
"KOI FENICE",
"КОИ-ФЕНИКС",
"凤凰锦鲤",
"フェニックスゴイ"
],
"REBORN FROM THE FLAMES.": [
"RENACIDO DE LAS LLAMAS.",
"RENÉ DES FLAMMES.",
"AUS DEN FLAMMEN WIEDERGEBOREN.",
"RENASCIDO DAS CHAMAS.",
"RINATO DALLE FIAMME.",
"ВОЗРОЖДЁН ИЗ ПЛАМЕНИ.",
"从火焰中重生。",
"炎からよみがえる。"
],
"{0}: {1}": [
"{0}: {1}",
"{0}: {1}",
"{0}: {1}",
"{0}: {1}",
"{0}: {1}",
"{0}: {1}",
"{0}：{1}",
"{0}：{1}"
],
"{0} {#1} CM": [
"{0} {1} CM",
"{0} {1} CM",
"{0} {1} CM",
"{0} {1} CM",
"{0} {1} CM",
"{0} {1} СМ",
"{0} {1}厘米",
"{0} {1}CM"
],
"SPACE/CLICK: SELL THIS ONE": [
"ESPACIO/CLIC: VENDER ESTE",
"ESPACE/CLIC: VENDRE CELUI-CI",
"LEER/KLICK: DIESEN VERKAUFEN",
"ESPAÇO/CLIQUE: VENDER ESTE",
"SPAZIO/CLIC: VENDI QUESTO",
"ПРОБЕЛ/КЛИК: ПРОДАТЬ ЭТУ",
"空格/点击：卖掉这条",
"スペース/クリック：これを売る"
],
"WANTED! X2 - SPACE/CLICK: SELL": [
"¡BUSCADO! X2 - ESPACIO/CLIC: VENDER",
"DEMANDÉ! X2 - ESPACE/CLIC: VENDRE",
"GESUCHT! X2 - LEER/KLICK: VERKAUFEN",
"PROCURADO! X2 - ESPAÇO/CLIQUE: VENDER",
"RICHIESTO! X2 - SPAZIO/CLIC: VENDI",
"В СПРОСЕ! X2 - ПРОБЕЛ/КЛИК: ПРОДАТЬ",
"抢手！X2 - 空格/点击：卖出",
"人気！X2 - スペース/クリック：売る"
],
"SOLD {0}! +{#1}": [
"¡VENDIDO: {0}! +{1}",
"VENDU: {0}! +{1}",
"VERKAUFT: {0}! +{1}",
"VENDIDO: {0}! +{1}",
"VENDUTO: {0}! +{1}",
"ПРОДАНО: {0}! +{1}",
"卖出{0}！+{1}",
"{0}を売った！+{1}"
],
"YOUR COOLER IS EMPTY": [
"TU NEVERA ESTÁ VACÍA",
"TA GLACIÈRE EST VIDE",
"DEINE KÜHLBOX IST LEER",
"A TUA GELEIRA ESTÁ VAZIA",
"IL TUO FRIGO È VUOTO",
"ХОЛОДИЛЬНИК ПУСТ",
"冷藏箱是空的",
"クーラーボックスは空っぽ"
],
"SELL ONE FISH OR ALL AT ONCE.": [
"VENDE UN PEZ O TODOS A LA VEZ.",
"VENDS UN POISSON OU TOUT D'UN COUP.",
"VERKAUFE EINEN FISCH ODER ALLE AUF EINMAL.",
"VENDE UM PEIXE OU TODOS DE UMA VEZ.",
"VENDI UN PESCE O TUTTI INSIEME.",
"ПРОДАВАЙ ПО ОДНОЙ ИЛИ ВСЁ СРАЗУ.",
"可以一条一条卖，也可以全部卖掉。",
"1匹ずつでも、まとめてでも売れるよ。"
]
};

let LANG = 0;
const _trExact = {}, _trPatterns = [], _trCache = new Map();
for (const key in I18N) {
  if (!key.includes('{')) { _trExact[key] = I18N[key]; continue; }
  const idx = [];
  let lit = 0;
  const src = key.split(/(\{#?\d\})/).map(part => {
    const m = /^\{(#?)(\d)\}$/.exec(part);
    if (m) { idx.push(+m[2]); return m[1] ? '([\\d.]+)' : '(.+?)'; }
    lit += part.length;
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  _trPatterns.push({ re: new RegExp('^' + src + '$'), idx, lit, out: I18N[key] });
}
_trPatterns.sort((a, b) => b.lit - a.lit);

function trRaw(s, depth) {
  const e = _trExact[s];
  if (e) return e[LANG - 1];
  if (depth > 4 || !/[A-Z]/.test(s)) return s;
  for (const p of _trPatterns) {
    const m = p.re.exec(s);
    if (!m) continue;
    const vals = [];
    p.idx.forEach((n, k) => { vals[n] = trRaw(m[k + 1], depth + 1); });
    return p.out[LANG - 1].replace(/\{(\d)\}/g, (_, n) => vals[+n]);
  }
  return s;
}
function tr(s) {
  if (!LANG || !s) return s;
  let c = _trCache.get(s);
  if (c === undefined) {
    c = trRaw(String(s).toUpperCase(), 0);
    if (_trCache.size > 3000) _trCache.clear();
    _trCache.set(s, c);
  }
  return c;
}
// every character a language uses, so the web font can fetch them all at once
function langChars() {
  const set = new Set();
  for (const k in I18N) for (const ch of I18N[k][LANG - 1]) set.add(ch);
  return [...set].join('');
}
function setLang(i) {
  LANG = ((i % LANGS.length) + LANGS.length) % LANGS.length;
  _trCache.clear();
  if (LANGS[LANG].wide) loadWideFonts(langChars());
  try { localStorage.setItem('reel-deep-lang', LANGS[LANG].id); } catch (e) { /* ignore */ }
}
(function initLang() {
  let id = null;
  try { id = localStorage.getItem('reel-deep-lang'); } catch (e) { /* ignore */ }
  if (!id) id = String(navigator.language || 'en').slice(0, 2).toLowerCase();
  const i = LANGS.findIndex(l => l.id === id);
  LANG = i > 0 ? i : 0;
  if (LANGS[LANG].wide) loadWideFonts(langChars());
})();
