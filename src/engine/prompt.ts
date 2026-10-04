/** The real route as a shell-style prompt: "/" -> "vishva@system:~$", "/work/rexi/" -> "vishva@system:~/work/rexi$". Never a fake command. */
export function prompt(path: string): string {
  const p = path.replace(/\/+$/, '');
  return `vishva@system:~${p}$`;
}
