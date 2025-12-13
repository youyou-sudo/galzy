export let deployStatus: 'starting' | 'migrating' | 'ready' | 'error' =
  'starting'

export const setDeployStatus = (newStatus: typeof deployStatus) => {
  deployStatus = newStatus
}
