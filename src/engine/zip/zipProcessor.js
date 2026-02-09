import { TYPE_KEYS } from "../typeKeys"; // [NEW]

import { collection, getDocs } from "firebase/firestore";
//import sanitizeLaTeX from "../utils/sanitize";
import togetherSelect from "./handlers/together/select";
import questionMathinput from "./handlers/question/mathinput"; // 이미 쓰고 있으면 그걸로
import questionTextinput from "./handlers/question/textinput"; // [NEW] Strategy Pattern (Input v1)
import conceptHandler from "./handlers/concept/index";
import togetherSelfHandler from "./handlers/together+self/index"; // [NEW]

import createInputStrategy from "./strategies/input_v1";
import createTogetherStrategy from "./strategies/together_v1";
import createConceptStrategy from "./strategies/concept_v1";
import createTogetherSelfStrategy from "./strategies/together_self_v1"; // [NEW]

const ENGINE_BY_TYPEKEY = {
  [togetherSelect.typeKey]: togetherSelect,
  [questionMathinput.typeKey]: questionMathinput,
  [questionTextinput.typeKey]: questionTextinput,
  [conceptHandler.typeKey]: conceptHandler,
  [togetherSelfHandler.typeKey]: togetherSelfHandler, // [NEW]
};

/**
 * App.js에서 이렇게 호출해야 함:
 * processAndDownloadZip({
 *   templates, selectedTemplateId, extractedBuildData,
 *   setStatusMessage, setIsProcessing, removePagination,
 *   db, appId,
 *   customConfig // [NEW] Draft Config
 * })
 */
export async function processAndDownloadZip({
  templates,
  selectedTemplateId,
  buildPages, // Not extractedBuildData
  setStatusMessage,
  setIsProcessing,
  removePagination, // can be deprecated or auto-used
  db,
  appId,
  customConfig, // [NEW]
}) {
  console.log("processAndDownloadZip called", buildPages);

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
    setStatusMessage({ title: "알림", 템플릿트가: "선택되지 않았습니다.", type: "error" });
    return;
  }

  // 유효한 데이터가 있는 페이지 필터링
  const validPages = (buildPages || []).filter(p => p.data);
  if (validPages.length === 0) {
    setStatusMessage({
      title: "알림",
      message: "유효한 데이터가 있는 페이지가 없습니다. 이미지를 업로드하고 분석을 진행해주세요.",
      type: "error",
    });
    return;
  }
  const totalPage = validPages.length;

  setIsProcessing(true);

  try {
    // 1) 템플릿 메타
    const templateMeta = templates.find((t) => t.id === selectedTemplateId);
    if (!templateMeta) throw new Error("템플릿 메타데이터를 찾을 수 없습니다.");
    //const baseTemplateId =
    //  customConfig?.baseTemplateTypeKey
    //    ? templates.find(t => t.typeKey === customConfig.baseTemplateTypeKey)?.id
    //    : selectedTemplateId;
    // [Changed] Strategy Selection
    let engine;
    let typeKey;

    if (customConfig) {
      console.log("Using Custom Config (Draft):", customConfig);
      typeKey = customConfig.typeKey;

      // [NEW] Select Strategy based on typeKey
      if (typeKey === "together.custom") {
        engine = createTogetherStrategy(customConfig.strategy.options);
      } else if (typeKey === TYPE_KEYS.CONCEPT) {
        console.log("Concept Strategy Selected for Draft"); // Debug
        engine = createConceptStrategy(customConfig);
      } else if (typeKey === TYPE_KEYS.TOGETHER_SELF) {
        console.log("Together+Self Strategy Selected");
        engine = createTogetherSelfStrategy(customConfig);
      } else {
        // Default to input_v1 (input.custom)
        engine = createInputStrategy(customConfig);
      }
    } else {
      typeKey = templateMeta.typeKey;
      engine = ENGINE_BY_TYPEKEY[typeKey];
    }

    if (!typeKey) throw new Error("템플릿에 typeKey가 없습니다.");
    if (!engine) throw new Error(`엔진이 없습니다: ${typeKey}`);

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

    // * Base Templates 확보: view01.html, act01.js 등
    // 템플릿에 view02 등 없는 경우를 대비해 01번 파일을 기준으로 복제 준비
    let view01Path = null;
    let act01Path = null;

    // zip 내 파일 경로 탐색 (최상위가 아닐 수 있음)
    Object.keys(loadedZip.files).forEach(path => {
      if (path.endsWith("view01.html")) view01Path = path;
      if (path.endsWith("act01.js")) act01Path = path;
    });

    if (!view01Path) throw new Error("view01.html이 템플릿에 없습니다.");

    const baseHtmlContent = await loadedZip.file(view01Path)?.async("string");
    const baseJsContent = act01Path ? await loadedZip.file(act01Path)?.async("string") : "";

    // 파일 삭제 목록
    const filesToRemove = [];

    // 기존 템플릿에 있는 viewXX.html, actXX.js 중 totalPage를 초과하는 것들은 삭제 대상
    loadedZip.forEach((path) => {
      const fName = path.split('/').pop();
      if (fName.startsWith("view") && fName.endsWith(".html")) {
        const m = fName.match(/view(\d+)\.html/);
        if (m) {
          const idx = parseInt(m[1]);
          if (idx > totalPage) filesToRemove.push(path);
        }
      }
      if (fName.startsWith("act") && fName.endsWith(".js") && fName.includes("0")) { // act01.js check
        const m = fName.match(/act(\d+)\.js/);
        if (m) {
          const idx = parseInt(m[1]);
          if (idx > totalPage) filesToRemove.push(path);
        }
      }
    });

    // 경로 접두어 (예: "Template/")
    const pathPrefix = view01Path.substring(0, view01Path.lastIndexOf("view01.html"));

    const promises = [];

    // 4) 각 페이지별 파일 생성/수정
    for (let i = 0; i < totalPage; i++) {
      const pageNum = i + 1; // 1, 2, 3, 4
      const pNumStr = String(pageNum).padStart(2, '0'); // "01", "02"
      const pageData = validPages[i].data;
      const normalizedData = engine.normalize(pageData);

      // 엔진 주입 전, 뼈대 수정 (Skeleton Modification)
      let skeletonConfig = {};
      if (engine.getSkeletonConfig) {
        skeletonConfig = engine.getSkeletonConfig() || {};
      }

      // --- HTML ---
      const htmlFilename = `view${pNumStr}.html`;
      // Try to find existing file
      const foundHtmlPath = Object.keys(loadedZip.files).find(k => k.endsWith(htmlFilename));

      // If found, use it. If not, construct path using prefix.
      const targetHtmlPath = foundHtmlPath || (pathPrefix + htmlFilename);

      // [ENHANCED] Determine which source HTML to use
      let sourceHtmlContent = null;
      if (skeletonConfig.sourceHtml) {
        const customSourcePath = Object.keys(loadedZip.files).find(k => k.endsWith(skeletonConfig.sourceHtml));
        if (customSourcePath) {
          sourceHtmlContent = await loadedZip.file(customSourcePath)?.async("string");
        }
      }

      // 기존 파일이 있으면 쓰고, 없으면 소스 또는 view01에서 복제
      let htmlContent = foundHtmlPath ? await loadedZip.file(foundHtmlPath)?.async("string") : null;
      if (!htmlContent) htmlContent = sourceHtmlContent || baseHtmlContent;

      // update HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, "text/html");

      // 1장일 때 페이지네이션 삭제
      if (totalPage === 1) {
        const pagers = doc.querySelectorAll('.pager, .pagination, .page-nav'); // 통상적인 클래스명
        pagers.forEach(el => el.remove());

        // footer > .btn-page-prev, .btn-page-next 등
        doc.querySelectorAll('.btn-page-prev, .btn-page-next').forEach(el => el.remove());
      }

      // --- Content Image Handling (Crop & Save) ---
      if (skeletonConfig.contentImageUrl) {
        try {
          // Initialize Image
          const img = new Image();
          img.crossOrigin = "Anonymous";

          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = skeletonConfig.contentImageUrl;
          });

          let blob;
          let hasImage = false; // [FIX] Declare variable
          const hasBounds = skeletonConfig.figureBounds &&
            Array.isArray(skeletonConfig.figureBounds) &&
            skeletonConfig.figureBounds.length === 4;

          // 크롭 로직 부분 (zipProcessor 또는 해당 로직 위치)
          if (hasBounds) {
            const [ymin, xmin, ymax, xmax] = skeletonConfig.figureBounds;

            // 유효한 좌표인지 체크 (전체화면 [0,0,100,100] 이나 [0,0,0,0] 인 경우 제외)
            // [FIX] Coordinate scale is 1000. Check full image accurately.
            // Assuming full image if top-left is near 0 and bottom-right is near 1000.
            const isFullImage = (ymin <= 10) && (xmin <= 10) && (ymax >= 990) && (xmax >= 990);
            const isEmpty = ymin === 0 && xmin === 0 && ymax === 0 && xmax === 0;

            if (!isEmpty && !isFullImage) {
              const w = img.naturalWidth;
              const h = img.naturalHeight;

              // 1000 기준 좌표를 픽셀로 변환
              const y1 = Math.floor((ymin / 1000) * h);
              const x1 = Math.floor((xmin / 1000) * w);
              const y2 = Math.ceil((ymax / 1000) * h);
              const x2 = Math.ceil((xmax / 1000) * w);

              const cropW = Math.max(1, x2 - x1);
              const cropH = Math.max(1, y2 - y1);

              const canvas = document.createElement('canvas');
              canvas.width = cropW;
              canvas.height = cropH;
              const ctx = canvas.getContext('2d');

              ctx.drawImage(img, x1, y1, cropW, cropH, 0, 0, cropW, cropH);
              blob = await new Promise(r => canvas.toBlob(r, 'image/png'));

              hasImage = true; // 실제 크롭 성공 시에만 이미지 활성화
            }
          }

          // [FIX] If no bounds or full image, fetch the original image blob
          if (!hasImage && skeletonConfig.contentImageUrl) {
            try {
              const response = await fetch(skeletonConfig.contentImageUrl);
              blob = await response.blob();
              hasImage = true;
            } catch (e) {
              console.error("Failed to fetch original image for zip:", e);
              // hasImage stays false
            }
          }

          // [Path Logic]
          // User Requirement: Use existing 'images' folder relative to HTML. src="./images/filename"
          // pathPrefix is directory of HTML.
          // We construct: pathPrefix + "images/content_XX.png"
          if (hasImage && blob) {
            //const imgFilename = `content_${pNumStr}.png`; // Assuming PNG for canvas or blob
            let ext = 'png';
            if (blob.type) {
              ext = blob.type.split('/')[1] || 'png';
            }
            console.log("figureBounds:", skeletonConfig.figureBounds);
            console.log("hasBounds:", hasBounds);
            const finalFilename = `content_${pNumStr}.${ext}`;
            const imagesDir = pathPrefix + "images/";
            const fullPath = `${imagesDir}${finalFilename}`;

            loadedZip.file(fullPath, blob);

            // Update Skeleton Config
            skeletonConfig.contentImageUrl = `./images/${finalFilename}`;
            console.log("Updated config to:", skeletonConfig.contentImageUrl);

            // [Alt Text]
            const altText = skeletonConfig.figureAlt || normalizedData.questions?.[0]?.promptLatex || normalizedData.mainQuestion || "문제 이미지";
            skeletonConfig.altText = altText;
          }
        } catch (err) {
          console.error("Failed to process content image:", err);
        }
      }

      // --- DOM Modification ---
      // Header
      if (skeletonConfig.headerUrl) {
        const headerImg = doc.querySelector(".tit img") || doc.querySelector("header img");
        if (headerImg) {
          headerImg.src = skeletonConfig.headerUrl;
          headerImg.style.display = "inline-block";
        }
      }

      // Content Image Injection
      if (skeletonConfig.contentImageUrl) {
        const img = doc.createElement("img");
        img.src = skeletonConfig.contentImageUrl;
        if (skeletonConfig.altText) img.alt = skeletonConfig.altText;
        img.className = "w-full max-w-3xl mt-4 rounded-xl border border-slate-200 block mx-auto shadow-sm mb-4";

        // [NEW] Generic Injection via imageTargetSelector
        if (skeletonConfig.imageTargetSelector) {
          const target = doc.querySelector(skeletonConfig.imageTargetSelector);
          if (target && target.parentNode) {
            const pos = skeletonConfig.imagePosition || "prepend";
            if (pos === "prepend") {
              target.parentNode.insertBefore(img, target);
            } else if (pos === "append") {
              target.appendChild(img);
            } else {
              target.parentNode.insertBefore(img, target);
            }
          }
        }
        // Legacy Injection (for input_v1)
        else {
          const rowTemplate = doc.querySelector(skeletonConfig.rowTemplate || ".flex-row.ai-s.jc-sb");
          if (rowTemplate) {
            const passage = rowTemplate.querySelector(".a2 p") || rowTemplate.querySelector(".passage");
            if (passage && passage.parentNode) {
              passage.parentNode.insertBefore(img, passage.nextSibling);
            }
          }
        }
      }

      // Input Style
      if (skeletonConfig.inputKind === "text") {
        const rowTemplate = doc.querySelector(".flex-row.ai-s.jc-sb");
        if (rowTemplate) {
          const inp = rowTemplate.querySelector(".inp-wrap > div");
          if (inp) {
            inp.classList.remove("box-type", "input-box", "w200");
            inp.style.border = "none";
            inp.style.borderBottom = "2px solid #cbd5e1";
            inp.style.backgroundColor = "transparent";
            inp.style.borderRadius = "0";
            inp.style.width = "100%";
            inp.style.maxWidth = "200px";
            inp.style.padding = "4px 8px";
          }
        }
      }

      // 엔진 주입
      engine.injectHtmlPage({
        doc,
        manifest: templateMeta.manifest || {}, // TODO: manifest도 페이지별로 달라야 하나? 일단 공통 사용
        data: normalizedData,
        pageIndex: i,
      });

      // Save HTML
      const serializer = new XMLSerializer();
      promises.push(Promise.resolve().then(() => loadedZip.file(targetHtmlPath, serializer.serializeToString(doc))));

      // --- JS ---
      // JS는 act01.js, act02.js ... 매핑
      // (주의: together.select는 JS 패치가 거의 없지만 question.mathinput은 있음)
      let jsPath = `act${pNumStr}.js`;
      // 경로 찾기 (폴더 구조가 있을 수 있음) - 여기서는 단순화.
      const foundJsPath = Object.keys(loadedZip.files).find(k => k.endsWith(jsPath));

      let jsContent = foundJsPath ? await loadedZip.file(foundJsPath)?.async("string") : null;
      if (!jsContent && baseJsContent) jsContent = baseJsContent; // 복제

      if (jsContent) {
        const patchedJs = engine.patchActJs
          ? engine.patchActJs({
            actJsText: jsContent,
            data: normalizedData,
            pageIndex: i
          })
          : jsContent;

        // 저장 위치: foundJsPath가 있으면 거기, 없으면 act02.js 등으로 루트(혹은 view랑 같은 폴더) 생성
        // 템플릿 구조를 따라가기 위해 act01.js가 있던 폴더를 찾음
        let targetJsPath = foundJsPath || jsPath;
        if (!foundJsPath && baseJsContent) {
          // act01.js의 위치를 찾아 그 폴더에 act02.js 생성
          const baseJsFile = Object.keys(loadedZip.files).find(k => k.endsWith("act01.js"));
          if (baseJsFile) {
            targetJsPath = baseJsFile.replace("act01.js", jsPath);
          }
        }
        promises.push(Promise.resolve().then(() => loadedZip.file(targetJsPath, patchedJs)));
      }
    }

    // 5) view_pageinfo.js 수정 (총 페이지 수)
    const pageInfoFiles = Object.keys(loadedZip.files).filter(k => k.endsWith("view_pageinfo.js"));
    pageInfoFiles.forEach(path => {
      promises.push(
        loadedZip.file(path).async("string").then(content => {
          // var totalPage = 4;
          const updated = content.replace(/var\s+totalPage\s*=\s*\d+;/, `var totalPage = ${totalPage};`);
          loadedZip.file(path, updated);
        })
      );
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
