/**
 * @notice Constants used in simulated annealing optimization algorithm
 * @dev These parameters control the behavior and convergence of the annealing process
 */
const ANNEALING_CONSTANTS = {
  /** @notice Starting temperature for annealing process */
  INITIAL_TEMP: 1,
  /** @notice Minimum temperature before terminating */
  MIN_TEMP: 0.001,
  /** @notice Rate at which temperature decreases each iteration */
  COOLING_RATE: 0.97,
  /** @notice Number of attempts at each temperature level */
  ITERATIONS_PER_TEMP: 3000,
  /** @notice Minimum ratio of accepted moves before increasing failure count */
  MIN_ACCEPTANCE_RATE: 0.01,
  /** @notice Maximum consecutive failures before early termination */
  MAX_CONSECUTIVE_FAILURES: 1000,
};

export default ANNEALING_CONSTANTS;
