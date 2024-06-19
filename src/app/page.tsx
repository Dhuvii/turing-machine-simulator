"use client";
import { TuringMachine } from "@/TuringMachine";
import { Button } from "@/components/Button";
import {
  IMachineState,
  NextMove,
  StateType,
  States,
  TLArrowShape,
  TLGeoShape,
  TapeSymbols,
  TestCase,
  Transition,
  TuringResult,
} from "@/types";
import orderStatesByName from "@/utils/orderStateByName";
import parser from "@/utils/parser";
import { useEffect, useRef, useState } from "react";
import {
  Editor,
  TLArrowBinding,
  TLShapeId,
  Tldraw,
  loadSnapshot,
} from "tldraw";

import Splash from "../../public/splash.png";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

let editor: Editor | null = null;
const turing = new TuringMachine();

export default function Home() {
  const [tape, setTape] = useState<TapeSymbols[]>([]);
  const [tapeInput, setTapeInput] = useState<string>("");
  const [readHead, setReadHead] = useState(0);
  const [currentStatus, setCurrentStatus] = useState<{
    currentlyReading: TapeSymbols | null;
    replaceWith: TapeSymbols | null;
    status: StateType | null;
    nextMove: "Left" | "Right" | null;
  }>({
    currentlyReading: null,
    replaceWith: null,
    status: null,
    nextMove: null,
  });

  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [speed, setSpeed] = useState(1000);

  const [testCases, setTestCases] = useState<TestCase[]>([]);

  const runTestCase = (testCase: TestCase) => {
    if (editor) {
      const t = new TuringMachine();
      const { configs } = generateTuringConfiguration(editor);
      t.configureTape(testCase.tape);
      t.configureMachine(configs);

      let stop = false;
      try {
        while (!stop) {
          const output = t.evaluate();
          if (output) {
            break;
          }
        }
        return t.getTuringResult();
      } catch (error) {
        stop = true;
        return t.getTuringResult();
      }
    }
  };

  const getStateType = (id: TLShapeId) => {
    const state = editor?.getShape(id)! as TLGeoShape;
    const type = state.props.text.split("-")[1]?.toLowerCase();
    let stateType: StateType = "INTERMEDIATE";

    if (type) {
      if (type === "i") {
        stateType = "INITIAL";
      }
      if (type === "a") {
        stateType = "ACCEPT";
      }
      if (type === "r") {
        stateType = "REJECT";
      }
      if (type === "f") {
        stateType = "FINAL";
      }
    }

    return stateType;
  };

  const generateTuringConfiguration = (editor: Editor) => {
    const allShapes = editor
      .getCurrentPageShapesSorted()
      .filter((shape) => shape.type === "geo" || shape.type === "arrow");
    let configuration: IMachineState[] = [];
    const states: Record<string, TLShapeId> = {};
    const transitionStates: Record<
      string,
      { type: StateType; transition: string[] }
    > = {};

    allShapes.map((shape) => {
      if (shape.type === "geo") {
        const s = shape as TLGeoShape;
        if (s.props.geo === "ellipse" && s.props.text) {
          states[s.props.text.split("-")[0]] = s.id;
        }
      }
    });

    allShapes.map((shape) => {
      if (shape.type === "arrow") {
        const s = shape as TLArrowShape;

        const [from, to] = editor?.getBindingsInvolvingShape(
          s.id,
        ) as TLArrowBinding[];

        let fromId: TLShapeId | null = null;
        let toId: TLShapeId | null = null;

        if (from && from.props.terminal === "start") {
          fromId = from.toId;
        }

        if (from && from.props.terminal === "end") {
          toId = from.toId;
        }

        if (to && to.props.terminal === "start") {
          fromId = to.toId;
        }

        if (to && to.props.terminal === "end") {
          toId = to.toId;
        }

        if (!fromId || !toId) {
          console.log("Some arrows are not connected, please check!");
          return;
        }

        const fromShape = editor?.getShape(fromId!)! as TLGeoShape;
        const toShape = editor?.getShape(toId!)! as TLGeoShape;

        const rule = s.props.text;
        let fromState: States = "Q1";
        let toState: States = "Q1";

        Object.entries(states).map(([key, val]) => {
          if (val === fromShape.id) {
            fromState = key as States;
          }
          if (val === toShape.id) {
            toState = key as States;
          }
        });

        rule.split("\n").forEach((r) => {
          const content = (r += `,${toState}`).replace(/\s+/g, "");
          if (fromState in transitionStates) {
            transitionStates[fromState].transition.push(content);
          } else {
            transitionStates[fromState] = {
              type: getStateType(states[fromState]),
              transition: [content],
            };
          }
        });
      }
    });

    Object.entries(states).map(([state, id]) => {
      if (!(state in transitionStates)) {
        transitionStates[state] = {
          type: getStateType(id),
          transition: [],
        };
      }
    });

    Object.entries(transitionStates).map(([key, value]) => {
      const transitions: Transition[] = [];
      value.transition.forEach((t) => {
        transitions.push(parser(t));
      });

      configuration.push({
        name: key as States,
        stateType: value.type,
        transitions,
      });
    });

    return {
      configs: orderStatesByName(configuration),
      states: states,
      transitionStates: transitionStates,
    };
  };

  const animateState = (
    editor: Editor,
    result: TuringResult,
    states: Record<string, TLShapeId>,
  ) => {
    const currentStateId = states[result.currentState];
    const nextStateId = result.nextState ? states[result.nextState] : null;
    const previousStateId = result.previousState
      ? states[result.previousState]
      : null;

    if (previousStateId) {
      editor.updateShape<TLGeoShape>({
        id: previousStateId,
        type: "geo",
        props: {
          fill: "none",
          color: "white",
        },
      });
    }

    editor.updateShape<TLGeoShape>({
      id: currentStateId,
      type: "geo",
      props: {
        fill: "solid",
        color: "orange",
      },
    });

    if (nextStateId) {
      const bindingsOfCurrentState =
        editor.getBindingsInvolvingShape<TLArrowBinding>(currentStateId);

      const bindingsOfNextState =
        editor.getBindingsInvolvingShape<TLArrowBinding>(nextStateId);

      const bindingsThatExtendFromCurrentState = bindingsOfCurrentState.filter(
        (bind) => bind.props.terminal === "start",
      );

      const bindingsThatAreConnectedToNextState = bindingsOfNextState.filter(
        (bind) => bind.props.terminal === "end",
      );

      let currentArrowShapeId: TLShapeId | null = null;
      //both the from ids should match
      bindingsThatExtendFromCurrentState.forEach((bind) => {
        bindingsThatAreConnectedToNextState.forEach((nextBind) => {
          if (bind.fromId === nextBind.fromId) {
            currentArrowShapeId = bind.fromId;
          }
        });
      });

      const allArrows = editor
        .getCurrentPageShapesSorted()
        .filter((shape) => shape.type === "arrow");

      editor.updateShapes<TLArrowShape>(
        allArrows.map((shape) => ({
          ...shape,
          type: "arrow",
          props: {
            size: "m",
            color: "white",
          },
        })),
      );

      if (currentArrowShapeId) {
        editor.updateShape<TLArrowShape>({
          id: currentArrowShapeId,
          type: "arrow",
          props: {
            size: "l",
            color: "yellow",
          },
        });
      }
    }

    if (result.output === "ACCEPT") {
      editor.updateShape<TLGeoShape>({
        id: currentStateId,
        type: "geo",
        props: {
          color: "green",
          fill: "solid",
        },
      });
    }

    if (result.output === "REJECT") {
      editor.updateShape<TLGeoShape>({
        id: currentStateId,
        type: "geo",
        props: {
          color: "red",
          fill: "solid",
        },
      });
    }
  };

  const resetShape = (editor: Editor) => {
    const allShapes = editor
      .getCurrentPageShapesSorted()
      .filter((shape) => shape.type === "geo" || shape.type === "arrow");

    editor.updateShapes(
      allShapes.map((shape) => ({
        ...shape,
        props: {
          fill: "none",
          color: "white",
          size: "m",
        },
      })),
    );
  };

  const backward = (editor: Editor) => {
    try {
      if (isRunning) {
        pauseLoop();
      }

      const { configs, states } = generateTuringConfiguration(editor);

      resetShape(editor);
      turing.configureMachine(configs);
      turing.resetMachine();

      const result = turing.backward();

      setReadHead(result.readHeadPosition);
      animateState(editor, result, states);
      setTape(() => result.tape);

      if (result) {
        setCurrentStatus(() => ({
          currentlyReading:
            (result?.transition?.split("->")[0] as TapeSymbols) || null,
          replaceWith:
            (result?.transition?.split("->")[1]?.split("")[0] as TapeSymbols) ||
            null,
          status: result.output,
          nextMove: result.transition
            ? result?.transition?.includes("L")
              ? "Left"
              : "Right"
            : null,
        }));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const play = async (editor: Editor) => {
    try {
      const { configs, states } = generateTuringConfiguration(editor);

      resetShape(editor);
      turing.configureMachine(configs);
      turing.resetMachine();

      const result = turing.play();

      setReadHead(result.readHeadPosition);
      animateState(editor, result, states);
      setTape(() => result.tape);
      if (result) {
        setCurrentStatus(() => ({
          currentlyReading:
            (result?.transition?.split("->")[0] as TapeSymbols) || null,
          replaceWith:
            (result?.transition?.split("->")[1]?.split("")[0] as TapeSymbols) ||
            null,
          status: result.output,
          nextMove: result.transition
            ? result?.transition?.includes("L")
              ? "Left"
              : "Right"
            : null,
        }));
      }

      if (["ACCEPT", "REJECT", "FINAL"].includes(result.output)) {
        stopLoop();
      }
    } catch (error) {
      stopLoop();
      console.error(error);
    }
  };

  const forward = (editor: Editor) => {
    try {
      if (isRunning) {
        pauseLoop();
      }

      const { configs, states } = generateTuringConfiguration(editor);

      resetShape(editor);
      turing.configureMachine(configs);
      turing.resetMachine();

      const result = turing.forward();

      setReadHead(result.readHeadPosition);
      animateState(editor, result, states);
      setTape(() => result.tape);
      if (result) {
        setCurrentStatus(() => ({
          currentlyReading:
            (result?.transition?.split("->")[0] as TapeSymbols) || null,
          replaceWith:
            (result?.transition?.split("->")[1]?.split("")[0] as TapeSymbols) ||
            null,
          status: result.output,
          nextMove: result.transition
            ? result?.transition?.includes("L")
              ? "Left"
              : "Right"
            : null,
        }));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const reset = (editor: Editor) => {
    setReadHead(0);
    stopLoop();

    resetShape(editor);

    turing.resetStepCounter();
    turing.resetPreviousTuringResult();
    turing.resetMachine();

    const { configs, states } = generateTuringConfiguration(editor);
    turing.configureTape(tapeInput.replaceAll("_", ""));
    turing.configureMachine(configs);
    const result = turing.getTuringResult();
    animateState(editor, result, states);

    if (result) {
      setCurrentStatus(() => ({
        currentlyReading:
          (result?.transition?.split("->")[0] as TapeSymbols) || null,
        replaceWith:
          (result?.transition?.split("->")[1]?.split("")[0] as TapeSymbols) ||
          null,
        status: result.output,
        nextMove: result.transition
          ? result?.transition?.includes("L")
            ? "Left"
            : "Right"
          : null,
      }));
    }
  };

  useEffect(() => {
    if (isRunning && !isPaused && editor) {
      intervalRef.current = setInterval(() => {
        play(editor!);
      }, speed);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused, speed]);

  const startLoop = () => {
    setIsRunning(true);
    setIsPaused(false);
  };

  const pauseLoop = () => {
    setIsPaused(true);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const resumeLoop = () => {
    setIsPaused(false);
  };

  const stopLoop = () => {
    setIsRunning(false);
    setIsPaused(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const [showSplash, setShowSplash] = useState(true);

  return (
    <main className="relative flex h-dvh w-full items-start justify-between gap-1 overflow-hidden">
      {/* splash screen */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            className="absolute inset-0 z-[99999] flex w-full flex-col items-center justify-center bg-gradient-to-b from-[var(--bg)] to-[#232323]"
          >
            <div className="flex flex-col items-center justify-start">
              <div className="flex items-center justify-start gap-3 text-4xl font-medium uppercase tracking-wider text-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-9"
                  viewBox="0 0 14 14"
                >
                  <path
                    fill="currentColor"
                    fillRule="evenodd"
                    d="M8.294 1.125h2.364c.374 0 .676.27.676.602v5.984H2.646l-.097.001V1.727c0-.333.302-.602.676-.602H5.59v3.014c0 .08.036.156.1.213a.36.36 0 00.238.088h2.028a.36.36 0 00.239-.088.286.286 0 00.099-.213zM2.646 8.96h8.708a2.448 2.448 0 010 4.895H2.646a2.448 2.448 0 110-4.895m1.761 2.44a.875.875 0 11-1.75 0 .875.875 0 011.75 0m3.473 0a.875.875 0 11-1.75 0 .875.875 0 011.75 0m2.597.874a.875.875 0 100-1.75.875.875 0 000 1.75"
                    clipRule="evenodd"
                  />
                </svg>

                <p>TMS</p>
              </div>

              <p className="mt-2 text-center text-xs text-white/80">
                Turing machine simulator
              </p>
              <p className="mt-2 text-center text-[0.6rem] text-white/70">
                Loading...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* splash screen */}

      <div className="relative flex h-[50dvh] w-full flex-col overflow-hidden border-r-2 border-white/10 bg-[var(--bg)] md:h-full md:w-2/5">
        <div className="flex h-full flex-1 flex-col overflow-y-auto p-5">
          <div className="flex w-full items-end justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-medium text-white">
                Turing Simulator
              </h1>
              <p className="mt-1 text-xs/5 text-white/70">
                Interactive Turing Machine Simulator for University Learning
              </p>
            </div>

            <div>
              <input
                type="file"
                id="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files![0];
                  if (file && editor) {
                    const reader = new FileReader();

                    reader.onload = function (e) {
                      try {
                        const result = e.target?.result as string;
                        const jsonData = JSON.parse(result);
                        loadSnapshot(editor!.store, jsonData);
                        reset(editor!);
                      } catch (error) {
                        console.error(
                          "Error reading or parsing JSON file:",
                          error,
                        );
                      }
                    };

                    reader.readAsText(file);
                  }
                }}
              />

              <Button
                onClick={() => {
                  if (editor) {
                    document.getElementById("file")?.click();
                  }
                }}
                variant={"secondary"}
                className="hidden p-3 md:p-3"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-5"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12"
                    opacity={0.5}
                  />
                  <path
                    fill="currentColor"
                    d="M12.75 7a.75.75 0 00-1.5 0v5.19l-1.72-1.72a.75.75 0 00-1.06 1.06l3 3a.75.75 0 001.06 0l3-3a.75.75 0 10-1.06-1.06l-1.72 1.72zM8 16.25a.75.75 0 000 1.5h8a.75.75 0 000-1.5z"
                  />
                </svg>
              </Button>
            </div>
          </div>

          <div className="mt-5 flex w-full flex-col items-center justify-start gap-5 xl:flex-row">
            <input
              id="tape"
              autoComplete="off"
              placeholder="0001110"
              value={tapeInput.replaceAll("_", "")}
              onChange={(e) => {
                if (editor) {
                  const value = e.target.value
                    .replaceAll("_", "")
                    .trim()
                    .split("") as TapeSymbols[];

                  setTapeInput(() => e.target.value.replaceAll("_", "").trim());

                  setTape([...value, "_"]);
                  turing.configureTape(value.join(""));

                  turing.resetMachine();
                  const { configs, states } =
                    generateTuringConfiguration(editor);
                  turing.configureMachine(configs);
                  const result = turing.getTuringResult();
                  animateState(editor, result, states);

                  if (result) {
                    setCurrentStatus(() => ({
                      currentlyReading:
                        (result?.transition?.split("->")[0] as TapeSymbols) ||
                        null,
                      replaceWith:
                        (result?.transition
                          ?.split("->")[1]
                          ?.split("")[0] as TapeSymbols) || null,
                      status: result.output,
                      nextMove: result.transition
                        ? result?.transition?.includes("L")
                          ? "Left"
                          : "Right"
                        : null,
                    }));
                  }
                }
              }}
              className="w-full flex-1 flex-shrink-0 rounded-xl border border-white/10 bg-transparent px-3 py-2.5 font-mono text-white placeholder-white/20 focus:outline-none focus:ring-[1px] focus:ring-[var(--primary)] focus:ring-offset-1 focus:ring-offset-transparent"
            />

            <div className="flex w-full items-center justify-start gap-5 xl:w-auto">
              <Button
                onClick={() => {
                  if (editor) {
                    backward(editor);
                  }
                }}
                variant={"unstyled"}
                className="bg-white/30 p-3 text-white hover:bg-white/40 focus:ring-white/40 data-[pressed]:bg-white/40 md:p-3"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-5"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 7h11a5 5 0 010 10M4 7l3-3M4 7l3 3m1 7h3"
                  />
                </svg>
              </Button>

              {!isRunning && !isPaused && (
                <Button
                  onClick={async () => {
                    if (editor) {
                      startLoop();
                    }
                  }}
                  variant={"secondary"}
                  className="p-3 md:p-3"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth={1.5}
                      d="M3 12v6.967c0 2.31 2.534 3.769 4.597 2.648l3.203-1.742M3 8V5.033c0-2.31 2.534-3.769 4.597-2.648l12.812 6.968a2.998 2.998 0 010 5.294l-6.406 3.484"
                    />
                  </svg>
                </Button>
              )}

              {isRunning && !isPaused && (
                <Button
                  onClick={async () => {
                    if (editor) {
                      pauseLoop();
                    }
                  }}
                  className="bg-amber-600 p-3 hover:bg-amber-500 focus:ring-amber-500 data-[pressed]:bg-amber-500 md:p-3"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth={1.5}
                      d="M2 18c0 1.886 0 2.828.586 3.414C3.172 22 4.114 22 6 22c1.886 0 2.828 0 3.414-.586C10 20.828 10 19.886 10 18V6c0-1.886 0-2.828-.586-3.414C8.828 2 7.886 2 6 2c-1.886 0-2.828 0-3.414.586C2 3.172 2 4.114 2 6v8m20-8c0-1.886 0-2.828-.586-3.414C20.828 2 19.886 2 18 2c-1.886 0-2.828 0-3.414.586C14 3.172 14 4.114 14 6v12c0 1.886 0 2.828.586 3.414C15.172 22 16.114 22 18 22c1.886 0 2.828 0 3.414-.586C22 20.828 22 19.886 22 18v-8"
                    />
                  </svg>
                </Button>
              )}

              {isPaused && (
                <Button
                  onClick={async () => {
                    if (editor) {
                      resumeLoop();
                    }
                  }}
                  variant={"secondary"}
                  className="p-3 md:p-3"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth={1.5}
                      d="M3 12v6.967c0 2.31 2.534 3.769 4.597 2.648l3.203-1.742M3 8V5.033c0-2.31 2.534-3.769 4.597-2.648l12.812 6.968a2.998 2.998 0 010 5.294l-6.406 3.484"
                    />
                  </svg>
                </Button>
              )}

              <Button
                onClick={() => {
                  if (editor) {
                    forward(editor);
                  }
                }}
                variant={"unstyled"}
                className="bg-white/30 p-3 text-white hover:bg-white/40 focus:ring-white/40 data-[pressed]:bg-white/40 md:p-3"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-5"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 7H9a5 5 0 000 10M20 7l-3-3m3 3l-3 3m-1 7h-3"
                  />
                </svg>
              </Button>

              <Button
                onClick={() => {
                  if (editor) {
                    reset(editor);
                  }
                }}
                className="p-3 md:p-3"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-5"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    d="M3.68 11.333h-.75zm0 1.667l-.528.532a.75.75 0 001.056 0zm2.208-1.134A.75.75 0 104.83 10.8zM2.528 10.8a.75.75 0 00-1.056 1.065zm16.088-3.408a.75.75 0 101.277-.786zm-1.723-3.785a.75.75 0 10-.786 1.277zm-4.43.151a.75.75 0 00.074-1.498zM12.08 2.25c-5.047 0-9.15 4.061-9.15 9.083h1.5c0-4.182 3.42-7.583 7.65-7.583zm-9.15 9.083V13h1.5v-1.667zm1.28 2.2l1.679-1.667L4.83 10.8l-1.68 1.667zm0-1.065L2.528 10.8l-1.057 1.065 1.68 1.666zm15.684-5.86a9.159 9.159 0 00-3-3l-.786 1.277a7.66 7.66 0 012.509 2.508zM12.537 2.26a9.36 9.36 0 00-.458-.011v1.5c.129 0 .257.003.384.01zM11.883 21v.75zm8.43-8.333h.75zm0-1.667l.528-.533a.75.75 0 00-1.055 0zM18.1 12.133a.75.75 0 101.055 1.067zm3.373 1.067a.75.75 0 101.054-1.067zM5.318 16.606a.75.75 0 10-1.277.788zm6.215 3.636a.75.75 0 00-.066 1.499zm-4.42.188a.75.75 0 00.774-1.285zm4.77 1.32c5.062 0 9.18-4.058 9.18-9.083h-1.5c0 4.18-3.43 7.583-7.68 7.583zm9.18-9.083V11h-1.5v1.667zm-1.277-2.2L18.1 12.133l1.055 1.067 1.686-1.667zm0 1.066l1.687 1.667 1.054-1.067-1.686-1.666zm-8.32 10.208c.139.006.277.009.417.009v-1.5a8.1 8.1 0 01-.35-.008zm-7.425-4.347a9.177 9.177 0 003.072 3.036l.774-1.285a7.676 7.676 0 01-2.57-2.539z"
                  />
                </svg>
              </Button>
            </div>
          </div>

          {tape && tapeInput && (
            <div className="mt-5 rounded-xl bg-white/5 p-3">
              <div
                className={`flex w-min items-center justify-start gap-2 rounded-md px-2 py-1 ${currentStatus.status === "INITIAL" || currentStatus.status === "INTERMEDIATE" ? "bg-yellow-600/10 text-yellow-600" : currentStatus.status === "ACCEPT" ? "bg-green-600/10 text-green-600" : currentStatus.status === "REJECT" ? "bg-red-600/10 text-red-600" : "bg-gray-600/10 text-gray-600"}`}
              >
                <div className="relative size-2">
                  <div
                    className={`absolute inset-0 size-full animate-ping rounded-full ${currentStatus.status === "INITIAL" || currentStatus.status === "INTERMEDIATE" ? "bg-yellow-500" : currentStatus.status === "ACCEPT" ? "bg-green-500" : currentStatus.status === "REJECT" ? "bg-red-500" : "bg-gray-500"}`}
                  ></div>
                  <div
                    className={`asolute inset-0 z-10 size-full rounded-full ${currentStatus.status === "INITIAL" || currentStatus.status === "INTERMEDIATE" ? "bg-yellow-500" : currentStatus.status === "ACCEPT" ? "bg-green-500" : currentStatus.status === "REJECT" ? "bg-red-500" : "bg-gray-500"}`}
                  ></div>
                </div>

                <p className="mt-px text-[0.6rem] font-medium uppercase leading-none tracking-wide">
                  {currentStatus.status === "ACCEPT"
                    ? "Accepted"
                    : currentStatus.status === "REJECT"
                      ? "Rejected"
                      : "Running"}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-start justify-start">
                {tape.map((l: string, idx) => (
                  <div
                    key={idx}
                    className={`${idx === readHead ? "bg-green-400/20" : "bg-transparent"} flex size-10 items-center justify-center rounded-md border border-white/15 font-mono text-sm text-white transition-all duration-200 ease-in-out`}
                  >
                    {l}
                  </div>
                ))}
              </div>

              {currentStatus.currentlyReading && currentStatus.replaceWith && (
                <div className="mb-1 mt-5 text-[0.65rem] leading-none text-white/90">
                  Currently reading{" "}
                  <span className="rounded-md bg-white/10 p-1 px-2 font-mono">
                    {currentStatus.currentlyReading}
                  </span>{" "}
                  will be replaced with{" "}
                  <span className="rounded-md bg-white/10 p-1 px-2 font-mono">
                    {currentStatus.replaceWith}
                  </span>
                  {currentStatus.nextMove && (
                    <>
                      <span> and moves to</span>{" "}
                      <span className="rounded-md bg-white/10 p-1 px-2 font-mono">
                        {currentStatus.nextMove}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-1">
            <div className="sticky -top-5 z-[999] flex items-end justify-between gap-5 bg-[var(--bg)] py-5">
              <div className="">
                <div className="flex items-end justify-start gap-3">
                  <h3 className="text-xl font-medium text-white">Test cases</h3>
                  {testCases.length > 1 && (
                    <Button
                      onClick={() => {
                        let output: TestCase[] = [];

                        testCases.forEach((test) => {
                          if (test.tape.length > 0) {
                            const result = runTestCase(test);
                            output.push({
                              tape: test.tape,
                              output: result?.output || "REJECT",
                            });
                          } else {
                            output.push(test);
                          }
                        });

                        setTestCases(() => output);
                      }}
                      variant={"ghost"}
                      wrapperClass="w-max"
                      className={"text-skin-primary hover:text-skin-primary/70"}
                    >
                      Run all tests
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-xs/5 text-white/70">
                  You can add multiple test cases to see how your machine
                  performs.
                </p>
              </div>

              <Button
                wrapperClass="w-max flex-shrink-0"
                onClick={() => {
                  setTestCases((pv) => [
                    ...pv,
                    { tape: "", output: undefined },
                  ]);
                }}
                className="p-3 md:p-3"
              >
                Add test case
              </Button>
            </div>

            {testCases && (
              <div className="w-full space-y-5">
                {testCases.map((testCase, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl p-3 ${testCase.output === "ACCEPT" ? "bg-green-600/10" : testCase.output === "REJECT" ? "bg-red-600/10" : "bg-white/5"} `}
                  >
                    <div className="mb-2 flex h-6 w-full items-center justify-between gap-5">
                      <label
                        className="block text-xs/none font-medium text-white"
                        htmlFor={`tape-${idx}`}
                      >
                        # {idx + 1} Test
                      </label>

                      {testCase.output && (
                        <div
                          className={`flex w-min items-center justify-start gap-2 rounded-md px-2 py-1 shadow-lg ${testCase.output === "INITIAL" || testCase.output === "INTERMEDIATE" ? "bg-yellow-600/10 text-yellow-600" : testCase.output === "ACCEPT" ? "bg-green-600/10 text-green-600" : testCase.output === "REJECT" ? "bg-red-600/10 text-red-600" : "bg-gray-600/10 text-gray-600"}`}
                        >
                          <div className="relative size-2">
                            <div
                              className={`absolute inset-0 size-full animate-ping rounded-full ${testCase.output === "INITIAL" || testCase.output === "INTERMEDIATE" ? "bg-yellow-500" : testCase.output === "ACCEPT" ? "bg-green-500" : testCase.output === "REJECT" ? "bg-red-500" : "bg-gray-500"}`}
                            ></div>
                            <div
                              className={`asolute inset-0 z-10 size-full rounded-full ${testCase.output === "INITIAL" || testCase.output === "INTERMEDIATE" ? "bg-yellow-500" : testCase.output === "ACCEPT" ? "bg-green-500" : testCase.output === "REJECT" ? "bg-red-500" : "bg-gray-500"}`}
                            ></div>
                          </div>

                          <p className="mt-px text-[0.6rem] font-medium uppercase leading-none tracking-wide">
                            {testCase.output === "ACCEPT"
                              ? "Accepted"
                              : testCase.output === "REJECT"
                                ? "Rejected"
                                : "Running"}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-5">
                      <div className="relative w-full">
                        <input
                          id={`tape-${idx}`}
                          autoComplete="off"
                          placeholder="0001110"
                          value={testCase.tape.replaceAll("_", "")}
                          onChange={(e) => {
                            if (editor) {
                              const value = e.target.value
                                .replaceAll("_", "")
                                .trim()
                                .split("") as TapeSymbols[];

                              const tape = e.target.value
                                .replaceAll("_", "")
                                .trim();

                              setTestCases((pv) => {
                                const caseToBeUpdated = [...pv];
                                caseToBeUpdated[idx] = {
                                  tape,
                                  output: undefined,
                                };
                                return caseToBeUpdated;
                              });
                            }
                          }}
                          className="w-full flex-1 flex-shrink-0 rounded-xl border border-white/10 bg-transparent px-3 py-2.5 font-mono text-white placeholder-white/20 focus:outline-none focus:ring-[1px] focus:ring-[var(--primary)] focus:ring-offset-1 focus:ring-offset-transparent"
                        />

                        <Button
                          onClick={() => {
                            setTestCases((pv) =>
                              pv.filter((c, index) => index !== idx),
                            );
                          }}
                          variant={"ghost"}
                          wrapperClass="w-max absolute right-0 -top-8"
                          className={
                            "text-skin-secondary hover:text-skin-secondary/70"
                          }
                        >
                          Delete
                        </Button>
                      </div>

                      <Button
                        disabled={!testCase.tape}
                        variant={"secondary"}
                        className={
                          "flex items-center justify-start gap-2 bg-rose-800 p-3 text-white hover:bg-rose-700 focus:ring-rose-800 disabled:bg-rose-800/15 disabled:text-white/15 data-[pressed]:bg-rose-700 md:p-3"
                        }
                        onClick={() => {
                          const result = runTestCase(testCase);
                          setTestCases((pv) => {
                            const caseToBeUpdated = [...pv];
                            caseToBeUpdated[idx] = {
                              ...testCase,
                              output: result?.output
                                ? ["ACCEPT", "REJECT"].includes(result?.output)
                                  ? result?.output
                                  : "REJECT"
                                : "REJECT",
                            };
                            return caseToBeUpdated;
                          });
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="size-5"
                          viewBox="0 0 24 24"
                        >
                          <path
                            fill="currentColor"
                            d="M14.87 2.224a.76.76 0 10-1.078 1.072l.694.697-6.95 6.98.69.076a2.995 2.995 0 012.642 2.65c.058.53.395.985.878 1.195l1.967.816 6.22-6.246.768.772a.76.76 0 001.078-1.072zM4.128 14.396l2.038-2.047 1.892.211a1.475 1.475 0 011.299 1.306c.118 1.073.802 2 1.792 2.426l1.405.583-2.98 2.992a3.84 3.84 0 01-5.446 0 3.88 3.88 0 010-5.471"
                          />
                        </svg>
                        <span>Run</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(!testCases || testCases.length <= 0) && (
            <div className="flex h-full w-full flex-1 items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-full max-w-[15rem] text-white/5"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M20 17c1.105 0 2-.933 2-2.083 0-.72-.783-1.68-1.37-2.3a.862.862 0 00-1.26 0c-.587.62-1.37 1.58-1.37 2.3 0 1.15.895 2.083 2 2.083m-3.722-6.432l1.505-2.598-8.41-4.826L2.65 14.746a4.827 4.827 0 001.776 6.606 4.862 4.862 0 006.629-1.77l1.12-1.932z"
                  opacity={0.5}
                />
                <path
                  fill="currentColor"
                  d="M9.294 1.354a.75.75 0 00-.763 1.292l.835.494.006.003 8.41 4.827.844.484a.75.75 0 10.747-1.3l-9.247-5.308zm3.633 14.998l-.002-.002-2.612-1.503a.75.75 0 00-.748 1.3l2.61 1.503zm1.638-2.827l-.002-.001-4.203-2.418a.75.75 0 00-.748 1.3l4.2 2.417zm1.711-2.958l-2.558-1.472a.75.75 0 00-.748 1.3l2.556 1.47z"
                />
              </svg>
            </div>
          )}
        </div>

        <div className="p-5 pt-0 text-center text-xs text-white/20">
          &copy;{new Date().getFullYear()} A product made with love.
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[99] h-[50dvh] md:inset-y-0 md:left-[40%] md:right-0 md:h-full md:w-3/5">
        <Tldraw
          onMount={(e) => {
            editor = e;
            e.updateInstanceState({
              isGridMode: true,
            });
            setShowSplash(false);
          }}
          persistenceKey="TMS_STORE"
          inferDarkMode
          //hideUi
          options={{
            maxPages: 1,
          }}
          components={{
            ContextMenu: null,
          }}
        ></Tldraw>
      </div>
    </main>
  );
}
