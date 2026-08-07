/**
 * Verse8 · 원스토어 출시 전 QA 체크리스트 — Google Form 자동 생성 스크립트
 * Verse8 / ONE store pre-release QA checklist — Google Form generator
 *
 * 운영 흐름 / How this is used
 *   1) 제작자가 자기 게임을 스스로 점검하고 이 폼을 제출한다 (셀프 체크리스트).
 *   2) 제출된 응답을 AI가 실제 게임 링크로 열어 2차 교차 확인한다.
 *   3) 검토팀은 그 결과로 이상 없는 게임을 골라낸다.
 *
 *   1) The developer self-checks their own game and submits this form.
 *   2) An AI pass opens the submitted URL and cross-checks the declarations.
 *   3) The review team uses that to shortlist builds that look clean.
 *
 * 셀프 신고이므로 "통과" 표시만으로는 검증 가치가 없다. 그래서 판정 문항 뒤에
 * 짧은 근거 칸을 둔다:
 *   - AI가 직접 확인 가능한 항목  → "어디를 눌러야 하는지" 위치를 받는다
 *   - AI가 재현 불가능한 항목      → 증빙(스크린샷/영상 링크, 확인 절차)을 받는다
 * AI 재현 불가 항목: 광고 완주 보상, 기기 간 계정 저장, 실제 결제 완료.
 *
 * 쓰는 법 / How to run
 *  1. https://script.google.com 접속 → "새 프로젝트"
 *  2. 편집기 내용 전부 지우고 이 파일 전체를 붙여넣기
 *  2-1. 왼쪽 "파일 +" 로 스크립트 파일을 하나 더 만들고(이름 아무거나),
 *       원스토어_QA체크리스트_이미지데이터.gs 내용을 통째로 붙여넣기.
 *       비개발자용 설명 다이어그램 4장이 base64 PNG로 들어 있음 — 외부 호스팅 불필요.
 *       이 파일을 안 넣어도 폼은 정상 생성되고 이미지만 빠진다(아래 addImage가 조용히 건너뜀).
 *  3. 상단 함수 목록에서 createQaChecklistForm 선택 → "실행"
 *  4. 최초 1회 권한 승인 (Google 폼 + 스프레드시트 생성 권한)
 *  5. 실행 로그에 나오는 링크 3개 확인
 *       - 응답용 링크: 제작자에게 배포. 로그인 없이 열림
 *       - 편집용 링크: 문항 수정할 때
 *       - 응답 스프레드시트: 제출 기록이 한 줄씩 쌓이는 시트
 *
 * 다시 실행하면 새 폼 + 새 시트가 또 생김. 기존 것을 수정하려면 편집 링크로 직접.
 * 모든 문항은 한국어 + 영어 병기. 해외 제작자도 그대로 쓸 수 있음.
 *
 * 판정은 통과 / 실패 두 가지뿐. "해당없음"은 두지 않는다 — 확인 안 한 항목을
 * 넘기는 도피처가 되기 때문. 항목 자체가 성립하지 않는 경우는 마지막 서술 칸에
 * 사유를 적는다.
 */

/**
 * 응답을 받을 스프레드시트 ID.
 * 비워두면('') 실행할 때마다 새 스프레드시트를 만든다.
 * 값을 넣으면 그 스프레드시트에 응답 탭이 새로 생긴다.
 *
 * 주의: 시트 안의 "특정 탭"을 지정할 수는 없다. 구글이 항상 새 탭을 만든다.
 * ID는 URL의 /d/ 와 /edit 사이 문자열이다.
 */
var RESPONSE_SPREADSHEET_ID = '1djUhtImOZdvaZb1tvGJHheoZ2L3s4LHCnCWhz0gLRmo';

function createQaChecklistForm() {
  var form = FormApp.create('Verse8 · 원스토어 출시 전 QA 체크리스트 / Pre-release QA Checklist');

  form.setDescription(
    '[KO] 제작자가 직접 자기 게임을 점검하고 제출하는 셀프 체크리스트입니다. ' +
    '제출 후 검토 측에서 제출하신 게임 링크를 실제로 열어 2차 확인을 진행합니다. ' +
    '각 항목은 통과 / 실패로 표시하고, 뒤따르는 짧은 칸에 근거(어디서 확인 가능한지 / 무엇으로 확인했는지)를 적어 주세요. ' +
    '코드만 보고 통과로 표시하지 마시고, 실제 배포 빌드에서 직접 눌러본 결과로 적어 주세요.\n\n' +
    '[EN] This is a self-check submitted by the developer of the game. ' +
    'After you submit, the review side opens the URL you provide and cross-checks these answers against the live build. ' +
    'Mark each item Pass or Fail, then use the short follow-up field to say where it can be seen or how you verified it. ' +
    'Do not mark an item Pass from reading code alone — report what you actually observed on a deployed build.'
  );

  form.setProgressBar(true);
  form.setAllowResponseEdits(true);   // 제출 후에도 수정 가능 / responses stay editable
  form.setLimitOneResponsePerUser(false);
  form.setShowLinkToRespondAgain(true);

  // ------------------------------------------------------------------
  // 열 추적 / column tracking
  // 응답 시트의 A열은 타임스탬프. 이후 질문이 추가된 순서대로 한 열씩 차지한다.
  // 판정 문항이 어느 열에 떨어지는지 손으로 세면 문항을 하나 끼워넣을 때마다
  // 조건부 서식이 어긋나므로, 추가하면서 자동으로 기록한다.
  // ------------------------------------------------------------------
  var colIndex = 1;              // A = 타임스탬프
  var verdictCols = [];          // 통과/실패 문항이 떨어진 열 번호

  var colLetter = function (n) {
    var s = '';
    while (n > 0) {
      var m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };

  var VERDICTS = ['통과 / Pass', '실패 / Fail'];

  /** 통과/실패 판정 문항 (또는 choices를 준 선택 문항) */
  var addChoice = function (title, help, choices) {
    form.addMultipleChoiceItem()
      .setTitle(title)
      .setHelpText(help)
      .setChoiceValues(choices || VERDICTS)
      .setRequired(true);
    colIndex++;
    if (!choices) verdictCols.push(colIndex);   // 방향 모드 선택은 판정이 아님
  };

  /** 판정 뒤에 붙는 짧은 근거 칸 */
  var addEvidence = function (title, help, required) {
    form.addTextItem()
      .setTitle(title)
      .setHelpText(help)
      .setRequired(required !== false);
    colIndex++;
  };

  var addParagraph = function (title, help, required) {
    form.addParagraphTextItem()
      .setTitle(title)
      .setHelpText(help)
      .setRequired(!!required);
    colIndex++;
  };

  var addHeader = function (title, help) {
    var h = form.addSectionHeaderItem().setTitle(title);
    if (help) h.setHelpText(help);
    // 섹션 헤더는 열을 차지하지 않는다.
  };

  /**
   * 설명 다이어그램. 개발을 모르는 제작자가 문항을 한눈에 이해하도록 문항 바로
   * 앞에 그림을 깐다. 이미지 항목도 응답을 받지 않으므로 열을 차지하지 않는다.
   *
   * base64는 이미지데이터.gs 에 들어 있다. 그 파일을 안 붙여넣었으면 상수가
   * 정의되지 않으므로(typeof 검사) 그림만 빠지고 폼 생성은 그대로 진행된다.
   */
  var addImage = function (b64, name, altTitle) {
    if (!b64) {
      Logger.log('이미지 건너뜀 / image skipped: ' + name + ' (이미지데이터 파일 미포함)');
      return;
    }
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/png', name + '.png');
    form.addImageItem()
      .setImage(blob)
      .setTitle(altTitle)
      .setAlignment(FormApp.Alignment.CENTER)
      .setWidth(600);
  };

  // ---------- 제출 정보 / Submission info ----------
  addHeader('제출 정보 / Submission info');

  addEvidence(
    '게임 이름  ·  Game title',
    ''
  );

  addEvidence(
    '개발사 / 제작자  ·  Developer',
    '[KO] 회신이 필요할 때 연락할 팀 또는 담당자.\n[EN] Team or person we should contact if we need to follow up.'
  );

  addEvidence(
    '점검한 게임 링크 (배포 URL)  ·  Deployed game URL',
    '[KO] 검토 측에서 이 URL을 실제로 열어 2차 확인합니다. 반드시 지금 접속 가능한 배포 빌드 주소를 적어 주세요. ' +
    '로컬/개발 환경 주소는 접속이 안 되므로 확인이 불가능합니다.\n' +
    '[EN] The review side will open this URL to cross-check your answers. It must be a deployed build that is reachable right now — ' +
    'a local or dev address cannot be checked.'
  );

  addEvidence(
    '접속에 필요한 것 (테스트 계정, 진입 경로 등)  ·  Anything needed to get in',
    '[KO] 로그인이 필요하거나 특정 경로로 들어가야 하면 적어 주세요. 없으면 "없음". ' +
    '비밀번호를 여기 적지 마시고, 필요하면 별도로 전달해 주세요.\n' +
    '[EN] Note any sign-in or entry path required to reach the game. Write "none" if there is none. ' +
    'Do not put passwords in this field — send those separately if needed.'
  );

  // ---------- 기본 전제 / Baseline ----------
  addHeader(
    '기본 전제 / Baseline',
    '[KO] 매번 디폴트로 깔고 감. 이게 안 되면 나머지 항목이 무의미함.\n' +
    '[EN] Assumed every time. If these fail, nothing below matters.'
  );

  addChoice(
    '0-1. 모바일 UI 대응  ·  Mobile UI support',
    '[KO] 확인 방법: 실기기 또는 DevTools 모바일 에뮬레이션에서 세로/가로 둘 다, 여러 화면 크기(작은 폰~큰 폰~태블릿)로 확인.\n' +
    '· 버튼/텍스트가 겹치지 않는지 (특히 상단에 HUD·버튼이 몰리는 경우)\n' +
    '· 버튼이 의도한 위치에 정렬돼 있는지\n' +
    '· 고해상도(DPR 2~3배)에서 텍스트·숫자가 흐리거나 계단현상 없는지\n' +
    '· 좁은 화면에서 요소가 잘리거나 화면 밖으로 넘치지 않는지\n' +
    '함정: 데스크톱 창 크기만 줄여서 테스트하면 DPR 문제를 못 잡음. 픽셀비율 에뮬레이션까지 켤 것.\n\n' +
    '[EN] How: test on a real device or DevTools device emulation, in both portrait and landscape, across several screen sizes.\n' +
    '· No overlapping buttons or text, especially where the HUD and buttons crowd the top of the screen\n' +
    '· Buttons sit where they are supposed to\n' +
    '· On high-DPR screens (2-3x) text and numbers stay sharp, not blurry\n' +
    '· Nothing is clipped or pushed off-screen on narrow viewports\n' +
    'Pitfall: shrinking a desktop window will not reveal DPR problems. Turn on pixel-ratio emulation too.'
  );

  addChoice(
    '0-2. 버그 없는지 (플레이 전체 흐름)  ·  No bugs across a full play session',
    '[KO] 확인 방법: 시작부터 끝까지 실제 플레이. 반복 동작을 오래 지속했을 때 프레임 드랍 확인.\n' +
    '· 콘솔에 에러 로그가 안 뜨는지\n' +
    '· 같은 동작을 반복할수록 렉이 쌓이지 않는지 (메모리 누수 신호)\n' +
    '· 인트로/씬 전환이 끊기지 않는지\n' +
    '· 장시간 세션에서 이상 없는지\n' +
    '함정: 짧게 몇 번 하고 끝내면 누적 성능 저하를 못 잡음. 최소 몇 분 이상 연속 플레이.\n\n' +
    '[EN] How: play from start to finish. Watch for frame drops while repeating actions for a long stretch.\n' +
    '· No errors in the console\n' +
    '· Lag does not accumulate the longer you repeat the same action (a memory-leak signal)\n' +
    '· Intro and scene transitions stay smooth\n' +
    '· Nothing breaks during a long session\n' +
    'Pitfall: a few short attempts will not surface performance that degrades over time. Play for several minutes at minimum.'
  );

  // ---------- 심사 항목 / Review items ----------
  addHeader(
    '심사 항목 / Review items',
    '광고 · 결제 · 계정 · 언어 · 화면방향  /  Ads · payments · accounts · language · orientation'
  );

  // 1. 광고 + VX 동시 탑재 (게이트)
  addImage(
    typeof IMG_ENTRY_POINTS !== 'undefined' ? IMG_ENTRY_POINTS : null,
    'entry_points',
    '참고 그림 — 광고 진입점과 결제 진입점이란? / Reference — what counts as an ad or purchase entry point'
  );
  addChoice(
    '1. 광고 + VX 결제 동시 탑재  ·  Both ads and VX purchases are present',
    '[KO] 이 항목이 먼저인 이유: 광고나 결제가 애초에 안 붙어있으면 아래 2~5번(타임아웃·보상·결제창)은 테스트 자체가 성립하지 않음.\n' +
    '왜: 둘 다 붙어있어야 하는 경우, 하나만 빠져도 반려 사유.\n' +
    '확인 방법: 코드에서 광고 SDK와 결제 SDK가 둘 다 초기화되는지 확인(import/init 호출부). 그다음 실제 화면에서 광고 진입점(보상형 버튼, 전면광고 트리거)과 결제 진입점(상점, 구매 버튼)이 둘 다 노출되는지.\n' +
    '통과 기준: 두 진입점이 실제 화면에 존재하고 각각 정상 클릭 가능.\n' +
    '함정: "나중에 붙이기로" 한 쪽을 잊고 제출하는 경우. 코드 검색만으로 끝내지 말고 실제 화면까지 눌러볼 것.\n' +
    '계약상 광고나 VX가 아예 없는 빌드면 실패로 두고 맨 아래 서술 칸에 사유를 남길 것.\n\n' +
    '[EN] Why this comes first: if ads or payments are not wired up at all, items 2-5 cannot be tested.\n' +
    'Why: when the game must ship with both, missing either one is grounds for rejection.\n' +
    'How: confirm in code that both the ad SDK and the payment SDK initialise, then confirm on screen that both entry points exist — an ad trigger and a purchase entry point.\n' +
    'Pass: both entry points are visible in the running game and each responds to a click.\n' +
    'Pitfall: whichever one was postponed "for later" is the one that ships missing. Press both in the actual build.\n' +
    'If this build ships without ads or VX by agreement, mark Fail and explain in the final field.'
  );
  addEvidence(
    '1-a. 광고와 결제 진입점 위치  ·  Where are the ad and purchase entry points?',
    '[KO] 검토 측이 어디를 눌러야 광고와 결제가 나오는지 적어 주세요. ' +
    '예: "게임오버 팝업의 시간연장 버튼 = 보상형 광고 / 메인 우상단 상점 아이콘 = VX 결제".\n' +
    '[EN] Tell us exactly where to click to reach each one. ' +
    'e.g. "Extra-time button on the game-over popup = rewarded ad / shop icon top-right on main = VX purchase".'
  );

  // 2. 광고 타임아웃
  addChoice(
    '2. 광고 타임아웃 120초  ·  Ad timeout set to 120s',
    '[KO] 왜: 광고 SDK가 무응답이면 유저가 화면에 갇힘. 타임아웃이 짧으면 정상 로드 중인 광고도 실패 처리됨.\n' +
    '확인 방법: 광고 요청 함수의 타임아웃 값을 코드에서 직접 확인 (예: Verse8Ads.showRewarded({ placementId, timeoutMs: 120_000 })). 광고 종류별(보상형/전면)로 각각 확인.\n' +
    '통과 기준: 120초 설정. 무응답 재현 시 120초 후 페널티 없이 원래 화면 복귀.\n' +
    '함정: 광고 다이얼로그에 자체 자동-거절 타이머가 따로 있으면 SDK 타임아웃을 늘려도 UI가 먼저 닫혀 의미 없음.\n\n' +
    '[EN] Why: if the ad SDK stops responding the player is stuck. Too short a timeout fails ads that were loading fine.\n' +
    'How: read the timeout passed to the ad call directly in code (e.g. Verse8Ads.showRewarded({ placementId, timeoutMs: 120_000 })). Check each ad type separately.\n' +
    'Pass: set to 120s, and an unresponsive ad returns to the original screen after 120s with no penalty.\n' +
    'Pitfall: if the ad dialog has its own auto-decline timer, raising the SDK timeout changes nothing — the UI closes first.'
  );
  addEvidence(
    '2-a. 설정한 타임아웃 값과 코드 위치  ·  Timeout value and where it is set',
    '[KO] 예: "src/sdk/platformSDK.ts 의 showRewarded 호출, timeoutMs: 120_000". 광고 종류가 여러 개면 각각 적어 주세요.\n' +
    '[EN] e.g. "showRewarded call in src/sdk/platformSDK.ts, timeoutMs: 120_000". List each ad type if there is more than one.'
  );

  // 3. 광고 보상 (AI 재현 불가 → 증빙)
  addChoice(
    '3. 광고 시청 → 보상 지급  ·  Watching an ad actually grants the reward',
    '[KO] 왜: 코드 변경이 보상 조건부 로직에 영향 없는지 매번 실제로 눌러 확인 필요.\n' +
    '확인 방법: 실제 배포 빌드에서 광고 끝까지 시청 → 보상 지급 확인. 중간에 닫았을 때 보상이 안 들어오는지도 확인.\n' +
    '통과 기준: 완주 시 100% 지급. 중도 이탈 시 보상 없음 + 페널티도 없음(재도전 가능).\n' +
    '함정: 로컬/개발 환경은 광고 SDK가 unsupported_env로 떨어져 애초에 테스트 불가. 반드시 배포 빌드에서.\n\n' +
    '[EN] Why: any code change can quietly break the reward-on-success path, so press the button yourself every release.\n' +
    'How: on a deployed build, watch an ad to the end and confirm the reward arrives. Also close one midway and confirm no reward is granted.\n' +
    'Pass: full watch always grants the reward; early exit grants nothing but also costs nothing.\n' +
    'Pitfall: local/dev environments fail with unsupported_env, so this cannot be tested there. Use a deployed build.'
  );
  addEvidence(
    '3-a. 보상 지급을 어떻게 확인했는지 (증빙)  ·  How you verified the reward — evidence',
    '[KO] 이 항목은 검토 측에서 광고를 완주해 재현하기 어려우므로 증빙이 필요합니다. ' +
    '스크린샷/영상 링크, 또는 "광고 완주 후 시간 +15초 반영됨, 중도 종료 시 미지급 확인"처럼 무엇이 얼마나 지급됐는지 구체적으로 적어 주세요.\n' +
    '[EN] The review side cannot easily reproduce a full ad watch, so evidence is required. ' +
    'Give a screenshot/video link, or state concretely what was granted — e.g. "+15s added after full watch; nothing granted when closed early".'
  );

  // 4. 계정 저장 (AI 재현 불가 → 증빙)
  addImage(
    typeof IMG_ACCOUNT_SAVE !== 'undefined' ? IMG_ACCOUNT_SAVE : null,
    'account_save',
    '참고 그림 — 계정 단위 저장 vs 기기에만 저장 / Reference — account-bound vs device-only saves'
  );
  addChoice(
    '4. 계정 단위 데이터 저장  ·  Data saved per account, not per device',
    '[KO] 왜: 로컬 저장과 계정(서버) 저장이 섞이면 기기 변경·재설치 시 진행 상황을 잃음.\n' +
    '확인 방법: 1) PC에서 같은 계정 로그인 → 레벨·골드·최고기록을 올림  2) 모바일에서 같은 계정 로그인 → PC에서 쌓은 값이 반영되는지  3) 반대 방향(모바일 → PC)도 동일하게  4) 리더보드에 다른 유저 기록도 함께 보이는지\n' +
    '통과 기준: 기기를 바꿔도 값 유지. 리더보드에 여러 유저 기록 정상 노출.\n' +
    '함정: 랭킹은 계정 단위인데 HUD의 "최고 기록"만 로컬 저장이라, 새 기기에서 랭킹엔 기록이 있는데 화면 BEST는 0으로 보이는 불일치가 생김 — 둘 다 따로 확인. ' +
    '클라이언트에 계정 저장 로직이 있어도 서버 배포가 안 돼 있으면 조용히 로컬로 폴백함 — 네트워크 탭에서 서버 호출 성공 여부 확인.\n\n' +
    '[EN] Why: when local storage and account (server) storage get mixed up, players lose progress on device change or reinstall.\n' +
    'How: 1) sign in on PC and raise level / gold / best score  2) sign in on mobile with the same account and confirm the values carried over  3) repeat in the other direction  4) confirm the leaderboard shows other players too.\n' +
    'Pass: values survive a device switch; the leaderboard lists multiple users.\n' +
    'Pitfall: rankings can be account-based while the HUD "best score" is still local-only — on a new device the ranking shows a score but the on-screen BEST reads 0. Check both. ' +
    'Account-save code on the client means nothing if the server was never deployed; it silently falls back to local. Confirm in the Network tab that the server call succeeds.'
  );
  addEvidence(
    '4-a. 기기 간 확인을 어떻게 했는지 (증빙)  ·  How you verified cross-device — evidence',
    '[KO] 이 항목은 검토 측에서 제작자 계정으로 로그인해 재현할 수 없으므로 증빙이 필요합니다. ' +
    '어떤 값을 어느 기기에서 올리고 어느 기기에서 확인했는지, 그리고 무엇이 계정에 저장되는지(최고기록/재화/레벨) 적어 주세요. 스크린샷 링크가 있으면 함께.\n' +
    '[EN] The review side cannot sign in as you, so evidence is required. ' +
    'State which value you raised on which device and where you confirmed it, and what exactly is account-bound (best score / currency / level). Add screenshot links if you have them.'
  );

  // 5. VX 결제 버튼 (결제 완료는 AI 불가 → 증빙)
  addChoice(
    '5. VX(인앱결제) 상품 결제 버튼  ·  VX in-app purchase buttons open checkout',
    '[KO] 왜: 결제 버튼이 안 눌리거나 결제창이 안 뜨면 심사 반려 + 매출 손실.\n' +
    '확인 방법: 상점/상품 화면에서 각 VX 상품 결제 버튼을 눌러 결제창이 실제로 뜨는지. 상품이 여러 개면 전부.\n' +
    '통과 기준: 모든 VX 상품에서 결제창 정상 노출. 결제 완료 후 재화가 계정에 귀속되어 기기 변경에도 유지.\n' +
    '함정: 테스트 결제(샌드박스)와 실 결제 환경의 상품 ID가 다르면 심사 빌드에서 상품을 못 찾아 결제창이 안 뜸. ' +
    'VX 상품이 있으면 4번 계정 단위 저장 확인을 절대 생략하지 말 것 — 돈 주고 산 게 사라지는 이슈로 직결.\n\n' +
    '[EN] Why: a purchase button that does nothing means both a review rejection and lost revenue.\n' +
    'How: press the buy button on every VX product and confirm the checkout sheet actually opens. Test all products.\n' +
    'Pass: checkout opens for every VX product, and purchased currency is account-bound so it survives a device change.\n' +
    'Pitfall: if sandbox and production product IDs differ, the review build cannot find the product and checkout never opens. ' +
    'If the game has VX products, never skip item 4 — currency that only exists locally means players lose what they paid for.'
  );
  addEvidence(
    '5-a. VX 상품 개수와 결제 완료 확인 여부  ·  Number of VX products, and whether a purchase was completed',
    '[KO] 상품이 몇 개인지, 그중 몇 개에서 결제창까지 확인했는지 적어 주세요. ' +
    '검토 측은 결제창이 뜨는 것까지만 확인하고 실제 결제는 진행하지 않으므로, 결제 완료 후 재화 지급까지 확인했다면 그 결과를 여기에 적어 주세요.\n' +
    '[EN] State how many VX products exist and for how many you confirmed checkout opens. ' +
    'The review side will only check that checkout opens — it will not complete a purchase — so if you verified that currency is actually granted after paying, report that here.'
  );

  // 6. Description 다국어
  addChoice(
    '6. 스토어 등록정보 Description 다국어(EN/KO)  ·  Store description filled in both EN and KO',
    '[KO] 왜: Verse8에 게임 설명 등록 시 영어/한국어 둘 다 채워야 함. 한쪽만 등록하면 반려 또는 빈 설명 노출.\n' +
    '확인 방법: Verse8 등록 화면에서 Description 입력란이 언어별로 분리돼 있는지 확인하고, EN/KO 둘 다 실제 값이 채워졌는지.\n' +
    '통과 기준: EN, KO 모두 공란 없이 등록 완료.\n' +
    '함정: 기본 언어만 채우고 영어 탭은 비운 채 제출하는 경우가 많음. 미리보기엔 기본 언어만 보여서 놓치기 쉬움 — 언어 탭을 하나씩 눌러 확인.\n\n' +
    '[EN] Why: Verse8 needs the store description in both English and Korean. Filling only one gets the submission rejected, or shows an empty description to the other locale.\n' +
    'How: check whether Description has a separate field per language, then confirm both EN and KO actually contain text.\n' +
    'Pass: both language fields are filled, neither is blank.\n' +
    'Pitfall: people fill the default language and leave the English tab empty. The preview only shows the default language — click through each language tab yourself.'
  );

  // 7. 화면 방향
  addImage(
    typeof IMG_ORIENTATION !== 'undefined' ? IMG_ORIENTATION : null,
    'orientation',
    '참고 그림 — 화면 방향 지원 모드 세 가지 / Reference — the three orientation modes'
  );
  addChoice(
    '7-1. 이 게임의 화면 방향 지원 모드  ·  Which orientation does this game support?',
    '[KO] 먼저 이 게임이 어느 모드로 기획됐는지 선택. 다음 문항(7-2)에서 실제 동작이 그 선택과 일치하는지 확인함. ' +
    '검토 측도 이 선언을 기준으로 실제 회전 동작을 확인합니다.\n' +
    '[EN] Declare which mode this game was designed for. Question 7-2 then checks whether the build behaves that way — ' +
    'and the review side rotates the build against this declaration.',
    ['세로 전용 / Portrait only', '가로 전용 / Landscape only', '둘 다 지원 / Both supported']
  );

  addChoice(
    '7-2. 선택한 방향 모드대로 실제 동작하는지  ·  Build matches the declared orientation mode',
    '[KO] 확인 방법: 전용 모드(세로/가로)를 선택했으면 반대 방향으로 돌렸을 때 실제로 방향이 고정되는지 확인. ' +
    '둘 다 지원을 선택했으면 세로↔가로 전환 시 버튼·HUD·다이얼로그가 각 방향에서 정상 재배치되는지 확인.\n' +
    '통과 기준: 7-1에서 선언한 모드와 실제 동작이 일치. 둘 다 지원이면 두 방향 모두 겹침·잘림 없음.\n' +
    '함정: 방향 잠금 없이 "일단 둘 다 되긴 하는" 상태면 실제로는 한쪽만 테스트됐을 가능성이 큼.\n\n' +
    '[EN] How: if you picked a single-orientation mode, rotate the device the other way and confirm it really stays locked. ' +
    'If you picked both, rotate between portrait and landscape and confirm buttons, HUD and dialogs re-lay-out correctly in each.\n' +
    'Pass: the build behaves exactly as declared in 7-1. If both are supported, neither orientation has overlapping or clipped elements.\n' +
    'Pitfall: a game left unlocked that "happens to work both ways" has usually only been tested in one of them.'
  );

  // 8. 게임 내 언어
  addImage(
    typeof IMG_LANGUAGE !== 'undefined' ? IMG_LANGUAGE : null,
    'language',
    '참고 그림 — 언어를 바꾸면 레이아웃도 바뀐다 / Reference — switching language also changes layout'
  );
  addChoice(
    '8. 게임 내 언어(한국어/영어) UI 지원  ·  In-game UI supports both Korean and English',
    '[KO] 왜: 6번 Description과 별개. 그건 스토어 소개글, 이건 게임 실행 중 화면 안 텍스트.\n' +
    '확인 방법: 언어 전환 기능이 있으면 한국어↔영어를 바꿔가며 모든 화면(메인, 팝업, 결과창, 상점)을 다 확인. 전환 UI 없이 기기 로케일을 따르는 구조면 기기 언어를 바꿔가며 동일하게.\n' +
    '통과 기준: 두 언어 모두 번역 누락(원문 노출) 없음. 텍스트 길이 차이로 버튼·문구가 잘리거나 겹치지 않음.\n' +
    '함정: 언어 전환이 텍스트뿐 아니라 버튼 폭·줄바꿈까지 바꿔서 특정 언어에서만 상단 레이아웃이 깨지는 경우가 있음 — 전환 직후 화면 전체를 다시 훑을 것.\n\n' +
    '[EN] Why: separate from item 6. That is the store listing; this is the text inside the running game.\n' +
    'How: if there is a language toggle, switch between Korean and English and walk through every screen (main, popups, results, shop). If it follows the device locale instead, change the device language and do the same.\n' +
    'Pass: no untranslated strings in either language, and nothing clipped or overlapping because of text-length differences.\n' +
    'Pitfall: switching language changes button widths and line wrapping, not just the words — a layout can break in one language only.'
  );
  addEvidence(
    '8-a. 언어 전환은 어디서 하나요  ·  Where is the language switch?',
    '[KO] 검토 측이 직접 전환해 볼 수 있도록 위치를 적어 주세요. 예: "메인 화면 우상단 KR/EN 토글". ' +
    '전환 UI 없이 기기 언어를 따라간다면 그렇게 적어 주세요.\n' +
    '[EN] Tell us where to switch so the review side can try it — e.g. "KR/EN toggle, top-right of the main screen". ' +
    'If there is no toggle and it follows the device locale, say so.'
  );

  // ---------- 마무리 / Wrap-up ----------
  addHeader('마무리 / Wrap-up');

  addParagraph(
    '실패 항목 상세  ·  Details for anything marked Fail',
    '[KO] 위에서 "실패"로 표시한 항목이 있으면 번호와 증상을 적어 주세요. 없으면 "없음".\n' +
    '이 빌드에 광고나 VX가 계약상 아예 없어서 항목 자체가 성립하지 않는 경우에도 여기에 사유를 남겨 주세요 ' +
    '— 판정에 "해당없음"을 두지 않는 이유는, 확인 안 한 항목을 조용히 넘기는 통로가 되기 때문입니다.\n\n' +
    '[EN] For each item marked Fail, give the item number and what you saw. Write "none" if nothing failed.\n' +
    'Also use this field when an item genuinely does not apply (e.g. this build ships without ads or VX by agreement). ' +
    'There is deliberately no "N/A" verdict, because it becomes a quiet way to skip an item you never checked.',
    true
  );

  addParagraph(
    '기타 특이사항  ·  Anything else worth noting',
    '[KO] 검토 측이 알고 있어야 할 점이 있으면 적어 주세요. 예: 특정 기기에서만 재현되는 알려진 이슈, 아직 작업 중인 부분.\n' +
    '[EN] Anything the review side should know — e.g. a known issue that only reproduces on a specific device, or work still in progress.',
    false
  );

  // ---------- 응답 스프레드시트 연결 / Link a response spreadsheet ----------
  // 이걸 안 하면 응답이 폼 안에만 쌓이고 시트로는 안 나감.
  var ss = RESPONSE_SPREADSHEET_ID
    ? SpreadsheetApp.openById(RESPONSE_SPREADSHEET_ID)
    : SpreadsheetApp.create('원스토어 QA 체크리스트 — 응답 기록 / QA responses');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // setDestination 직후에는 응답 시트가 아직 안 잡힐 수 있어 다시 열어서 찾는다.
  // 기존 시트에 붙인 경우 첫 번째 탭이 아니라 방금 생긴 응답 탭을 찾아야 한다.
  SpreadsheetApp.flush();
  var sheet = findResponseSheet_(ss.getId(), form.getId());

  // 판정 열에만 색 규칙. 열 번호는 문항을 추가하며 자동으로 모아둔 verdictCols 사용
  // — 문항을 끼워넣어도 서식이 어긋나지 않는다.
  try {
    var ranges = verdictCols.map(function (c) {
      var L = colLetter(c);
      return sheet.getRange(L + '2:' + L);
    });
    var fail = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('Fail')
      .setBackground('#f8d7da')
      .setFontColor('#8b1a1a')
      .setRanges(ranges)
      .build();
    var pass = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('Pass')
      .setBackground('#d9ede4')
      .setRanges(ranges)
      .build();
    sheet.setConditionalFormatRules([fail, pass]);
    sheet.setFrozenRows(1);
  } catch (e) {
    Logger.log('색 규칙 적용 실패(폼/응답은 정상) / colour rules failed, form still fine: ' + e);
  }

  Logger.log('응답용 링크 (제작자에게 배포, 로그인 불필요) / Share with developers: ' + form.getPublishedUrl());
  Logger.log('편집용 링크 (본인만) / Edit: ' + form.getEditUrl());
  Logger.log('응답 스프레드시트 / Responses: ' + ss.getUrl());
  Logger.log('응답 탭 / Response tab: ' + (sheet ? sheet.getName() : '(못 찾음)'));
  Logger.log('판정 열 / verdict columns: ' + verdictCols.map(colLetter).join(', '));
}

/**
 * 폼이 만든 응답 탭을 찾는다.
 * 기존 스프레드시트에 붙이면 탭이 여러 개라 getSheets()[0]으로는 엉뚱한 걸 잡는다.
 * getFormUrl()이 이 폼을 가리키는 탭만 진짜 응답 탭이다.
 */
function findResponseSheet_(spreadsheetId, formId) {
  var sheets = SpreadsheetApp.openById(spreadsheetId).getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var url = sheets[i].getFormUrl();
    if (url && url.indexOf(formId) !== -1) return sheets[i];
  }
  return null;
}

/**
 * 이미 배포해서 쓰고 있는 폼의 응답 대상만 옮긴다. (문항은 그대로)
 *
 * 쓰는 법: OLD_RESPONSE_SPREADSHEET_ID 에 지금 응답이 쌓이는 시트 ID를 넣고,
 * 함수 목록에서 이 함수를 골라 실행.
 *
 * 주의
 *  - 이전 응답은 따라오지 않는다. 옮긴 시점부터의 제출만 새 시트에 쌓인다.
 *  - 폼의 응답 대상은 하나뿐이라, 옮기면 이전 시트로는 더 이상 안 들어온다.
 *    (이전 시트에 쌓여 있던 기록 자체는 지워지지 않는다)
 */
function moveExistingFormDestination() {
  var OLD_RESPONSE_SPREADSHEET_ID = '1f3xy_ykhb02aYRyQUI9VzTQwnP-XxcJM1_OOSy_pxe8';

  if (!RESPONSE_SPREADSHEET_ID) {
    throw new Error('RESPONSE_SPREADSHEET_ID가 비어 있다. 옮길 대상 시트 ID를 먼저 넣을 것.');
  }

  // 폼 ID를 몰라도 된다 — 지금 응답이 쌓이는 시트가 폼 주소를 들고 있다.
  var oldSheets = SpreadsheetApp.openById(OLD_RESPONSE_SPREADSHEET_ID).getSheets();
  var formUrl = null;
  for (var i = 0; i < oldSheets.length; i++) {
    formUrl = oldSheets[i].getFormUrl();
    if (formUrl) break;
  }
  if (!formUrl) throw new Error('이 시트에 연결된 폼을 못 찾았다. ID를 확인할 것.');

  var form = FormApp.openByUrl(formUrl);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, RESPONSE_SPREADSHEET_ID);
  SpreadsheetApp.flush();

  var moved = findResponseSheet_(RESPONSE_SPREADSHEET_ID, form.getId());
  Logger.log('옮긴 폼 / Form: ' + form.getTitle());
  Logger.log('새 응답 시트 / New destination: ' + SpreadsheetApp.openById(RESPONSE_SPREADSHEET_ID).getUrl());
  Logger.log('새 응답 탭 / New tab: ' + (moved ? moved.getName() : '(다음 제출 때 생김)'));
}
