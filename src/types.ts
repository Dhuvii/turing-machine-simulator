import { TLArrowShapeProps, TLBaseShape, TLGeoShapeProps } from "tldraw";

export type TLGeoShape = TLBaseShape<"geo", TLGeoShapeProps>;
export type TLArrowShape = TLBaseShape<"arrow", TLArrowShapeProps>;

type LowercaseLetter =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type SpecialCharacter = "_";

export type TapeSymbols = LowercaseLetter | Digit | SpecialCharacter;

export type States = `Q${number}`;

export type StateType =
  | "INITIAL"
  | "ACCEPT"
  | "REJECT"
  | "INTERMEDIATE"
  | "FINAL";

export type NextMove = "L" | "R";

export interface IMachineState {
  name: States;
  stateType: StateType;
  transitions: Transition[];
}

export type Transition = {
  readSymbol: TapeSymbols;
  writeSymbol: TapeSymbols;
  moveDirection: NextMove;
  nextState: States;
};

export type TuringResult = {
  tape: TapeSymbols[];
  output: StateType;
  transition: string | null;
  previousStateIndex: number | null;
  previousState: `Q${number}` | null;
  currentState: `Q${number}`;
  currentStateIndex: number;
  nextState: `Q${number}` | null;
  nextStateIndex: number | null;
  readHeadPosition: number;
};

export type TestCase = {
  tape: string;
  output: StateType | undefined;
};
