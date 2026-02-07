import { TYPE_KEYS } from "./typeKeys";

import questionSelect from "./handlers/question/select";
import questionMathinput from "./handlers/question/mathinput";
import togetherSelect from "./handlers/together/select";

const REGISTRY = {
  [TYPE_KEYS.QUESTION_SELECT]: questionSelect,
  [TYPE_KEYS.QUESTION_MATHINPUT]: questionMathinput,
  [TYPE_KEYS.TOGETHER_SELECT]: togetherSelect,
};

export function getHandler(typeKey) {
  const handler = REGISTRY[typeKey];
  if (!handler) {
    throw new Error(`No handler registered for typeKey: ${typeKey}`);
  }
  return handler;
}
