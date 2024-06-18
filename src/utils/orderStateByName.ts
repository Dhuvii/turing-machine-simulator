import { IMachineState } from "@/types";

/**
 * Function to order an array of state objects by their 'name' property in ascending order.
 * @param {IMachineState[]} states - An array of state objects to be sorted.
 * @returns {IMachineState[]} - The sorted array of state objects.
 */

export default function (states: IMachineState[]) {
  return states.sort((a, b) => a.name.localeCompare(b.name));
}
