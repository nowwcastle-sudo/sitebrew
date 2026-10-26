// 초보자용 런북 — AI 가 쓸 재료(브리프)와 결정론 검사(린트 ①~⑧). 순수 모듈: 파일·시계 없음.
// 브리프의 허용 집합과 검사는 이 파일의 토큰화(tokenize) 하나로 만든다 — 둘이 어긋나지 않게.
// 사용자 문장은 코드에 없다: 규칙·도움 문장·문제 문장은 모두 rubric 데이터에서 읽는다.

// ── 토큰화 ───────────────────────────────────────────────────────────────

// 스킴 있는 주소. 끝의 문장부호는 주소가 아니다.
const URL_RE = /https?:\/\/[^\s<>()[\]「」“”"‘’`]+/gi;
// 스킴 없는 도메인(+경로). 앞이 낱말·점·빗금이면 파일 이름이나 경로의 일부라 건너뛴다.
const DOMAIN_RE = /(?<![\w./-])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})(\/[^\s<>()[\]「」“”"‘’`]*)?/gi;
// 도메인처럼 보이지만 파일 이름인 끝 조각.
const FILE_EXT = new Set(["md", "mdx", "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "yml", "yaml", "toml",
  "txt", "css", "html", "png", "jpg", "jpeg", "svg", "gif", "webp", "local", "lock", "env", "log"]);
const ENV_RE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;
// 따옴표 이름: 「…」 “…” "…" ‘…’ (한 줄 안).
const QUOTED_RE = /「([^」\n]+)」|“([^”\n]+)”|"([^"\n]+)"|‘([^’\n]+)’/g;
// 숫자: 영문 낱말·식별자 안의 숫자는 아니다(앞이 영문자·밑줄·숫자면 건너뜀). 날짜·소수·범위는 한 토큰.
const NUMBER_RE = /(?<![A-Za-z0-9_])\d+(?:[.,:/-]\d+)*/g;
// 줄 앞 단계 번호(1. · 12)).
const ORDINAL_RE = /^(\s*)\d+[.)](?=\s)/gm;
const STEP_RE = /^\s*\d+[.)]\s+/;
const SENTENCE_END_RE = /[.!?。！？]+(?=\s|$|["”’」)])/g;
const MASK = "";
const TRAILING_PUNCT = /[.,;:!?]+$/;

const uniqSorted = (xs) => [...new Set(xs)].sort();
const squash = (s) => s.replace(/\s+/g, " ").trim();
const normName = (s) => squash(s).toLowerCase();

// 주소 토큰 { raw, host, path } — path 는 경로·쿼리·조각이 있으면 비지 않는다.
function findUrls(text) {
  const found = [];
  const masked = text.replace(URL_RE, (m) => {
    const raw = m.replace(TRAILING_PUNCT, "");
    let host = "";
    let path = "";
    try {
      const u = new URL(raw);
      host = u.hostname.toLowerCase();
      path = `${u.pathname === "/" ? "" : u.pathname}${u.search}${u.hash}`;
    } catch {
      path = raw;
    }
    found.push({ raw, host, path });
    return MASK + m.slice(raw.length);
  });
  const rest = masked.replace(DOMAIN_RE, (m, host, tail = "") => {
    const ext = host.slice(host.lastIndexOf(".") + 1).toLowerCase();
    if (FILE_EXT.has(ext)) return m;
    const path = tail.replace(TRAILING_PUNCT, "");
    found.push({ raw: host + path, host: host.toLowerCase(), path: path === "/" ? "" : path });
    return MASK + tail.slice(path.length);
  });
  return { urls: found, masked: rest };
}

const countSentences = (text) => {
  const t = text.trim();
  if (!t) return 0;
  return t.split(SENTENCE_END_RE).filter((part) => /[\p{L}\p{N}]/u.test(part)).length;
};

// 번호 단계: 번호 줄 + 들여 쓴 이어지는 줄. 문장 수는 주소를 지운 글로 센다.
function findSteps(maskedText) {
  const steps = [];
  for (const line of maskedText.split("\n")) {
    if (STEP_RE.test(line)) steps.push(line.replace(STEP_RE, ""));
    else if (steps.length && /^\s+\S/.test(line)) steps[steps.length - 1] += ` ${line.trim()}`;
    else if (steps.length && line.trim() === "") steps.push(null);
  }
  return steps.filter((s) => s !== null).map((s) => ({ text: s, sentences: countSentences(s) }));
}

/**
 * 브리프와 검사가 함께 쓰는 단 하나의 토큰화.
 * @param {string} text
 * @returns {{ urls: {raw:string,host:string,path:string}[], envNames: string[], quoted: string[],
 *   numbers: string[], steps: {text:string,sentences:number}[] }}
 */
export function tokenize(text) {
  const quoted = [...text.matchAll(QUOTED_RE)].map((m) => squash(m.slice(1).find((g) => g !== undefined)));
  const { urls, masked } = findUrls(text);
  const envNames = masked.match(ENV_RE) ?? [];
  const noIds = masked.replace(ENV_RE, MASK);
  const numbers = noIds.replace(ORDINAL_RE, "$1" + MASK).match(NUMBER_RE) ?? [];
  return { urls, envNames: uniqSorted(envNames), quoted: uniqSorted(quoted), numbers: uniqSorted(numbers), steps: findSteps(masked) };
}

// ── 브리프 ───────────────────────────────────────────────────────────────

// 허용 집합의 원천 글: 장 본문 · 카드 · 도움/오래됨/마침 문장 · 비용·필수 낱말. 검사의 따옴표 폴백도 이것을 본다.
const sourceTexts = (chapter) => [
  chapter.body, chapter.title, chapter.service, chapter.ifSkipped,
  ...chapter.labels.cost, chapter.labels.need,
  chapter.check.helpLine, chapter.check.staleLine, chapter.check.closing,
];

function assertNoSecret(texts, shapes, gid) {
  for (const { id, re } of shapes) {
    if (texts.some((t) => new RegExp(re).test(t))) throw new Error(`secret-shaped string (${id}) in chapter data: ${gid}`);
  }
}

function allowedSets(chapter, generalWords, envNames) {
  const tokens = [...sourceTexts(chapter), ...generalWords].map(tokenize);
  return {
    names: uniqSorted(envNames),
    numbers: uniqSorted(tokens.flatMap((t) => t.numbers)),
    quoted: uniqSorted([...generalWords, chapter.service, chapter.title, ...tokens.flatMap((t) => t.quoted)].map(squash)),
  };
}

/**
 * AI 가 초보자용 장을 쓸 재료. 검사(checkBeginner)는 이 `chapter` 만 받는다.
 * @param {{ lang: 'ko'|'en', chapters: string[], stale: string[] }} plan
 * @param {object} data RunbookData
 * @param {{ lang?: 'ko'|'en', gid: string }} opts
 */
export function beginnerBrief(plan, data, { lang = plan.lang, gid }) {
  if (!plan.chapters.includes(gid)) throw new RangeError(`chapter not in plan: ${gid}`);
  const ch = data.chapters[gid];
  const text = ch?.text?.[lang];
  if (!text) throw new RangeError(`no ${lang} chapter text: ${gid}`);
  const { rubric } = data;
  const stale = plan.stale.includes(gid);
  const chapter = {
    gid,
    title: text.title,
    service: ch.card.service,
    home: ch.card.home ?? null,
    cost: ch.card.cost,
    need: ch.card.need,
    ifSkipped: ch.card.ifSkipped[lang],
    mustName: ch.mustName,
    body: text.body,
    stale,
    ...(stale ? { staleLine: rubric.staleLine[lang] } : {}),
    labels: { cost: ch.card.cost.map((k) => rubric.labels.cost[k][lang]), need: rubric.labels.need[ch.card.need][lang] },
    check: {
      lang,
      helpLine: rubric.helpLine[lang],
      staleLine: rubric.staleLine[lang],
      closing: rubric.closing[lang],
      staleAfter: ch.staleAfter,
      actions: ch.actions[lang] ?? 0,
      secretShapes: data.secretShapes,
    },
  };
  assertNoSecret(sourceTexts(chapter), data.secretShapes, gid);
  const planNames = [gid, ...plan.chapters].flatMap((g) => data.chapters[g]?.envNames ?? []);
  chapter.allowed = allowedSets(chapter, rubric.generalWords[lang], planNames);
  return { rubric: rubric.rules[lang], helpLine: rubric.helpLine[lang], chapter };
}

// ── 검사 ─────────────────────────────────────────────────────────────────

const homeHost = (home) => (home ? new URL(home).hostname.toLowerCase() : null);
const sameHost = (host, home) => home !== null && (host === home || host === `www.${home}`);
const contains = (draft, line) => squash(draft).includes(squash(line));

// 규칙마다 (draft, tokens, chapter, ctx) → Problem[]. 순서가 ①~⑧ 이다.
const RULES = [
  // ① 반드시 말할 환경 이름
  (_, tok, ch) => ch.mustName.filter((n) => !tok.envNames.includes(n)).map((n) => ({ rule: "env-missing", detail: n })),
  // ② 키 모양 문자열 — 값은 detail 에 싣지 않는다(표의 id 만).
  (draft, _, ch) => ch.check.secretShapes.filter(({ re }) => new RegExp(re).test(draft)).map(({ id }) => ({ rule: "secret-shape", detail: id })),
  // ③ 도움 문장 그대로
  (draft, _, ch) => (contains(draft, ch.check.helpLine) ? [] : [{ rule: "help-missing", detail: "helpLine" }]),
  // ④ 단계 수와 단계 길이
  (_, tok, ch) => {
    const need = Math.min(3, ch.check.actions);
    const out = tok.steps.length < need ? [{ rule: "too-few-steps", detail: `steps ${tok.steps.length} < ${need}` }] : [];
    tok.steps.forEach((s, i) => {
      if (s.sentences > 2) out.push({ rule: "too-few-steps", detail: `step ${i + 1}: ${s.sentences} sentences` });
    });
    return out;
  },
  // ⑤ 주소는 카드 home 의 도메인뿐, 경로 없음
  (_, tok, ch) => {
    const home = homeHost(ch.home);
    return tok.urls.filter((u) => u.path || !sameHost(u.host, home)).map((u) => ({ rule: "url", detail: u.raw }));
  },
  // ⑥ UPPER_SNAKE 는 계획에 든 장들의 이름
  (_, tok, ch) => tok.envNames.filter((n) => !ch.allowed.names.includes(n)).map((n) => ({ rule: "unknown-name", detail: n })),
  // ⑦ 오래된 장이면 오래됨 문장
  (draft, _, ch, { today }) => {
    const stale = ch.stale || (today !== undefined && ch.check.staleAfter < today);
    return stale && !contains(draft, ch.check.staleLine) ? [{ rule: "stale-missing", detail: ch.check.staleAfter }] : [];
  },
  // ⑧ 숫자와 따옴표 이름은 장 본문·카드·일반 낱말에 있어야 한다
  (_, tok, ch) => {
    const numbers = tok.numbers.filter((n) => !ch.allowed.numbers.includes(n)).map((n) => ({ rule: "unknown-number", detail: n }));
    const known = new Set(ch.allowed.quoted.map(normName));
    const hay = sourceTexts(ch).filter(Boolean).map(normName);
    const names = tok.quoted
      .filter((q) => !known.has(normName(q)) && !hay.some((h) => h.includes(normName(q))))
      .map((q) => ({ rule: "unknown-name", detail: q }));
    return [...numbers, ...names];
  },
];

/**
 * 초보자용 글 검사. 빈 배열이면 통과.
 * @param {string} draft
 * @param {object} chapter beginnerBrief(...).chapter
 * @param {{ lang?: 'ko'|'en', today?: string }} opts
 * @returns {{ rule: string, detail: string }[]}
 */
export function checkBeginner(draft, chapter, { lang = chapter.check.lang, today } = {}) {
  if (lang !== chapter.check.lang) throw new RangeError(`lang ${lang} does not match the brief (${chapter.check.lang})`);
  const tok = tokenize(draft);
  const shapes = chapter.check.secretShapes.map(({ id, re }) => ({ id, re: new RegExp(re) }));
  // 따옴표·주소·숫자 칸으로 들어온 글에 키 모양이 섞여 있어도 detail 로 되풀이하지 않는다(표의 id 로 바꾼다).
  const redact = (detail) => shapes.find(({ re }) => re.test(detail))?.id ?? detail;
  return RULES.flatMap((rule) => rule(draft, tok, chapter, { today })).map((p) => ({ ...p, detail: redact(p.detail) }));
}

/** 문제 문장(rubric 데이터에서). */
export const problemText = (problem, data, lang) => data.rubric.problems[problem.rule][lang];
