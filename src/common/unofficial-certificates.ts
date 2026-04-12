import {Person} from '@wca/helpers';
import {Result} from '@wca/helpers/lib/models/result';
import {WCIF} from './types';

/** Internal id passed to PrintService with official event ids */
export const UNOFFICIAL_FASTEST_NEWCOMER_333_R1 = 'unofficial:fastest-newcomer-333-r1';

/** Event title shown on the PDF certificate */
export const CERT_EVENT_FASTEST_NEWCOMER_333 = '3x3x3 Newcomer';

export function isUnofficialCertificateId(id: string): boolean {
  return id.startsWith('unofficial:');
}

function isNewcomer(person: Person | undefined): boolean {
  if (!person) {
    return false;
  }
  return !person.wcaId;
}

function primaryTime(result: Result): number {
  return result.average > 0 ? result.average : result.best;
}

function compareByPrimaryTime(a: Result, b: Result): number {
  const va = primaryTime(a);
  const vb = primaryTime(b);
  if (va !== vb) {
    return va - vb;
  }
  return a.best - b.best;
}

/**
 * Fastest first: gold at index 0. Extends third-place ties like official podium logic.
 * Returns order [third, second, first] with rankingAfterFiltering set for certificate text.
 */
export function podiumByFastestTime(results: Result[]): Result[] {
  if (results.length === 0) {
    return [];
  }
  const sorted = [...results].sort(compareByPrimaryTime);
  const podium = sorted.slice(0, 3);
  if (podium.length === 3) {
    let i = 3;
    const thirdKey = primaryTime(podium[2]);
    while (i < sorted.length) {
      if (primaryTime(sorted[i]) === thirdKey) {
        podium.push(sorted[i]);
      } else {
        break;
      }
      i++;
    }
  }
  for (let i = 0; i < podium.length; i++) {
    if (i > 0 && primaryTime(podium[i]) === primaryTime(podium[i - 1])) {
      podium[i]['rankingAfterFiltering'] = podium[i - 1]['rankingAfterFiltering'];
    } else {
      podium[i]['rankingAfterFiltering'] = i + 1;
    }
  }
  return [...podium].reverse();
}

export function computeFastestNewcomer333R1Podium(wcif: WCIF, countriesFilter: string): Result[] {
  const event333 = wcif.events.find(e => e.id === '333');
  if (!event333?.rounds?.length) {
    return [];
  }
  const firstRound = event333.rounds[0];
  const results = firstRound.results || [];
  let filtered = results.filter(r => {
    if (r.best <= 0) {
      return false;
    }
    const person = wcif.persons.find(p => p.registrantId === r.personId);
    return isNewcomer(person);
  });
  if (countriesFilter?.trim()) {
    const codes = countriesFilter.split(';').map(c => c.trim()).filter(Boolean);
    filtered = filtered.filter(r => codes.includes(r['countryIso2'] as string));
  }
  return podiumByFastestTime(filtered);
}

export function unofficialPodiumWarning(podiumLength: number): string {
  switch (podiumLength) {
    case 0:
      return 'Not available yet';
    case 1:
      return 'Only 1 person on the podium!';
    case 2:
      return 'Only 2 persons on the podium!';
    default:
      return '';
  }
}
