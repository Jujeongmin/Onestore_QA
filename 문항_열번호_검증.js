/**
 * buildFormItems_ 를 가짜 폼에 돌려 두 가지를 검증한다.
 *
 * 1) 열 번호 계산
 *    응답 시트의 열은 A=타임스탬프, (이메일 자동 수집이 켜져 있으면 B=이메일 주소),
 *    그 뒤로 응답을 받는 문항이 추가된 순서대로 한 열씩 차지한다. buildFormItems_ 는
 *    통과/실패 문항이 떨어지는 열 번호를 돌려주고, 그 번호로 조건부 서식을 건다.
 *    문항을 중간에 하나 끼워넣거나, 열을 차지하지 않는 항목(섹션 헤더·이미지)을
 *    잘못 세면 서식이 통째로 한 칸씩 밀린다. 폼은 멀쩡해 보이고 시트 색만 엉뚱해지므로
 *    눈으로는 잘 안 잡힌다.
 *
 * 2) 제자리 수정이 정말 "안 바뀐 것을 안 건드리는지"
 *    폼 제목에 손으로 넣은 굵게는 setTitle 을 부르는 순간 날아간다. 서식은 API로
 *    읽지도 쓰지도 못하므로, 굵게가 살아남는 유일한 조건이 "setTitle 을 안 부르는 것"이다.
 *    그래서 같은 내용으로 두 번 돌렸을 때 setter 가 한 번도 불리지 않아야 한다.
 *    이 검사가 깨지면 rebuildExistingForm 을 돌릴 때마다 굵게가 사라진다.
 *
 * 쓰는 법 (Apps Script가 아니라 로컬에서 돌린다)
 *   node 문항_열번호_검증.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const TARGET = process.argv[2] ||
  path.join(__dirname, '원스토어_QA체크리스트_구글폼생성기.gs');
const src = fs.readFileSync(TARGET, 'utf8');

const TYPE = {
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  CHECKBOX: 'CHECKBOX',
  TEXT: 'TEXT',
  PARAGRAPH_TEXT: 'PARAGRAPH_TEXT',
  SECTION_HEADER: 'SECTION_HEADER',
  IMAGE: 'IMAGE',
};

/** 열을 차지하는(= 응답을 받는) 문항 종류 */
const TAKES_COLUMN = new Set([
  TYPE.MULTIPLE_CHOICE, TYPE.CHECKBOX, TYPE.TEXT, TYPE.PARAGRAPH_TEXT,
]);

/** FormApp 을 흉내 낸 가짜 폼. setter 가 몇 번 불렸는지 센다. */
function fakeForm(collectEmail) {
  const items = [];
  const calls = {
    setTitle: [], setHelpText: [], setRequired: [], setChoiceValues: [],
    created: [], deleted: [],
  };

  const makeItem = (type) => {
    const it = {
      _type: type, _title: '', _help: '', _required: false, _choices: [],
      getType: () => it._type,
      getIndex: () => items.indexOf(it),
      getTitle: () => it._title,
      getHelpText: () => it._help,
      isRequired: () => it._required,
      getChoices: () => it._choices.map((v) => ({ getValue: () => v })),
      setTitle: (v) => { calls.setTitle.push(v); it._title = v; return it; },
      setHelpText: (v) => { calls.setHelpText.push(it._title); it._help = v; return it; },
      setRequired: (v) => { calls.setRequired.push(it._title); it._required = v; return it; },
      setChoiceValues: (v) => { calls.setChoiceValues.push(it._title); it._choices = v.slice(); return it; },
      setImage: () => it, setAlignment: () => it, setWidth: () => it,
      asMultipleChoiceItem: () => it, asCheckboxItem: () => it, asTextItem: () => it,
      asParagraphTextItem: () => it, asSectionHeaderItem: () => it, asImageItem: () => it,
    };
    return it;
  };
  const add = (type) => { const it = makeItem(type); items.push(it); calls.created.push(type); return it; };

  const form = {
    setTitle() {}, setDescription() {}, setProgressBar() {},
    setAllowResponseEdits() {}, setLimitOneResponsePerUser() {},
    setShowLinkToRespondAgain() {}, setCollectEmail() {},
    collectsEmail: () => collectEmail,
    getItems: () => items.slice(),
    moveItem: (from, to) => { const [it] = items.splice(from, 1); items.splice(to, 0, it); return it; },
    deleteItem: (it) => { calls.deleted.push(it._title); items.splice(items.indexOf(it), 1); },
    addMultipleChoiceItem: () => add(TYPE.MULTIPLE_CHOICE),
    addCheckboxItem: () => add(TYPE.CHECKBOX),
    addTextItem: () => add(TYPE.TEXT),
    addParagraphTextItem: () => add(TYPE.PARAGRAPH_TEXT),
    addSectionHeaderItem: () => add(TYPE.SECTION_HEADER),
    addImageItem: () => add(TYPE.IMAGE),
  };
  return { form, items, calls, reset: () => { for (const k of Object.keys(calls)) calls[k].length = 0; } };
}

function loadBuild() {
  const globals = {
    Logger: { log() {} },
    Utilities: { newBlob: () => ({}), base64Decode: () => [] },
    FormApp: { Alignment: { CENTER: 'CENTER' }, ItemType: TYPE },
    // 이미지데이터 파일이 없어도 폼은 생성되지만, 여기서는 이미지 항목이 열을
    // 차지하지 않는다는 것까지 확인해야 하므로 있는 셈 친다.
    IMG_AD_EXAMPLE: 'iVBORw0KGgo',
    IMG_PURCHASE_EXAMPLE: 'iVBORw0KGgo',
    IMG_LANGUAGE: 'iVBORw0KGgo',
    IMG_GAMELINK_EXAMPLE: 'iVBORw0KGgo',
    IMG_GITLAB_EXAMPLE: 'iVBORw0KGgo',
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
    SpreadsheetApp: {}, DriveApp: {}, Session: {},
  };
  const load = new Function(...Object.keys(globals), src + '\nreturn buildFormItems_;');
  return load(...Object.values(globals));
}

function colLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

const isVerdict = (it) =>
  it._type === TYPE.MULTIPLE_CHOICE && it._choices.some((c) => c.indexOf('Pass') !== -1);

const buildFormItems_ = loadBuild();

// ---------------------------------------------------------------------------
// 1) 열 번호
// ---------------------------------------------------------------------------
for (const collectEmail of [true, false]) {
  const { form, items } = fakeForm(collectEmail);
  const verdictCols = buildFormItems_(form);

  const before = collectEmail ? 2 : 1;   // 문항이 시작되기 직전 열
  const expected = [];
  let n = 0;
  for (const it of items) {
    if (!TAKES_COLUMN.has(it._type)) continue;
    n++;
    if (isVerdict(it)) expected.push(before + n);
  }

  assert.deepStrictEqual(
    verdictCols, expected,
    `이메일수집=${collectEmail}: buildFormItems_ 가 준 ${verdictCols} 가 실제 위치 ${expected} 와 다르다`
  );
  assert.ok(verdictCols.length > 0, '통과/실패 문항이 하나도 안 잡혔다');

  console.log(`이메일수집=${String(collectEmail).padEnd(5)} 응답 열 ${n}개 · ` +
              `판정 열 ${verdictCols.map(colLetter).join(', ')}  OK`);
}

// ---------------------------------------------------------------------------
// 2) 제자리 수정 — 같은 내용으로 다시 돌리면 아무것도 건드리지 않아야 한다
//    (setTitle 이 한 번이라도 불리면 그 문항의 굵게가 날아간다)
// ---------------------------------------------------------------------------
{
  const f = fakeForm(true);
  buildFormItems_(f.form);                 // 1회차 — 폼을 처음 만든다
  const built = f.items.length;
  f.reset();
  buildFormItems_(f.form);                 // 2회차 — 코드가 그대로이므로 할 일이 없어야 한다

  assert.strictEqual(f.calls.setTitle.length, 0,
    '두 번째 실행에서 setTitle 이 불렸다 → 굵게가 날아간다: ' + f.calls.setTitle.slice(0, 3));
  assert.strictEqual(f.calls.setHelpText.length, 0, '두 번째 실행에서 설명이 다시 쓰였다');
  assert.strictEqual(f.calls.setChoiceValues.length, 0, '두 번째 실행에서 선택지가 다시 쓰였다');
  assert.strictEqual(f.calls.setRequired.length, 0, '두 번째 실행에서 필수여부가 다시 쓰였다');
  assert.strictEqual(f.calls.created.length, 0, '두 번째 실행에서 문항이 새로 만들어졌다');
  assert.strictEqual(f.calls.deleted.length, 0, '두 번째 실행에서 문항이 지워졌다');
  assert.strictEqual(f.items.length, built, '두 번째 실행 뒤 문항 수가 달라졌다');

  console.log(`제자리 수정  두 번째 실행에서 손댄 곳 0곳 (문항 ${built}개 그대로)  OK`);
}

// ---------------------------------------------------------------------------
// 3) 한 곳만 어긋나 있으면 그 한 곳만 고쳐야 한다
// ---------------------------------------------------------------------------
{
  const f = fakeForm(true);
  buildFormItems_(f.form);

  // 폼에서 누가 설명 한 줄을 지운 상황을 흉내 낸다
  const victim = f.items.find((it) => TAKES_COLUMN.has(it._type) && it._help);
  victim._help = '누가 손으로 지웠다';
  f.reset();
  buildFormItems_(f.form);

  assert.strictEqual(f.calls.setHelpText.length, 1,
    '어긋난 설명 한 곳만 고쳐야 하는데 ' + f.calls.setHelpText.length + '곳을 고쳤다');
  assert.strictEqual(f.calls.setTitle.length, 0,
    '설명만 어긋났는데 제목까지 다시 썼다 → 굵게가 날아간다');

  console.log('부분 수정    설명 1곳만 어긋났을 때 고친 곳 1곳, 제목 손댄 곳 0곳  OK');
}

// ---------------------------------------------------------------------------
// 4) 스펙에 없는 문항이 뒤에 남아 있으면 지워야 한다
// ---------------------------------------------------------------------------
{
  const f = fakeForm(true);
  buildFormItems_(f.form);
  const built = f.items.length;
  f.form.addTextItem().setTitle('예전에 쓰던 문항');   // 뒤에 찌꺼기 하나
  f.reset();
  buildFormItems_(f.form);

  assert.strictEqual(f.items.length, built, '뒤에 남은 문항이 지워지지 않았다');
  assert.deepStrictEqual(f.calls.deleted, ['예전에 쓰던 문항'], '엉뚱한 문항을 지웠다');
  assert.strictEqual(f.calls.setTitle.length, 0, '찌꺼기 하나 때문에 다른 제목까지 다시 썼다');

  console.log('찌꺼기 정리  뒤에 남은 문항 1개만 삭제, 제목 손댄 곳 0곳  OK');
}

// ---------------------------------------------------------------------------
// 폼 구조를 눈으로 훑기 위한 출력 (이메일 수집을 켠 기준)
// ---------------------------------------------------------------------------
{
  const { form, items } = fakeForm(true);
  buildFormItems_(form);
  console.log('\n--- 폼 구조 / form structure ---');
  let col = 2;
  for (const it of items) {
    if (it._type === TYPE.SECTION_HEADER) { console.log(`\n[${it._title}]`); continue; }
    if (it._type === TYPE.IMAGE) { console.log(`      (그림) ${it._title.split('\n')[0]}`); continue; }
    col++;
    const mark = it._required ? ' *' : '';
    const ch = it._choices.length ? `  {선택지 ${it._choices.length}}` : '';
    console.log(`  ${colLetter(col).padEnd(2)} ${it._title.replace(/\n/g, ' / ')}${mark}${ch}`);
  }
}
