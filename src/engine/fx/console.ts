/** For people who read the source. One message, once per load. Nothing else is hidden. */
const MARK = [
  ' __   __',
  ' \ \ / /',
  '  \ V /   system://vishva',
  '   \_/',
].join('\n');

export function sourceGreeting(log: (msg: string) => void = (m) => console.log(m)): void {
  log(`${MARK}\n\nyou're reading the source. good.\nhttps://github.com/ckvishwa`);
}
