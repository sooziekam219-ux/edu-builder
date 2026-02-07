// content injection
            if (isTogether && extractedBuildData.lines) {
              // together 로직 (현재 zipProcessor.js에 있는 그대로 두는 게 안전)
              const container = doc.querySelector('div[translate="no"]');
              if (container) {
                const existingLines = Array.from(container.querySelectorAll(".txt1"));
                const ml50Base = existingLines.find((l) => l.classList.contains("ml50"))?.cloneNode(true);
                const ml100Base = existingLines.find((l) => l.classList.contains("ml100"))?.cloneNode(true);
                const defaultBase = existingLines[0]?.cloneNode(true);

                container.innerHTML = "";
                let bId = 0;

                extractedBuildData.lines.forEach((line) => {
                  const newLine = (line.label ? (ml50Base || defaultBase) : (ml100Base || defaultBase)).cloneNode(true);
                  newLine.innerHTML = "";
                  newLine.className = line.label ? "txt1 mb40 ml50" : "txt1 mb40 ml100 flex-row ai-c";

                  if (line.label) {
                    const lSpan = doc.createElement("span");
                    lSpan.textContent = line.label;
                    newLine.appendChild(lSpan);
                  }

                  if (line.parts) {
                    line.parts.forEach((part) => {
                      if (part.type === "text") {
                        const tSpan = doc.createElement("span");
                        if (!line.label) tSpan.className = "ml10";
                        tSpan.innerHTML = sanitizeLaTeX(part.content);
                        newLine.appendChild(tSpan);
                      } else if (part.type === "blank") {
                        bId++;
                        const bSpan = doc.createElement("span");
                        bSpan.className = "btn-blank-wrap ml10";

                        const options = part.options || [];
                        const correctIdx = (parseInt(part.correctIndex) || 1) - 1;
                        const correctValue = options[correctIdx] || "";
                        const finalCorrect = sanitizeLaTeX(correctValue);

                        bSpan.innerHTML = `
<input type="checkbox" class="check-blank" id="check-blank${bId}">
<label for="check-blank${bId}" class="btn-blank">빈칸</label>
<ul class="select-wrap bottom">
  ${options.map((opt) => `<li><button type="button" class="btn-select">${sanitizeLaTeX(opt)}</button></li>`).join("")}
</ul>
<span class="write-txt" style="width: ${part.width || 120}px"></span>
<span class="correct">${finalCorrect}</span>
`;
                        newLine.appendChild(bSpan);
                      }
                    });
                  }

                  container.appendChild(newLine);
                });
              }
            } else if (extractedBuildData.subQuestions) {
              // question_mathinput 로직
              const rowTemplate = doc.querySelector(".flex-row.ai-s.jc-sb");
              if (rowTemplate) {
                const parent = rowTemplate.parentNode;
                // 기존 문항 지우기
                const rows = Array.from(parent.querySelectorAll(".flex-row.ai-s.jc-sb")).filter((r) => r.querySelector(".a2"));
                rows.forEach((r) => r.remove());
                
                // AI가 준 문항 배열 하나씩 처리
                extractedBuildData.subQuestions.forEach((sq, i) => {
                  const newRow = rowTemplate.cloneNode(true);
                  const label = newRow.querySelector(".a2 label");
                  const p = newRow.querySelector(".a2 p");
                  const inp = newRow.querySelector(".inp-wrap > div");

                  const solveBtn = newRow.querySelector(".btn-solve");
                  if (solveBtn) solveBtn.setAttribute("aria-haspopup", "dialog");

                  if (label) label.textContent = sq.label;
                  if (p) p.innerHTML = sanitizeLaTeX(sq.passage);

                  if (inp) {
                    inp.classList.forEach((c) => {
                      if (c.startsWith("w")) inp.classList.remove(c);
                    });
                    inp.classList.add(sq.inputWidth || "w200");
                  }

                  if (i !== extractedBuildData.subQuestions.length - 1) newRow.classList.add("mb80");
                  parent.appendChild(newRow);
                });
              }

              // solution popup
              const solPopups = doc.querySelectorAll(".pop.solution");
              if (solPopups.length > 0) {
                extractedBuildData.subQuestions.forEach((sq, idx) => {
                  if (solPopups[idx]) {
                    const cont = solPopups[idx].querySelector(".cont");
                    if (cont) {
                      cont.innerHTML = sanitizeLaTeX(sq.explanation);
                      cont.setAttribute("aria-label", "");
                    }
                  }
                });
              }
            }



// js
let js = content;

            if (isTogether && extractedBuildData.lines) {
              // together: dap_array (index)
              const daps = [];
              extractedBuildData.lines.forEach((l) =>
                l.parts?.filter((p) => p.type === "blank").forEach((p) => daps.push((p.correctIndex || 1) - 1))
              );
              js = js.replace(/var\s+dap_array\s*=\s*\[[\s\S]*?\]\s*;/g, `var dap_array = ${JSON.stringify(daps)};`);
              js = js.replace(/var\s+q_len\s*=\s*dap_array\.length\s*;/g, `var q_len = ${daps.length};`);
            } 
            // 문제 mathinput
            else if (extractedBuildData.subQuestions) {
              // ✅ mathinput: dap1_array 구조 패치 (act.js가 이 구조임) :contentReference[oaicite:4]{index=4}
              if (/var\s+dap1_array\s*=/.test(js) || /var\s+qArange\s*=/.test(js)) {
                js = patchMathInputActJs(js, extractedBuildData.subQuestions);
              } else {
                // fallback(다른 템플릿)
                const daps = extractedBuildData.subQuestions.map((s) => s.answer);
                js = js.replace(
                  /(const|var|let)\s+answers\s*=\s*\[[\s\S]*?\]\s*;/g,
                  `$1 answers = ${JSON.stringify(daps)};`
                );
              }
            }