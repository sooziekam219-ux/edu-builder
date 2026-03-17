import { sanitizeLaTeX } from "../../../utils/sanitize";

function injectHeaderImage({ doc, manifest, data }) {
  const selector = manifest?.headerImg || "header h1 img.lang-image";
  const img = doc.querySelector(selector);
  if (!img) return;

  // [추가] 타이틀 분석을 통한 동적 헤더/제목 매칭 (함께 풀기 전용)
  const fullText = (data?.title || "");
  const match = fullText.match(/함께\s*풀기\s*(\d+)/);
  let hasDynamicMatch = false;

  if (match) {
    const num = match[1];
    const titText = `함께 풀기 ${num}`;
    hasDynamicMatch = true;

    // 동적 매칭 성공 시 우선 설정
    img.setAttribute("src", `images/tit-together${num}.png`);
    img.setAttribute("alt", titText);

    // 2. 문서 <title> 태그 변경
    const titleEl = doc.querySelector('title');
    if (titleEl) titleEl.textContent = titText;
    else {
      const newTitle = doc.createElement('title');
      newTitle.textContent = titText;
      doc.head.appendChild(newTitle);
    }
  }

  // 우선순위 적용: data.header.src (개별 설정) > 동적 매칭 이미지 > manifest.headerSrc (템플릿 기본값)
  const explicitSrc = data?.header?.src;
  if (explicitSrc) {
    img.setAttribute("src", explicitSrc);
  } else if (!hasDynamicMatch) {
    const templateSrc = manifest?.headerSrc;
    if (templateSrc) img.setAttribute("src", templateSrc);
  }

  const explicitAlt = data?.header?.alt;
  if (explicitAlt) {
    img.setAttribute("alt", explicitAlt);
  } else if (!hasDynamicMatch) {
    const templateAlt = manifest?.headerAlt;
    if (templateAlt) img.setAttribute("alt", templateAlt);
  }
}
export function injectTogetherBase({ doc, data, manifest, skeletonConfig }) {

  // ✅ 헤더 이미지(함께 풀기 공통)
  injectHeaderImage({ doc, manifest, data });

  // ✅ 공통 발문(H1) — header의 h1은 절대 건드리지 않음
  const displayTitle = data.mainQuestion || data.title || "";
  if (displayTitle) {
    let $h1 = doc.querySelector('main h1');
    if (!$h1) {
      // main 안에 h1이 없으면 .q 내부에 새로 생성
      const qBox = doc.querySelector('.q') || doc.querySelector('main');
      if (qBox) {
        $h1 = doc.createElement('h1');
        qBox.insertBefore($h1, qBox.firstChild);
      }
    }
    if ($h1) $h1.innerHTML = sanitizeLaTeX(displayTitle);
  }

  // ✅ 3. 공통 guide text (.stxt가 없으면 강제 생성)
  if (data?.guideText) {
    const guideSelector = manifest?.guideText || ".stxt";
    const stxtEl = doc.querySelector(guideSelector);

    if (stxtEl) {
      stxtEl.innerHTML = sanitizeLaTeX(data.guideText);
    } else {
      const qBoxP = doc.querySelector(".q p") || doc.querySelector(".q");
      if (qBoxP) {
        const br = doc.createElement("br");
        const span = doc.createElement("span");
        span.className = "stxt";
        span.innerHTML = sanitizeLaTeX(data.guideText);

        qBoxP.appendChild(br);
        qBoxP.appendChild(span);
      }
    }
  }

  // ----------------------------------------------------------------
  // 🌟 [NEW] 삽화가 있으면 div[translate='no']를 flex 2컬럼으로 감싸기
  //   텍스트(75%) : 삽화(25%)  |  삽화 없으면 원래 구조 유지
  // ----------------------------------------------------------------
  const imageUrl = skeletonConfig?.contentImageUrl;
  // [FIX] 로컬 이미지 경로일 때만 삽화가 있는 것으로 간주 (원격 URL은 무시)
  if (imageUrl && imageUrl.startsWith("./images/")) {
    // 1. zipProcessor가 넣은 잔여 이미지 제거
    const junkImg = doc.querySelector("img.illustration-img");
    if (junkImg) junkImg.remove();

    // 2. 콘텐츠 컨테이너 찾기
    const contentBox = doc.querySelector("div[translate='no']") || doc.querySelector("main");
    if (contentBox && !doc.querySelector(".illust-flex-wrapper")) {
      // 3. flex wrapper 생성
      const flexWrapper = doc.createElement("div");
      flexWrapper.className = "illust-flex-wrapper";
      flexWrapper.style.cssText = "display:flex; gap:20px; align-items:flex-start;";

      // 4. 기존 contentBox를 flex 왼쪽 칼럼으로 이동
      contentBox.parentNode.insertBefore(flexWrapper, contentBox);
      contentBox.style.flex = "3"; // 75%
      flexWrapper.appendChild(contentBox);

      // 5. 이미지를 flex 오른쪽 칼럼으로 생성
      const imgCol = doc.createElement("div");
      imgCol.style.cssText = "flex:1; flex-shrink:0; display:flex; align-items:flex-start; justify-content:center;";

      const imgEl = doc.createElement("img");
      imgEl.src = imageUrl;
      imgEl.alt = skeletonConfig?.altText || "삽화";
      imgEl.style.cssText = "width:100%; height:auto; border-radius:8px;";
      imgCol.appendChild(imgEl);

      flexWrapper.appendChild(imgCol);
    }
  }
}