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

export function injectTogetherBase({ doc, data, manifest }) {
  // ✅ 헤더 이미지(함께 풀기 공통)
  injectHeaderImage({ doc, manifest, data });

  // ✅ 공통 guide text
  if (manifest?.guideText && data?.guideText) {
    const el = doc.querySelector(manifest.guideText);
    if (el) el.innerHTML = data.guideText;
  }

  // ✅ 공통 발문(H1)
  const $h1 = doc.querySelector('main h1') || doc.querySelector('h1');
  if ($h1) {
    let displayTitle = data.mainQuestion || data.title || "";
    if (displayTitle) $h1.innerHTML = sanitizeLaTeX(displayTitle);
  }
}
