var dap_array = ["412", "408", ["\\frac{136}{33}","\\frac{408}{99}"], "412", "408"];//수식입력기 이용 latex 정답
var latexStr_array = dap_array;//common.js 에서 latexStr_array 를 참조해서 처리하고 있음
//A 수식입력 (여러개)
var chasi = "4";//차시별로 따로 지정해야 함
var qType_array = ["Q001"];//정오답형
var q_class = "selfquiz";//quiz 와 ssok 으로 구분 - 퀴즈 쏙 은 정답이 아니면 튕김
var char_no = 1;//캐릭터 번호 1:당근, 2토끼

var saveType = "ok";// "ok"(확인 - btn-ok 클래스) or "save"(저장하기 - btn-save 클래스)
//if (q_class == "ssok") saveType = "save";

var ans_array = [];
var latexStr = "";
var pgQId = "Q" + chasi + "_" + curActNum + "_" + pageNum;//curActNum과 pageNum 은 common 에 선언되어 있음
var qId_array = [pgQId];// 여러개의 아이디가 필요한 경우 pgQId+"_1",pgQId+"_2" 형식으로 붙임
var qId = qId_array[0];
var qType = qType_array[0];
var quiz_on = true;
var q_len = dap_array.length;
var i = 0;
var qCorrectType_bool = true;//quiz_input 타입과 quiz_correct 타입이 동시에 선언되어 있음을 체크

$(function () {
	//var dapStr = chglatexStr_fn(latexStr_array[0]);
	//viewMathJaxStr(dapStr,$(".correct"));

	BtnSet_fn();
	getQuizVal_fn(qId, qType, "getQData_fn");
	correctSet_fn(latexStr_array);//정답을 미리세팅 - correctSet_fn 은 common.js 에 선언

	// 처음에 빈칸을 표시하도록 설정
	/*if (isEmpty($(".QuizInput").html())) {
		viewMathJaxStr("", $(".QuizInput"));
	}*/
});

function BtnSet_fn() {
	$saveBtn = (saveType == "ok") ? $(".btn.btn-ok") : $(".btn.btn-save");//btn-save or btn-ok
	$(".correct").removeClass("show");
	$saveBtn.click(function () {//확인 버튼 클릭시
		var index = $(".saveBtn").index(this);
		if (!chkAnsAll_fn()) {
			$(".pop.feedback").removeClass("correct" + char_no + " incorrect" + char_no);
			$(".pop.feedback").addClass("blank" + char_no + " show");
			$("#feedbacktext").html("<strong>빈칸을</strong> 입력하세요.") // a11y
			return;
		}
		if (chkOxType_fn(q_class)) {
			if (isWrong_fn()) {//오답이 있는 경우
				$(".pop.feedback").removeClass("blank" + char_no);
				$(".pop.feedback").addClass("incorrect" + char_no + " show");
				$(".pop.feedback").data("index", index);
				(isEmpty($("#feedbacktext").attr("data-o"))) ? $(".pop #feedbacktext").html("<strong>오답</strong>입니다!") : $(".pop #feedbacktext").html($("#feedbacktext").attr("data-x"));
			} else {//정답인 경우
				$(".pop.feedback").removeClass("blank" + char_no);
				$(".pop.feedback").removeClass("incorrect" + char_no);
				$(".pop.feedback").addClass("correct" + char_no + " show");
				$(".pop.feedback").data("index", index);
				(isEmpty($("#feedbacktext").attr("data-o"))) ? $(".pop #feedbacktext").html("<strong>정답</strong>입니다!") : $(".pop #feedbacktext").html($("#feedbacktext").attr("data-o"));
				$(".inp-wrap input").addClass("correct");
                try {chkDap_fn();} catch (e) {}
			}
		}
		var ansStr = ans_array.join("|");
		saveQuiz_fn(qId, qType, latexStr_array.join("|"), ansStr);
		$(".btn.btn-retry").css("display", "block");
		$(".btn.btn-solve").css("display", "block");
		$(this).css("display", "none");
		$('.btn').addClass('reload');
		quiz_on = false;
		if(!chkOxType_fn(q_class)) chkDap_fn();
	})
	$(".btn.btn-retry").click(function () {
		retry_fn();
	})

	$('.btn-close').on('click', function () {
		$(this).closest('.pop').removeClass('show');
		$saveBtn.removeClass("on");
	});
}
function chkAnsAll_fn() {//모두 다 완료했는지 체크- 여기서는 체크한 게 있으면 true 값을 넘김
	var ansAll_bool = true;
	for (var i = 0; i < dap_array.length; i++) {
		if (isEmpty(ans_array[i])) {
			ansAll_bool = false;
		}
	}
	return ansAll_bool;
}
function isWrong_fn() {//정오답 체크
	var isWrong_bool = false;
	for (var i = 0; i < dap_array.length; i++) {
		if (!compareAnsDap(ans_array[i], dap_array[i])) {
			isWrong_bool = true;
		}
	}
	return isWrong_bool;
}
function chkDap_fn() {
	//$(".correct").addClass("show");
	for (var i = 0; i < q_len; i++) {
		if (compareAnsDap(ans_array[i], dap_array[i])) {//정답
			$("#QuizInput" + (i + 1)).css("color", o_color);
		} else {//오답
			$(".correct").eq(i).addClass("show");
		}
	}
	$(".btn-ocr").addClass("hidden");
	$(".btn-math").addClass("hidden");
}
function retry_fn() {
	$(".wrap").attr("tabindex", 0).focus(); ans_array = [];
	for (i = 1; i <= q_len; i++) {
		$("#QuizInput" + i).html("").css("color", "");;
	}
	$saveBtn.css("display", "block");
	$(".btn.btn-solve").css("display", "none");
	$(".btn.btn-retry").css("display", "none");
	$('.btn').addClass('reload');
	$(".correct").removeClass("show");
	$(".btn-ocr").removeClass("hidden");
	$(".btn-math").removeClass("hidden");
	quiz_on = true;
}
function delayHidePop() {
	setTimeout(function () {
		$(".pop.correct2").removeClass("show");
	}, 2500);
}
for (i = 1; i <= q_len; i++) {
	window['ExpRtn' + i] = function (data) { ExpRtn_fn(data); };
	window['OcrRtn' + i] = function (data) { OcrRtn_fn(data); };
}
function ExpRtn_fn(data) {//수식 입력기 입력 후 리턴 받는 함수
	//console.log(data.id);
	//alert("수식입력기:" + data.latex);
	var idx = Number(data.id.split("_")[1]);
	//latexStr = escapeLatexStr(data.latex); // LaTeX 문자열
	latexStr = chglatexStr_fn(data.latex);
	ans_array[idx - 1] = latexStr;
	viewMathJaxStr(latexStr, $("#QuizInput" + idx)); //common.js에 선언되어 있음
}
function OcrRtn_fn(data) {//Ocr 입력기 입력 후 리턴 받는 함수
	//console.log(data.id);
	//alert("Ocr입력기:" + data.resultText);
	var idx = Number(data.id.split("_")[2]);
	//latexStr = escapeLatexStr(data.resultText); // LaTeX 문자열
	latexStr = chglatexStr_fn(data.resultText);
	ans_array[idx - 1] = latexStr;
	viewMathJaxStr(latexStr, $("#QuizInput" + idx)); //common.js에 선언되어 있음
}
function getQData_fn(data) {//처음 페이지 진입시 데이타 받아오는 함수
	if (!isEmpty(data.input)) {
		var ans_arr = data.input.split("|");
		for (i = 0; i < ans_arr.length; i++) {
			//$("#QuizInput"+(i+1)).html(chgMathJax(ans_array[i]));
			viewMathJaxStr(ans_arr[i], $("#QuizInput" + (i + 1)))
		}
		ans_array = ans_arr;
		chkDap_fn();
		$(".btn.btn-solve").css("display", "block");
		$(".btn.btn-retry").css("display", "block");
		$saveBtn.css("display", "none");
	}
}