function injectHeaderImage({ doc, manifest, data }) {
  const selector = manifest?.headerImg || "header h1 img.lang-image";
  const img = doc.querySelector(selector);
  if (!img) return;

  const nextSrc = manifest?.headerSrc || data?.header?.src;
  if (nextSrc) img.setAttribute("src", nextSrc);

  const nextAlt = manifest?.headerAlt || data?.header?.alt;
  if (nextAlt) img.setAttribute("alt", nextAlt);
}

export function injectTogetherBase({ doc, data, manifest }) {
  // ✅ 헤더 이미지(함께 풀기 공통)
  injectHeaderImage({ doc, manifest, data });

  // ✅ 공통 guide text
  if (manifest?.guideText && data?.guideText) {
    const el = doc.querySelector(manifest.guideText);
    if (el) el.innerHTML = data.guideText;
  }
}
