/**
 * buildFormItems_ 의 열 번호 계산을 검증한다.
 *
 * 왜 필요한가
 *   응답 시트의 열은 A=타임스탬프, (이메일 자동 수집이 켜져 있으면 B=이메일 주소),
 *   그 뒤로 응답을 받는 문항이 추가된 순서대로 한 열씩 차지한다. buildFormItems_ 는
 *   통과/실패 문항이 떨어지는 열 번호를 세어 돌려주고, 그 번호로 조건부 서식을 건다.
 *
 *   문항을 중간에 하나 끼워넣거나, 열을 차지하지 않는 항목(섹션 헤더·이미지)을
 *   잘못 세면 서식이 통째로 한 칸씩 밀린다. 폼은 멀쩡해 보이고 시트 색만 엉뚱해지므로
 *   눈으로는 잘 안 잡힌다. 그래서 기계로 센다.
 *
 * 쓰는 법 (Apps Script가 아니라 로컬에서 돌린다)
 *   node 문항_열번호_검증.js
 *
 * 통과하면 폼 구조도 함께 출력하므로, 문항을 고친 뒤 순서를 눈으로 확인하기에도 좋다.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const TARGET = process.argv[2] ||
  path.join(__dirname, '원스토어_QA체크리스트_구글폼생성기.gs');
const src = fs.readFileSync(TARGET, 'utf8');

/**
 * FormApp 을 흉내 내어 buildFormItems_ 를 돌린다.
 * 어떤 항목이 열을 차지하는지는 여기서 독립적으로 기록한다 — 본 코드의 colIndex 와
 * 같은 방식으로 세면 검증이 되지 않으므로, 일부러 따로 센다.
 */
function run(collectEmail) {
  const withColumn = [];   // 응답을 받는 문항 (열을 차지한다)
  const everything = [];   // 헤더·이미지까지 전부

  const chainOn = (rec) => {
    const o = {};
    for (const m of ['setTitle', 'setHelpText', 'setChoiceValues', 'setRequired',
                     'setImage', 'setAlignment', 'setWidth']) {
      o[m] = (v) => {
        if (m === 'setTitle') rec.title = v;
        if (m === 'setChoiceValues') rec.choices = v;
        if (m === 'setRequired') rec.required = v;
        return o;
      };
    }
    return o;
  };
  const maker = (kind, takesColumn) => () => {
    const rec = { kind };
    everything.push(rec);
    if (takesColumn) withColumn.push(rec);
    return chainOn(rec);
  };

  const form = {
    setTitle() {}, setDescription() {}, setProgressBar() {},
    setAllowResponseEdits() {}, setLimitOneResponsePerUser() {},
    setShowLinkToRespondAgain() {}, setCollectEmail() {},
    collectsEmail: () => collectEmail,
    addMultipleChoiceItem: maker('choice', true),
    addCheckboxItem: maker('checks', true),
    addTextItem: maker('text', true),
    addParagraphTextItem: maker('para', true),
    addSectionHeaderItem: maker('header', false),
    addImageItem: maker('image', false),
  };

  const globals = {
    Logger: { log() {} },
    Utilities: { newBlob: () => ({}), base64Decode: () => [] },
    FormApp: { Alignment: { CENTER: 'CENTER' } },
    // 이미지데이터 파일이 없어도 폼은 생성되지만, 여기서는 이미지 항목이 열을
    // 차지하지 않는다는 것까지 확인해야 하므로 있는 셈 친다.
    IMG_AD_EXAMPLE: 'iVBORw0KGgo',
    IMG_PURCHASE_EXAMPLE: 'iVBORw0KGgo',
    IMG_LANGUAGE: 'iVBORw0KGgo',
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
    SpreadsheetApp: {}, DriveApp: {}, Session: {},
  };
  const load = new Function(...Object.keys(globals), src + '\nreturn buildFormItems_;');
  const buildFormItems_ = load(...Object.values(globals));

  return { verdictCols: buildFormItems_(form), withColumn, everything };
}

function colLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const isVerdict = (it) =>
  it.kind === 'choice' && it.choices && it.choices.some((c) => c.indexOf('Pass') !== -1);

for (const collectEmail of [true, false]) {
  const { verdictCols, withColumn } = run(collectEmail);

  // 문항이 시작되기 직전의 열 번호. 이메일을 수집하면 A·B가 먼저 찬다.
  const before = collectEmail ? 2 : 1;
  const expected = [];
  withColumn.forEach((it, i) => {
    if (isVerdict(it)) expected.push(before + 1 + i);
  });

  assert.deepStrictEqual(
    verdictCols, expected,
    `이메일수집=${collectEmail}: buildFormItems_ 가 준 ${verdictCols} 가 ` +
    `실제 위치 ${expected} 와 다르다`
  );
  assert.ok(verdictCols.length > 0, '통과/실패 문항이 하나도 안 잡혔다');

  console.log(
    `이메일수집=${String(collectEmail).padEnd(5)} ` +
    `응답 열 ${withColumn.length}개 · 판정 열 ${verdictCols.map(colLetter).join(', ')}  OK`
  );
}

// 폼 구조를 눈으로 훑기 위한 출력 (이메일 수집을 켠 기준)
const { everything } = run(true);
console.log('\n--- 폼 구조 / form structure ---');
let col = 2;
for (const it of everything) {
  if (it.kind === 'header') { console.log(`\n[${it.title}]`); continue; }
  if (it.kind === 'image') { console.log('      (그림)'); continue; }
  col++;
  const mark = it.required ? ' *' : '';
  const choices = it.choices ? `  {선택지 ${it.choices.length}}` : '';
  console.log(`  ${colLetter(col).padEnd(2)} ${it.title}${mark}${choices}`);
}
