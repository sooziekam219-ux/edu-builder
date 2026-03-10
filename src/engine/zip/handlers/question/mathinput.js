import { injectQuestionBase } from "./base";
import { sanitizeLaTeX } from "../../../utils/sanitize";

const mathInputHandler = {
  typeKey: "question.mathinput",

  normalize(raw) {
    // subQuestions(빌더) OR questions(표준)
    const qs = raw?.subQuestions || raw?.questions || [];
    return {
      header: raw?.header,
      guideText: raw?.guideText ?? "",
      mainQuestion: raw?.mainQuestion ?? raw?.questionText ?? "",
      questions: qs.map((q) => ({
        label: q.label, // (1), (2) 등
        promptLatex: q.promptLatex ?? q.passage ?? q.prompt ?? "", // 지문/수식
        answerLatex: q.answerLatex ?? q.answer ?? "",
        explanation: q.explanation ?? "",
        inputWidth: q.inputWidth || "w200",
      })),
      figure_bounds: raw?.figure_bounds || [0, 0, 0, 0],
      figure_alt: raw?.figure_alt || "",
      contentImageUrl: raw?.contentImageUrl || null
    };
  },

  getSkeletonConfig(data) {
    // [FIX] Use keys normalized by the same handler
    return {
      hasImage: !!(data?.figure_bounds && data.figure_bounds.some(v => v !== 0)),
      contentImageUrl: data?.contentImageUrl || null,
      figureBounds: data?.figure_bounds || [0, 0, 0, 0],
      figureAlt: data?.figure_alt || "문제 이미지"
    };
  },

  injectHtmlPage({ doc, manifest, data, pageIndex }) {
    // 1. 공통 헤더/가이드/발문
    injectQuestionBase({ doc, data, manifest });

    // [추가] 정렬을 위한 스타일 주입
    if (!doc.getElementById('mathinput-inline-style')) {
      const $style = doc.createElement('style');
      $style.id = 'mathinput-inline-style';
      $style.textContent = `
            mjx-container, math { margin-top: 8px; }
            .inp-wrap p, .inp-wrap2 p { margin-top: -5px; }
        `;
      const head = doc.head || doc.getElementsByTagName('head')[0];
      if (head) {
        head.appendChild($style);
      } else {
        (doc.body || doc.documentElement).appendChild($style);
      }
    }

    // 2. 문항 렌더링 (Clone -> Clear -> Rebuild Strategy)
    const rowTemplate = doc.querySelector(".flex-row.ai-s.jc-sb");
    if (!rowTemplate) return;

    const parent = rowTemplate.parentNode;
    const existingRows = Array.from(parent.querySelectorAll(".flex-row.ai-s.jc-sb"));
    existingRows.forEach((r) => r.remove());

    // injectHtmlPage 내부의 루프 부분 수정
    (data.questions || []).forEach((q, i) => {
      const newRow = rowTemplate.cloneNode(true);

      const label = newRow.querySelector(".a2 label");
      const p = newRow.querySelector(".a2 p");
      // 중요: inp-wrap 내부의 div를 찾을 때도 newRow 안에서 수행
      const inp = newRow.querySelector(".inp-wrap > div");
      const solveBtn = newRow.querySelector(".btn-solve");

      if (label) label.textContent = q.label || `(${i + 1})`;
      if (p) p.innerHTML = sanitizeLaTeX(q.promptLatex);

      // 입력칸 ID 업데이트
      if (inp) {
        // [추가] 정답 분석 및 너비 클래스 계산
        const answer = q.answerLatex || "";
        const cleanAns = String(answer || "")
          .replace(/\\\(|\\\)|\\\[|\\\]/g, '')
          .replace(/\\left|\\right/g, '')

          .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (match, a, b) => {
            return a.length >= b.length ? a : b;
          })
          .replace(/\\sqrt(\{[^{}]*\}|.)/g, (match, p1) => {
            return p1 ? p1.replace(/[{}]/g, '') : "";
          })
          .replace(/\\circ/g, '')
          .replace(/\\[a-zA-Z]+/g, ' ')
          .trim();

        let widthClass = "w200";

        const len = cleanAns.length;
        if (len <= 4) widthClass = "w150";
        else if (len <= 6) widthClass = "w250";
        else if (len <= 9) widthClass = "w300";
        else if (len <= 13) widthClass = "w400";
        else if (len <= 16) widthClass = "w500";
        else widthClass = "w600";

        inp.className = `${widthClass} ml10 mr10`; // 기존 클래스 교체 및 마진 추가

        // [수정된 부분] QuizInput ID 및 aria-label 부여
        const quizP = inp.querySelector("p[id^='QuizInput']");
        if (quizP) {
          quizP.id = `QuizInput${i + 1}`;
          quizP.className = `QuizInput${i + 1}`; // [추가] 클래스도 ID와 동일하게 부여
        }

        // 버튼을 찾아서 aria-label 부여 (.btn-solve 또는 .btn-math)
        const btn = inp.querySelector("button");
        if (btn) {
          btn.setAttribute("aria-label", `${i + 1}번 정답 입력칸`);
        }
      }

      // [추가] 하단 버튼들 (풀기, 다시 하기, 확인) aria-label 처리
      const btnWrap = newRow.querySelector(".btn-wrap");
      if (btnWrap) {
        const solve = btnWrap.querySelector(".btn-solve");
        const retry = btnWrap.querySelector(".btn-retry");
        const ok = btnWrap.querySelector(".btn-ok");

        if (solve) solve.setAttribute("aria-label", `${i + 1}번 풀이`);
        if (retry) retry.setAttribute("aria-label", `${i + 1}번 다시 하기`);
        if (ok) ok.setAttribute("aria-label", `${i + 1}번 확인`);
      }

      if (solveBtn) {
        solveBtn.setAttribute("aria-haspopup", "dialog");
      }

      // 4) 마진 처리
      if (i !== (data.questions.length - 1)) {
        newRow.classList.add("mb80");
        newRow.style.marginBottom = "80px";
      }

      // 5) 최종 추가
      parent.appendChild(newRow);
    });

    // 3. 해설 팝업 (.pop.solution)
    const solPopups = doc.querySelectorAll(".pop.solution");
    if (solPopups.length > 0) {
      // 팝업이 여러 개면 순서대로 매핑
      (data.questions || []).forEach((q, idx) => {
        if (solPopups[idx]) {
          const cont = solPopups[idx].querySelector(".cont");
          if (cont) {
            cont.innerHTML = sanitizeLaTeX(q.explanation);
            cont.setAttribute("aria-label", ""); // 접근성 초기화
          }
        }
      });
    }
  },

  patchActJs({ actJsText, data, pageIndex }) {
    let out = actJsText;
    const questions = data.questions || [];
    const n = questions.length;
    const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

    // 1. 개별 정답 배열 (dapX_array) 처리
    for (let i = 0; i < n; i++) {
      const val = questions[i].answerLatex;
      const varName = `dap${i + 1}_array`;
      const newCode = `var ${varName} = ["${esc(val)}"];`;

      // [수정됨] g 플래그 제거 및 값 매칭 정규식 개선 ([^;]* 사용)
      const re = new RegExp(`(?:var|let|const)?\\s*${varName}\\s*=\\s*[^;]*;?`);

      if (re.test(out)) {
        out = out.replace(re, newCode);
      } else {
        // [수정됨] 못 찾은 경우 q_len 변수 선언부 바로 위에 추가 (qArange 위보다 안전함)
        out = out.replace(/((?:var|let|const)?\s*q_len)/, `${newCode}\n$1`);
      }
    }

    // 2. q_len
    out = out.replace(/(?:var|let|const)?\s*q_len\s*=\s*\d+\s*;?/, `var q_len = ${n};`);

    // 3. qArange: [[1],[2],...]
    const arangeStr = "[" + Array.from({ length: n }, (_, i) => `[${i + 1}]`).join(", ") + "]";
    // [수정됨] 중첩 배열([[1], [2]])을 처리하지 못하던 기존 정규식(\[[^\]]*\])을 [^;]* 로 변경
    out = out.replace(/(?:var|let|const)?\s*qArange\s*=\s*[^;]*;?/, `var qArange = ${arangeStr};`);

    // 4. dap_array: [].concat(dap1_array, dap2_array...)
    const concatArgs = Array.from({ length: n }, (_, i) => `dap${i + 1}_array`).join(", ");
    out = out.replace(
      /(?:var|let|const)?\s+dap_array\s*=\s*[^;]*;?/,
      `var dap_array = [].concat(${concatArgs});`
    );

    out += `\n\n/* 로컬 테스트를 위한 수식 입력 프롬프트 주입 */
(function() {
  if (window._hasCallExpressPatch) return;
  window._hasCallExpressPatch = true;
  const original_call_EXPRESS = window.call_EXPRESS;
  window.call_EXPRESS = function (idx) {
    if (typeof isMuto_fn === 'function' && isMuto_fn()) {
      const latex = prompt("LaTeX 수식을 입력하세요:");
      if (latex !== null && typeof ExpRtn_fn === 'function') {
        ExpRtn_fn({ id: "EXPRESS_0" + idx, latex: latex });
      }
      return;
    }
    if (typeof original_call_EXPRESS === 'function') {
      original_call_EXPRESS(idx);
    }
  };
})();\n`;

    return out;
  },
};

export default mathInputHandler;
