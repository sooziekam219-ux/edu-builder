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
import { TYPE_KEYS } from "./engine/typeKeys";
console.log("App.js loaded");


/* 익명 로그인*/
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const auth = getAuth(app);
useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
        if (!u) await signInAnonymously(auth);
    });
    return () => unsub();
}, []);



// --- Constants & Assets ---
const JSZIP_CDN = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
const PPTX_CDN = "https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";
const link = document.createElement('link');
link.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css';
link.rel = 'stylesheet';
document.head.appendChild(link);

// Modern Global Styles
const style = document.createElement('style');
style.innerHTML = `
    * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif !important; }
    body { background-color: #F8FAFC; color: #334155; }
    
    /* Modern Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

    /* Selection Color */
    ::selection { background: #6366f1; color: white; }

    /* Inputs Focus Ring */
    input:focus, textarea:focus, select:focus {
        outline: none;
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        border-color: #6366f1;
    }
`;
document.head.appendChild(style);

document.body.style.fontFamily = "Pretendard, sans-serif";
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
const raw = process.env.REACT_APP_FIREBASE_CONFIG;
console.log("REACT_APP_FIREBASE_CONFIG:", raw);

if (!raw) throw new Error("REACT_APP_FIREBASE_CONFIG가 비어있음(.env 설정 확인)");

let firebaseConfig;
try {
    firebaseConfig = JSON.parse(raw);
} catch (e) {
    throw new Error("REACT_APP_FIREBASE_CONFIG JSON 파싱 실패: " + e.message);
}
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
  JSON 구조: { "type": "함께 풀기", "figure_bounds": [0,0,100,100], "figure_alt": "이미지 설명(수식X)", "mainQuestion": "...", "guideText": "▷ 빈칸을 눌러 정답을 선택하세요.", "lines": [{ "label": "(1)", "parts": [{ "type": "text", "content": "..." }, { "type": "blank", "options": ["A","B","C"], "correctIndex": 1, "width": 120 }] }] }`
    :
    `수학 콘텐츠 개발자로서 문제를 분석하세요. LaTeX는 \\\\( 수식 \\\\) 형태 유지.
  JSON: { "type": "문제", "figure_bounds": [0,0,100,100], "figure_alt": "이미지 설명(수식X)", "mainQuestion": "...", "guideText": "▷ 빈칸을 눌러 답을 입력하세요.", "subQuestions": [{ "label": "(1)", "passage": "...", "answer": "...", "explanation": "...", "inputWidth": "w200" }] }`;

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

// [NEW] Draft Config Generator
const buildDraftInputConfig = ({
    typeKey,
    baseTemplateTypeKey, // zip 베이스. 예: "question.mathinput"
    inputKind = "math", hasImage = false, headerUrl = "", contentImageUrl = "",
    figureBounds = null, figureAlt = "",
    isTogether = false // [NEW] Together Mode Flag
}) => ({
    typeKey: isTogether ? "together.custom" : "input.custom", // Dynamic Type Key
    baseTemplateTypeKey: isTogether ? "together.select" : "question.mathinput",
    manifest: {
        // Manifest selectors differ by type? Currently unused by zipProcessor directly except as hint.
        // input_v1 uses them internally? No, input_v1 hardcodes selectors for question.mathinput mostly.
        // We should make strategy robust.
        rowTemplate: isTogether ? ".txt1" : ".flex-row.ai-s.jc-sb",
        // ... other selectors
    },
    strategy: {
        name: isTogether ? "together_v1" : "input_v1", // Strategy Name Switch
        options: {
            inputKind,
            hasImage,
            headerUrl,
            contentImageUrl,
            figureBounds,
            figureAlt
        }
    }
});

const App = () => {
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('analysis');
    const [isProcessing, setIsProcessing] = useState(false);
    const TYPE_DEFS = [
        {
            typeKey: TYPE_KEYS.QUESTION_MATHINPUT,
            label: "문제 > 수식입력형",
        },
        {
            typeKey: TYPE_KEYS.TOGETHER_SELECT,
            label: "함께 풀기 > 선택형",
        },
    ];

    // 이후 계속 추가

    const [analysisImages, setAnalysisImages] = useState([]);
    const [pages, setPages] = useState([]);
    const [metadata, setMetadata] = useState({
        schoolLevel: '중학교', grade: '3학년', subject: '수학', author: '김화경', unit: '1. 제곱근과 실수', session: '1차시', activityName: ''
    });

    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [selectedTypeKey, setSelectedTypeKey] = useState(""); // Default to empty (Auto Detect)

    // [New] Multi-Page Builder State
    const [buildPages, setBuildPages] = useState([{ id: 1, image: null, data: null }]);
    const [activePageIndex, setActivePageIndex] = useState(0);

    // [New] Input Strategy Test State
    const [inputKind, setInputKind] = useState("math"); // math | text | ocr
    const [hasImage, setHasImage] = useState(false);

    const [removePagination, setRemovePagination] = useState(true);

    // Derived Logic
    const activeData = buildPages[activePageIndex]?.data;

    // // 1. Detect Type from Data
    // let detectedTypeKey = "";
    // if (activeData) {
    //     if (activeData.subQuestions || activeData.questions) 
    //         detectedTypeKey = "question.mathinput"; // Or generalized to question.input later
    //     else if (activeData.lines) 
    //         detectedTypeKey = "together.select";
    // }

    // ================================
    // [NEW] Detection Logic (Family vs Type)
    // ================================

    // 1️⃣ 패턴(Strategy Family) 판별
    let detectedFamily = "";
    if (activeData) {
        if (activeData.lines) detectedFamily = "together";
        else if (activeData.subQuestions || activeData.questions) detectedFamily = "input";
    }

    // 2️⃣ 의미 typeKey (있으면 사용, 없으면 empty)
    const detectedTypeKey = activeData?.typeKey || "";

    // 3️⃣ 기존 템플릿 존재 여부(EXACT 판별용)
    const hasExactTemplate = detectedTypeKey
        ? templates.some(t => t.typeKey === detectedTypeKey)
        : false;

    // 4️⃣ Detection Status 결정
    let detectionStatus = "UNKNOWN"; // EXACT | SIMILAR | NEW

    if (!detectedFamily) {
        detectionStatus = "UNKNOWN";
    } else if (hasExactTemplate) {
        detectionStatus = "EXACT";
    } else if (detectedFamily === "input") {
        detectionStatus = "SIMILAR"; // input_v1 전략으로 생성 가능
    } else {
        detectionStatus = "NEW";
    }


    // 2. Filter Templates: If manual type selected, use it. Else if detected, use matching. Else show all?
    // User said: "Advanced option can select existing". 
    // Let's filter by selectedTypeKey if present.
    const filteredTemplates = templates.filter(t => !selectedTypeKey || t.typeKey === selectedTypeKey);

    // 3. Status Logic
    // EXISTING: Found templates matching the DETECTED type (regardless of selection?) -> Auto-match
    // DRAFT: No matching templates for DETECTED type, but structure allows Input V1

    // Find templates that match the *detected* type
    const matchingDetectedTemplates = templates.filter(t => t.typeKey === detectedTypeKey);
    const hasExistingTemplate = matchingDetectedTemplates.length > 0;

    const isInputType = detectedFamily === "input";// For Draft strategy scope

    // [Strict Detection Logic]

    // Header Mapping (Title Type -> Template TypeKey)
    const TYPE_MAPPING = {
        "question.mathinput": ["문제", "예제", "따라 하기"], // Exact header matches
        "together.select": ["함께 풀기", "스스로 확인하기"]
    };

    if (detectedTypeKey) {
        // [New Logic using activeData.type if available]
        const headerType = activeData?.type || "";
        const allowedHeaders = TYPE_MAPPING[detectedTypeKey] || [];
        const isHeaderMatch = allowedHeaders.some(h => headerType.includes(h));

        if (hasExistingTemplate && isHeaderMatch) {
            detectionStatus = "EXACT";
        } else if (hasExistingTemplate && detectedTypeKey === 'question.mathinput') {
            // Structure OK, Key OK, but Header Mismatch -> Similar -> Draft
            detectionStatus = "SIMILAR";
        } else if (isInputType) {
            detectionStatus = "SIMILAR"; // Draft mode for input
        } else {
            detectionStatus = "NEW";
        }
    }

    const onClickZip = () => {
        let customConfig = null;
        let finalTemplateId = selectedTemplateId;

        const currentData = buildPages[activePageIndex]?.data;
        const isTogether = (selectedTypeKey || currentData?.type || "").startsWith("together") || (currentData?.type === "함께 풀기");

        // Auto-Selection Logic if not manually selected
        if (!finalTemplateId) {
            if (detectionStatus === "EXACT") {
                finalTemplateId = matchingDetectedTemplates[0]?.id;
            } else if (detectionStatus === "SIMILAR" || detectionStatus === "NEW") {
                // Determine base for Draft (needs a template zip to clone assets from)
                // [Fixed] Dynamic Base Template
                const baseType = isTogether ? "together.select" : "question.mathinput";
                finalTemplateId = templates.find(t => t.typeKey === baseType)?.id;
            }
        }

        // Generate Draft Config
        // [Fixed] Always generate config if manual override or new/similar
        // Even if EXACT, user might want to force Draft mode via Advanced Options? 
        // For now, keep logic: Only if SIMILAR/NEW OR manual drafted.
        if (detectionStatus === "SIMILAR" || detectionStatus === "NEW" || selectedTypeKey) {
            const headerType = currentData?.type || (isTogether ? "함께 풀기" : "문제");
            // Check if ASSETS is available in scope, it is global const
            const hUrl = ASSETS.TITLES[headerType] || ASSETS.TITLES['문제'];
            const cImg = buildPages[activePageIndex]?.image || "";

            const figureBounds = currentData?.figure_bounds;
            const figureAlt = currentData?.figure_alt;

            customConfig = buildDraftInputConfig({
                inputKind,
                hasImage,
                headerUrl: hUrl,
                contentImageUrl: cImg,
                figureBounds,
                figureAlt,
                isTogether
            });
            console.log("Generating Draft Config:", customConfig);
        }

        if (!finalTemplateId && !customConfig) {
            setStatusMessage({ title: "알림", message: "사용할 템플릿을 찾을 수 없습니다.", type: "error" });
            return;
        }

        processAndDownloadZip({
            templates,
            selectedTemplateId: finalTemplateId,
            buildPages,
            setStatusMessage,
            setIsProcessing,
            removePagination,
            db,
            appId,
            customConfig
        });
    };

    const builderImageInputRef = useRef(null);
    const templateZipInputRef = useRef(null);
    const analysisScrollRef = useRef(null); // [NEW] Ref for analysis image grid

    const dragItem = useRef(null);

    const [statusMessage, setStatusMessage] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    // [New] Auto-scroll when analysis images are added
    useEffect(() => {
        if (activeTab === 'analysis' && analysisImages.length > 0 && analysisScrollRef.current) {
            analysisScrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [analysisImages, activeTab]);

    const StatusModal = ({ status, onClose }) => {
        if (!status) return null;
        const isLoading = status.type === 'loading' || status.type === 'info';
        return (
            <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center gap-6">
                    <div className={`p-4 rounded-full ${status.type === 'error' ? 'bg-red-100 text-red-600' : isLoading ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {status.type === 'error' ? <AlertTriangle size={32} /> : isLoading ? <Loader2 className="animate-spin" size={32} /> : <CheckCircle2 size={32} />}
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-black text-slate-900 mb-2">{status.title}</h3>
                        <p className="text-slate-500 font-medium whitespace-pre-wrap">{status.message}</p>
                    </div>
                    {!isLoading && (
                        <button onClick={onClose} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all">확인</button>
                    )}
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
        });
    }, [user, db, appId]);

    useEffect(() => {
        if (filteredTemplates.length === 0) {
            setSelectedTemplateId("");
            return;
        }

        const exists = filteredTemplates.some(t => t.id === selectedTemplateId);
        if (!selectedTemplateId || !exists) {
            setSelectedTemplateId(filteredTemplates[0].id);
        }
    }, [selectedTypeKey, filteredTemplates, selectedTemplateId]);


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
                let subQs = (sec.content.body || "").split('\n').filter(l => l.trim()).map((l, i) => ({ id: i, text: l.replace(/^\(\d+\)\s*/, '') }));

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

    const addPage = () => {
        if (buildPages.length >= 4) return;
        const newPages = [...buildPages, { id: buildPages.length + 1, image: null, data: null }];
        setBuildPages(newPages);
        setActivePageIndex(newPages.length - 1);
    };

    const removePage = (index) => {
        if (buildPages.length <= 1) return;
        const newPages = buildPages.filter((_, i) => i !== index).map((p, i) => ({ ...p, id: i + 1 }));
        setBuildPages(newPages);
        setActivePageIndex(Math.max(0, index - 1));
    };

    const updateCurrentPageData = (newData) => {
        const newPages = [...buildPages];
        newPages[activePageIndex].data = newData;
        setBuildPages(newPages);
    };

    const analyzeImage = async (file) => {
        const base64 = await new Promise(r => {
            const reader = new FileReader();
            reader.onload = () => r(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });
        const template = templates.find(t => t.id === selectedTemplateId);
        // [Fixed] Check selectedTypeKey as well
        const isTogether = (template?.typeKey || selectedTypeKey || "").startsWith('together');
        const systemPrompt = BUILDER_SYSTEM_PROMPT(isTogether);

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Extract JSON for build." }, { inlineData: { mimeType: "image/png", data: base64 } }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error?.message || `API Error ${res.status}`);
        }

        const data = await res.json();

        if (!data.candidates || !data.candidates[0]) {
            console.error("Gemini No Candidates:", data);
            if (data.promptFeedback?.blockReason) {
                throw new Error(`AI Safety Block: ${data.promptFeedback.blockReason}`);
            }
            throw new Error("AI 분석 결과가 없습니다. 다시 시도해주세요.");
        }

        const text = data.candidates[0].content.parts[0].text;
        // Strip markdown code blocks if present
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    };

    const handleBuilderImage = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setIsProcessing(true);
        try {
            let currentPages = [...buildPages];
            let targetIndex = activePageIndex;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                // Add page if needed
                if (targetIndex >= currentPages.length) {
                    if (currentPages.length >= 4) break;
                    currentPages.push({ id: currentPages.length + 1, image: null, data: null });
                }

                // Preview
                currentPages[targetIndex] = {
                    ...currentPages[targetIndex],
                    image: URL.createObjectURL(file),
                };
                setBuildPages([...currentPages]);

                // Analyze
                const extracted = await analyzeImage(file);
                currentPages[targetIndex].data = extracted;
                setBuildPages([...currentPages]);

                targetIndex++;
            }
            // Move active index to the last processed page
            setActivePageIndex(targetIndex - 1);

        } catch (e) {
            alert("분석 에러: " + e.message);
        } finally {
            setIsProcessing(false);
            e.target.value = '';
        }
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
                createdAt: Date.now(),
                typeKey: selectedTypeKey,
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
        <div className="flex h-screen bg-[#F8FAFC] text-slate-800 overflow-hidden selection:bg-indigo-500 selection:text-white">
            <StatusModal status={statusMessage} onClose={() => setStatusMessage(null)} />

            {/* [Modern Sidebar] Glassmorphism & Clean Typography */}
            <aside className="w-72 bg-white/80 backdrop-blur-2xl border-r border-slate-100/50 p-8 flex flex-col gap-10 z-20 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-4 px-2">
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-200 ring-4 ring-indigo-50">
                        <Layout size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none mb-1">Edu Builder</h1>
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-full inline-block">AI Powered</span>
                    </div>
                </div>

                <nav className="flex flex-col gap-3 flex-1">
                    {[
                        { id: 'analysis', icon: BookOpen, label: '교과서 분석' },
                        { id: 'storyboard', icon: Layers, label: '스토리보드' },
                        { id: 'builder', icon: Calculator, label: '콘텐츠 생성' },
                        { id: 'library', icon: HardDrive, label: '라이브러리' }
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`group flex items-center gap-4 px-5 py-4 rounded-[1.2rem] transition-all duration-300 ease-out border ${activeTab === item.id
                                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 border-indigo-500 translate-x-2'
                                : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-900 hover:border-slate-100'
                                }`}
                        >
                            <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} className={`transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                            <span className="font-bold text-[15px] tracking-tight">{item.label}</span>
                            {activeTab === item.id && <ChevronRight size={16} className="ml-auto opacity-50" />}
                        </button>
                    ))}
                </nav>

                <div className="px-4 py-6 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">System Status</p>
                    <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-bold text-slate-600">Online & Ready</span>
                    </div>
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto relative custom-scrollbar p-10">
                {isProcessing && (
                    <div className="fixed inset-0 bg-white/70 backdrop-blur-md z-[100] flex flex-col items-center justify-center">
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

                <div className="max-w-7xl mx-auto">
                    <header className="flex justify-between items-end mb-8 px-4 sticky top-0 z-20 bg-[#fcfcfc]">
                        <div>
                            <h2 className="text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tighter leading-tight drop-shadow-sm">
                                {activeTab === 'analysis' && "교과서 분석"}
                                {activeTab === 'storyboard' && "스토리보드 리뷰"}
                                {activeTab === 'builder' && "콘텐츠 자동 생성"}
                                {activeTab === 'library' && "템플릿 라이브러리"}
                            </h2>
                            <p className="text-slate-500 font-medium mt-3 text-lg">Kim Hwa-kyung Specialized Integrated Platform</p>
                        </div>
                        <div className="flex gap-4">
                            {activeTab === 'analysis' && (
                                <button onClick={runAnalysis} className="px-10 py-4 bg-gray-900 text-white rounded-full font-bold text-lg shadow-xl shadow-gray-200 hover:scale-[1.02] hover:shadow-2xl active:scale-95 transition-all flex items-center gap-3">
                                    <MonitorPlay size={20} /> 분석 시작
                                </button>
                            )}
                            {activeTab === 'storyboard' && (
                                <button onClick={generatePPTX} className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-full font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:scale-105 transition-all">
                                    <Download size={20} /> PPTX 다운로드
                                </button>
                            )}
                        </div>
                    </header>

                    {activeTab === 'analysis' && (
                        <div className="space-y-12 animate-in slide-in-from-bottom-8 duration-700 fade-in">
                            <div
                                onClick={() => builderImageInputRef.current.click()}
                                className="group relative border-4 border-dashed border-slate-200/80 rounded-[3rem] p-24 flex flex-col items-center justify-center bg-white hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer shadow-sm hover:shadow-2xl hover:shadow-indigo-100/50 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10 group-hover:opacity-100 transition-opacity" />
                                <input ref={builderImageInputRef} type="file" multiple accept="image/*" onChange={(e) => setAnalysisImages(Array.from(e.target.files).map(f => ({ id: Math.random(), file: f, preview: URL.createObjectURL(f) })))} className="hidden" />

                                <div className="p-3 bg-white rounded-[2rem] text-indigo-600 mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-100">
                                    <Upload size={64} strokeWidth={1.5} />
                                </div>
                                <h3 className="text-3xl font-bold text-slate-800 tracking-tight text-center">교과서 원고 업로드</h3>
                                <p className="text-slate-500 font-medium mt-4 text-center max-w-lg leading-relaxed">
                                    최대 3장의 교과서 png를 업로드하면 한 번에 분석하여 스토리보드를 생성합니다.<br />
                                    <span className="text-indigo-500 font-bold">AI가 자동으로 콘텐츠 유형 판별 및 텍스트 추출, 정답 및 해설 내용을 작성합니다. <br /> AI는 실수를 할 수 있습니다.</span>
                                </p>
                            </div>
                            <div ref={analysisScrollRef} className="grid grid-cols-3 gap-8">
                                {analysisImages.map(img => (
                                    <div key={img.id} className="relative rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-md group hover:scale-[1.02] hover:shadow-xl transition-all duration-500 bg-white">
                                        <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setAnalysisImages(prev => prev.filter(i => i.id !== img.id))} className="p-3 bg-white/90 backdrop-blur-md text-rose-500 rounded-full hover:bg-rose-50 transition-colors shadow-sm"><Trash2 size={20} /></button>
                                        </div>
                                        <img src={img.preview} className="w-full h-72 object-cover" />
                                        <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
                                            <p className="text-white font-bold text-sm">교과서 이미지</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'storyboard' && (
                        <div className="space-y-16 animate-in fade-in duration-500 pb-32">
                            {pages.length > 0 ? pages.map((page, pIdx) => (
                                <div key={page.id} className="bg-white rounded-[3rem] p-2 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-100 group">
                                    <div className="flex flex-col lg:flex-row h-full">

                                        {/* Metadata Sider */}
                                        <div className="lg:w-60 p-8 flex flex-col gap-6 border-b lg:border-b-0 lg:border-r border-slate-100">
                                            <div className="flex items-center gap-4 mb-4">
                                                <span className="w-14 h-14 bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-200">
                                                    {pIdx + 1}
                                                </span>
                                                <div>
                                                    <span className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Page Sequence</span>
                                                    <span className="font-black text-slate-800 text-lg tracking-tight">Main Flow</span>
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</span>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-700">
                                                    {page.type}
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Title</span>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-700 leading-snug">
                                                    {page.title}
                                                </div>
                                            </div>

                                            <div className="mt-auto pt-4 flex gap-2 opacity-50 hover:opacity-100 transition-opacity">
                                                <GripVertical className="text-slate-300 cursor-move" />
                                                <span className="text-xs font-bold text-slate-400">Drag to Reorder</span>
                                            </div>
                                        </div>

                                        {/* Content Preview */}
                                        <div className="flex-1 p-10 bg-slate-50/50">
                                            <label className="text-[10px] font-black uppercase text-indigo-300 tracking-widest block mb-6">Visual Preview</label>
                                            <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-sm relative min-h-[500px]">
                                                <img src={ASSETS.TITLES[page.type] || ASSETS.TITLES['개념']} className="h-10 mb-10 object-contain brightness-95" />
                                                <div className="space-y-12">
                                                    <h4 className="text-3xl font-bold text-slate-800 leading-snug tracking-tight">{page.content}</h4>
                                                    <div className="space-y-6 mt-8 pl-2 border-l-2 border-slate-100">
                                                        {page.subQuestions.length > 0 ? page.subQuestions.map((sq, i) => (
                                                            <div key={i} className="flex items-start gap-6 p-6 bg-slate-50 rounded-[2rem] hover:bg-indigo-50/30 transition-colors">
                                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 mt-1">{sq.label || i + 1}</div>
                                                                <div className="text-lg font-medium text-slate-700 leading-relaxed flex-1">{renderMathToHTML(sq.text)}</div>
                                                            </div>
                                                        )) : (
                                                            <div className="text-xl leading-relaxed text-slate-600 font-medium whitespace-pre-wrap">{renderMathToHTML(page.body)}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Logic Description */}
                                        <div className="lg:w-76 bg-slate-900 p-8 text-slate-300 flex flex-col">
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-6">Interaction Logic</label>
                                            <textarea
                                                className="w-full flex-1 bg-transparent text-emerald-400 font-mono text-xs leading-relaxed border-none focus:ring-0 p-0 resize-none selection:bg-emerald-900"
                                                value={page.description[0].text}
                                                onChange={(e) => {
                                                    const newPages = [...pages];
                                                    newPages[pIdx].description[0].text = e.target.value;
                                                    setPages(newPages);
                                                }}
                                            />
                                            <button
                                                disabled={statusMessage?.type === 'loading'}
                                                onClick={async () => {
                                                    if (statusMessage?.type === 'loading') return;
                                                    // Remove setIsProcessing(true) to avoid double popup. Rely on StatusModal overlay.
                                                    setStatusMessage({ title: "생성 중", message: "콘텐츠 빌더로 복사 및 데이터 추출 중...", type: 'loading' });

                                                    try {
                                                        // 1. Prepare Text Prompt from Storyboard Page
                                                        const sbContent = JSON.stringify({
                                                            type: page.type,
                                                            content: page.content,
                                                            body: page.body,
                                                            subQuestions: page.subQuestions,
                                                            description: page.description[0].text
                                                        }, null, 2);

                                                        const isTogether = page.type === '함께 풀기';
                                                        const systemPrompt = BUILDER_SYSTEM_PROMPT(isTogether);

                                                        // 2. Call Gemini
                                                        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                contents: [{
                                                                    parts: [
                                                                        { text: systemPrompt },
                                                                        { text: `Extract build data from this JSON representation of a textbook page:\n\n${sbContent}` }
                                                                    ]
                                                                }],
                                                                generationConfig: { responseMimeType: "application/json" }
                                                            })
                                                        });

                                                        if (!res.ok) throw new Error("API Error");
                                                        const data = await res.json();
                                                        const text = data.candidates[0].content.parts[0].text;
                                                        const extracted = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());

                                                        // 3. Add to Build Pages
                                                        const newBuildPages = [...buildPages];
                                                        if (!newBuildPages[activePageIndex].data && !newBuildPages[activePageIndex].image) {
                                                            newBuildPages[activePageIndex] = { ...newBuildPages[activePageIndex], data: extracted };
                                                        } else {
                                                            if (newBuildPages.length < 4) {
                                                                newBuildPages.push({ id: newBuildPages.length + 1, image: null, data: extracted });
                                                                setActivePageIndex(newBuildPages.length - 1);
                                                            } else {
                                                                alert("최대 4페이지까지만 생성 가능합니다.");
                                                                setStatusMessage(null);
                                                                return;
                                                            }
                                                        }

                                                        setBuildPages(newBuildPages);
                                                        setActiveTab('builder');
                                                        setStatusMessage(null); // Close loading modal

                                                        // Set Type Key
                                                        const typeMap = {
                                                            '함께 풀기': 'together.select',
                                                            '문제': 'question.mathinput',
                                                            '수식 입력형': 'question.mathinput',
                                                            '스스로 풀기': 'question.mathinput',
                                                            '연습 하기': 'question.mathinput'
                                                        };
                                                        if (typeMap[page.type]) {
                                                            setSelectedTypeKey(typeMap[page.type]);
                                                        } else {
                                                            // Default logic if type is unknown (e.g. '발견하기' -> question.mathinput?)
                                                            // For now, if it's not '함께 풀기', assume question.mathinput
                                                            if (page.type !== '함께 풀기') {
                                                                setSelectedTypeKey('question.mathinput');
                                                            }
                                                        }

                                                    } catch (e) {
                                                        console.error(e);
                                                        setStatusMessage({ title: "오류", message: "데이터 추출 실패: " + e.message, type: 'error' });
                                                    }
                                                    // No finally block needed as success clears modal, error shows error modal.
                                                }}
                                                className={`w-full mt-4 py-3 rounded-xl font-bold text-xs transition-all border flex items-center justify-center gap-2 ${statusMessage?.type === 'loading' ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-wait' : 'bg-white/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border-white/10 hover:border-emerald-400'}`}
                                            >
                                                {statusMessage?.type === 'loading' ? <div className="w-3 h-3 rounded-full border-2 border-slate-500 border-t-white animate-spin" /> : <Calculator size={14} />}
                                                {statusMessage?.type === 'loading' ? "분석 중..." : "콘텐츠 빌더로 복사"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-40 text-center flex flex-col items-center gap-6">
                                    <div className="bg-white p-8 rounded-[2.5rem] text-indigo-200 shadow-xl shadow-indigo-50 border border-indigo-50"><Layers size={64} /></div>
                                    <p className="font-bold text-slate-400 text-xl max-w-md mx-auto leading-relaxed">No storyboard data found.<br />Please proceed with <span className="text-indigo-500">Textbook Analysis</span> first.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'builder' && (
                        <div className="grid grid-cols-3 gap-12 animate-in fade-in duration-500">
                            <div className="col-span-1 space-y-8">
                                <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm">

                                    <label className="text-xs font-black text-slate-400 uppercase mb-5 block ml-2 tracking-widest">UPLOAD SB IMAGES</label>

                                    <div className="flex gap-2 mb-4 flex-wrap">
                                        {buildPages.map((p, idx) => (
                                            <button
                                                key={p.id}
                                                onClick={() => setActivePageIndex(idx)}
                                                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activePageIndex === idx ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                            >
                                                Page {p.id}
                                                {buildPages.length > 1 && (
                                                    <span onClick={(e) => { e.stopPropagation(); removePage(idx); }} className="hover:text-red-300"><X size={12} /></span>
                                                )}
                                            </button>
                                        ))}
                                        {buildPages.length < 4 && (
                                            <button onClick={addPage} className="px-4 py-2 rounded-xl font-bold text-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all flex items-center gap-1">
                                                <Plus size={14} /> Add
                                            </button>
                                        )}
                                    </div>

                                    <div onClick={() => templateZipInputRef.current.click()} className="aspect-[4/5] bg-slate-50 border-4 border-dashed border-slate-100 rounded-[3rem] flex items-center justify-center overflow-hidden cursor-pointer group hover:bg-indigo-50 hover:border-indigo-200 transition-all relative">
                                        <input ref={templateZipInputRef} type="file" multiple accept="image/*" onChange={handleBuilderImage} className="hidden" />
                                        {buildPages[activePageIndex]?.image ? <img src={buildPages[activePageIndex].image} className="w-full h-full object-cover" /> : <div className="text-center text-slate-300"><ImageIcon className="mx-auto mb-2" size={48} /><span className="text-xs font-bold">Upload Image(s)</span></div>}
                                    </div>

                                    <details className="mt-10 mb-5 text-slate-400">
                                        <summary className="cursor-pointer text-xs font-black uppercase tracking-widest hover:text-indigo-500 transition-colors">Advanced Options</summary>
                                        <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">

                                            <div>
                                                <label className="text-xs font-black text-slate-400 uppercase mb-2 block tracking-widest">
                                                    Manual Type Filtering
                                                </label>
                                                <select
                                                    value={selectedTypeKey}
                                                    onChange={(e) => {
                                                        setSelectedTypeKey(e.target.value);
                                                        setSelectedTemplateId("");
                                                    }}
                                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-300"
                                                >
                                                    <option value="">Auto Detect (Default)</option>
                                                    {TYPE_DEFS.map((t) => (
                                                        <option key={t.typeKey} value={t.typeKey}>
                                                            {t.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="text-xs font-black text-slate-400 uppercase mb-2 block tracking-widest">
                                                    Select Template
                                                </label>
                                                <select
                                                    value={selectedTemplateId || ""}
                                                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-300"
                                                >
                                                    <option value="">
                                                        {selectedTypeKey ? "Select a template..." : "Auto Select based on detection"}
                                                    </option>
                                                    {filteredTemplates.map((t) => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                    {filteredTemplates.length === 0 && <option disabled>No templates available</option>}
                                                </select>
                                            </div>
                                        </div>
                                    </details>
                                </div>
                            </div>
                            <div className="col-span-2">
                                <div className="bg-white p-12 rounded-[4.5rem] border border-slate-200 shadow-sm min-h-[600px] flex flex-col relative overflow-hidden">
                                    {buildPages[activePageIndex]?.data ? (
                                        <div className="w-full space-y-10 animate-in slide-in-from-right-10 duration-500">

                                            {/* [NEW] Detected Strategy Card */}
                                            {isInputType && (
                                                <div className={`p-6 rounded-[2.5rem] border-2 ${detectionStatus === 'EXACT' ? 'bg-green-50 border-green-200' : 'bg-indigo-50 border-indigo-200'}`}>
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <ShieldCheck size={20} className={detectionStatus === 'EXACT' ? 'text-green-600' : 'text-indigo-600'} />
                                                        <span className="font-black text-sm uppercase tracking-wider opacity-60">Detected Strategy</span>
                                                    </div>

                                                    {detectionStatus === 'EXACT' && (
                                                        <div>
                                                            <p className="font-bold text-lg text-green-800 mb-2">✅ 완벽히 일치하는 기존 템플릿 발견</p>
                                                            <div className="bg-white p-3 rounded-xl border border-green-100 text-xs font-bold text-green-600">
                                                                Type: {activeData.type} / {detectedTypeKey}<br />
                                                                Family: {detectedFamily}<br />
                                                                Matching Templates: {matchingDetectedTemplates.length} matches
                                                            </div>
                                                        </div>
                                                    )}

                                                    {(detectionStatus === 'SIMILAR' || detectionStatus === 'NEW') && (
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase text-white ${detectionStatus === 'SIMILAR' ? 'bg-amber-400' : 'bg-rose-400'}`}>
                                                                    {detectionStatus}
                                                                </span>
                                                                <p className="font-bold text-lg text-indigo-800">
                                                                    {detectionStatus === 'SIMILAR' ? "유사한 구조의 템플릿이 있습니다." : "새로운 유형입니다. 다른 방법을 사용하여 생성하세요."}
                                                                </p>
                                                            </div>
                                                            <p className="text-xs text-slate-500 font-bold mb-4">Input v1 모드로 생성합니다.</p>

                                                            {/* Options for Draft */}
                                                            <div className="flex gap-4">
                                                                <div className="bg-white p-3 rounded-xl border border-indigo-100 flex-1">
                                                                    <label className="text-[10px] font-black text-indigo-400 uppercase block mb-1">입력칸 유형</label>
                                                                    <div className="flex bg-indigo-50 rounded-lg p-1">
                                                                        {['math', 'text', 'ocr'].map(k => (
                                                                            <button
                                                                                key={k}
                                                                                onClick={() => setInputKind(k)}
                                                                                className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${inputKind === k ? 'bg-white shadow-sm text-indigo-600' : 'text-indigo-300 hover:text-indigo-500'}`}
                                                                            >
                                                                                {k}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                                <div className="bg-white p-3 rounded-xl border border-indigo-100 flex-1">
                                                                    <label className="text-[10px] font-black text-indigo-400 uppercase block mb-1">이미지 유무</label>
                                                                    <button
                                                                        onClick={() => setHasImage(!hasImage)}
                                                                        className={`w-full py-2 text-xs font-bold rounded-lg transition-all ${hasImage ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                                                                    >
                                                                        {hasImage ? 'Image Enabled' : 'No Image'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between mt-8">
                                                <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">Page {buildPages[activePageIndex].id} Data</h3>
                                                <span className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border border-emerald-100 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Engine Ready
                                                </span>
                                            </div>

                                            <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-2">Main Question</label>
                                                    <input className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 font-bold text-lg text-slate-800 focus:bg-white transition-all" value={buildPages[activePageIndex].data.mainQuestion} onChange={e => updateCurrentPageData({ ...buildPages[activePageIndex].data, mainQuestion: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-2">Guide Text</label>
                                                    <input className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium text-sm text-slate-600 focus:bg-white transition-all" value={buildPages[activePageIndex].data.guideText || ""} onChange={e => updateCurrentPageData({ ...buildPages[activePageIndex].data, guideText: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                                {/* Case 1: SubQuestions (General) */}
                                                {buildPages[activePageIndex].data.subQuestions && buildPages[activePageIndex].data.subQuestions.map((item, i) => (
                                                    <div key={i} className="p-8 bg-white border border-slate-100 rounded-[2.5rem] space-y-6 shadow-sm hover:shadow-md transition-shadow relative group">
                                                        <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <GripVertical className="text-slate-300" />
                                                        </div>
                                                        <div className="flex items-start gap-5">
                                                            <span className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-lg shadow-slate-200">{item.label || i + 1}</span>
                                                            <div className="flex-1 space-y-2">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Passage Content</label>
                                                                <textarea rows={2} className="w-full p-3 bg-slate-50 rounded-xl text-sm font-medium border-0 focus:ring-2 focus:ring-indigo-100 outline-none resize-none transition-all" value={item.passage || ""} onChange={(e) => {
                                                                    const newSub = [...buildPages[activePageIndex].data.subQuestions];
                                                                    newSub[i].passage = e.target.value;
                                                                    updateCurrentPageData({ ...buildPages[activePageIndex].data, subQuestions: newSub });
                                                                }} />
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-6">
                                                            <div>
                                                                <label className="text-[10px] font-bold text-emerald-500 uppercase mb-2 block">Correct Answer</label>
                                                                <input className="w-full p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-sm font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-100 transition-all" value={item.answer || ""} onChange={(e) => {
                                                                    const newSub = [...buildPages[activePageIndex].data.subQuestions];
                                                                    newSub[i].answer = e.target.value;
                                                                    updateCurrentPageData({ ...buildPages[activePageIndex].data, subQuestions: newSub });
                                                                }} />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-indigo-400 uppercase mb-2 block">Explanation</label>
                                                                <input className="w-full p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-sm font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-100 transition-all" value={item.explanation || ""} onChange={(e) => {
                                                                    const newSub = [...buildPages[activePageIndex].data.subQuestions];
                                                                    newSub[i].explanation = e.target.value;
                                                                    updateCurrentPageData({ ...buildPages[activePageIndex].data, subQuestions: newSub });
                                                                }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Case 2: Lines (Hello Together) */}
                                                {buildPages[activePageIndex].data.lines && buildPages[activePageIndex].data.lines.map((line, i) => (
                                                    <div key={i} className="p-6 bg-white border-2 border-amber-100 rounded-[2.5rem] space-y-4 shadow-sm">
                                                        <div className="flex items-center gap-4 mb-2">
                                                            <span className="w-8 h-8 bg-amber-500 text-white rounded-lg flex items-center justify-center font-black text-xs">{line.label || "L" + (i + 1)}</span>
                                                            <span className="text-xs font-bold text-slate-400 uppercase">Line {i + 1}</span>
                                                        </div>
                                                        {line.parts && line.parts.map((part, pIdx) => (
                                                            <div key={pIdx} className="pl-4 border-l-2 border-slate-100 ml-2">
                                                                {part.type === 'text' && (
                                                                    <div className="mb-2">
                                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Text Part</label>
                                                                        <textarea rows={1} className="w-full p-2 text-sm border-b border-slate-100 outline-none resize-none" value={part.content} onChange={(e) => {
                                                                            const newLines = [...buildPages[activePageIndex].data.lines];
                                                                            newLines[i].parts[pIdx].content = e.target.value;
                                                                            updateCurrentPageData({ ...buildPages[activePageIndex].data, lines: newLines });
                                                                        }} />
                                                                    </div>
                                                                )}
                                                                {part.type === 'blank' && (
                                                                    <div className="bg-slate-50 p-3 rounded-xl space-y-2">
                                                                        <div className="flex justify-between">
                                                                            <label className="text-[10px] font-bold text-blue-500 uppercase">Blank (Index: {part.correctIndex})</label>
                                                                        </div>
                                                                        <div className="flex gap-2 flex-wrap">
                                                                            {part.options && part.options.map((opt, oIdx) => (
                                                                                <span key={oIdx} className={`px-2 py-1 rounded-lg text-xs font-bold ${oIdx + 1 === part.correctIndex ? 'bg-blue-500 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>
                                                                                    {opt}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                            <button onClick={onClickZip} className="w-full py-7 bg-slate-900 text-white rounded-[3rem] font-black text-xl shadow-2xl hover:bg-black hover:scale-[1.01] active:scale-95 transition-all flex items-end justify-center gap-6">
                                                <Download size={32} /> 콘텐츠 다운로드
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
                        <div className="grid grid-cols-2 gap-12 animate-in fade-in duration-500 pb-20">
                            <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm relative overflow-hidden group flex flex-col">
                                <h3 className="text-3xl font-black mb-8 text-slate-800 tracking-tight">Add New Template</h3>
                                <div onClick={() => templateZipInputRef.current.click()} className="flex-1 min-h-[400px] bg-slate-50 border-4 border-dashed border-indigo-100 rounded-[2.5rem] flex flex-col items-center justify-center text-indigo-400 cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-inner group-hover:scale-[1.02] duration-500">
                                    <input ref={templateZipInputRef} type="file" accept=".zip" onChange={uploadTemplate} className="hidden" />
                                    <div className="bg-white p-6 rounded-full shadow-lg mb-6 group-hover:rotate-90 transition-transform duration-500 border border-indigo-50">
                                        <Plus className="text-indigo-500" size={48} />
                                    </div>
                                    <p className="font-black uppercase tracking-widest text-xs mb-2">Drop ZIP Template Here</p>
                                    <span className="text-[10px] font-bold text-slate-400">Supported formats: .zip containing templates</span>
                                </div>
                            </div>
                            <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col">
                                <div className="flex justify-between items-center mb-10">
                                    <h3 className="text-3xl font-black text-slate-800 tracking-tight">Library Index</h3>
                                    <span className="bg-slate-100 text-slate-600 px-4 py-2 rounded-2xl text-xs font-black shadow-sm border border-slate-200">{templates.length} Items</span>
                                </div>
                                <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                                    {templates.sort((a, b) => b.createdAt - a.createdAt).map(t => (
                                        <div key={t.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-indigo-200 hover:bg-white hover:shadow-xl transition-all group">
                                            <div className="flex items-center gap-5">
                                                <div className={`p-4 rounded-2xl ${t.type === 'together' ? 'bg-amber-100 text-amber-600 shadow-amber-100' : 'bg-indigo-100 text-indigo-600 shadow-indigo-100'} shadow-md`}>
                                                    <FileCode size={24} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-lg leading-tight mb-1">{t.name}</p>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-100">{t.type || 'Standard'}</span>
                                                </div>
                                            </div>
                                            <button onClick={async (e) => { e.stopPropagation(); if (window.confirm('Delete template?')) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'templates', t.id)) }} className="p-3 bg-white text-slate-300 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-colors shadow-sm"><Trash2 size={20} /></button>
                                        </div>
                                    ))}
                                    {templates.length === 0 && (
                                        <div className="text-center py-20 text-slate-400 font-medium">No templates found.<br />Upload one to get started.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 2px solid transparent; background-clip: content-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
        </div>
    );
};

export default App;