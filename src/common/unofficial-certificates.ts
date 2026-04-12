import {Person} from '@wca/helpers';
import {Result} from '@wca/helpers/lib/models/result';
import {WCIF} from './types';
import {getPodiumWarning, podiumByFastestTime} from './podium';

/** Internal id passed to PrintService with official event ids */
export const UNOFFICIAL_FASTEST_NEWCOMER_333_R1 = 'unofficial:fastest-newcomer-333-r1';

export interface UnofficialCertificateDefinition {
  id: string;
  label: string;
  eventIdForFormat: string;
  certificateEventName: string;
  computePodium: (wcif: WCIF, countriesFilter: string) => Result[];
  hasSourceResults: (wcif: WCIF) => boolean;
  getSourceFormat: (wcif: WCIF) => string | null;
}

export function isUnofficialCertificateId(id: string): boolean {
  return id.startsWith('unofficial:');
}

function isNewcomer(person: Person | undefined): boolean {
  if (!person) {
    return false;
  }
  return !person.wcaId;
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

function getFastestNewcomer333R1Format(wcif: WCIF): string | null {
  return wcif.events.find(e => e.id === '333')?.rounds?.[0]?.format ?? null;
}

function hasFastestNewcomer333R1Results(wcif: WCIF): boolean {
  return !!wcif.events.find(e => e.id === '333')?.rounds?.[0]?.results?.length;
}

export const UNOFFICIAL_CERTIFICATE_DEFINITIONS: readonly UnofficialCertificateDefinition[] = [
  {
    id: UNOFFICIAL_FASTEST_NEWCOMER_333_R1,
    label: 'Fastest Newcomer (First Round)',
    eventIdForFormat: '333',
    certificateEventName: '3x3x3 Newcomer',
    computePodium: computeFastestNewcomer333R1Podium,
    hasSourceResults: hasFastestNewcomer333R1Results,
    getSourceFormat: getFastestNewcomer333R1Format,
  },
] as const;

export function getUnofficialCertificateDefinition(id: string): UnofficialCertificateDefinition | undefined {
  return UNOFFICIAL_CERTIFICATE_DEFINITIONS.find(definition => definition.id === id);
}

export function createUnofficialCertificateSelection(): Record<string, boolean> {
  return UNOFFICIAL_CERTIFICATE_DEFINITIONS.reduce<Record<string, boolean>>((selection, definition) => {
    selection[definition.id] = false;
    return selection;
  }, {});
}

export function getUnofficialPodium(id: string, wcif: WCIF, countriesFilter: string): Result[] {
  return getUnofficialCertificateDefinition(id)?.computePodium(wcif, countriesFilter) ?? [];
}

export function getUnofficialWarning(id: string, wcif: WCIF | null, countriesFilter: string): string {
  if (!wcif) {
    return getPodiumWarning(0);
  }
  return getPodiumWarning(getUnofficialPodium(id, wcif, countriesFilter).length);
}

export function shouldGenerateBlankUnofficialCertificates(id: string, wcif: WCIF | null, countriesFilter: string): boolean {
  const definition = getUnofficialCertificateDefinition(id);
  if (!definition || !wcif) {
    return false;
  }

  if (!definition.hasSourceResults(wcif)) {
    return true;
  }

  return definition.computePodium(wcif, countriesFilter).length === 0;
}

export {getPodiumWarning};
