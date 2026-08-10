/**
 * Verse8 · 원스토어 출시 전 게임 점검표 — Google Form 자동 생성 스크립트
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
 * 셀프 신고이므로 "통과" 표시만으로는 검증 가치가 없다. 그래서
 *   - AI가 직접 확인 가능한 항목  → "어디를 눌러야 하는지" 위치를 받는다
 *   - AI가 재현 불가능한 항목      → 증빙(스크린샷/영상 링크, 확인 절차)을 받는다
 * AI 재현 불가 항목: 광고 완주 보상, 기기 간 계정 저장, 실제 결제 완료.
 *
 * ---------------------------------------------------------------------------
 * 문항 형식 — 통과/실패가 아니라 체크박스인 이유
 *
 * 예전에는 "0-1 모바일 UI 대응 = 통과/실패" 한 문항이었는데, 그 안에 실제로
 * 확인할 것이 겹침·정렬·선명도·잘림 네 가지 들어 있었다. 하나로 뭉치면 응답자는
 * 어디까지 봤는지 스스로도 모른 채 "통과"를 누르고, 검토 측은 무엇이 확인됐는지
 * 알 수 없다. 그래서 확인 항목이 여럿인 문항은 체크박스로 쪼갰다.
 * 하나의 사실로 판정되는 항목(광고 대기시간, 방향 동작)만 통과/실패로 남겼다.
 *
 * 문구는 비개발자 기준으로 쓴다. AI로 게임을 만든 제작자가 다수라
 * DevTools · DPR · SDK · timeoutMs 같은 말이 나오면 답을 못 한다.
 * ---------------------------------------------------------------------------
 *
 * 쓰는 법 / How to run
 *  1. https://script.google.com 접속 → "새 프로젝트"
 *  2. 편집기 내용 전부 지우고 이 파일 전체를 붙여넣기
 *  2-1. 왼쪽 "파일 +" 로 스크립트 파일을 하나 더 만들고(이름 아무거나),
 *       원스토어_QA체크리스트_이미지데이터.gs 내용을 통째로 붙여넣기.
 *       비개발자용 설명 다이어그램 4장이 base64 PNG로 들어 있음 — 외부 호스팅 불필요.
 *       이 파일을 안 넣어도 폼은 정상 생성되고 이미지만 빠진다(아래 addImage가 조용히 건너뜀).
 *  3. 상단 함수 목록에서 함수를 고르고 "실행"
 *       - 처음 만들 때        → createQaChecklistForm
 *       - 이미 배포한 폼 갱신  → rebuildExistingForm   ← 문항을 고쳤을 때 이것
 *  4. 최초 1회 권한 승인 (Google 폼 + 스프레드시트 생성 권한)
 *  5. 실행 로그에 나오는 링크 확인
 *
 * createQaChecklistForm 은 두 번째 실행부터 가드가 막는다(아래 ALLOW_NEW_FORM 참고).
 * 응답 탭이 여러 개로 늘어나 어느 게 진짜인지 헷갈리면 listResponseTabs 실행.
 * 모든 문항은 한국어 + 영어 병기. 해외 제작자도 그대로 쓸 수 있음.
 *
 * "해당없음" 선택지는 두지 않는다 — 확인 안 한 항목을 조용히 넘기는 통로가 되기
 * 때문. 항목 자체가 성립하지 않는 경우는 마지막 서술 칸에 사유를 적는다.
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

/**
 * 재실행 가드.
 *
 * createQaChecklistForm 은 실행할 때마다 폼을 통째로 새로 만든다. 이미 배포한
 * 폼이 있는 상태에서 또 실행하면 새 폼이 생기고, 그 새 폼이 응답 스프레드시트에
 * 탭을 하나 더 만든다. 배포해 둔 링크는 여전히 예전 폼이라 응답은 예전 탭에
 * 쌓이고, 새로 생긴 탭은 계속 비어 있다 — 응답 시트가 "자꾸 바뀌는" 것처럼 보이는
 * 원인이 이것이다.
 *
 * 그래서 만든 폼 ID를 스크립트 속성에 적어두고 두 번째 실행부터는 멈춘다.
 * 정말 별개의 폼이 필요할 때만 true 로 바꿀 것.
 */
var ALLOW_NEW_FORM = false;
var FORM_ID_PROPERTY = 'QA_FORM_ID';

var FORM_TITLE = '원스토어 출시 전 게임 점검표 / Pre-release Game Checklist';

var FORM_DESCRIPTION =
  '게임을 올리기 전에 만드신 분이 직접 확인하는 점검표입니다. ' +
  '제출하신 게임 주소로 검토팀이 한 번 더 확인합니다.\n' +
  '실제로 눌러보고 확인한 것만 체크해 주세요. 10~15분 정도 걸립니다.\n\n' +
  'A self-check by the person who made the game. After you submit, our reviewers open your link ' +
  'and check it themselves. Only tick what you actually tried. Takes 10-15 minutes.';

// ---------------------------------------------------------------------------
// 진입점 / Entry points
// ---------------------------------------------------------------------------

/**
 * 폼을 새로 만든다. 이미 만든 폼이 있으면 가드가 막는다.
 */
function createQaChecklistForm() {
  assertNoExistingForm_();

  var form = FormApp.create(FORM_TITLE);
  var verdictCols = buildFormItems_(form);

  // ---------- 응답 스프레드시트 연결 / Link a response spreadsheet ----------
  // 이걸 안 하면 응답이 폼 안에만 쌓이고 시트로는 안 나감.
  var ss = RESPONSE_SPREADSHEET_ID
    ? SpreadsheetApp.openById(RESPONSE_SPREADSHEET_ID)
    : SpreadsheetApp.create('원스토어 게임 점검표 — 응답 기록 / QA responses');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // setDestination 직후에는 응답 시트가 아직 안 잡힐 수 있어 다시 열어서 찾는다.
  // 기존 시트에 붙인 경우 첫 번째 탭이 아니라 방금 생긴 응답 탭을 찾아야 한다.
  SpreadsheetApp.flush();
  var sheet = findResponseSheet_(ss.getId(), form.getId());
  paintVerdictColumns_(sheet, verdictCols);

  // 만든 폼을 기억해 둔다. 다음 실행 때 assertNoExistingForm_ 이 이걸 보고 막는다.
  PropertiesService.getScriptProperties().setProperty(FORM_ID_PROPERTY, form.getId());

  Logger.log('응답용 링크 (제작자에게 배포, 로그인 불필요) / Share with developers: ' + form.getPublishedUrl());
  Logger.log('편집용 링크 (본인만) / Edit: ' + form.getEditUrl());
  Logger.log('응답 스프레드시트 / Responses: ' + ss.getUrl());
  Logger.log('응답 탭 / Response tab: ' + (sheet ? sheet.getName() : '(못 찾음)'));
  Logger.log('판정 열 / verdict columns: ' + verdictCols.map(colLetter_).join(', '));
}

/**
 * 이미 배포해 쓰고 있는 폼의 문항을 이 파일 내용으로 갈아끼운다.
 *
 * 폼 주소가 그대로라 배포한 링크를 다시 뿌릴 필요가 없다. 응답 스프레드시트
 * 연결도 유지된다. 문항을 고쳤을 때 쓰는 함수는 이것이다 —
 * createQaChecklistForm 을 다시 돌리면 폼이 하나 더 생긴다.
 *
 * ⚠️ 기존 문항을 전부 지우고 새로 넣는다. 그래서
 *  - 응답 스프레드시트에 이미 쌓인 데이터는 그대로 남는다 (열도 지워지지 않는다)
 *  - 다만 새 문항은 시트 오른쪽에 새 열로 붙는다. 문항 이름이 바뀌었으면
 *    예전 열과 새 열이 나란히 생겨 시트가 넓어진다.
 *  - 폼 안에 저장된 기존 응답에서는 지워진 문항의 답이 사라진다.
 * 실제 응답이 쌓이기 전에 돌리는 것이 가장 깔끔하다.
 */
function rebuildExistingForm() {
  var form = openManagedForm_();

  var items = form.getItems();
  for (var i = items.length - 1; i >= 0; i--) {
    form.deleteItem(items[i]);
  }
  Logger.log('기존 문항 ' + items.length + '개 삭제 / removed ' + items.length + ' items');

  var verdictCols = buildFormItems_(form);

  var sheet = RESPONSE_SPREADSHEET_ID
    ? findResponseSheet_(RESPONSE_SPREADSHEET_ID, form.getId())
    : null;
  paintVerdictColumns_(sheet, verdictCols);

  Logger.log('갱신한 폼 / Rebuilt: ' + form.getTitle());
  Logger.log('응답용 링크 (그대로) / Published (unchanged): ' + form.getPublishedUrl());
  Logger.log('편집용 링크 / Edit: ' + form.getEditUrl());
  Logger.log('판정 열 / verdict columns: ' + verdictCols.map(colLetter_).join(', '));
}

/**
 * 이 스크립트가 관리하는 폼을 연다.
 * 스크립트 속성에 기록이 없으면 응답 스프레드시트에서 역으로 찾아 기록해 둔다.
 */
function openManagedForm_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(FORM_ID_PROPERTY);

  if (id) {
    try {
      return FormApp.openById(id);
    } catch (e) {
      Logger.log('기록된 폼을 열 수 없어 기록을 비운다: ' + id);
      props.deleteProperty(FORM_ID_PROPERTY);
    }
  }

  // 기록이 없으면 응답 시트에 연결된 폼을 찾는다.
  var sheets = SpreadsheetApp.openById(RESPONSE_SPREADSHEET_ID).getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var url = sheets[i].getFormUrl();
    if (!url) continue;
    try {
      var found = FormApp.openByUrl(url);
      props.setProperty(FORM_ID_PROPERTY, found.getId());
      Logger.log('응답 시트에서 폼을 찾아 기록했다 / found via response sheet: ' + found.getTitle());
      return found;
    } catch (e) { /* 권한 없는 폼은 건너뛴다 */ }
  }

  throw new Error(
    '갱신할 폼을 찾지 못했다.\n' +
    '  · 아직 폼을 안 만들었으면 → createQaChecklistForm 실행\n' +
    '  · 폼은 있는데 못 찾으면   → listResponseTabs 로 어느 폼인지 확인 후,\n' +
    '    스크립트 속성 ' + FORM_ID_PROPERTY + ' 에 폼 ID를 직접 넣을 것'
  );
}

// ---------------------------------------------------------------------------
// 문항 본문 / Form items
// createQaChecklistForm 과 rebuildExistingForm 이 같이 쓴다.
// 반환값은 통과/실패 문항이 떨어진 응답 시트 열 번호.
// ---------------------------------------------------------------------------

function buildFormItems_(form) {
  form.setDescription(FORM_DESCRIPTION);
  form.setProgressBar(true);
  form.setAllowResponseEdits(true);   // 제출 후에도 수정 가능 / responses stay editable
  form.setLimitOneResponsePerUser(false);
  form.setShowLinkToRespondAgain(true);

  // 응답 시트의 A열은 타임스탬프. 이후 질문이 추가된 순서대로 한 열씩 차지한다.
  // 판정 문항이 어느 열에 떨어지는지 손으로 세면 문항을 하나 끼워넣을 때마다
  // 조건부 서식이 어긋나므로, 추가하면서 자동으로 기록한다.
  var colIndex = 1;              // A = 타임스탬프
  var verdictCols = [];          // 통과/실패 문항이 떨어진 열 번호

  var VERDICTS = ['통과 / Pass', '실패 / Fail'];

  /** 통과/실패 판정 문항. 하나의 사실로 판정되는 항목에만 쓴다. */
  var addVerdict = function (title, help) {
    form.addMultipleChoiceItem()
      .setTitle(title)
      .setHelpText(help)
      .setChoiceValues(VERDICTS)
      .setRequired(true);
    colIndex++;
    verdictCols.push(colIndex);
  };

  /** 선택지가 따로 있는 객관식(방향 모드 등). 판정이 아니라 색칠하지 않는다. */
  var addChoice = function (title, help, choices) {
    form.addMultipleChoiceItem()
      .setTitle(title)
      .setHelpText(help)
      .setChoiceValues(choices)
      .setRequired(true);
    colIndex++;
  };

  /**
   * 확인할 것이 여럿인 항목. 체크한 것만 확인된 것으로 본다.
   * 전부 필수로 걸지 않는다 — 못 한 확인을 억지로 체크하게 만들면 폼의 의미가 없다.
   * 대신 마무리의 '체크하지 못한 항목'에 적게 한다.
   */
  var addChecks = function (title, help, options) {
    form.addCheckboxItem()
      .setTitle(title)
      .setHelpText(help)
      .setChoiceValues(options)
      .setRequired(false);
    colIndex++;
  };

  /** 짧은 서술 칸 */
  var addText = function (title, help, required) {
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

  // ======================= 1. 기본 정보 =======================
  addHeader('1. 기본 정보 · Basics');

  addText('게임 이름  ·  Game title', '');

  addText(
    '만든 분 / 팀  ·  Who made it',
    '연락이 필요할 때 답해 주실 수 있는 분으로 적어 주세요.\n' +
    'Someone we can contact if we need to follow up.'
  );

  addText(
    '게임 주소  ·  Link to the game',
    '검토팀이 이 주소로 직접 들어가 봅니다. 지금 접속되는 주소여야 합니다.\n' +
    '내 컴퓨터에서만 열리는 주소(localhost 등)는 확인이 불가능합니다.\n\n' +
    'The reviewer opens this link. It has to work right now — an address that only opens ' +
    'on your own computer cannot be checked.'
  );

  addText(
    '들어가는 데 필요한 게 있나요?  ·  Anything needed to get in',
    '로그인이 필요하거나 특정 경로로 들어가야 하면 적어 주세요. 없으면 "없음".\n' +
    '비밀번호는 여기 적지 마시고 따로 전달해 주세요.\n\n' +
    'Note any sign-in or path needed. Write "none" if there is none. Do not put passwords here.'
  );

  // ======================= 2. 화면 =======================
  addHeader('2. 화면 · Display', '휴대폰에서 제대로 보이는지 확인합니다 / How it looks on a phone');

  addChecks(
    '휴대폰에서 화면이 제대로 나오나요?  ·  Does it display correctly on a phone?',
    '확인한 것만 체크해 주세요. 실제 휴대폰으로 봐주세요 — 컴퓨터 창을 줄이는 것만으로는 ' +
    '안 잡히는 문제가 있습니다.\n' +
    '자주 나오는 실수: 큰 폰에서만 확인하고 작은 폰을 안 봄.\n' +
    '체크하지 못한 항목이 있으면 맨 아래 칸에 적어 주세요.\n\n' +
    'Tick only what you checked. Use a real phone — shrinking a desktop window hides some problems.',
    [
      '버튼과 글자가 서로 겹치지 않음 / Nothing overlaps',
      '버튼이 있어야 할 자리에 있음 / Buttons sit where they should',
      '글자와 숫자가 또렷함 (뿌옇거나 깨지지 않음) / Text stays sharp',
      '화면 밖으로 잘려 나간 게 없음 / Nothing is cut off'
    ]
  );

  addChecks(
    '처음부터 끝까지 해봤을 때 문제가 없나요?  ·  Does a full play session run cleanly?',
    '최소 몇 분은 계속 플레이해 주세요. 짧게 몇 번 해보면 시간이 지나야 나타나는 문제를 놓칩니다.\n' +
    '자주 나오는 실수: 1분 해보고 괜찮다고 판단.\n\n' +
    'Play for several minutes at least. A few short attempts will not surface problems that ' +
    'only appear over time.',
    [
      '처음부터 끝까지 한 판을 끝내 봤음 / Played one full run',
      '오래 할수록 점점 느려지지 않음 / Does not get slower over time',
      '화면이 바뀔 때 끊기지 않음 / Transitions stay smooth',
      '갑자기 멈추거나 튕기지 않음 / No freezes or crashes'
    ]
  );

  // ======================= 3. 광고 =======================
  addHeader('3. 광고 · Ads');

  addImage(
    typeof IMG_ENTRY_POINTS !== 'undefined' ? IMG_ENTRY_POINTS : null,
    'entry_points',
    '참고 그림 — 광고 버튼과 결제 버튼이란? / Reference — what counts as an ad or purchase button'
  );

  addChecks(
    '게임에 광고와 결제가 둘 다 들어가 있나요?  ·  Are both ads and purchases in the game?',
    '코드에만 있고 화면에 안 보이면 없는 것과 같습니다. 실제로 눌러보고 체크해 주세요.\n' +
    '자주 나오는 실수: "나중에 붙이기로" 한 쪽을 잊고 제출.\n\n' +
    'If it exists in code but not on screen, it does not count. Press both in the real build.',
    [
      '광고를 보는 버튼이 있음 (예: "광고 보고 이어하기") / There is an ad button',
      '결제하는 곳이 있음 (예: 상점, 구매 버튼) / There is a place to buy'
    ]
  );

  addText(
    '광고 버튼과 결제 버튼은 어디에 있나요?  ·  Where are they?',
    '검토팀이 찾아 들어갈 수 있게 위치를 적어 주세요.\n' +
    '예: "게임오버 창의 \'시간 늘리기\' 버튼 = 광고 / 오른쪽 위 상점 아이콘 = 결제"\n\n' +
    'Tell us exactly what to click to reach each one.'
  );

  addVerdict(
    '광고가 안 뜰 때 게임이 멈추지 않나요?  ·  If an ad never loads, does the game recover?',
    '광고가 응답하지 않아도 2분(120초) 뒤에는 원래 화면으로 돌아와야 합니다. ' +
    '그 사이 유저가 손해 보는 것도 없어야 합니다.\n' +
    '자주 나오는 실수: 대기 시간을 늘려도, 광고 창이 자체 타이머로 먼저 닫혀서 소용없는 경우.\n\n' +
    'An unresponsive ad must return to the previous screen after 120s, with no penalty to the player.'
  );

  addText(
    '대기 시간을 직접 설정하셨다면 어디에 있는지 알려주세요  ·  Where is the timeout set?',
    '직접 코드를 만지지 않으셨다면 비워두셔도 됩니다.\n' +
    'Optional — leave blank if you did not set this yourself.',
    false
  );

  addChecks(
    '광고를 끝까지 보면 보상이 제대로 들어오나요?  ·  Does watching an ad give the reward?',
    '실제 배포된 주소에서 확인해 주세요. 만드는 중인 화면에서는 광고가 아예 안 나옵니다.\n\n' +
    'Check on the deployed link. Ads do not run in a local or development environment.',
    [
      '끝까지 보면 보상이 들어옴 / Full watch gives the reward',
      '중간에 닫으면 보상이 안 들어옴 / Closing early gives nothing',
      '중간에 닫아도 불이익은 없음 (다시 도전 가능) / Closing early costs nothing either'
    ]
  );

  addText(
    '보상을 어떻게 확인하셨나요?  ·  How did you check the reward?',
    '검토팀이 광고를 끝까지 보고 확인하기 어려워서 여쭙습니다.\n' +
    '예: "광고 다 보니 시간이 15초 늘어남 / 중간에 닫으니 안 늘어남"\n' +
    '스크린샷이나 영상 링크가 있으면 함께 주세요.\n\n' +
    'We cannot easily reproduce a full ad watch, so please describe what you saw.'
  );

  // ======================= 4. 저장과 결제 =======================
  addHeader('4. 저장과 결제 · Saving and payments');

  addImage(
    typeof IMG_ACCOUNT_SAVE !== 'undefined' ? IMG_ACCOUNT_SAVE : null,
    'account_save',
    '참고 그림 — 계정에 저장 vs 이 기기에만 저장 / Reference — account-bound vs device-only saves'
  );

  addChecks(
    '게임 기록이 계정에 저장되나요?  ·  Is progress saved to the account?',
    '기기에만 저장되면 폰을 바꾸거나 다시 설치할 때 기록이 전부 사라집니다.\n' +
    '자주 나오는 실수: 순위표에는 점수가 있는데 화면의 \'최고 기록\'은 0으로 나오는 경우 — ' +
    '둘은 따로 저장돼 있을 수 있으니 각각 확인해 주세요.\n\n' +
    'Device-only saves are lost on a new phone or a reinstall. Rankings and the on-screen best ' +
    'score can be stored separately — check both.',
    [
      '컴퓨터에서 올린 기록이 휴대폰에서도 보임 / PC to phone carries over',
      '휴대폰에서 올린 기록이 컴퓨터에서도 보임 / Phone to PC carries over',
      '화면의 \'최고 기록\'도 기기를 바꿔도 유지됨 / On-screen best score survives too',
      '순위표에 다른 사람 기록도 함께 나옴 / Leaderboard shows other players'
    ]
  );

  addText(
    '기기 두 개로 어떻게 확인하셨나요?  ·  How did you check across two devices?',
    '검토팀은 만드신 분의 계정으로 로그인할 수 없어 재현이 안 됩니다.\n' +
    '예: "컴퓨터에서 레벨 5까지 올린 뒤 휴대폰으로 접속하니 레벨 5로 나옴"\n\n' +
    'We cannot sign in as you, so please describe what you did.'
  );

  addChecks(
    '결제 버튼을 누르면 결제창이 뜨나요?  ·  Does the checkout open when you press buy?',
    '상품이 여러 개면 전부 눌러봐 주세요.\n' +
    '자주 나오는 실수: 테스트할 때와 실제 등록한 상품 번호가 달라서, 심사용 빌드에서만 ' +
    '결제창이 안 뜨는 경우.\n\n' +
    'Press buy on every product. Mismatched test and production product IDs are the usual cause ' +
    'of a checkout that never opens.',
    [
      '상품을 전부 눌러봤고 모두 결제창이 떴음 / Checkout opened for every product',
      '결제한 재화가 계정에 남아 기기를 바꿔도 유지됨 / Purchased currency survives a device change'
    ]
  );

  addText(
    '결제 상품이 몇 개인가요?  ·  How many purchase items are there?',
    '실제로 결제까지 해보셨다면 재화가 잘 들어왔는지도 적어 주세요. ' +
    '검토팀은 결제창이 뜨는 것까지만 확인하고 실제 결제는 하지 않습니다.\n\n' +
    'We only check that checkout opens — we do not complete a purchase.'
  );

  // ======================= 5. 스토어 등록 정보 =======================
  addHeader('5. 스토어 등록 정보 · Store listing');

  addChecks(
    '게임 설명을 한국어와 영어 둘 다 넣으셨나요?  ·  Is the description filled in both languages?',
    '등록 화면에서 언어 탭을 하나씩 눌러 확인해 주세요.\n' +
    '자주 나오는 실수: 미리보기에는 기본 언어만 보여서, 영어 탭이 비어 있는 걸 모르고 제출.\n\n' +
    'Click through each language tab. The preview only shows the default language.',
    [
      '한국어 설명을 넣었음 / Korean description filled',
      '영어 설명을 넣었음 / English description filled'
    ]
  );

  // ======================= 6. 화면 방향과 언어 =======================
  addHeader('6. 화면 방향과 언어 · Orientation and language');

  addImage(
    typeof IMG_ORIENTATION !== 'undefined' ? IMG_ORIENTATION : null,
    'orientation',
    '참고 그림 — 세로 전용 / 가로 전용 / 둘 다 / Reference — the three orientation modes'
  );

  addChoice(
    '이 게임은 어느 방향으로 하는 게임인가요?  ·  Which orientation is this game for?',
    '다음 문항에서 실제 동작이 이 선택과 맞는지 확인합니다. 검토팀도 이 선언을 기준으로 ' +
    '직접 돌려 봅니다.\n\n' +
    'The next question checks whether the build actually behaves this way.',
    ['세로로만 / Portrait only', '가로로만 / Landscape only', '둘 다 가능 / Both']
  );

  addVerdict(
    '실제로도 그렇게 동작하나요?  ·  Does the build actually behave that way?',
    '세로 전용이라고 하셨으면 — 폰을 가로로 돌려도 화면이 세로로 고정돼야 합니다.\n' +
    '둘 다 가능이라고 하셨으면 — 돌렸을 때 버튼과 글자가 각 방향에 맞게 다시 배치돼야 합니다.\n' +
    '자주 나오는 실수: 고정을 안 해놔서 "일단 둘 다 되긴 하는" 상태 — 실제로는 한쪽만 ' +
    '테스트된 경우가 많습니다.\n\n' +
    'Rotate the device and confirm it matches what you declared above.'
  );

  addImage(
    typeof IMG_LANGUAGE !== 'undefined' ? IMG_LANGUAGE : null,
    'language',
    '참고 그림 — 언어를 바꾸면 글자 길이도 바뀐다 / Reference — switching language changes layout'
  );

  addChecks(
    '게임 안 글자가 한국어와 영어 둘 다 나오나요?  ·  Does in-game text work in both languages?',
    '위 5번과 다른 항목입니다. 그건 스토어 소개글, 이건 게임 안에서 보이는 글자입니다.\n' +
    '메인 화면만 보지 마시고 팝업 · 결과 화면 · 상점까지 다 봐주세요.\n' +
    '자주 나오는 실수: 언어를 바꾸면 글자 길이가 달라져서, 한쪽 언어에서만 버튼 글자가 잘리는 경우.\n\n' +
    'Different from item 5 — that is the store listing, this is the text inside the game. ' +
    'Walk through popups, results and the shop too.',
    [
      '한국어로 하면 모든 화면이 한국어 / Korean is complete everywhere',
      '영어로 하면 모든 화면이 영어 / English is complete everywhere',
      '언어를 바꿔도 글자가 잘리거나 겹치지 않음 / Nothing is clipped in either language'
    ]
  );

  addText(
    '언어는 어디서 바꾸나요?  ·  Where is the language switch?',
    '예: "메인 화면 오른쪽 위 KR/EN 버튼"\n' +
    '자동으로 휴대폰 언어를 따라간다면 그렇게 적어 주세요.\n\n' +
    'e.g. "KR/EN toggle, top-right of the main screen". If it follows the device language, say so.'
  );

  // ======================= 7. 마무리 =======================
  addHeader('7. 마무리 · Wrap-up');

  addParagraph(
    '체크하지 못한 항목이 있나요?  ·  Anything you could not tick?',
    '어느 항목이고 무엇이 문제였는지 적어 주세요. 전부 체크하셨으면 "없음".\n' +
    '이 게임에 광고나 결제가 애초에 없어서 체크할 수 없었던 경우에도 여기에 적어 주세요.\n\n' +
    'Say which item and what you saw. Write "none" if everything was ticked. Also use this if ' +
    'the game genuinely ships without ads or purchases.',
    true
  );

  addParagraph(
    '그 밖에 알려주실 것  ·  Anything else we should know',
    '예: 특정 기기에서만 생기는 문제, 아직 작업 중인 부분.\n' +
    'e.g. a problem that only happens on one device, or work still in progress.',
    false
  );

  // 제출 직전 경고. 응답을 받지 않는 섹션 헤더라 열을 차지하지 않는다.
  // 겁을 줘서 전부 체크하게 만들면 폼이 무의미해지므로, 불이익이 "확인을 안 한 것"이
  // 아니라 "확인한 것처럼 적은 것"에 붙는다는 점을 분명히 한다.
  addHeader(
    '⚠️ 제출 전에 한 번만 더 읽어 주세요  ·  Before you submit',
    '제출해 주신 내용은 검토팀이 게임에 직접 들어가 하나씩 대조합니다. ' +
    '확인하지 않은 항목을 체크하셨거나 내용이 실제와 다르면 이 단계에서 드러납니다.\n\n' +
    '· 재검수 대상이 되어 출시 일정이 밀립니다\n' +
    '· 같은 일이 반복되면 스토어 노출 순위에서 후순위로 밀릴 수 있습니다\n\n' +
    '확인하지 못한 항목이 있어도 괜찮습니다. 체크를 비워 두고 위 \'체크하지 못한 항목\'에 ' +
    '그대로 적어 주세요. 솔직하게 적힌 쪽이 훨씬 빠르게 처리됩니다 — 불이익은 확인을 안 한 것이 ' +
    '아니라, 확인한 것처럼 적은 것에 붙습니다.\n\n' +
    'Our reviewers open your game and check these answers one by one. Ticking something you did ' +
    'not actually verify will surface here — it sends the build back for re-review and delays your ' +
    'release, and repeated cases can push your game down in store placement. It is fine to leave a ' +
    'box unticked: say so in "Anything you could not tick" above. Being upfront is handled faster. ' +
    'The penalty is for claiming a check you did not do, not for the missing check itself.'
  );

  return verdictCols;
}

// ---------------------------------------------------------------------------
// 보조 / Helpers
// ---------------------------------------------------------------------------

function colLetter_(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * 통과/실패 열에만 색 규칙을 건다. 체크박스 열은 값이 여러 개 이어 붙어 나오므로
 * 색칠 대상이 아니다.
 */
function paintVerdictColumns_(sheet, verdictCols) {
  if (!sheet) {
    Logger.log('응답 탭을 못 찾아 색 규칙을 건너뛴다 (폼/응답은 정상).');
    return;
  }
  try {
    var ranges = verdictCols.map(function (c) {
      var L = colLetter_(c);
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
}

/**
 * 이미 만든 폼이 있으면 멈춘다. 없으면 조용히 통과.
 *
 * 기록해 둔 폼이 지워졌거나 열 권한이 없으면 기록을 지우고 통과시킨다 —
 * 죽은 ID 하나 때문에 영영 못 만들게 되는 상황을 피한다.
 */
function assertNoExistingForm_() {
  if (ALLOW_NEW_FORM) return;

  var props = PropertiesService.getScriptProperties();
  var existingId = props.getProperty(FORM_ID_PROPERTY);
  if (!existingId) return;

  var existing;
  try {
    existing = FormApp.openById(existingId);
  } catch (e) {
    Logger.log('기록된 폼을 열 수 없어 기록을 비운다(삭제됐거나 권한 없음): ' + existingId);
    props.deleteProperty(FORM_ID_PROPERTY);
    return;
  }

  throw new Error(
    '이미 만든 폼이 있다. 새로 만들면 응답 탭이 하나 더 생기고 응답이 흩어진다.\n' +
    '기존 폼 편집: ' + existing.getEditUrl() + '\n' +
    '기존 폼 배포: ' + existing.getPublishedUrl() + '\n' +
    '\n' +
    '  · 문항을 이 파일 내용으로 갈아끼울 것이면 → rebuildExistingForm 실행\n' +
    '  · 일부만 손볼 것이면        → 위 편집 링크로 직접 수정\n' +
    '  · 응답 시트를 옮길 것이면    → moveExistingFormDestination 실행\n' +
    '  · 탭이 어느 폼 것인지 볼 것이면 → listResponseTabs 실행\n' +
    '  · 정말 별개의 폼이 필요하면   → ALLOW_NEW_FORM 을 true 로'
  );
}

/**
 * 응답 스프레드시트의 탭을 전부 훑어서 어느 폼과 연결됐는지, 응답이 몇 건인지 찍는다.
 *
 * 폼을 여러 번 만들어 탭이 늘어났을 때 어느 탭이 실제로 배포된 폼의 것인지
 * 가려내는 용도. 읽기만 하며 아무것도 바꾸지 않는다.
 */
function listResponseTabs() {
  var ss = SpreadsheetApp.openById(RESPONSE_SPREADSHEET_ID);
  var sheets = ss.getSheets();
  Logger.log('시트 / Spreadsheet: ' + ss.getUrl());
  Logger.log('탭 ' + sheets.length + '개 / ' + sheets.length + ' tabs');

  for (var i = 0; i < sheets.length; i++) {
    var s = sheets[i];
    var head = '[' + (i + 1) + '] ' + s.getName() + '  (gid ' + s.getSheetId() + ')';
    var formUrl = s.getFormUrl();

    if (!formUrl) {
      Logger.log(head + ' — 폼 연결 없음 / not a form response tab');
      continue;
    }

    // 1행은 머리글이므로 응답 건수에서 뺀다. 빈 탭이면 getLastRow()가 0이다.
    var rows = Math.max(0, s.getLastRow() - 1);
    var title = '(폼을 열 수 없음 — 권한 확인 필요)';
    try {
      title = FormApp.openByUrl(formUrl).getTitle();
    } catch (e) {}

    Logger.log(head + ' — 응답 ' + rows + '건 / ' + rows + ' responses' +
               '\n      폼 / form: ' + title +
               '\n      ' + formUrl);
  }

  Logger.log('응답이 쌓이고 있는 탭이 실제로 배포된 폼의 것이다. ' +
             '0건인 탭은 재실행으로 생긴 빈 껍데기일 가능성이 높다.');
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

  // 폼을 못 열면 권한 문제다. 어느 폼인지 먼저 찍어두면 소유자 확인이 쉽다.
  Logger.log('연결된 폼 주소 / Linked form: ' + formUrl);

  var form;
  try {
    form = FormApp.openByUrl(formUrl);
  } catch (e) {
    throw new Error(
      '폼을 열 수 없다 — 지금 로그인한 계정에 이 폼의 편집 권한이 없다.\n' +
      '폼 주소: ' + formUrl + '\n' +
      '해결: 폼 소유자 계정으로 이 스크립트를 실행하거나, 폼 소유자가 이 계정을 편집자로 추가할 것.\n' +
      '(스크립트 없이 폼 편집화면 → 응답 → ⋮ → "응답 대상 선택"으로도 같은 작업이 가능하다)\n' +
      '원본 오류: ' + e.message
    );
  }
  form.setDestination(FormApp.DestinationType.SPREADSHEET, RESPONSE_SPREADSHEET_ID);
  SpreadsheetApp.flush();

  var moved = findResponseSheet_(RESPONSE_SPREADSHEET_ID, form.getId());
  Logger.log('옮긴 폼 / Form: ' + form.getTitle());
  Logger.log('새 응답 시트 / New destination: ' + SpreadsheetApp.openById(RESPONSE_SPREADSHEET_ID).getUrl());
  Logger.log('새 응답 탭 / New tab: ' + (moved ? moved.getName() : '(다음 제출 때 생김)'));
}
