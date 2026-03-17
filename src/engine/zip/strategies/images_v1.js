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
                    prefixText: raw.prefixText || "",
                    suffixText: raw.suffixText || "",
                }]
            };
        },

        injectHtmlPage({ doc, manifest: pageManifest, data, skeletonConfig }) {
            // Merge final manifest (from ZIP loadManifest)
            const finalSEL = { ...SEL, ...pageManifest };

            injectQuestionBase({ doc, data, manifest: finalSEL });


            // --- [NEW] question.image 전용: main 영역에 크롭된 이미지 주입 ---
            if (skeletonConfig && skeletonConfig.contentImageUrl) {
                const mainEl = doc.querySelector("main");
                if (mainEl) {
                    // 기존 이미지 영역 제거 (main 내 모든 img — header 내부 제외)
                    mainEl.querySelectorAll("img").forEach(el => {
                        if (!el.closest("header") && !el.closest(".tit")) {
                            el.remove();
                        }
                    });

                    // 새 크롭 이미지 요소 생성
                    const isLandscape = skeletonConfig.imageOrientation !== "portrait";
                    const imgEl = doc.createElement("img");
                    imgEl.src = skeletonConfig.contentImageUrl; // "./images/content_01.png"
                    imgEl.alt = skeletonConfig.altText || "문제 이미지";
                    imgEl.className = "illustration-img";
                    imgEl.style.cssText = `display:block; margin:20px auto; max-width:100%;${isLandscape ? " max-height:600px; width:auto; height:auto;" : ""}`;

                    // .q 영역(안내 텍스트 .stxt 포함) 다음에 삽입
                    const qBox = mainEl.querySelector(".q");
                    if (qBox && qBox.nextSibling) {
                        mainEl.insertBefore(imgEl, qBox.nextSibling);
                    } else if (qBox) {
                        mainEl.appendChild(imgEl);
                    } else {
                        mainEl.insertBefore(imgEl, mainEl.firstChild);
                    }
                }
            }

            // [수정 1] image.js에서 questions 배열을 안 만들어줬을 경우를 대비한 Fallback
            const questionsList = (data.questions && data.questions.length > 0)
                ? data.questions
                : [{
                    promptLatex: data.mainQuestion || "",
                    answerLatex: data.answer || "",
                    explanation: data.explanation || "",
                    prefixText: data.prefixText || "",
                    suffixText: data.suffixText || ""
                }];

            // [수정 2] 조기 종료(return)를 없애고, 템플릿이 있을 때만 실행되도록 if문으로 감쌈
            const rowTemplate = doc.querySelector(finalSEL.rowTemplate);
            if (rowTemplate) {
                const parent = rowTemplate.parentNode;
                const existingRows = Array.from(parent.querySelectorAll(finalSEL.rowTemplate));
                existingRows.forEach(r => r.remove());

                questionsList.forEach((q, i) => {
                    const newRow = rowTemplate.cloneNode(true);
                    const label = newRow.querySelector(finalSEL.label);
                    const p = newRow.querySelector(finalSEL.passage);
                    const inp = newRow.querySelector(finalSEL.inputWrap);

                    if (label) label.textContent = "";
                    if (p) p.innerHTML = sanitizeLaTeX(q.promptLatex);

                    if (inp) {
                        // [NEW] mathinput.js와 동일한 정답 길이 기반 입력칸 크기 조절
                        const answer = q.answerLatex || "";
                        const cleanAns = String(answer)
                            .replace(/\\\(|\\\)|\\\[|\\\]/g, '')
                            .replace(/\\left|\\right/g, '')
                            .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (m, a, b) => a.length >= b.length ? a : b)
                            .replace(/\\sqrt(\{[^{}]*\}|.)/g, (m, p1) => p1 ? p1.replace(/[{}]/g, '') : "")
                            .replace(/\\circ/g, '')
                            .replace(/\\[a-zA-Z]+/g, ' ')
                            .trim();

                        let widthClass = "w200";
                        const len = cleanAns.length;
                        if (len <= 4) widthClass = "w200";
                        else if (len <= 6) widthClass = "w250";
                        else if (len <= 9) widthClass = "w300";
                        else if (len <= 13) widthClass = "w400";
                        else if (len <= 16) widthClass = "w500";
                        else widthClass = "w600";

                        inp.className = `${widthClass} ml10 mr10`;

                        const quizP = inp.querySelector("p[id^='QuizInput']") || inp.querySelector("p");
                        if (quizP) {
                            quizP.id = `QuizInput${i + 1}`;
                            quizP.className = `QuizInput${i + 1}`;
                            quizP.setAttribute("data-no_idx", String(i + 1));
                            quizP.style.padding = "0px 33px";
                        }

                        const correctEl = inp.querySelector(".correct");
                        if (correctEl) correctEl.innerHTML = sanitizeLaTeX(q.answerLatex);

                        // 버튼 접근성
                        const btn = inp.querySelector("button");
                        if (btn) btn.setAttribute("aria-label", `${i + 1}번 정답 입력칸`);

                        // [NEW] 입력칸 앞뒤 텍스트 삽입 (정상 작동할 것입니다)
                        const inpWrap = inp.closest(".inp-wrap") || inp.parentNode;
                        // 1. 기존 접두어/접미어 안전하게 철거 (버튼, div 등은 절대 건드리지 않음!)
                        // inpWrap의 직계 자식 중에서 'span' 태그만 찾아서 삭제합니다.
                        Array.from(inpWrap.children).forEach(child => {
                            if (child.tagName.toLowerCase() === 'span') {
                                child.remove();
                            }
                        });
                        if (q.prefixText || q.suffixText) {
                            inpWrap.style.cssText += "display:flex; align-items:center; flex-wrap:wrap;";
                        }
                        if (q.prefixText) {
                            const prefix = doc.createElement("span");
                            prefix.className = "prefix-text";
                            prefix.setAttribute("translate", "no");
                            prefix.innerHTML = sanitizeLaTeX(q.prefixText);
                            prefix.style.cssText = "font-size:34px; font-weight:bold; margin-right:8px; vertical-align:middle;";
                            inpWrap.insertBefore(prefix, inpWrap.firstChild);
                        }
                        if (q.suffixText) {
                            const suffix = doc.createElement("span");
                            suffix.className = "suffix-text";
                            suffix.setAttribute("translate", "no");
                            suffix.innerHTML = sanitizeLaTeX(q.suffixText);
                            suffix.style.cssText = "font-size:34px; font-weight:bold; margin-left:8px; vertical-align:middle;";
                            inpWrap.appendChild(suffix);
                        }
                    }
                    parent.appendChild(newRow);
                });
            } else {
                // [선택적 Fallback] rowTemplate(.flex-row.ai-s.jc-sb)이 없더라도 단일 입력칸(.inp-wrap)이 있다면 앞뒤 텍스트를 주입
                const singleInp = doc.querySelector(finalSEL.inputWrap);
                if (singleInp && questionsList[0]) {
                    const q = questionsList[0];
                    const inpWrap = singleInp.closest(".inp-wrap") || singleInp.parentNode;

                    // 1. [핵심] 기존 span 태그 삭제 로직을 Fallback 블록에도 추가!
                    Array.from(inpWrap.children).forEach(child => {
                        if (child.tagName.toLowerCase() === 'span') {
                            child.remove();
                        }
                    });
                    if (q.prefixText || q.suffixText) {
                        inpWrap.style.cssText += "display:flex; align-items:center; flex-wrap:wrap;";
                    }
                    if (q.prefixText) {
                        const prefix = doc.createElement("span");
                        prefix.className = "prefix-text";
                        prefix.innerHTML = sanitizeLaTeX(q.prefixText);
                        prefix.style.cssText = "font-size:34px; font-weight:bold; margin-right:8px; vertical-align:middle;";
                        inpWrap.insertBefore(prefix, inpWrap.firstChild);
                    }
                    if (q.suffixText) {
                        const suffix = doc.createElement("span");
                        suffix.className = "suffix-text";
                        suffix.innerHTML = sanitizeLaTeX(q.suffixText);
                        suffix.style.cssText = "font-size:34px; font-weight:bold; margin-left:8px; vertical-align:middle;";
                        inpWrap.appendChild(suffix);
                    }
                }
            }

            // [수정 3] return 문이 사라졌으므로 해설 팝업 로직은 무조건 정상적으로 실행됨!
            const solPopups = doc.querySelectorAll(finalSEL.explanationPopup);
            if (solPopups.length > 0) {
                questionsList.forEach((q, idx) => {
                    if (solPopups[idx]) {
                        const cont = solPopups[idx].querySelector(".cont");
                        if (cont) {
                            cont.innerHTML = sanitizeLaTeX(q.explanation);
                            cont.setAttribute("aria-label", "");
                        }
                    }
                });
            }
        },

        patchActJs({ actJsText, data }) {
            let out = actJsText;
            const questions = data.questions || [];
            const n = questions.length || 1;
            const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

            console.log("[images_v1 patchActJs] questions:", questions.map(q => q.answerLatex));

            // 1. 개별 정답 배열 (dapX_array) — mathinput.js과 동일한 frac/dfrac 상호 치환 로직
            for (let i = 0; i < n; i++) {
                const val = questions[i].answerLatex || "";
                const varName = `dap${i + 1}_array`;

                const parts = val.split('|').map(s => s.trim()).filter(s => s !== "");
                const result = parts.map(p => {
                    if (p.includes("\\frac") || p.includes("\\dfrac")) {
                        const variants = new Set([p]);
                        if (p.includes("\\frac")) variants.add(p.replace(/\\frac/g, "\\dfrac"));
                        if (p.includes("\\dfrac")) variants.add(p.replace(/\\dfrac/g, "\\frac"));
                        const variantArray = Array.from(variants);
                        return variantArray.length > 1 ? variantArray : variantArray[0];
                    }
                    return p;
                });

                const finalVal = result.length === 1 ? [result[0]] : result;
                const newCode = `var ${varName} = ${JSON.stringify(finalVal)};`;

                const re = new RegExp(`(?:var|let|const)?\\s*${varName}\\s*=\\s*[^;]*;?`);
                if (re.test(out)) {
                    out = out.replace(re, newCode);
                } else {
                    out = out.replace(/((?:var|let|const)?\s*q_len)/, `${newCode}\n$1`);
                }
            }

            // 2. q_len
            out = out.replace(/(?:var|let|const)?\s*q_len\s*=\s*\d+\s*;?/, `var q_len = ${n};`);

            // 3. qArange
            const arangeStr = "[" + Array.from({ length: n }, (_, i) => `[${i + 1}]`).join(", ") + "]";
            out = out.replace(/(?:var|let|const)?\s*qArange\s*=\s*[^;]*;?/, `var qArange = ${arangeStr};`);

            // 4. dap_array — 실제 정답 값을 인라인으로 삽입
            const allAnswers = questions.map(q => q.answerLatex || "");
            out = out.replace(
                /(?:var|let|const)?\s+dap_array\s*=\s*[^;]*;?/,
                `var dap_array = ${JSON.stringify(allAnswers)};`
            );

            // 5. 로컬 테스트를 위한 수식 입력 프롬프트 주입
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
