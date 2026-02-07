import { injectQuestionBase } from "./base";
import { sanitizeLaTeX } from "../../../utils/sanitize";

export default {
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
    };
  },

  injectHtmlPage({ doc, manifest, data, pageIndex }) {
    // 1. 공통 헤더/가이드/발문
    injectQuestionBase({ doc, data, manifest });

    // 2. 문항 렌더링 (Clone -> Clear -> Rebuild Strategy from oldzip.js)
    const rowTemplate = doc.querySelector(".flex-row.ai-s.jc-sb");
    if (!rowTemplate) return;

    const parent = rowTemplate.parentNode;
    // 기존 문항(템플릿에 박혀있는 가짜 문항들) 제거
    const existingRows = Array.from(parent.querySelectorAll(".flex-row.ai-s.jc-sb")).filter((r) =>
      r.querySelector(".a2")
    );
    existingRows.forEach((r) => r.remove());

    // 데이터 기반 생성
    // (mathinput은 보통 페이지 구분 없이 쭉 나열하거나, 템플릿에 따라 다를 수 있음.
    //  oldzip.js는 페이지 구분 없이 subQuestions 전체를 렌더링했음. 여기서도 전체 렌더링 가정)
    //  만약 페이지네이션이 필요하다면 slice 로직 추가 필요. (여기서는 oldzip 로직 준수)
    (data.questions || []).forEach((q, i) => {
      const newRow = rowTemplate.cloneNode(true);

      const label = newRow.querySelector(".a2 label");
      const p = newRow.querySelector(".a2 p");
      const inp = newRow.querySelector(".inp-wrap > div");
      const solveBtn = newRow.querySelector(".btn-solve");

      if (label) label.textContent = q.label || `(${i + 1})`;
      if (p) p.innerHTML = sanitizeLaTeX(q.promptLatex);

      // 입력칸 너비 조정
      if (inp) {
        inp.classList.forEach((c) => {
          if (c.startsWith("w") && c !== "wrap") inp.classList.remove(c);
        });
        inp.classList.add(q.inputWidth || "w200");

        // id 조정 필요 시 (보통 템플릿에 QuizInput1, 2... 순서대로 있음)
        // 여기서는 oldzip이 건드리지 않았으므로 패스하거나, 필요하면 재할당
      }

      if (solveBtn) solveBtn.setAttribute("aria-haspopup", "dialog");

      // 마지막 요소 아니면 마진 추가
      if (i !== (data.questions.length - 1)) {
        newRow.classList.add("mb80");
        newRow.style.marginBottom = "80px"; // 안전하게 인라인 스타일도 or class check
      }

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
    // oldzip.js logic: dap1_array, qArange, q_len, dap_array
    // act.js가 "var dap1_array = ..." 형태라고 가정
    let out = actJsText;

    // 1. 각 문항 정답 (dapN_array)
    //    템플릿에는 var dap1_array=['...'];, var dap2_array=['...']; 등이 있을 것임.
    //    데이터 개수만큼 매치해서 교체, 없으면 추가? -> oldzip은 "있는 거 교체" + "부족하면...?"
    //    여기서는 "데이터 개수만큼 순회하며 교체/추가" 

    const questions = data.questions || [];
    const n = questions.length;
    const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

    for (let i = 0; i < n; i++) {
      const val = questions[i].answerLatex;
      const varName = `dap${i + 1}_array`;
      const newCode = `var ${varName} = ["${esc(val)}"];`;

      if (new RegExp(`var\\s+${varName}\\s*=`).test(out)) {
        out = out.replace(new RegExp(`var\\s+${varName}\\s*=\\s*\\[[^\\]]*\\]\\s*;`), newCode);
      } else {
        // 없으면 qArange 근처에 삽입 (Fallback)
        out = out.replace(/(var\s+qArange)/, `${newCode}\n$1`);
      }
    }

    // 2. q_len
    out = out.replace(/var\s+q_len\s*=\s*\d+\s*;/, `var q_len = ${n};`);

    // 3. qArange: [[1],[2],...]
    const arangeStr = "[" + Array.from({ length: n }, (_, i) => `[${i + 1}]`).join(", ") + "]";
    out = out.replace(/var\s+qArange\s*=\s*\[[^\]]*\]\s*;/, `var qArange = ${arangeStr};`);

    // 4. dap_array: [].concat(dap1_array, dap2_array...)
    const concatArgs = Array.from({ length: n }, (_, i) => `dap${i + 1}_array`).join(", ");
    out = out.replace(
      /var\s+dap_array\s*=\s*[^;]*;/,
      `var dap_array = [].concat(${concatArgs});`
    );

    return out;
  },
};
