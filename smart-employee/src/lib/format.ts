export function sar(value: number) {
  return `${new Intl.NumberFormat("ar-SA").format(value)} ر.س`;
}

export function daysLeft(dateStr: string) {
  const end = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function formatDate(dateStr: string) {
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}
