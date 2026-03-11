import { injectQuestionBase } from "../handlers/question/base";
import { sanitizeLaTeX } from "../../utils/sanitize";

const createImagesStrategy = (config) => {
    const { typeKey, manifest: configManifest, strategy } = config;
    const options = strategy.options || {};

    // MERGE manifest from config with defaults
    const SEL = {
        rowTemplate: ".flex-row.ai-s.jc-sb",
        label: ".a2 label",
        passage: ".a2 p",
        inputWrap: ".inp-wrap > div",
        solveBtn: ".btn-solve",
        explanationPopup: ".pop.solution",
        ...configManifest
    };

    return {
        typeKey,
        getSkeletonConfig() {
            return {
                headerUrl: options.headerUrl,
                contentImageUrl: options.contentImageUrl || null,
                inputKind: options.inputKind || "math",
                figureBounds: options.figure_bounds || options.figureBounds || [0, 0, 0, 0],
                figureAlt: options.figure_alt || options.figureAlt || ""
            };
        },

        normalize(raw) {
            // raw represents buildPages[i].data
            const mainQ = raw.mainQuestion || raw.guideText || "";

            // [FIX] Support multiple answer field names
            const ans = raw.answer || (Array.isArray(raw.answers) ? raw.answers[0] : "") || raw.correctAnswer || "";
            const expl = raw.explanation || "";

            return {
                ...raw,
                mainQuestion: mainQ,
                guideText: raw.guideText || "",
                questions: [{
                    label: "1",
                    promptLatex: mainQ,
                    answerLatex: ans,
                    explanation: expl,
                    inputWidth: "w250"
                }]
            };
        },

        injectHtmlPage({ doc, manifest: pageManifest, data }) {
            // Merge final manifest (from ZIP loadManifest)
            const finalSEL = { ...SEL, ...pageManifest };

            injectQuestionBase({ doc, data, manifest: finalSEL });

            const rowTemplate = doc.querySelector(finalSEL.rowTemplate);
            if (!rowTemplate) return;

            const parent = rowTemplate.parentNode;
            const existingRows = Array.from(parent.querySelectorAll(finalSEL.rowTemplate));
            existingRows.forEach(r => r.remove());

            (data.questions || []).forEach((q, i) => {
                const newRow = rowTemplate.cloneNode(true);
                const label = newRow.querySelector(finalSEL.label);
                const p = newRow.querySelector(finalSEL.passage);
                const inp = newRow.querySelector(finalSEL.inputWrap);

                if (label) label.textContent = "";
                if (p) p.innerHTML = sanitizeLaTeX(q.promptLatex);

                if (inp) {
                    inp.className = "w250 ml10 mr10";
                    const quizP = inp.querySelector("p");
                    if (quizP) {
                        quizP.id = `QuizInput${i + 1}`;
                        quizP.className = `QuizInput${i + 1}`;
                        quizP.setAttribute("data-no_idx", String(i + 1));
                        quizP.style.padding = "0px 33px";
                    }
                    const correctEl = inp.querySelector(".correct");
                    if (correctEl) correctEl.innerHTML = sanitizeLaTeX(q.answerLatex);
                }

                parent.appendChild(newRow);
            });

            // Explanation
            const solPopup = doc.querySelector(finalSEL.explanationPopup);
            if (solPopup && data.questions && data.questions[0]) {
                const cont = solPopup.querySelector(".cont");
                if (cont) cont.innerHTML = sanitizeLaTeX(data.questions[0].explanation);
            }
        },

        patchActJs({ actJsText, data }) {
            let out = actJsText;
            const q = (data.questions && data.questions[0]) || { answerLatex: "" };
            const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

            // [FIX] More robust regex for act.js patching
            out = out.replace(/(?:var|let|const)?\s*dap1_array\s*=\s*\[[^]*?\]\s*;/,
                `var dap1_array = [["${esc(q.answerLatex)}"]];`);

            out = out.replace(/(?:var|let|const)?\s*q_len\s*=\s*\d+\s*;/, `var q_len = 1;`);

            out = out.replace(/(?:var|let|const)?\s*qArange\s*=\s*\[[^]*?\]\s*;/, `var qArange = [[1]];`);

            out = out.replace(/(?:var|let|const)?\s*dap_array\s*=\s*[^;]*;/, `var dap_array = [].concat(dap1_array);`);

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
        }
    };
};

export default createImagesStrategy;
