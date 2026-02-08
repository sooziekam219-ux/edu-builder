var dap_array = ["3𝑎(𝑎+4𝑏)", "3𝑎^2+12𝑎𝑏"];//수식입력기 이용 latex 정답
var latexStr_array = dap_array;//common.js 에서 latexStr_array 를 참조해서 처리하고 있음
//개념 설명
var chasi = "10";//차시별로 따로 지정해야 함
var qType_array = ["Q001"];//단답형
var q_class = "find";//quiz 와 ssok 으로 구분 - 퀴즈 쏙 은 정답이 아니면 튕김

var saveType = "ok";// "ok"(확인 - btn-ok 클래스) or "save"(저장하기 - btn-save 클래스)
if (q_class == "ssok") saveType = "save";

var ans_array = [];
var latexStr ="";
var pgQId = "Q" + chasi + "_" + curActNum + "_" + pageNum;//curActNum과 pageNum 은 common 에 선언되어 있음
var qId_array = [pgQId];// 여러개의 아이디가 필요한 경우 pgQId+"_1",pgQId+"_2" 형식으로 붙임
var qId = qId_array[0];
var qType = qType_array[0];
var quiz_on = true;
var q_len = dap_array.length;
var i = 0;
var qCorrectType_bool = true;//quiz_input 타입과 quiz_correct 타입이 동시에 선언되어 있음을 체크

$(function() {
    var dapStr = chglatexStr_fn(latexStr_array[0]);
    viewMathJaxStr(dapStr,$(".correct"));

    BtnSet_fn();
    getQuizVal_fn(qId,qType,"getQData_fn");

    // 처음에 빈칸을 표시하도록 설정
    if (isEmpty($("#QuizInput").html())) {
        viewMathJaxStr("", $("#QuizInput"));
    }
});

function BtnSet_fn(){
    $saveBtn = (saveType == "ok") ? $(".btn.btn-ok") : $(".btn.btn-save");

    $saveBtn.click(function(){
        if (chkOxType_fn(q_class)) {
            if (isEmpty($("#QuizInput").html())) {
                $(".pop.feedback").removeClass("correct1 incorrect1");
                $(".pop.feedback").addClass("blank1 show");
                $("#feedbacktext").text("빈칸을 입력해 주세요.") // a11y
                $saveBtn.addClass("on");
                $(".btn-ocr").focus(); // a11y
                return;
            }
            if (ans_array[0]!=dap_array[0]) {
                if (q_class == "quiz") {
                    $(".pop.feedback").removeClass("blank1");
                    $(".pop.feedback").addClass("incorrect1 show");
                    (isEmpty($("#feedbacktext").attr("data-o")))? $(".pop #feedbacktext").html("<strong>오답</strong>입니다!"):$(".pop #feedbacktext").html($("#feedbacktext").attr("data-x"));
                }
                $('.correct').addClass('show');
                $(".correct").focus(); // a11y
            } else {
                if (q_class == "quiz") {
                    $(".pop.feedback").removeClass("blank1");
                    $(".pop.feedback").removeClass("incorrect1");
                    $(".pop.feedback").addClass("correct1 show");
                    (isEmpty($("#feedbacktext").attr("data-o")))? $(".pop #feedbacktext").html("<strong>정답</strong>입니다!"):$(".pop #feedbacktext").html($("#feedbacktext").attr("data-o"));
                    $("#QuizInput").css("color",o_color);
                }
                $(".inp-wrap input").addClass("correct");
                viewMathJaxStr(dap_array[0], $("#QuizInput")); // 정답 표시
            }
        }
        saveQuiz_fn(qId,qType,latexStr_array[0],latexStr);
        $(".btn-ocr").addClass("hidden");
        $(".btn-math").addClass("hidden");
        $(".btn.btn-solve").css("display","block");
        $(".btn.btn-retry").css("display","block");
        $(this).css("display","none");
        $('.btn').addClass('reload');
    });

    $(".btn.btn-retry").click(function(){
        retry_fn();
    });

    $('.pop.feedback .btn-close').on('click', function(){
        $(this).parents('.pop').removeClass('show');
        $saveBtn.removeClass("on");
    });
}

function retry_fn() {
	$(".wrap").attr("tabindex", 0).focus();
    $("#QuizInput").html("");
	$saveBtn.css("display","block");
	$(".btn.btn-retry").css("display","none");
	$(".btn.btn-solve").css("display","none");
	$(".correct").removeClass("show");
	$('.btn').addClass('reload');
	$(".wrap").attr("tabindex", 0).focus(); // a11y
	$("#QuizInput").css("color","");
	$(".btn-ocr").removeClass("hidden");
	$(".btn-math").removeClass("hidden");
	ans_array = [];
}
function delayHidePop(){
	return;
	setTimeout(function() {
    	$(".pop.feedback").removeClass("show");
	}, 2500);
}

function ExpRtn1(data){//수식 입력기 입력 후 리턴 받는 함수
	//console.log(data.id);
	//alert("수식입력기:"+data.latex);
	//latexStr = escapeLatexStr(data.latex); // LaTeX 문자열
	latexStr = chglatexStr_fn(data.latex);
	ans_array[0]=latexStr;
   	viewMathJaxStr(latexStr,$("#QuizInput")); //common.js에 선언되어 있음
}
function OcrRtn1(data){//Ocr 입력기 입력 후 리턴 받는 함수
	//console.log(data.id);
	//alert("Ocr입력기:"+data.resultText);
	//latexStr = escapeLatexStr(data.resultText); // LaTeX 문자열
	latexStr = chglatexStr_fn(data.resultText);
	ans_array[0]=latexStr;
   	viewMathJaxStr(latexStr,$("#QuizInput")); //common.js에 선언되어 있음
}
function getQData_fn(data){//처음 페이지 진입시 데이타 받아오는 함수
	if(!isEmpty(data.input)){
		//$("#QuizInput").html(chgMathJax(data.input));
		viewMathJaxStr(data.input,$("#QuizInput"))
		$(".btn.btn-solve").css("display","block");
        $(".btn.btn-retry").css("display","block");
        $saveBtn.css("display","none");
        if(data.answer==data.input){//기존에 정답을 입력한 경우
        	$("#QuizInput").css("color",o_color);
        }else{
        	$(".correct").addClass("show");
        }
        $(".btn-ocr").addClass("hidden");
        $(".btn-math").addClass("hidden");
	}
}