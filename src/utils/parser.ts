import { NextMove, States, TapeSymbols, Transition } from "@/types";

export default (content: string): Transition => {
  const [read, rest] = content.split("->");
  const [write, move, nextState] = rest.split(",");
  const transition: Transition = {
    readSymbol: read as TapeSymbols,
    writeSymbol: write as TapeSymbols,
    moveDirection: move as NextMove,
    nextState: nextState as States,
  };

  return transition;
};
