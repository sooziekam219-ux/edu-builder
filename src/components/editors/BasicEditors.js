import React from 'react';

function ensureSubQuestions(data) {
    const sub = Array.isArray(data.subQuestions) ? data.subQuestions : [];
    return sub.length ? sub : [{ label: "1", passage: "", answer: "", explanation: "" }];
}

function SubQuestionsEditor({ currentData, onChange }) {
    const subQuestions = ensureSubQuestions(currentData);

    return (
        <div className="space-y-6">
            {subQuestions.map((item, i) => (
                <div key={i} className="p-8 bg-white border border-slate-100 rounded-[2.5rem] space-y-6 shadow-sm">
                    <div className="flex items-start gap-5">
                        <span className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-sm">
                            {item.label || i + 1}
                        </span>
                        <div className="flex-1 space-y-2">
                            <textarea
                                rows={1}
                                className="w-full p-3 bg-slate-50 rounded-xl text-sm font-medium outline-none resize-none"
                                value={item.passage || ""}
                                onChange={(e) => {
                                    const next = [...subQuestions];
                                    next[i] = { ...next[i], passage: e.target.value };
                                    onChange({ ...currentData, subQuestions: next });
                                }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-[15px] font-bold text-emerald-500 uppercase mb-2 block">정답</label>
                            <input
                                className="w-full p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-sm font-bold text-emerald-700 outline-none"
                                value={item.answer || ""}
                                onChange={(e) => {
                                    const next = [...subQuestions];
                                    next[i] = { ...next[i], answer: e.target.value };
                                    onChange({ ...currentData, subQuestions: next });
                                }}
                            />
                        </div>

                        <div>
                            <label className="text-[15px] font-bold text-indigo-400 uppercase mb-2 block">해설</label>
                            <input
                                className="w-full p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-sm font-bold text-indigo-700 outline-none"
                                value={item.explanation || ""}
                                onChange={(e) => {
                                    const next = [...subQuestions];
                                    next[i] = { ...next[i], explanation: e.target.value };
                                    onChange({ ...currentData, subQuestions: next });
                                }}
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export function MathInputEditor({ currentData, onChange }) {
    return <SubQuestionsEditor currentData={currentData} onChange={onChange} />;
}
export function GenericFallbackEditor({ currentData }) {
    return (
        <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-200 text-slate-500">
            <div className="font-black mb-2">이 타입은 전용 에디터가 없어요.</div>
            <pre className="text-xs overflow-auto">{JSON.stringify(currentData, null, 2)}</pre>
        </div>
    );
}

export function TogetherSelectEditor({ currentData, onChange }) {
    const lines = Array.isArray(currentData?.lines) ? currentData.lines : [];

    // blank 파트만 한 번에 모으기(순서 유지)
    const blanks = [];
    lines.forEach((line, li) => {
        (line.parts || []).forEach((part, pi) => {
            if (part?.type === "blank") blanks.push({ li, pi, part });
        });
    });

    const patchPart = (li, pi, nextPart) => {
        const nextLines = lines.map((l, idx) =>
            idx !== li ? l : { ...l, parts: (l.parts || []).map((p, j) => (j !== pi ? p : nextPart)) }
        );
        onChange({ ...currentData, lines: nextLines });
    };

    const updateOption = (li, pi, part, optIdx, value) => {
        const nextOptions = [...(part.options || [""])];
        nextOptions[optIdx] = value;
        patchPart(li, pi, { ...part, options: nextOptions });
    };

    const addOption = (li, pi, part) => {
        const nextOptions = [...(part.options || ["", "", ""]), ""];
        patchPart(li, pi, { ...part, options: nextOptions });
    };

    const removeOption = (li, pi, part) => {
        const currentOptions = part.options || [""];
        if (currentOptions.length <= 1) return;
        const nextOptions = currentOptions.slice(0, -1);
        patchPart(li, pi, { ...part, options: nextOptions });
    };

    const toggleSelectionMode = (li, pi, part) => {
        const nextMode = part.selectionEnabled === false ? true : false;
        patchPart(li, pi, { ...part, selectionEnabled: nextMode });
    };

    return (
        <div className="space-y-8">
            <div className="p-8 bg-blue-50/60 border border-blue-200 rounded-[2.5rem] space-y-5">
                <div>
                    <div className="text-xs font-black uppercase tracking-widest text-blue-600">함께 풀기(선택형)</div>
                    <div className="text-sm font-bold text-slate-600 mt-1">각 빈칸의 정답과 오답 선택지를 설정하세요.</div>
                </div>

                <div className="space-y-4">
                    {blanks.map(({ li, pi, part }, idx) => (
                        <div key={`${li}-${pi}`} className="bg-white rounded-2xl border border-blue-100 p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500 text-white font-black flex items-center justify-center text-xs">
                                        {idx + 1}
                                    </div>
                                    <span className="font-bold text-slate-700">빈칸 {idx + 1}번 설정</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">선택형 문제로 생성</span>
                                        <button
                                            onClick={() => toggleSelectionMode(li, pi, part)}
                                            className={`px-4 py-1.5 rounded-xl font-black text-[10px] transition-all ${part.selectionEnabled !== false ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                                        >
                                            {part.selectionEnabled !== false ? "ON" : "OFF"}
                                        </button>
                                    </div>
                                    {part.selectionEnabled !== false && (
                                        <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                                            <button
                                                onClick={() => removeOption(li, pi, part)}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 transition-all font-bold"
                                            >
                                                -
                                            </button>
                                            <span className="px-2 text-[10px] font-black text-slate-500 uppercase">{(part.options || []).length}개</span>
                                            <button
                                                onClick={() => addOption(li, pi, part)}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 transition-all font-bold"
                                            >
                                                +
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {part.selectionEnabled !== false ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {(part.options || ["", "", ""]).map((opt, oIdx) => (
                                        <div key={oIdx} className="space-y-2">
                                            <label className={`text-[10px] font-black uppercase tracking-widest block ${oIdx === 0 ? "text-emerald-500" : "text-rose-400"}`}>
                                                {oIdx === 0 ? "정답" : `오답 ${oIdx}`}
                                            </label>
                                            <input
                                                className={`w-full p-3 rounded-xl border font-bold text-sm outline-none transition-all ${oIdx === 0
                                                    ? "border-emerald-100 bg-emerald-50/30 focus:ring-2 focus:ring-emerald-200"
                                                    : "border-rose-100 bg-rose-50/30 focus:ring-2 focus:ring-rose-200"
                                                    }`}
                                                value={opt}
                                                onChange={(e) => updateOption(li, pi, part, oIdx, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">텍스트로 노출될 정답</label>
                                    <input
                                        className="w-full p-3 rounded-xl border border-slate-100 bg-slate-50/50 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100 text-slate-600"
                                        value={part.options?.[0] || ""}
                                        onChange={(e) => updateOption(li, pi, part, 0, e.target.value)}
                                    />
                                    <p className="text-[10px] text-slate-400 ml-1 font-medium">이 빈칸은 빌더에서 설정한 정답이 텍스트로 보이며 선택형 기능은 비활성화됩니다.</p>
                                </div>
                            )}
                        </div>
                    ))}


                    {blanks.length === 0 && (
                        <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                            <div className="text-slate-400 font-bold italic truncate">분석된 빈칸(blank) 데이터가 없습니다. 본문 텍스트에 □ 또는 _ 기호가 포함되어 있는지 확인하세요.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ensureTogetherSelf(data) {
    const together = data.together || {};
    const self = data.self || {};

    return {
        ...data,
        together: {
            numbers: Array.isArray(together.numbers) && together.numbers.length
                ? together.numbers
                : [{ value: 1, labelEnabled: false }, { value: 2, labelEnabled: false }, { value: 3, labelEnabled: false }]
        },
        self: {
            answers: Array.isArray(self.answers) && self.answers.length ? self.answers : ["", "", ""],
            explanation: self.explanation || ""
        }
    };
}

export function TogetherSelfEditor({ currentData, onChange, onClickLabelZip }) {
    const lines = Array.isArray(currentData?.lines) ? currentData.lines : [];
    const rawType = (currentData?.type || "").trim();

    const showTogetherTab =
        rawType === "together" ||
        rawType === "함께 풀기" ||
        rawType === "together.self";

    const showSelfTab =
        rawType === "self" ||
        rawType === "스스로 풀기" ||
        rawType === "together.self";

    const isThisPageSelf = showSelfTab && !showTogetherTab;

    const [activeTab, setActiveTab] = React.useState(
        showTogetherTab ? "together" : "self"
    );

    React.useEffect(() => {
        setActiveTab(showTogetherTab ? "together" : "self");
    }, [showTogetherTab, showSelfTab]);

    // blank 파트만 한 번에 모으기(순서 유지)
    const getBlanks = (targetLines) => {
        const blks = [];
        targetLines.forEach((line, li) => {
            (line.parts || []).forEach((part, pi) => {
                if (part?.type === "blank") blks.push({ li, pi, part });
            });
        });
        return blks;
    };

    const blanks = getBlanks(lines);

    // 편집 유틸
    const patchPart = (li, pi, nextPart) => {
        const nextLines = lines.map((l, idx) =>
            idx !== li ? l : { ...l, parts: (l.parts || []).map((p, j) => (j !== pi ? p : nextPart)) }
        );
        onChange({ ...currentData, lines: nextLines });
    };

    const getBlankAnswer = (part) => {
        const options = Array.isArray(part.options) ? part.options : [];
        const idx = (parseInt(part.correctIndex, 10) || 1) - 1;
        return options[idx] ?? "";
    };

    const setBlankAnswer = (li, pi, part, value) => {
        patchPart(li, pi, { ...part, options: [value], correctIndex: 1 });
    };

    const toggleLabel = (li, pi, part) => {
        patchPart(li, pi, { ...part, labelEnabled: !part.labelEnabled });
    };

    const toggleInput = (li, pi, part) => {
        patchPart(li, pi, { ...part, inputEnabled: part.inputEnabled === false ? true : false });
    };

    // 텍스트 소스 편집 (함께 풀기 전용)
    const fullText = lines.map(l => {
        return (l.parts || []).map(p => p.type === 'blank' ? '□' : p.content).join('');
    }).join('\n');

    const handleTextChange = (newText) => {
        // 기존 blanks 데이터 백업 (순서대로)
        const oldBlanks = blanks.map(b => ({ ...b.part }));

        let blankIdx = 0;
        const newLines = newText.split('\n').map((txt, idx) => {
            const parts = [];
            const segments = txt.split(/(□|_)/g);
            segments.forEach(seg => {
                if (seg === '□' || seg === '_') {
                    // 기존 데이터가 있으면 재사용, 없으면 초기값
                    const oldPart = oldBlanks[blankIdx];
                    parts.push({
                        type: 'blank',
                        options: oldPart ? [...oldPart.options] : [""],
                        correctIndex: oldPart ? oldPart.correctIndex : 1,
                        labelEnabled: oldPart ? oldPart.labelEnabled : (activeTab === 'together'),
                        isLabelTarget: true,
                        explanation: oldPart ? oldPart.explanation : ""
                    });
                    blankIdx++;
                } else if (seg) {
                    parts.push({ type: 'text', content: seg });
                }
            });
            return { label: `(${idx + 1})`, parts, labelEnabled: activeTab === 'together', isSelfLine: lines[idx]?.isSelfLine || isThisPageSelf };
        });
        onChange({ ...currentData, lines: newLines });
    };

    const insertLabel = () => {
        const textarea = document.getElementById('together-text-source');
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const before = text.substring(0, start);
        const after = text.substring(end);
        handleTextChange(before + "□" + after);
    };

    return (
        <div className="animate-in fade-in duration-500 space-y-6">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
                {showTogetherTab && (
                    <button
                        onClick={() => setActiveTab("together")}
                        className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === "together" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        함께 풀기(라벨형)
                    </button>
                )}

                {showSelfTab && (
                    <button
                        onClick={() => setActiveTab("self")}
                        className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === "self" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        스스로 풀기(입력형)
                    </button>
                )}
            </div>

            {/* Together Section */}
            {showTogetherTab && activeTab === "together" && (
                <div className="p-8 bg-amber-50/60 border border-amber-200 rounded-[2.5rem] space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs font-black uppercase tracking-widest text-amber-600">함께 풀기 설정</div>
                            <div className="text-sm font-bold text-slate-600 mt-1">제안된 라벨을 검토 후 onoff 여부를 설정해 주세요.</div>
                        </div>

                    </div>


                    <div className="space-y-3">
                        {blanks.map(({ li, pi, part }, idx) => (
                            <div key={`${li}-${pi}`} className="flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-amber-100 p-4 shadow-sm">
                                <div className="w-15 h-10 rounded-md bg-amber-500 text-white text-xs font-black flex items-center justify-center shadow-lg shadow-amber-100">
                                    라벨 {idx + 1}
                                </div>
                                <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                                    <div className="col-span-3">
                                        <input
                                            type="text"
                                            className="w-full p-3 rounded-xl border border-slate-200 font-bold focus:border-amber-400 outline-none transition-all"
                                            value={getBlankAnswer(part)}
                                            onChange={(e) => setBlankAnswer(li, pi, part, e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">라벨 노출</label>
                                        <button
                                            onClick={() => toggleLabel(li, pi, part)}
                                            className={`w-full py-3 rounded-xl font-black text-xs transition-all ${part.labelEnabled ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                                        >
                                            {part.labelEnabled ? "ON" : "OFF"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Self Section */}
            {showSelfTab && activeTab === "self" && (
                <div className="p-8 bg-indigo-50/60 border border-indigo-200 rounded-[2.5rem] space-y-6">
                    <div>
                        <div className="text-xs font-black uppercase tracking-widest text-indigo-600">스스로 풀기 설정</div>
                        <div className="text-sm font-bold text-slate-600 mt-1">빈칸별 정답을 수정할 수 있습니다. 입력칸 OFF를 누르면 입력칸을 삭제할 수 있습니다.</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {blanks.map(({ li, pi, part }, idx) => (
                            <div key={`self-${li}-${pi}`} className="bg-white rounded-2xl border border-indigo-100 p-5 shadow-sm space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">빈칸 {idx + 1}</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">입력칸</span>
                                        <button
                                            onClick={() => toggleInput(li, pi, part)}
                                            className={`px-3 py-1 rounded-lg font-black text-[10px] transition-all ${part.inputEnabled !== false ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                                        >
                                            {part.inputEnabled !== false ? "ON" : "OFF"}
                                        </button>
                                    </div>
                                </div>
                                <input
                                    className="w-full p-3 rounded-xl border border-slate-200 font-bold focus:border-indigo-400 outline-none transition-all"
                                    value={getBlankAnswer(part)}
                                    onChange={(e) => setBlankAnswer(li, pi, part, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>
                    {blanks.length === 0 && (
                        <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 font-bold">
                            함께 풀기 섹션에서 □ 기호를 추가하면 여기에 입력창이 나타납니다.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


export function QuestionImageEditor({ currentData, onChange }) {
    const handleUpdate = (field, value) => {
        onChange({ ...currentData, [field]: value });
    };

    return (
        <div className="space-y-8">
            <div className="p-8 bg-emerald-50/60 border border-emerald-200 rounded-[2.5rem] space-y-6">
                <div>
                    <div className="text-sm font-black uppercase tracking-widest text-emerald-600 mb-4">이미지형 문제 설정</div>
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-bold text-slate-400 uppercase mb-2 block tracking-widest ml-1">입력칸 앞 텍스트</label>
                                <input
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 ring-emerald-500/10 transition-all"
                                    value={currentData.prefixText || ""}
                                    onChange={(e) => handleUpdate("prefixText", e.target.value)}
                                    placeholder='예: 넓이 = '
                                />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-slate-400 uppercase mb-2 block tracking-widest ml-1">입력칸 뒤 텍스트</label>
                                <input
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 ring-emerald-500/10 transition-all"
                                    value={currentData.suffixText || ""}
                                    onChange={(e) => handleUpdate("suffixText", e.target.value)}
                                    placeholder='예: cm²'
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-slate-400 uppercase mb-2 block tracking-widest ml-1">정답</label>
                            <input
                                className="w-full p-4 bg-white border border-emerald-100 rounded-2xl text-lg font-bold text-emerald-700 outline-none focus:ring-4 ring-emerald-500/10 transition-all"
                                value={currentData.answer || ""}
                                onChange={(e) => handleUpdate("answer", e.target.value)}
                                placeholder="정답을 입력하세요 (예: 25\pi)"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-bold text-slate-400 uppercase mb-2 block tracking-widest ml-1">해설</label>
                            <textarea
                                className="w-full p-4 bg-white border border-emerald-100 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-4 ring-emerald-500/10 transition-all min-h-[120px]"
                                value={currentData.explanation || ""}
                                onChange={(e) => handleUpdate("explanation", e.target.value)}
                                placeholder="상세한 풀이 과정을 입력하세요."
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-8 bg-rose-50/40 border border-rose-100 rounded-[2.5rem] space-y-6">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-black uppercase tracking-widest text-rose-500">AI 삽화 탐지 정보</div>
                    <span className="text-[10px] font-bold text-rose-300">이 영역이 실제 문제 삽화를 포함해야 합니다.</span>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="text-sm font-bold text-slate-400 mb-2 block ml-1">이미지 좌표값</label>
                        <div className="flex gap-2">
                            {(currentData.figure_bounds || [0, 0, 0, 0]).map((val, idx) => (
                                <input
                                    key={idx}
                                    type="number"
                                    className="w-full p-2 bg-white border border-rose-100 rounded-xl text-center font-bold text-xs text-rose-600"
                                    value={val}
                                    onChange={(e) => {
                                        const next = [...(currentData.figure_bounds || [0, 0, 0, 0])];
                                        next[idx] = parseInt(e.target.value) || 0;
                                        handleUpdate("figure_bounds", next);
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-400 mb-2 block ml-1">삽화 대체텍스트</label>
                        <input
                            className="w-full p-2 bg-white border border-rose-100 rounded-xl font-medium text-xs text-slate-600 outline-none"
                            value={currentData.figure_alt || ""}
                            onChange={(e) => handleUpdate("figure_alt", e.target.value)}
                            placeholder="삽화에 대해 설명해주세요."
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
