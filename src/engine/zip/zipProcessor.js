/* eslint-disable */
import { collection, getDocs } from "firebase/firestore";

/**
 * App.js에서 이렇게 호출해야 함:
 * processAndDownloadZip({
 *   templates, selectedTemplateId, extractedBuildData,
 *   setStatusMessage, setIsProcessing, removePagination,
 *   db, appId
 * })
 */
export async function processAndDownloadZip({
  templates,
  selectedTemplateId,
  extractedBuildData,
  setStatusMessage,
  setIsProcessing,
  removePagination,
  db,
  appId,
}) {
  console.log("processAndDownloadZip called");

  // --------------------
  // helpers
  // --------------------
  const sanitizeLaTeX = (str) => {
    if (!str) return "";
    let sanitized = str;

    // $...$ -> \(...\)
    sanitized = sanitized.replace(/\$(.*?)\$/g, "\\($1\\)");

    // \ ^ _ 있는데 \( \) 없으면 감싸기
    if (
      (sanitized.includes("\\") || sanitized.includes("^") || sanitized.includes("_")) &&
      !sanitized.includes("\\(")
    ) {
      sanitized = `\\(${sanitized}\\)`;
    }

    // 중복된 \( \( 제거
    sanitized = sanitized.replace(/\\\((\\\(.*?\\\))\\\)/g, "$1");
    return sanitized;
  };

  // mathinput act.js(dap1_array...) 패치
  const patchMathInputActJs = (actText, subQuestions) => {
    const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');

    const answers = (subQuestions || []).map((sq) => sq.answer ?? "");
    const n = Math.max(answers.length, 0);

    // 기존 dap*_array 선언 제거
    let out = actText.replace(/var\s+dap\d+_array\s*=\s*\[[^\]]*\]\s*;\s*\r?\n/g, "");

    // 맨 앞(첫 줄 다음)에 dap1_array.. 삽입 (multiQuiz 선언 바로 아래에 들어가게 됨)
    const firstNL = out.indexOf("\n");
    const dapLines = [];
    for (let i = 0; i < n; i++) {
      dapLines.push(`var dap${i + 1}_array = ["${esc(answers[i])}"];`);
    }
    const dapBlock = dapLines.join("\n") + "\n";

    if (firstNL !== -1) out = out.slice(0, firstNL + 1) + dapBlock + out.slice(firstNL + 1);
    else out = dapBlock + out;

    // q_len 교체
    out = out.replace(/var\s+q_len\s*=\s*\d+\s*;[^\n]*\r?\n/, `var q_len = ${n};//확인버튼 개수\n`);

    // qArange 교체: [[1],[2],...]
    const qArange = "[" + Array.from({ length: n }, (_, i) => `[${i + 1}]`).join(", ") + "]";
    out = out.replace(
      /var\s+qArange\s*=\s*\[[^\]]*\]\s*;[^\n]*\r?\n/,
      `var qArange = ${qArange};// 각 확인버튼에 배정된 문제 번호\n`
    );

    // dap_array 교체
    const dapArrayExpr = `[].concat(${Array.from({ length: n }, (_, i) => `dap${i + 1}_array`).join(", ")})`;
    out = out.replace(/var\s+dap_array\s*=\s*[^;]*;[^\n]*\r?\n/, `var dap_array = ${dapArrayExpr};//전체 정답 배열\n`);

    return out;
  };

  // --------------------
  // guards
  // --------------------
  if (!window.JSZip) {
    setStatusMessage({
      title: "오류",
      message: "JSZip 라이브러리가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.",
      type: "error",
    });
    return;
  }
  if (!selectedTemplateId) {
    setStatusMessage({ title: "알림", message: "템플릿이 선택되지 않았습니다.", type: "error" });
    return;
  }
  if (!extractedBuildData) {
    setStatusMessage({
      title: "알림",
      message: "AI 분석 데이터가 없습니다. 이미지를 업로드하고 분석을 기다려주세요.",
      type: "error",
    });
    return;
  }

  setIsProcessing(true);

  try {
    // 1) 템플릿 메타
    const templateMeta = templates.find((t) => t.id === selectedTemplateId);
    if (!templateMeta) throw new Error("템플릿 메타데이터를 찾을 수 없습니다.");
    const isTogether = templateMeta.type === "together";

    // 2) Firestore chunks에서 zip 복원
    const chunksRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "templates",
      selectedTemplateId,
      "chunks"
    );
    const chunksSnap = await getDocs(chunksRef);
    if (chunksSnap.empty) {
      throw new Error(
        "서버에서 템플릿 데이터를 찾을 수 없습니다. (업로드 실패 가능성)\n해당 템플릿을 삭제 후 다시 업로드해주세요."
      );
    }

    const sorted = chunksSnap.docs.map((d) => d.data()).sort((a, b) => a.index - b.index);

    const chunkBinaries = sorted.map((c) => {
      const bin = atob(c.data);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return u8;
    });

    const totalSize = chunkBinaries.reduce((a, b) => a + b.length, 0);
    const combined = new Uint8Array(totalSize);
    let offset = 0;
    for (const b of chunkBinaries) {
      combined.set(b, offset);
      offset += b.length;
    }

    // 3) zip 열기
    const zip = new window.JSZip();
    const loadedZip = await zip.loadAsync(combined);

    const parser = new DOMParser();
    const serializer = new XMLSerializer();

    const promises = [];
    const filesToRemove = [];

    loadedZip.forEach((path, file) => {
      if (path.startsWith("common1/")) return;

      // pagination 제거 옵션
      if (removePagination) {
        const fileName = path.split("/").pop();
        if (
          (fileName.startsWith("view") && fileName.endsWith(".html") && !fileName.includes("01")) ||
          (fileName.startsWith("act") && fileName.endsWith(".js") && (fileName.includes("02") || fileName.includes("2")))
        ) {
          filesToRemove.push(path);
          return;
        }
      }

      // --------------------
      // HTML(view*.html)
      // --------------------
      if (path.endsWith(".html") && path.includes("view")) {
        promises.push(
          file.async("string").then((content) => {
            const doc = parser.parseFromString(content, "text/html");

            // pagination 제거(view 내부)
            if (removePagination) doc.querySelector(".pagination")?.remove();

            // guideText
            const stxt = doc.querySelector(".stxt");
            if (stxt && extractedBuildData.guideText) {
              const gt = extractedBuildData.guideText.trim();
              stxt.textContent = gt.startsWith("▷") ? gt : `▷ ${gt}`;
            }

            // mainQuestion
            const qp = doc.querySelector(".q > p");
            if (qp && extractedBuildData.mainQuestion) {
              if (qp.childNodes[0]?.nodeType === 3) qp.childNodes[0].textContent = extractedBuildData.mainQuestion;
            }

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

            loadedZip.file(path, serializer.serializeToString(doc));
          })
        );
      }

      // --------------------
      // JS(act*.js)
      // --------------------
      // 함께풀기
      if (path.endsWith(".js") && path.includes("act")) {
        promises.push(
          file.async("string").then((content) => {
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

            loadedZip.file(path, js);
          })
        );
      }
    });

    await Promise.all(promises);
    filesToRemove.forEach((p) => loadedZip.remove(p));

    const blob = await loadedZip.generateAsync({ type: "blob" });
    if (blob.size === 0) throw new Error("생성된 ZIP 파일의 크기가 0입니다.");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Result_${templateMeta.name}_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setStatusMessage({ title: "성공", message: "ZIP 빌드 및 다운로드가 완료되었습니다.", type: "success" });
  } catch (e) {
    console.error(e);
    setStatusMessage({ title: "오류", message: "다운로드 실패: " + e.message, type: "error" });
  } finally {
    setIsProcessing(false);
  }
}
