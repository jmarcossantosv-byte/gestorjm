export const GAMES_PER_PAGE = 5;

export function canAddGame(count: number) {
  return count < GAMES_PER_PAGE;
}

export function paginateGames<T extends { horario: string }>(games: T[]): T[][] {
  const sorted = [...games].sort((a, b) => (a.horario || "99:99").localeCompare(b.horario || "99:99"));
  const pages: T[][] = [];
  for (let i = 0; i < sorted.length; i += GAMES_PER_PAGE) pages.push(sorted.slice(i, i + GAMES_PER_PAGE));
  return pages.length ? pages : [[]];
}

export function bannerWeekday(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" })
    .format(new Date(`${date}T12:00:00Z`)).replace(/-feira$/, "").toUpperCase();
}

export function downloadBanner(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}