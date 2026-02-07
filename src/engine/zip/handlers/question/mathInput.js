import { injectQuestionBase } from "./base";

/**
 * data.questions 예시(권장 표준)
 * [
 *   { promptLatex: "\\(6\\)", answerLatex: "\\pm\\sqrt{6}" },
 *   { promptLatex: "\\(10\\)", answerLatex: "\\pm\\sqrt{10}" },
 *   { promptLatex: "...", answerLatex: "..." },
 *   { promptLatex: "...", answerLatex: "..." }
 * ]
 */
function chunkQuestions(questions, size = 2) {
  const out = [];
  for (let i = 0; i < questions.length; i += size) out.push(questions.slice(i, i + size));
  return out;
}

function setInnerHTMLSafe(el, html) {
  if (!el) return;
  el.innerHTML = html ?? "";
}

function injectOnePage({ doc, manifest, data, pageIndex, pageQuestions }) {
  // 공통(헤더/guide/mainQuestion)
  injectQuestionBase({ doc, data, manifest });

  // 문항 아이템들
  const items = Array.from(doc.querySelectorAll(manifest.itemSelector || "main > div.flex-row"));
  if (items.length === 0) return;

  // 페이지당 2개를 목표로 하되, 템플릿에 아이템이 2개 있다고 가정
  for (let i = 0; i < items.length; i++) {
    const q = pageQuestions[i];

    // q가 없으면(문항 수 부족) 해당 블록 숨김
    if (!q) {
      items[i].style.display = "none";
      continue;
    } else {
      items[i].style.display = "";
    }

    // 라벨 (1)(2)(3)(4)…
    const labelEl = items[i].querySelector(manifest.itemLabel || ".a2 > label");
    if (labelEl) labelEl.textContent = `(${pageIndex * 2 + i + 1})`;

    // 좌측 프롬프트(LaTeX)
    const promptEl = items[i].querySelector(manifest.itemPrompt || ".a2 > p");
    if (promptEl) {
      // 템플릿이 이미 translate="no" + tex-svg.js로 렌더하니까 LaTeX 문자열만 넣으면 됨
      setInnerHTMLSafe(promptEl, q.promptLatex ?? "");
    }

    // 입력칸 id는 템플릿 그대로(QuizInput1/2) 두는 게 안전
    // -> 여기서는 건드리지 않음
  }
}

function patchActJsForPage(actJsText, pageQuestions) {
  const answers = (pageQuestions || []).map(q => q?.answerLatex ?? "");
  const n = answers.length;

  const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  let out = actJsText;

  // dap1_array, dap2_array, ... 교체 (해당 개수만큼)
  for (let i = 0; i < n; i++) {
    const re = new RegExp(`var\\s+dap${i + 1}_array\\s*=\\s*\\[[^\\]]*\\]\\s*;`);
    out = out.replace(re, `var dap${i + 1}_array = ["${esc(answers[i])}"];`);
  }

  // 혹시 템플릿에 dap3_array 같은 게 남아있으면 제거(안전)
  out = out.replace(/var\s+dap\d+_array\s*=\s*\[[^\]]*\]\s*;\s*\r?\n/g, (m) => {
    const num = Number((m.match(/dap(\d+)_array/) || [])[1]);
    return num > n ? "" : m;
  });

  // q_len 갱신
  out = out.replace(/var\s+q_len\s*=\s*\d+\s*;[^\n]*\r?\n/, `var q_len = ${n};//확인버튼 개수\n`);

  // qArange 갱신: [[1],[2],...]
  const qArange = "[" + Array.from({ length: n }, (_, i) => `[${i + 1}]`).join(", ") + "]";
  out = out.replace(
    /var\s+qArange\s*=\s*\[[^\]]*\]\s*;[^\n]*\r?\n/,
    `var qArange = ${qArange};// 각 확인버튼에 배정된 문제 번호\n`
  );

  // dap_array 갱신 (concat 체인 안전 생성)
  const dapArrayExpr = `[].concat(${Array.from({ length: n }, (_, i) => `dap${i + 1}_array`).join(", ")})`;
  out = out.replace(/var\s+dap_array\s*=\s*[^;]*;[^\n]*\r?\n/, `var dap_array = ${dapArrayExpr};//전체 정답 배열\n`);

  return out;
}

export default {
  typeKey: "question_mathinput",

  // 너가 지금 AI에서 어떤 JSON을 받든, 여기서 “questions 배열”로만 맞춰주면 됨
  normalize(raw) {
    // raw가 기존 subQuestions 형태면 여기에 맞추기
    // 기대: raw.subQuestions: [{ promptLatex, answerLatex }, ...]
    const qs = raw?.questions || raw?.subQuestions || [];
    return {
      header: raw?.header,
      guideText: raw?.guideText ?? "",
      mainQuestion: raw?.mainQuestion ?? raw?.questionText ?? "",
      questions: qs.map((q) => ({
        promptLatex: q.promptLatex ?? q.prompt ?? q.left ?? "",
        answerLatex: q.answerLatex ?? q.answer ?? "",
      })),
    };
  },

  /**
   * zipProcessor 쪽에서 아래 2개를 호출해줘야 완성:
   * - injectHtmlPage(doc, pageIndex)
   * - patchActJs(actText, pageIndex)
   */
  injectHtmlPage({ doc, manifest, data, pageIndex }) {
    const pages = chunkQuestions(data.questions, 2);
    const pageQuestions = pages[pageIndex] || [];
    injectOnePage({ doc, manifest, data, pageIndex, pageQuestions });
  },

  patchActJs({ actJsText, data, pageIndex }) {
    const pages = chunkQuestions(data.questions, 2);
    const pageQuestions = pages[pageIndex] || [];
    return patchActJsForPage(actJsText, pageQuestions);
  },
};
