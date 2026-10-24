// beginner.mjs 시험 — 브리프(재료)와 검사(린트 ①~⑧). 고정물은 모양만 믿고, gid 는 직접 쓴다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beginnerBrief, checkBeginner, problemText, tokenize } from "./beginner.mjs";

const DATA = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "runbook.generated.json"), "utf8"));
const TODAY = "2026-10-22";
const PLAN = Object.freeze({
  lang: "ko", site: "composed",
  chapters: ["G-hosting", "G-domain", "G-db", "G-auth", "G-email", "G-billing", "G-push"],
  missing: [], stale: ["G-push"],
});

const planFor = (lang, over = {}) => ({ ...PLAN, lang, ...over });
const brief = (gid, lang = "ko", data = DATA, plan = planFor(lang)) => beginnerBrief(plan, data, { lang, gid });
const check = (draft, b, lang = "ko") => checkBeginner(draft, b.chapter, { lang, today: TODAY });
const rules = (problems) => problems.map((p) => p.rule);
// 가짜 키는 런타임에 이어 붙인다(저장소에 완성된 글자가 남지 않게).
const fakeKey = () => ["sk", "live", "Ab3".repeat(8)].join("_");

const KO_HELP = DATA.rubric.helpLine.ko;
const EN_HELP = DATA.rubric.helpLine.en;

const koAuth = () => [
  "로그인 장이에요. 환경 변수는 사이트가 읽는 비밀 메모예요. 돈은 들지 않아요.",
  "",
  "1. 외부 계정은 필요 없어요. 바로 다음 단계로 가요.",
  "2. 길고 무작위인 비밀 문자열을 만들어요. 값은 채팅에 붙이지 않아요.",
  "3. 호스팅 대시보드의 「설정」 메뉴에서 `BETTER_AUTH_SECRET` 이름으로 넣어요. 저장하면 목록에 이름이 보여요.",
  "4. 가입한 뒤 로그인해요. 로그인이 되면 끝이에요.",
  "",
  "로그인 직후 풀리면 `NEXT_PUBLIC_APP_URL` 이 실제 주소인지 봐요. 출처는 example-auth.com 이에요.",
  KO_HELP,
  "다 했어요 / 막혔어요",
].join("\n");

const enHosting = () => [
  "Hosting puts the site on the internet. A repository is a folder of your site's code.",
  "",
  "1. Open example-hosting.com and make an account. You should see an empty dashboard.",
  "2. Press a button that looks like “New project” and pick your repository. The deploy starts.",
  "3. In the host dashboard, add `NEXT_PUBLIC_APP_URL`. Do not paste the value in chat.",
  "4. Wait for the deploy to end. The site opens at a temporary address.",
  "",
  "If the build fails, read the first error in the log.",
  EN_HELP,
  "Done / Stuck",
].join("\n");

test("good Korean and English drafts pass", () => {
  assert.deepEqual(check(koAuth(), brief("G-auth")), []);
  assert.deepEqual(check(enHosting(), brief("G-hosting", "en"), "en"), []);
});

test("brief shape: rules in lang, help line, chapter material, allowed sets", () => {
  const b = brief("G-auth", "en");
  assert.deepEqual(b.rubric, DATA.rubric.rules.en);
  assert.equal(b.helpLine, EN_HELP);
  const c = b.chapter;
  assert.equal(c.gid, "G-auth");
  assert.equal(c.title, DATA.chapters["G-auth"].text.en.title);
  assert.equal(c.body, DATA.chapters["G-auth"].text.en.body);
  assert.equal(c.home, "https://example-auth.com");
  assert.deepEqual(c.mustName, ["BETTER_AUTH_SECRET", "NEXT_PUBLIC_APP_URL"]);
  assert.equal(c.stale, false);
  assert.equal("staleLine" in c, false);
  // ⑥ 의 허용 이름은 계획에 든 모든 장의 이름이다.
  for (const name of ["DATABASE_URL", "PADDLE_API_KEY", "VAPID_DEV_KEY"]) assert.ok(c.allowed.names.includes(name), name);
  assert.ok(c.allowed.quoted.includes("New project"));
  assert.throws(() => brief("G-nope", "en"), /G-nope/);
});

test("① env-missing: every mustName must appear; devOnly and notEnv are not required", () => {
  const b = brief("G-auth");
  const p = check(koAuth().replace("`BETTER_AUTH_SECRET` 이름으로", "비밀 이름으로"), b);
  assert.deepEqual(p, [{ rule: "env-missing", detail: "BETTER_AUTH_SECRET" }]);

  const push = brief("G-push");
  assert.ok(!push.chapter.mustName.includes("VAPID_DEV_KEY"));
  const pushDraft = [
    push.chapter.staleLine,
    "1. 키 한 쌍을 만들어요. 값은 채팅에 붙이지 않아요.",
    "2. `VAPID_PUBLIC_KEY` 이름으로 넣어요.",
    "3. `VAPID_PRIVATE_KEY` 이름으로 넣어요.",
    KO_HELP,
  ].join("\n");
  assert.deepEqual(check(pushDraft, push), []);

  const billing = brief("G-billing");
  assert.ok(!billing.chapter.mustName.includes("TEST_MODE"));
});

test("② secret-shape: a fake live key is caught and never echoed", () => {
  const key = fakeKey();
  const p = check(koAuth().replace("값은 채팅에 붙이지 않아요.", `예를 들면 ${key} 같은 값이에요.`), brief("G-auth"));
  assert.deepEqual(rules(p), ["secret-shape"]);
  assert.equal(JSON.stringify(p).includes(key), false);
});

test("② secret-shape: a key quoted as a button name is not echoed through another rule", () => {
  const key = fakeKey();
  const p = check(koAuth().replace("값은 채팅에 붙이지 않아요.", `「${key}」 버튼을 눌러요.`), brief("G-auth"));
  assert.equal(JSON.stringify(p).includes(key), false);
  assert.ok(p.some((x) => x.rule === "secret-shape"));
});

test("③ help-missing: the help line must be there verbatim", () => {
  const p = check(koAuth().replace(KO_HELP, KO_HELP.slice(0, -3)), brief("G-auth"));
  assert.deepEqual(rules(p), ["help-missing"]);
});

test("④ too-few-steps: count and two-sentence limit", () => {
  const b = brief("G-auth");
  const fewer = koAuth().replace(/^2\. .*\n/m, "").replace(/^4\. .*\n/m, "");
  assert.deepEqual(rules(check(fewer, b)), ["too-few-steps"]);
  const long = koAuth().replace("바로 다음 단계로 가요.", "바로 다음 단계로 가요. 쉬워요.");
  assert.deepEqual(rules(check(long, b)), ["too-few-steps"]);
});

test("④ a domain's dot is not a sentence end", () => {
  const data = structuredClone(DATA);
  data.chapters["G-auth"].card.home = "https://solapi.com";
  const b = brief("G-auth", "ko", data);
  const draft = koAuth()
    .replace("바로 다음 단계로 가요.", "solapi.com 에서 확인해요.")
    .replace("example-auth.com", "solapi.com");
  assert.deepEqual(check(draft, b), []);
});

test("④ a chapter with no registration actions does not force three steps", () => {
  const data = structuredClone(DATA);
  data.chapters["G-domain"].actions.ko = 0;
  const b = brief("G-domain", "ko", data);
  assert.deepEqual(check(`도메인을 연결하면 내 주소로 사이트가 열려요.\n${KO_HELP}`, b), []);
  // 행동이 둘이면 단계도 둘이면 된다(셋을 요구하지 않는다).
  data.chapters["G-domain"].actions.ko = 2;
  const two = brief("G-domain", "ko", data);
  assert.deepEqual(check(`1. 도메인을 사요.\n2. 호스팅 대시보드에서 연결해요.\n${KO_HELP}`, two), []);
  assert.deepEqual(rules(check(`1. 도메인을 사요.\n${KO_HELP}`, two)), ["too-few-steps"]);
});

test("⑤ url: home domain only — paths, other domains and scheme-less paths are caught", () => {
  const b = brief("G-auth");
  const cases = [
    "https://example-auth.com/docs/setup",
    "example-auth.com/dashboard",
    "https://other-site.com",
    "other-site.com",
  ];
  for (const addr of cases) {
    const p = check(koAuth().replace("example-auth.com", addr), b);
    assert.deepEqual(rules(p), ["url"], addr);
    assert.equal(p[0].detail, addr);
  }
  assert.deepEqual(check(koAuth().replace("example-auth.com", "https://example-auth.com"), b), []);
  // 파일 이름은 주소가 아니다.
  assert.deepEqual(check(koAuth().replace("가입한 뒤", "`.env.local` 이나 next.config.ts 는 건드리지 않고 가입한 뒤"), b), []);
});

test("⑥ unknown-name: UPPER_SNAKE must belong to some chapter of the plan", () => {
  const b = brief("G-auth");
  const other = koAuth().replace("가입한 뒤 로그인해요.", "`DATABASE_URL` 이 있는지 봐요.");
  assert.deepEqual(check(other, b), []);
  const invented = koAuth().replace("가입한 뒤 로그인해요.", "`AUTH_TOKEN_KEY` 도 넣어요.");
  assert.deepEqual(check(invented, b), [{ rule: "unknown-name", detail: "AUTH_TOKEN_KEY" }]);
  // 계획에 없는 장의 이름은 허용하지 않는다.
  const narrow = brief("G-auth", "ko", DATA, planFor("ko", { chapters: ["G-hosting", "G-auth"], stale: [] }));
  assert.deepEqual(check(other, narrow), [{ rule: "unknown-name", detail: "DATABASE_URL" }]);
});

test("⑦ stale-missing: an old chapter needs the stale line", () => {
  const push = brief("G-push");
  assert.equal(push.chapter.stale, true);
  assert.equal(push.chapter.staleLine, DATA.rubric.staleLine.ko);
  const draft = [
    "1. 키 한 쌍을 만들어요.",
    "2. `VAPID_PUBLIC_KEY` 이름으로 넣어요.",
    "3. `VAPID_PRIVATE_KEY` 이름으로 넣어요.",
    KO_HELP,
  ].join("\n");
  assert.deepEqual(rules(check(draft, push)), ["stale-missing"]);
  // 계획이 오래됨을 몰라도 today 로 다시 판정한다.
  const fresh = brief("G-push", "ko", DATA, planFor("ko", { stale: [] }));
  assert.deepEqual(rules(check(draft, fresh)), ["stale-missing"]);
  // today 가 없어도 계획의 오래됨 표시만으로 요구한다.
  assert.deepEqual(rules(checkBeginner(draft, push.chapter, { lang: "ko" })), ["stale-missing"]);
});

test("⑧ an invented number and an invented quoted button are caught", () => {
  const b = brief("G-auth");
  const days = check(koAuth().replace("가입한 뒤 로그인해요.", "가입한 뒤 7일 안에 로그인해요."), b);
  assert.deepEqual(days, [{ rule: "unknown-number", detail: "7" }]);
  const button = check(koAuth().replace("「설정」 메뉴", "「비밀 키 발급」 버튼"), b);
  assert.deepEqual(button, [{ rule: "unknown-name", detail: "비밀 키 발급" }]);
  const enButton = check(enHosting().replace("“New project”", "“Import Git Repository”"), brief("G-hosting", "en"), "en");
  assert.deepEqual(rules(enButton), ["unknown-name"]);
});

test("⑧ numbers and names from the body, card and general words pass; identifiers and dates do not mislead", () => {
  const email = brief("G-email");
  // 본문의 「하루」·카드의 서비스 이름·일반 낱말은 지어낸 것이 아니다.
  const draft = [
    `「${email.chapter.service}」 에 계정을 만들어요.`,
    "1. 「보내는 도메인」을 인증해요. 인증 반영에 최대 하루가 걸릴 수 있어요.",
    "2. 「새로 만들기」처럼 보이는 버튼으로 키를 발급해요.",
    "3. `RESEND_API_KEY` 이름과 `EMAIL_FROM` 이름으로 넣어요.",
    KO_HELP,
  ].join("\n");
  assert.deepEqual(check(draft, email), []);

  const data = structuredClone(DATA);
  data.chapters["G-auth"].text.ko.body += "\n- 메모: 2026-10-21 에 바뀐 화면이에요. 키는 32자 이상이에요.";
  data.chapters["G-auth"].envNames.push("S3_BUCKET_2");
  const b = brief("G-auth", "ko", data);
  const ok = koAuth().replace("가입한 뒤 로그인해요. 로그인이 되면 끝이에요.", "키는 32자 이상이에요. 2026-10-21 에 바뀌었어요.")
    .replace("다 했어요", "`S3_BUCKET_2` 는 그대로 둬요.\n다 했어요");
  assert.deepEqual(check(ok, b), []);
  // 줄 앞 단계 번호는 숫자로 세지 않는다.
  assert.deepEqual(tokenize("1. 열어요.\n12) 닫아요.").numbers, []);
  // 영문 식별자 안의 숫자도 세지 않는다.
  assert.deepEqual(tokenize("Node v20 과 H264 영상").numbers, []);
});

test("brief allowed sets and the check agree (draft built from allowed tokens passes)", () => {
  const data = structuredClone(DATA);
  data.chapters["G-billing"].text.ko.body += "\n- 메모: 「가맹 심사 요청」 단추가 있어요. 심사는 3영업일 걸려요.";
  const b = brief("G-billing", "ko", data);
  const { allowed, mustName } = b.chapter;
  assert.ok(allowed.numbers.includes("3"));
  assert.ok(allowed.quoted.includes("가맹 심사 요청"));
  const draft = [
    ...allowed.quoted.map((q) => `「${q}」`),
    ...allowed.numbers.map((n) => `${n}개`),
    ...allowed.names.map((n) => `\`${n}\``),
    ...mustName.map((n) => `\`${n}\``),
    "1. 가입해요.", "2. 심사를 받아요.", "3. 키를 넣어요.", "4. 시험 결제를 해요.",
    KO_HELP,
  ].join("\n");
  assert.deepEqual(check(draft, b), []);
});

test("brief carries no secret-shaped string, and refuses chapter data that holds one", () => {
  const shapes = DATA.secretShapes.map(({ re }) => new RegExp(re));
  for (const gid of PLAN.chapters) {
    for (const lang of ["ko", "en"]) {
      if (!DATA.chapters[gid].text[lang]) continue;
      const text = JSON.stringify(brief(gid, lang));
      for (const re of shapes) assert.equal(re.test(text), false, `${gid} ${lang} ${re}`);
    }
  }
  const data = structuredClone(DATA);
  data.chapters["G-auth"].text.ko.body += `\n- ${fakeKey()}`;
  assert.throws(() => brief("G-auth", "ko", data), /secret/);
});

test("problemText reads the sentence from rubric data", () => {
  const p = { rule: "url", detail: "x" };
  assert.equal(problemText(p, DATA, "ko"), DATA.rubric.problems.url.ko);
  assert.equal(problemText(p, DATA, "en"), DATA.rubric.problems.url.en);
});
