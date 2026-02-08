
import createInputStrategy from "../../strategies/input_v1";

const config = {
    typeKey: "question.textinput",
    manifest: {
        // Uses default selectors mostly, but specifying them explicitly for clarity
        rowTemplate: ".flex-row.ai-s.jc-sb",
        label: ".a2 label",
        passage: ".a2 p",
        inputWrap: ".inp-wrap > div",
        solveBtn: ".btn-solve",
        explanationPopup: ".pop.solution"
    },
    strategy: {
        name: "input_v1",
        options: {
            inputKind: "text", // Treated as full-width text input
            hasImage: false
        }
    }
};

const textInputHandler = createInputStrategy(config);
export default textInputHandler;
