/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, query, deleteDoc, addDoc, getDocs } from 'firebase/firestore';
import {
    Upload, FileArchive, ImageIcon, Settings, Download, CheckCircle2,
    AlertCircle, Loader2, User, FileCode, ShieldCheck, Layers,
    Trash2, Maximize2, Plus, Server, Check, HardDrive, Layout, RefreshCw,
    Type, Info, ListPlus, X, AlertTriangle, Calculator, FileText,
    BookOpen, GripVertical, ChevronRight, MonitorPlay, MessageSquare,
    Film, Eye, Code, Square, PenTool
} from 'lucide-react';
import { processAndDownloadZip } from "./engine/zip/zipProcessor";

// --- Constants & Assets ---
const JSZIP_CDN = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
const PPTX_CDN = "https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";

const ASSETS = {
    TITLES: {
        '발견하기': 'https://i.imgur.com/t5oUrkW.png',
        '개념': 'https://i.imgur.com/cjOaHRg.png',
        '문제': 'https://i.imgur.com/gH2J7p7.png',
        '함께 풀기': 'https://i.imgur.com/qnlGWhM.png',
        '스스로 풀기': 'https://i.imgur.com/LVk2NIU.png',
        '생각 KEY우기': 'https://i.imgur.com/99AXcjD.png',
        '핵심 쏙': 'https://placehold.co/300x80/f59e0b/ffffff?text=%ED%95%B5%EC%8B%AC+%EC%8F%99',
    },
    BUTTONS: {
        'CHECK': 'https://i.imgur.com/B8Wofel.png',
        'SAVE': 'https://i.imgur.com/3xzxskE.png',
        'RETRY': 'https://i.imgur.com/Cg89H9w.png',
        'SOLVE': 'https://placehold.co/200x60/0ea5e9/ffffff?text=풀이'
    }
};

// --- Firebase Config ---
const firebaseConfig = JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'edu-builder-integrated-v5';
const CHUNK_SIZE = 500 * 1024;

// --- Prompts ---
const KIM_HWA_KYUNG_PROMPT = `
  **Role:** Expert digital textbook converter for 'Kim Hwa-kyung'.
  Analyze input textbook image(s) and split content into logical sections for a Storyboard.
  
  **Splitting Rules:**
  - Detect visual separators like "개념 쏙", "문제 1", "함께 풀기".
  - **Type:** '개념', '문제', '발견하기', '함께 풀기', '핵심 쏙'.
  - **Body Text:** Use LaTeX \\( ... \\). Use \\n to separate distinct questions or sentences.
  - **Together Type:** For '함께 풀기', target the 'white area' (step-by-step explanation). Extract ONLY sentences containing a blank/input box. Represent these blanks specifically as '□'. Ignore other descriptive texts. **EXCLUDE** numbered sub-questions (like (1), (2) on skyblue backgrounds)
  - **Answers:** Extract or solve for correct answers.
  
  Output JSON format:
  {
    "sections": [
      {
        "type": "문제",
        "subtype": "수식 입력형",
        "content": { "title": "문제 1", "instruction": "다음 값을 구하시오.", "body": "(1) \\(\\sqrt{16}\\) \n(2) \\(0.04\\)" },
        "answers": ["4, -4", "0.02"]
      }
    ]
  }
`;

const BUILDER_SYSTEM_PROMPT = (isTogether) => isTogether ?
    `당신은 수학 교육 콘텐츠 전문 개발자입니다. 
  **중요 규칙:**
  1. 모든 수식에 '$' 기호를 절대 사용하지 마세요.
  2. 모든 수식은 반드시 '\\\\( ... \\\\)' (백슬래시 2개 포함) 형태로만 감싸세요.
  3. 빈칸의 정답을 직접 계산하여 'correctIndex'를 도출하세요.
  4. 'options'는 이미지에 설명된 정답을 포함하여 총 3개의 보기로 만드세요.
  5. 'correctIndex'는 'options' 배열에서 실제 정답이 있는 순서(1, 2, 3 중 하나)를 숫자로 적으세요.
  JSON 구조: { "mainQuestion": "...", "guideText": "▷ 빈칸을 눌러 정답을 선택하세요.", "lines": [{ "label": "(1)", "parts": [{ "type": "text", "content": "..." }, { "type": "blank", "options": ["A","B","C"], "correctIndex": 1, "width": 120 }] }] }`
    :
    `수학 콘텐츠 개발자로서 문제를 분석하세요. LaTeX는 \\\\( 수식 \\\\) 형태 유지.
  JSON: { "mainQuestion": "...", "guideText": "▷ 빈칸을 눌러 답을 입력하세요.", "subQuestions": [{ "label": "(1)", "passage": "...", "answer": "...", "explanation": "...", "inputWidth": "w200" }] }`;

// --- Helpers ---
// edubuilder_260206.jsx 상단의 sanitizeLaTeX 함수 수정
const sanitizeLaTeX = (str) => {
    if (!str) return "";
    let sanitized = str;

    // 1. $ ... $ 형태를 \( ... \) 형태로 치환
    sanitized = sanitized.replace(/\$(.*?)\$/g, '\\($1\\)');

    // 2. 기존 로직: 백슬래시나 수식 기호가 있는데 \( 가 없는 경우 보정
    if ((sanitized.includes('\\') || sanitized.includes('^') || sanitized.includes('_')) && !sanitized.includes('\\(')) {
        sanitized = `\\(${sanitized}\\)`;
    }

    // 3. 중복된 \( \( 제거 (방어적 코드)
    sanitized = sanitized.replace(/\\\((\\\(.*?\\\))\\\)/g, '$1');

    return sanitized;
};

const generateLogicText = (type, subtype, answers) => {
    const hasAnswer = answers && answers.length > 0;
    if (type === '개념') return `[개념 학습]\n1. 단순 열람 모드.\n2. 페이지 넘김 기능 활성화.`;
    if (type.includes('발견') || type.includes('생각')) return `[활동형]\n1. [저장] 버튼 클릭 시 입력값 저장.\n2. 정오 판별 없음.\n3. 빈칸 시 "내용을 입력하세요" 알럿.`;

    return `[정답 설정]\n- 정답: ${answers.join(', ')}\n\n[기능 로직]\n1. [확인] 클릭 시 정오답 판별.\n2. 정답 시: 파란색(#0000FF) 변경 + 정답 알럿.\n3. 오답 시: 재도전 알럿 + 오답 붉은색 노출.\n4. 버튼 토글: 확인 -> 풀이/다시하기.`;
};

const App = () => {
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;   
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('analysis');
    const [isProcessing, setIsProcessing] = useState(false);
    const TYPE_DEFS = [
  { typeKey: "question.mathinput", label: "문제 > 수식입력형" },
  { typeKey: "together.select", label: "함께 풀기 > 선택형" },
  // 이후 계속 추가
];
    const [analysisImages, setAnalysisImages] = useState([]);
    const [pages, setPages] = useState([]);
    const [metadata, setMetadata] = useState({
        schoolLevel: '중학교', grade: '3학년', subject: '수학', author: '김화경', unit: '1. 제곱근과 실수', session: '1차시', activityName: ''
    });

    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [selectedTypeKey, setSelectedTypeKey] = useState(TYPE_DEFS[0].typeKey);
    const [builderInputImage, setBuilderInputImage] = useState(null);
    const [extractedBuildData, setExtractedBuildData] = useState(null);
    const [removePagination, setRemovePagination] = useState(true); // Added for Zip logic
    const filteredTemplates = templates.filter(t => t.typeKey === selectedTypeKey);

    const onClickZip = () =>
  processAndDownloadZip({
    templates,
    selectedTemplateId,
    extractedBuildData,
    setStatusMessage,
    setIsProcessing,
    removePagination,
    db,
    appId,
  });

    const builderImageInputRef = useRef(null);
    const templateZipInputRef = useRef(null);

    const dragItem = useRef(null);

    const [statusMessage, setStatusMessage] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    const StatusModal = ({ status, onClose }) => {
        if (!status) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center gap-6">
                    <div className={`p-4 rounded-full ${status.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {status.type === 'error' ? <AlertTriangle size={32} /> : <CheckCircle2 size={32} />}
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-black text-slate-900 mb-2">{status.title}</h3>
                        <p className="text-slate-500 font-medium whitespace-pre-wrap">{status.message}</p>
                    </div>
                    <button onClick={onClose} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all">확인</button>
                </div>
            </div>
        );
    };

    useEffect(() => {
    [JSZIP_CDN, PPTX_CDN].forEach(src => {
        if (!document.querySelector(`script[src="${src}"]`)) {
            const script = document.createElement('script'); script.src = src; script.async = true; document.head.appendChild(script);
        }
    });

    const initAuth = async () => {
        // 복잡한 조건문 대신, 단순히 익명 로그인을 시도하도록 수정합니다.
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("인증 에러:", error);
        }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
}, []);

    useEffect(() => {
        if (!user) return;
        const q = collection(db, 'artifacts', appId, 'public', 'data', 'templates');
        return onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTemplates(list);
            if (list.length > 0 && !selectedTemplateId) setSelectedTemplateId(list[0].id);
        });
    }, [user]);

    const renderMathToHTML = (text) => {
        if (!text) return null;
        const parts = text.split(/(\\\(.*?\\\)|□)/g);
        return parts.map((part, i) => {
            if (part.startsWith('\\(')) {
                const latex = part.replace(/^\\\(|\\\)$/g, '');
                const url = `https://latex.codecogs.com/png.latex?\\dpi{150}\\bg_white ${encodeURIComponent(latex)}`;
                return <img key={i} src={url} alt="math" className="inline-block align-middle mx-1 h-5" />;
            } else if (part === '□') {
                return <span key={i} className="inline-block w-8 h-8 bg-[#00bcf1] align-middle mx-1 rounded-sm border border-[#00bcf1]"></span>;
            }
            return <span key={i} className="whitespace-pre-wrap">{part}</span>;
        });
    };

    const runAnalysis = async () => {
    if (analysisImages.length === 0) return;
    setIsProcessing(true);

    // [중요] API 키를 가져옵니다. 
    // Vercel 환경변수 이름이 REACT_APP_GEMINI_API_KEY 인지 꼭 확인하세요!
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;

    if (!apiKey) {
        alert("API 키를 찾을 수 없습니다. Vercel 환경 변수 설정을 확인해주세요.");
        setIsProcessing(false);
        return;
    }

    try {
        const imageParts = await Promise.all(analysisImages.map(async (img) => {
            const base64 = await new Promise(r => {
                const reader = new FileReader();
                reader.onload = () => r(reader.result.split(',')[1]);
                reader.readAsDataURL(img.file);
            });
            return { inlineData: { mimeType: "image/png", data: base64 } };
        }));

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: "POST", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: KIM_HWA_KYUNG_PROMPT }, ...imageParts] }], 
                generationConfig: { responseMimeType: "application/json" } 
            })
        });

        // 만약 여기서 404 에러가 난다면 res.ok가 false가 됩니다.
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error?.message || "API 요청 실패 (404/403)");
        }

        const data = await res.json();
        
        // 데이터 구조 안전하게 읽기 (candidates[0]이 없을 경우 대비)
        if (!data.candidates || !data.candidates[0]) {
            throw new Error("AI가 응답을 생성하지 못했습니다. (Safety Filter 등)");
        }

        const parsed = JSON.parse(data.candidates[0].content.parts[0].text);

        // ... 이후 로직은 기존과 동일 ...
        const newPages = [];
        parsed.sections.forEach((sec, sIdx) => {
            const title = sec.content.title || "";
            const type = title.includes('문제') ? '문제' : title.includes('함께') ? '함께 풀기' : title.includes('발견') ? '발견하기' : '개념';
            let subQs = (sec.content.body || "").split('\n').filter(l => l.trim()).map((l, i) => ({ id: i, text: l }));

            if (type === '함께 풀기') {
                subQs = subQs.filter(q => q.text.includes('□'));
            }

            if (type === '문제' && subQs.length >= 3) {
                for (let i = 0; i < subQs.length; i += 2) {
                    const chunk = subQs.slice(i, i + 2);
                    newPages.push({
                        id: Date.now() + sIdx + i,
                        type,
                        title: i === 0 ? title : `${title} (계속)`,
                        content: sec.content.instruction || "",
                        body: chunk.map(q => q.text).join('\n'),
                        answers: sec.answers ? sec.answers.slice(i, i + 2) : [],
                        description: [{ text: generateLogicText(type, sec.subtype, sec.answers ? sec.answers.slice(i, i + 2) : []) }],
                        subQuestions: chunk
                    });
                }
            } else {
                newPages.push({
                    id: Date.now() + sIdx,
                    type,
                    title,
                    content: sec.content.instruction || "",
                    body: sec.content.body || "",
                    answers: sec.answers || [],
                    description: [{ text: generateLogicText(type, sec.subtype, sec.answers || []) }],
                    subQuestions: subQs
                });
            }
        });

        setPages(newPages);
        setActiveTab('storyboard');
        if (newPages[0]) setMetadata(prev => ({ ...prev, activityName: newPages[0].title }));

    } catch (err) { 
        console.error(err);
        alert("분석 실패: " + err.message); 
    } finally { 
        setIsProcessing(false); 
    }
};

    // --- Math Rendering Helper (Improved) ---
    const renderMathText = (slide, textBlock, startX, startY, width, lineHeight = 0.4) => {
        if (!textBlock) return startY;

        const lines = textBlock.split('\n');
        let currentY = startY;
        const fontSize = 10;

        lines.forEach(line => {
            const parts = line.split(/(\\\(.*?\\\)|\\\[.*?\\\]|□)/g);
            let currentX = startX;

            parts.forEach(part => {
                if ((part.startsWith('\\(') && part.endsWith('\\)')) || (part.startsWith('\\[') && part.endsWith('\\]'))) {
                    let latexCode = part.replace(/^\\(\(|\[)/, '').replace(/\\(\)|\])$/, '');
                    const imageUrl = `https://latex.codecogs.com/png.latex?\\dpi{200}\\bg_white ${encodeURIComponent(latexCode)}`;

                    const imgWidth = Math.min(width, Math.max(0.15, latexCode.length * 0.04));
                    const imgHeight = 0.15;

                    if (currentX + imgWidth > startX + width) {
                        currentX = startX;
                        currentY += lineHeight;
                    }

                    slide.addImage({
                        path: imageUrl,
                        x: currentX,
                        y: currentY - 0.05,
                        w: imgWidth,
                        h: imgHeight
                    });
                    currentX += imgWidth + 0.1;
                } else if (part === '□') {
                    // Render Blue Box
                    const boxSize = 0.3;
                    if (currentX + boxSize > startX + width) {
                        currentX = startX;
                        currentY += lineHeight;
                    }
                    slide.addShape(window.PptxGenJS.ShapeType.rect, {
                        x: currentX, y: currentY - 0.05, w: boxSize, h: boxSize,
                        fill: '00bcf1', line: { color: '00bcf1', width: 0 }
                    });
                    currentX += boxSize + 0.1;
                } else if (part.trim() !== '') {
                    const textWidth = part.length * 0.12;
                    if (currentX + textWidth > startX + width) {
                        slide.addText(part, { x: currentX, y: currentY - 0.12, w: width - (currentX - startX), h: lineHeight, fontSize: fontSize, color: '000000', valign: 'middle', fontFace: 'Malgun Gothic' });
                        currentX = startX;
                        currentY += lineHeight;
                    } else {
                        slide.addText(part, { x: currentX, y: currentY - 0.12, w: textWidth, h: lineHeight, fontSize: fontSize, color: '000000', valign: 'middle', fontFace: 'Malgun Gothic' });
                        currentX += textWidth;
                    }
                }
            });
            currentY += lineHeight;
        });
        return currentY;
    };

    const generatePPTX = () => {
        if (!window.PptxGenJS || pages.length === 0) {
            alert("PPT 생성 도구 로딩 중이거나 페이지가 없습니다.");
            return;
        }
        try {
            const pptx = new window.PptxGenJS();
            pptx.layout = 'LAYOUT_16x9';
            const fontOpts = { fontSize: 9, fontFace: 'Malgun Gothic' };
            const labelOpts = { ...fontOpts, fill: 'E5E5E5', bold: true };
            const borderStyle = { color: '000000', width: 0.5 };

            pages.forEach((page, index) => {
                const slide = pptx.addSlide();

                // 1. Header
                const headerRows = [
                    [{ text: "학교급", options: labelOpts }, { text: metadata.schoolLevel, options: fontOpts }, { text: "학년", options: labelOpts }, { text: metadata.grade, options: fontOpts }, { text: "과목", options: labelOpts }, { text: metadata.subject, options: fontOpts }, { text: "저자", options: labelOpts }, { text: metadata.author, options: fontOpts }, { text: "유형", options: labelOpts }, { text: "HTML5", options: fontOpts }],
                    [{ text: "단원명", options: labelOpts }, { text: metadata.unit, options: fontOpts }, { text: "차시명", options: labelOpts }, { text: metadata.session, options: fontOpts }, { text: "활동 구분", options: labelOpts }, { text: page.type, options: fontOpts }, { text: "ACTIVITY", options: labelOpts }, { text: metadata.activityName, options: fontOpts }, { text: "페이지", options: labelOpts }, { text: (index + 1).toString(), options: { ...fontOpts, align: 'center' } }]
                ];
                slide.addTable(headerRows, { x: 0, y: 0, w: 10.0, h: 0.45, border: { pt: 0.5, color: "999999" }, align: "center", valign: "middle", colW: [0.8, 1.2, 0.8, 1.2, 0.8, 1.2, 0.8, 1.2, 0.8, 1.2] });

                // 2. Layout
                const mainY = 0.6; const bottomY = 5.4;
                const leftW = 6.8; const rightW = 2.6; const contentX = 0.2; const rightX = 7.2;
                const narrH = 0.9; const refH = 1.3; const descH = bottomY - refH - 0.1 - mainY; const contentH = bottomY - narrH - 0.1 - mainY;

                // [LAYOUT ADJUSTMENT] Concept = Full Width
                const isConcept = page.type === '개념';
                const actualLeftW = isConcept ? 9.6 : leftW;

                // [Left] Main Content Box
                slide.addShape(pptx.ShapeType.rect, { x: contentX, y: mainY, w: actualLeftW, h: contentH, fill: 'FFFFFF', line: borderStyle });

                let currentY = mainY + 0.2;

                // [Image] Top Title Banner
                const titleImg = ASSETS.TITLES[page.type] || ASSETS.TITLES['개념'];
                slide.addImage({ path: titleImg, x: contentX + 0.2, y: currentY, w: 0.8, h: 0.4 });
                currentY += 0.5;

                // Content Text
                if (page.content) {
                    slide.addText(page.content, { x: contentX + 0.2, y: currentY, w: actualLeftW - 0.4, h: 0.4, fontSize: 11, bold: true, color: '333333', fontFace: 'Malgun Gothic' });
                    currentY += 0.5;
                }

                // *** Body Rendering ***
                const textLineHeight = isConcept ? 0.3 : 0.4;
                const hasSubQuestions = page.subQuestions && page.subQuestions.length > 0;

                if (hasSubQuestions) {
                    page.subQuestions.forEach((sq, qIdx) => {
                        const qStartX = contentX + 0.2;
                        const textAvailW = actualLeftW - 2.0;
                        const nextY = renderMathText(slide, sq.text, qStartX, currentY, textAvailW, 0.4);

                        if (page.type !== '개념' && !page.type.includes('발견') && page.type !== '함께 풀기') {
                            const inputW = 1.5; const inputH = 0.4;
                            const inputX = contentX + actualLeftW - inputW - 0.2;
                            slide.addShape(pptx.ShapeType.rect, { x: inputX, y: currentY, w: inputW, h: inputH, fill: 'FFFFFF', line: { color: '999999', width: 1 } });

                            // 2. 입력칸 정중앙에 아이콘 이미지 배치 (가로/세로 0.25 크기 기준)
                            const iconSize = 0.25;
                            const centerX = inputX + (inputW - iconSize) / 2;
                            const centerY = currentY + (inputH - iconSize) / 2;

                            slide.addImage({
                                path: 'https://i.imgur.com/5LhWfL3.png',
                                x: centerX,
                                y: centerY,
                                w: iconSize,
                                h: iconSize
                            });

                            const btnW = 0.4; const btnH = 0.25;
                            const btnX = inputX + inputW - btnW;
                            const btnY = currentY + inputH + 0.1;

                            const btnImg = ASSETS.BUTTONS['CHECK'];
                            slide.addImage({ path: btnImg, x: btnX, y: btnY, w: btnW, h: btnH });
                        }

                        const blockH = Math.max((nextY - currentY), (0.4 + 0.1 + 0.25));
                        currentY += blockH + 0.3;
                    });
                } else {
                    if (page.body) {
                        renderMathText(slide, page.body, contentX + 0.2, currentY, actualLeftW - 0.4, textLineHeight);
                    }

                    if (page.type !== '개념' && page.type !== '함께 풀기' && !hasSubQuestions) {
                        const hasAnswer = page.answers && page.answers.length > 0;
                        const btnImg = hasAnswer ? ASSETS.BUTTONS['CHECK'] : ASSETS.BUTTONS['SAVE'];
                        const retryImg = ASSETS.BUTTONS['RETRY'];

                        const btnW = 0.4; const btnH = 0.25;
                        const btnX = contentX + actualLeftW - btnW - 0.1;
                        const btnY = mainY + contentH - btnH - 0.1;

                        slide.addImage({ path: btnImg, x: btnX, y: btnY, w: btnW, h: btnH });
                        slide.addImage({ path: retryImg, x: btnX - btnW - 0.05, y: btnY, w: btnW, h: btnH });
                    }
                }

                // Render Right Panel ALWAYS (even for Concept)
                slide.addShape(pptx.ShapeType.rect, { x: rightX, y: mainY, w: rightW, h: descH, fill: 'FFFFFF', line: borderStyle });
                slide.addText("Description (Logic)", { x: rightX, y: mainY, w: rightW, h: 0.3, ...fontOpts, color: 'FFFFFF', align: 'center', fill: '666666', bold: true });

                const descText = page.description?.[0]?.text || "";
                slide.addText(descText, { x: rightX + 0.1, y: mainY + 0.4, w: rightW - 0.2, h: descH - 0.5, ...fontOpts, color: '333333', valign: 'top', fontFace: 'Consolas' });

                // [Right] Reference
                const refY = bottomY - refH;
                slide.addShape(pptx.ShapeType.rect, { x: rightX, y: refY, w: rightW, h: refH, fill: 'FFFFFF', line: borderStyle });
                slide.addText("참고", { x: rightX, y: refY, w: rightW, h: 0.3, ...fontOpts, color: 'FFFFFF', align: 'center', fill: '888888', bold: true });
                slide.addText("-", { x: rightX + 0.1, y: refY + 0.4, w: rightW - 0.2, h: refH - 0.5, ...fontOpts, color: '555555', valign: 'top' });

                // [Bottom] Narration
                const narrY = bottomY - narrH;
                slide.addShape(pptx.ShapeType.rect, { x: contentX, y: narrY, w: leftW, h: narrH, fill: 'FFFFFF', line: borderStyle });
                slide.addText("Latex 수식", { x: contentX, y: narrY, w: 1.5, h: 0.3, ...fontOpts, color: '333333', bold: true });

                const rawContent = page.body || "(No Content)";
                slide.addText(rawContent, {
                    x: contentX + 0.1, y: narrY + 0.3, w: leftW - 0.2, h: narrH - 0.4,
                    ...fontOpts, color: '555555', valign: 'top', fontFace: 'Consolas'
                });

                slide.addText(`${metadata.schoolLevel} ${metadata.grade} ${metadata.subject} | 저자: ${metadata.author}`, { x: 0.2, y: 5.45, w: 6.0, h: 0.2, fontSize: 7, color: '9CA3AF' });
            });

            pptx.writeFile({ fileName: `Storyboard_${metadata.unit}_${Date.now()}.pptx` });
        } catch (err) { console.error(err); alert(`PPT 생성 오류: ${err.message}`); }
    };

    const handleBuilderImage = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setBuilderInputImage(URL.createObjectURL(file));
        setIsProcessing(true);
        try {
            const base64 = await new Promise(r => {
                const reader = new FileReader();
                reader.onload = () => r(reader.result.split(',')[1]);
                reader.readAsDataURL(file);
            });
            const template = templates.find(t => t.id === selectedTemplateId);
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: "Extract JSON for build." }, { inlineData: { mimeType: "image/png", data: base64 } }] }],
                    systemInstruction: { parts: [{ text: BUILDER_SYSTEM_PROMPT(template?.type === 'together') }] },
                    generationConfig: { responseMimeType: "application/json" }
                })
            });
            const data = await res.json();
            setExtractedBuildData(JSON.parse(data.candidates[0].content.parts[0].text));
        } catch (e) { alert("분석 에러: " + e.message); }
        finally { setIsProcessing(false); }
    };

    

    const uploadTemplate = async (e) => {
        const file = e.target.files[0];
        if (!file || !file.name.endsWith('.zip')) {
            setStatusMessage({ title: "오류", message: "유효한 ZIP 파일을 선택해주세요.", type: 'error' });
            return;
        }
        if (file.size === 0) {
            setStatusMessage({ title: "오류", message: "파일 크기가 0바이트입니다. 올바른 파일을 선택해주세요.", type: 'error' });
            return;
        }

        setIsProcessing(true);
        setUploadProgress(0);
        try {
            const templateId = `temp_${Date.now()}`;
            const chunkCount = Math.ceil(file.size / CHUNK_SIZE);

            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'templates', templateId), {
                name: file.name.replace('.zip', ''),
                type: file.name.includes('함께') ? 'together' : 'question',
                createdAt: Date.now()
            });

            for (let i = 0; i < chunkCount; i++) {
                const chunkBlob = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const result = reader.result;
                        const base64Str = result.includes(',') ? result.split(',')[1] : result;
                        resolve(base64Str);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(chunkBlob);
                });

                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'templates', templateId, 'chunks', `chunk_${i}`), { data: base64, index: i });
                setUploadProgress(Math.round(((i + 1) / chunkCount) * 100));
            }
            setStatusMessage({ title: "성공", message: "템플릿 업로드가 완료되었습니다.", type: 'success' });
        } catch (e) {
            console.error(e);
            setStatusMessage({ title: "오류", message: "업로드 실패: " + e.message, type: 'error' });
        } finally {
            setIsProcessing(false);
            setUploadProgress(0);
            if (templateZipInputRef.current) templateZipInputRef.current.value = '';
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
            <StatusModal status={statusMessage} onClose={() => setStatusMessage(null)} />
            <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-8 z-20">
                <div className="flex items-center gap-3 px-2">
                    <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-xl shadow-indigo-100"><Layout size={26} /></div>
                    <h1 className="text-xl font-black tracking-tighter text-indigo-600 uppercase">EduPro V5</h1>
                </div>
                <nav className="flex flex-col gap-2 flex-1">
                    <button onClick={() => setActiveTab('analysis')} className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${activeTab === 'analysis' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><BookOpen size={20} /><span className="font-bold text-sm">교과서 분석</span></button>
                    <button onClick={() => setActiveTab('storyboard')} className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${activeTab === 'storyboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><Layers size={20} /><span className="font-bold text-sm">스토리보드</span></button>
                    <button onClick={() => setActiveTab('builder')} className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${activeTab === 'builder' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><Calculator size={20} /><span className="font-bold text-sm">콘텐츠 생성</span></button>
                    <button onClick={() => setActiveTab('library')} className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${activeTab === 'library' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><HardDrive size={20} /><span className="font-bold text-sm">템플릿 업로드</span></button>
                </nav>
            </aside>

            <main className="flex-1 overflow-y-auto relative custom-scrollbar p-10">
                {isProcessing && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-md z-[100] flex flex-col items-center justify-center">
                        <div className="p-10 bg-white rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 border border-slate-100 animate-in zoom-in duration-300">
                            <Loader2 className="animate-spin text-indigo-600" size={64} />
                            <p className="font-black text-slate-700 text-lg">
                                {uploadProgress > 0 ? `업로드 중... ${uploadProgress}%` : "AI 엔진 가동 중..."}
                            </p>
                            {uploadProgress > 0 && (
                                <div className="w-64 h-4 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="max-w-6xl mx-auto">
                    <header className="flex justify-between items-end mb-12">
                        <div>
                            <h2 className="text-4xl font-black text-slate-800 tracking-tight">
                                {activeTab === 'analysis' && "1. 교과서 분석"}
                                {activeTab === 'storyboard' && "2. 스토리보드 리뷰"}
                                {activeTab === 'builder' && "3. 제작 엔진"}
                                {activeTab === 'library' && "템플릿 라이브러리"}
                            </h2>
                            <p className="text-slate-400 font-bold mt-2">Kim Hwa-kyung Specialized Integrated Platform</p>                        </div>
                        <div className="flex gap-4">
                            {activeTab === 'analysis' && <button onClick={runAnalysis} className="px-10 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all">분석 실행</button>}
                            {activeTab === 'storyboard' && <button onClick={generatePPTX} className="flex items-center gap-2 px-10 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black shadow-xl shadow-indigo-100 hover:scale-105 transition-all"><Download size={20} />PPTX 다운로드</button>}
                        </div>
                    </header>

                    {activeTab === 'analysis' && (
                        <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-700">
                            <div onClick={() => builderImageInputRef.current.click()} className="group border-4 border-dashed border-slate-200 rounded-[4rem] p-24 flex flex-col items-center justify-center bg-white hover:bg-indigo-50 hover:border-indigo-400 transition-all cursor-pointer shadow-sm">
                                <input ref={builderImageInputRef} type="file" multiple accept="image/*" onChange={(e) => setAnalysisImages(Array.from(e.target.files).map(f => ({ id: Math.random(), file: f, preview: URL.createObjectURL(f) })))} className="hidden" />
                                <div className="p-10 bg-indigo-50 rounded-[2.5rem] text-indigo-600 mb-8 group-hover:scale-110 group-hover:bg-indigo-100 transition-all shadow-inner"><Upload size={72} /></div>
                                <h3 className="text-3xl font-black text-slate-800">교과서 원고 업로드</h3>
                                <p className="text-slate-400 font-bold mt-3">수학 김화경 교과서를 캡처한 png 파일을 최대 3장 업로드하면 한 번에 분석하여 스토리보드를 생성합니다.</p>
                            </div>
                            <div className="grid grid-cols-3 gap-8">
                                {analysisImages.map(img => (
                                    <div key={img.id} className="relative rounded-[3rem] overflow-hidden border-2 border-slate-100 shadow-xl group">
                                        <img src={img.preview} className="w-full h-64 object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button onClick={() => setAnalysisImages(prev => prev.filter(i => i.id !== img.id))} className="p-4 bg-red-500 text-white rounded-2xl hover:scale-110 transition-transform"><X size={24} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'storyboard' && (
                        <div className="space-y-12 animate-in fade-in duration-500 pb-20">
                            {pages.length > 0 ? pages.map((page, pIdx) => (
                                <div key={page.id} className="bg-white rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col group hover:shadow-2xl transition-all duration-500">
                                    <div className="bg-slate-50 px-10 py-5 border-b border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-5">
                                            <span className="w-12 h-12 bg-indigo-600 text-white rounded-[1.25rem] flex items-center justify-center font-black text-lg shadow-lg">P.{pIdx + 1}</span>
                                            <span className="font-black text-slate-800 text-xl tracking-tight uppercase">{page.type} — {page.title}</span>
                                        </div>
                                        <GripVertical className="text-slate-300 cursor-move" />
                                    </div>
                                    <div className="p-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
                                        <div className="lg:col-span-2 space-y-8">
                                            <label className="text-xs font-black uppercase text-slate-400 tracking-widest block ml-3">Manuscript & Interaction Preview</label>
                                            <div className="bg-indigo-50/20 p-12 rounded-[3.5rem] border border-indigo-50 min-h-[450px] relative shadow-inner">
                                                <img src={ASSETS.TITLES[page.type] || ASSETS.TITLES['개념']} className="h-9 mb-8 object-contain" />
                                                <div className="space-y-10">
                                                    <h4 className="text-2xl font-black text-slate-800 leading-snug">{page.content}</h4>
                                                    <div className="space-y-10 mt-12 pl-4">
                                                        {page.subQuestions.length > 0 ? page.subQuestions.map((sq, i) => (
                                                            <div key={i} className="flex items-center justify-between gap-10 p-6 bg-white/80 rounded-[2.5rem] border border-white shadow-sm hover:translate-x-2 transition-transform">
                                                                <div className="text-xl font-bold leading-relaxed flex-1">{renderMathToHTML(sq.text)}</div>
                                                                {page.type === '문제' && (
                                                                    <div className="flex flex-col items-end gap-3">
                                                                        <div className="w-40 h-12 bg-white border-2 border-slate-100 rounded-[1.25rem] shadow-inner"></div>
                                                                        <img src={ASSETS.BUTTONS['CHECK']} className="h-7 drop-shadow-sm" alt="check" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )) : (
                                                            <div className="text-lg leading-loose text-slate-600 whitespace-pre-wrap">{renderMathToHTML(page.body)}</div>
                                                        )}
                                                    </div>
                                                </div>
                                                {page.type !== '개념' && page.subQuestions.length === 0 && (
                                                    <div className="absolute bottom-10 right-10 flex gap-4">
                                                        <img src={ASSETS.BUTTONS['RETRY']} className="h-10 opacity-60" alt="retry" />
                                                        <img src={ASSETS.BUTTONS['CHECK']} className="h-10 shadow-xl" alt="check" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="lg:col-span-1 space-y-8">
                                            <label className="text-xs font-black uppercase text-slate-400 tracking-widest block ml-3">System Logic Description</label>
                                            <textarea
                                                className="w-full h-full min-h-[450px] bg-slate-900 text-emerald-400 p-10 rounded-[3.5rem] font-mono text-xs leading-relaxed border-none shadow-2xl focus:ring-0"
                                                value={page.description[0].text}
                                                onChange={(e) => {
                                                    const newPages = [...pages];
                                                    newPages[pIdx].description[0].text = e.target.value;
                                                    setPages(newPages);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-40 text-center flex flex-col items-center gap-6">
                                    <div className="bg-slate-100 p-10 rounded-full text-slate-300"><Layers size={80} /></div>
                                    <p className="font-bold text-slate-400 text-xl">데이터가 없습니다. 1단계에서 교과서를 분석하세요.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'builder' && (
                        <div className="grid grid-cols-3 gap-12 animate-in fade-in duration-500">
                            <div className="col-span-1 space-y-8">
                                <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm">
                                    
                                    <label className="text-xs font-black text-slate-400 uppercase mb-5 block ml-2 tracking-widest">
                                    1. Select Type
                                    </label>
                                    <select
                                    value={selectedTypeKey}
                                    onChange={(e) => {
                                        setSelectedTypeKey(e.target.value);
                                        setSelectedTemplateId(""); // 유형 바꾸면 템플릿 선택 초기화
                                    }}
                                    className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black outline-none focus:border-indigo-300 transition-all appearance-none"
                                    >
                                    {TYPE_DEFS.map((t) => (
                                        <option key={t.typeKey} value={t.typeKey}>
                                        {t.label}
                                        </option>
                                    ))}
                                    </select>

                                    <label className="text-xs font-black text-slate-400 uppercase mt-10 mb-5 block ml-2 tracking-widest">
                                    2. Select Template
                                    </label>

                                    {filteredTemplates.length === 0 ? (
                                    <div className="w-full p-5 bg-amber-50 border-2 border-amber-200 rounded-3xl font-black text-amber-700">
                                        이 유형에 연결된 템플릿이 없습니다. 템플릿 zip을 업로드해야 합니다.
                                    </div>
                                    ) : (
                                    <select
                                        value={selectedTemplateId || filteredTemplates[0].id}
                                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                                        className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black outline-none focus:border-indigo-300 transition-all appearance-none"
                                    >
                                        {filteredTemplates.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                        ))}
                                    </select>
                                    )}


                                    
                                    <label className="text-xs font-black text-slate-400 uppercase mt-10 mb-5 block ml-2 tracking-widest">2. Upload Builder Image</label>
                                    <div onClick={() => templateZipInputRef.current.click()} className="aspect-[4/5] bg-slate-50 border-4 border-dashed border-slate-100 rounded-[3rem] flex items-center justify-center overflow-hidden cursor-pointer group hover:bg-indigo-50 hover:border-indigo-200 transition-all relative">
                                        <input ref={templateZipInputRef} type="file" accept="image/*" onChange={handleBuilderImage} className="hidden" />
                                        {builderInputImage ? <img src={builderInputImage} className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-200 group-hover:scale-110 transition-transform" size={64} />}
                                    </div>
                                </div>
                            </div>
                            <div className="col-span-2">
                                <div className="bg-white p-12 rounded-[4.5rem] border border-slate-200 shadow-sm min-h-[600px] flex flex-col relative overflow-hidden">
                                    {extractedBuildData ? (
                                        <div className="w-full space-y-10 animate-in slide-in-from-right-10 duration-500">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-3xl font-black tracking-tight">Production Data Review</h3>
                                                <span className="bg-emerald-100 text-emerald-600 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase border border-emerald-200">Engine Ready</span>
                                            </div>
                                            <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-4">
                                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block ml-2">Extracted Main Question</label>
                                                <input className="w-full bg-white p-4 rounded-2xl border border-slate-200 font-black text-lg" value={extractedBuildData.mainQuestion} onChange={e => setExtractedBuildData({ ...extractedBuildData, mainQuestion: e.target.value })} />
                                            </div>
                                            <div className="space-y-6 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                                                {(extractedBuildData.subQuestions || extractedBuildData.lines || []).map((item, i) => (
                                                    <div key={i} className="p-8 bg-white border-2 border-slate-100 rounded-[2.5rem] flex items-center gap-6 shadow-sm">
                                                        <span className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm">{item.label || i + 1}</span>
                                                        <div className="flex-1 space-y-2">
                                                            <input className="w-full p-2 text-sm font-bold border-b border-slate-100 focus:border-indigo-400 outline-none" value={item.passage || item.parts?.[0]?.content} />
                                                            <div className="flex gap-4">
                                                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Answer: {item.answer || item.parts?.find(p => p.type === 'blank')?.correctText}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <button onClick={onClickZip} className="w-full py-10 bg-slate-900 text-white rounded-[3rem] font-black text-3xl shadow-2xl hover:bg-black hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-6">
                                                <Download size={32} /> ZIP PACKAGING & DOWNLOAD
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center opacity-20 space-y-6">
                                            <Calculator size={100} />
                                            <p className="font-black text-2xl tracking-tight">이미지를 업로드하여 빌드 데이터를 추출하세요.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'library' && (
                        <div className="grid grid-cols-2 gap-12 animate-in fade-in duration-500">
                            <div className="bg-white p-16 rounded-[4.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                                <h3 className="text-3xl font-black mb-10">Add Template</h3>
                                <div onClick={() => templateZipInputRef.current.click()} className="aspect-video bg-indigo-50 border-4 border-dashed border-indigo-100 rounded-[3.5rem] flex flex-col items-center justify-center text-indigo-600 cursor-pointer hover:bg-indigo-100 hover:border-indigo-300 transition-all shadow-inner">
                                    <input ref={templateZipInputRef} type="file" accept=".zip" onChange={uploadTemplate} className="hidden" />
                                    <Plus className="group-hover:rotate-90 transition-transform mb-4" size={80} />
                                    <p className="font-black uppercase tracking-widest text-xs">Drop ZIP Template Here</p>
                                </div>
                            </div>
                            <div className="bg-white p-16 rounded-[4.5rem] border border-slate-200 shadow-sm flex flex-col">
                                <h3 className="text-3xl font-black mb-10 flex justify-between items-center">Library Index <span className="bg-indigo-100 text-indigo-600 px-4 py-1 rounded-2xl text-sm shadow-sm">{templates.length}</span></h3>
                                <div className="space-y-5 overflow-y-auto max-h-[500px] pr-4 custom-scrollbar">
                                    {templates.sort((a, b) => b.createdAt - a.createdAt).map(t => (
                                        <div key={t.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:bg-white hover:shadow-2xl transition-all group">
                                            <div className="flex items-center gap-5">
                                                <div className={`p-4 rounded-2xl ${t.type === 'together' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}><FileCode size={24} /></div>
                                                <div>
                                                    <p className="font-black text-slate-800 text-lg leading-none mb-2">{t.name}</p>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.type} type</span>
                                                </div>
                                            </div>
                                            <button onClick={async () => await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'templates', t.id))} className="p-4 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={24} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 2px solid #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @keyframes zoom-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
        </div>
    );
};

export default App;