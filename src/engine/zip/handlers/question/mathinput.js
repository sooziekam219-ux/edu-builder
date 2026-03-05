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

        // [추가된 부분] 복제된 p 태그의 ID를 QuizInput1, QuizInput2 등으로 고유하게 변경
        const quizP = inp.querySelector("p[id^='QuizInput']");
        if (quizP) {
          quizP.id = `QuizInput${i + 1}`;
        }
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
    const allQuizInputs = doc.querySelectorAll("p[id^='QuizInput']");
    allQuizInputs.forEach((el, index) => {
      // 강제로 QuizInput1, QuizInput2, QuizInput3... 으로 덮어씌움
      el.setAttribute("id", `QuizInput${index + 1}`);
    });

    const allMathBtns = doc.querySelectorAll(".btn-math");
    allMathBtns.forEach((btn, index) => {
      // 접근성 라벨도 1번, 2번... 으로 강제 매핑
      btn.setAttribute("aria-label", `${index + 1}번 정답 입력칸`);
    });
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

    return out;
  },
};

export default mathInputHandler;
