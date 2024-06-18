import { TapeSymbols, IMachineState, TuringResult } from "./types";

export class TuringMachine {
  private tape: TapeSymbols[] = [];
  private initialTape: TapeSymbols[] = [];
  private machine: IMachineState[] = [];
  private currentStateIndex: number = 0;
  private readHeadPosition: number = 0; // initial read head position
  private previousStateIndex: number | null = null;
  private stepCounter: number = 0;
  private previousTuringResult: TuringResult | null = null;

  public resetStepCounter = () => {
    this.stepCounter = 0;
  };

  public resetPreviousTuringResult = () => {
    this.previousTuringResult = null;
  };

  /**
   * Configures the Turing machine tape with the provided input.
   * @param initialTape The initial input string for the Turing machine tape.
   */
  public configureTape(initialTape: string) {
    const tapeArray = initialTape.split("") as TapeSymbols[];
    this.tape = [...tapeArray, "_"];
    this.initialTape = [...tapeArray, "_"];
  }

  /**
   * Configures the Turing machine with the provided set of states.
   * @param machineStates The array of IMachineState objects representing states and transitions.
   */
  public configureMachine(machineStates: IMachineState[]) {
    this.machine = this.orderStatesByName(machineStates);
  }

  /**
   * Resets the Turing machine to its initial configuration.
   */
  public resetMachine() {
    this.tape = [...this.initialTape];
    this.readHeadPosition = 0;
    this.currentStateIndex = 0;
    this.previousStateIndex = null;
  }

  /**
   * Evaluates the Turing machine for the current step.
   */
  public evaluate() {
    const currentState = this.machine[this.currentStateIndex];

    // Check for final state types
    if (
      currentState.stateType !== "INITIAL" &&
      currentState.stateType !== "INTERMEDIATE"
    ) {
      return this.getTuringResult();
    }

    const currentlyReadingSymbol = this.tape[this.readHeadPosition];

    // Find transition for the current symbol
    const transition = currentState.transitions.find(
      (t) => t.readSymbol === currentlyReadingSymbol,
    );

    if (!transition) {
      throw new Error("No transition found.");
    }

    // Update the tape with the write symbol
    this.tape[this.readHeadPosition] = transition.writeSymbol;

    // Update read head position based on move direction
    if (transition.moveDirection === "R") {
      this.readHeadPosition++;
    } else {
      this.readHeadPosition--;
    }

    /**
     * If the read head goes beyond the bonds of the current tape, append or prepend "_" as nessasary.
     */
    if (this.readHeadPosition < 0) {
      this.tape = ["_", ...this.tape];
    }

    if (this.readHeadPosition > this.tape.length) {
      this.tape = [...this.tape, "_"];
    }

    /**
     * Find the index of next state and update.
     */
    const nextStateIndex = parseInt(transition.nextState.slice(1)) - 1;

    if (
      isNaN(nextStateIndex) ||
      nextStateIndex < 0 ||
      nextStateIndex >= this.machine.length
    ) {
      throw new Error(`Invalid state name: ${transition.nextState}`);
    }

    this.previousStateIndex = this.currentStateIndex;
    this.currentStateIndex = nextStateIndex;
  }

  public forward = () => {
    if (
      !this.previousTuringResult ||
      (this.previousTuringResult &&
        ["INITIAL", "INTERMEDIATE"].includes(this.previousTuringResult.output))
    ) {
      this.stepCounter = this.stepCounter + 1;
    }

    const result = this.gotoPosition(this.stepCounter);
    this.resetMachine();

    this.previousTuringResult = result;

    return result;
  };

  public backward = () => {
    if (this.stepCounter > 0) {
      this.stepCounter = this.stepCounter - 1;
    }
    const result = this.gotoPosition(this.stepCounter);
    this.resetMachine();
    return result;
  };

  public play = () => {
    if (
      !this.previousTuringResult ||
      (this.previousTuringResult &&
        ["INITIAL", "INTERMEDIATE"].includes(this.previousTuringResult.output))
    )
      this.stepCounter = this.stepCounter + 1;

    const result = this.gotoPosition(this.stepCounter);
    this.resetMachine();
    this.previousTuringResult = result;
    return result;
  };

  /**
   * Evaluates the tape up to a given position.
   * @param index The step index to evaluate up to.
   */
  public gotoPosition(index: number) {
    const SAFE_LIMIT = 1000;

    if (index < 0 || index > SAFE_LIMIT) {
      throw new Error(`Invalid step provided: ${index}`);
    }

    for (let i = 0; i < index; i++) {
      try {
        this.evaluate();
      } catch (error) {
        console.error(error);
        break;
      }
    }

    return this.getTuringResult();
  }

  /**
   * Retrieves the current result of the Turing machine.
   */
  public getTuringResult() {
    const currentState = this.machine[this.currentStateIndex];
    const transition = currentState.transitions?.find(
      (t) => t.readSymbol === this.tape[this.readHeadPosition],
    );

    return {
      tape: this.tape,
      output: currentState.stateType,
      transition: transition
        ? `${transition.readSymbol}->${transition.writeSymbol},${transition.moveDirection},${transition.nextState}`
        : null,
      previousStateIndex: this.previousStateIndex,
      previousState:
        this.previousStateIndex !== null
          ? this.machine[this.previousStateIndex].name
          : null,
      currentState: this.machine[this.currentStateIndex].name,
      currentStateIndex: this.currentStateIndex,
      nextState: transition ? transition.nextState : null,
      nextStateIndex: transition
        ? parseInt(transition.nextState.slice(1)) - 1
        : null,
      readHeadPosition: this.readHeadPosition,
    };
  }

  /**
   * Prints the current state and tape of the Turing machine.
   */
  public print() {
    console.table({
      transition:
        this.machine[this.currentStateIndex].transitions.find(
          (transition) =>
            transition.readSymbol === this.tape[this.readHeadPosition],
        ) || "No Transition To Perform",
    });

    console.table({
      currentState: this.machine[this.currentStateIndex].name,
      readHeadPosition: this.readHeadPosition,
      tape: this.tape.join(" , "),
    });

    console.log();
    console.log("------------------------------------------------------");
    console.log();
  }

  /**
   * Orders an array of state objects by their 'name' property in ascending order.
   * @param states An array of state objects to be sorted.
   * @returns The sorted array of state objects.
   */
  private orderStatesByName(states: IMachineState[]) {
    return states.sort((a, b) => a.name.localeCompare(b.name));
  }
}
