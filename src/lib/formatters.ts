// CareFlow — Clinical Pathway Process Mining Formatters

export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || isNaN(minutes)) {
    return 'Not available';
  }

  if (minutes === 0) {
    return '0 min';
  }

  if (minutes > 0 && minutes < 1) {
    return '< 1 min';
  }

  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);

    if (remainingMinutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${remainingMinutes}m`;
  }

  const days = Math.floor(minutes / 1440);
  const remainingHours = Math.round((minutes % 1440) / 60);

  if (remainingHours === 0) {
    return `${days}d`;
  }

  return `${days}d ${remainingHours}h`;
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatPercentage(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '0.0%';
  }
  return `${val.toFixed(decimals)}%`;
}

export function formatDateTime(isoOrString: string | null | undefined): string {
  if (!isoOrString) return 'Not available';
  try {
    const d = new Date(isoOrString);
    if (isNaN(d.getTime())) return String(isoOrString);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return String(isoOrString);
  }
}

export function formatDateShort(isoOrString: string | null | undefined): string {
  if (!isoOrString) return '';
  try {
    const d = new Date(isoOrString);
    if (isNaN(d.getTime())) return String(isoOrString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(isoOrString);
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
