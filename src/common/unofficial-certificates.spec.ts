import {Person} from '@wca/helpers';
import {WCIF} from './types';
import {
  UNOFFICIAL_CERTIFICATE_DEFINITIONS,
  createUnofficialCertificateSelection,
  computeFastestNewcomer333R1Podium,
  getPodiumWarning
} from './unofficial-certificates';
import {podiumByFastestTime} from './podium';
import {Result} from '@wca/helpers/lib/models/result';
import {Event} from '@wca/helpers/lib/models/event';

function makeResult(overrides: Partial<Result> & {best?: number; average?: number} = {}): Result {
  return {
    personId: 1,
    ranking: 1,
    attempts: [],
    best: 0,
    average: 0,
    ...overrides
  } as Result;
}

function makePerson(
  name: string,
  registrantId: number,
  wcaId: string | null | undefined,
  countryIso2 = 'IE'
): Person {
  return {name, registrantId, wcaId, countryIso2, roles: [], registration: {status: 'accepted'}} as Person;
}

function makeWcif(events: Event[], persons: Person[]): WCIF {
  return {
    id: 'Test2024',
    name: 'Test Competition 2024',
    shortName: 'Test 2024',
    persons,
    events,
    schedule: {},
    competitorLimit: null,
    extensions: []
  };
}

describe('unofficial-certificates', () => {
  describe('podiumByFastestTime', () => {
    it('should order by primary time (average when set)', () => {
      const a = makeResult({personId: 1, best: 900, average: 1000});
      const b = makeResult({personId: 2, best: 800, average: 1100});
      const c = makeResult({personId: 3, best: 950, average: 950});
      const podium = podiumByFastestTime([a, b, c]);
      expect(podium.length).toBe(3);
      expect(podium[2].personId).toBe(3);
      expect(podium[1].personId).toBe(1);
      expect(podium[0].personId).toBe(2);
    });

    it('should include ties on third place', () => {
      const r1 = makeResult({personId: 1, best: 800, average: 900});
      const r2 = makeResult({personId: 2, best: 850, average: 950});
      const r3a = makeResult({personId: 3, best: 900, average: 1000});
      const r3b = makeResult({personId: 4, best: 880, average: 1000});
      const podium = podiumByFastestTime([r1, r2, r3a, r3b]);
      expect(podium.filter(p => p['rankingAfterFiltering'] === 3).length).toBe(2);
    });
  });

  describe('computeFastestNewcomer333R1Podium', () => {
    it('should only include registrants without a WCA ID', () => {
      const persons = [
        makePerson('Old', 1, '2010OLD01'),
        makePerson('New', 2, null)
      ];
      const results = [
        makeResult({personId: 1, ranking: 1, best: 700, average: 800}),
        makeResult({personId: 2, ranking: 2, best: 600, average: 700})
      ];
      const events = [{
        id: '333',
        rounds: [{id: 'r1', format: 'a', results}]
      }] as unknown as Event[];
      const wcif = makeWcif(events, persons);
      const podium = computeFastestNewcomer333R1Podium(wcif, '');
      expect(podium.length).toBe(1);
      expect(podium[0].personId).toBe(2);
    });

    it('should use first round of 333 only', () => {
      const persons = [makePerson('New', 1, null)];
      const first = makeResult({personId: 1, ranking: 2, best: 1200, average: 1300});
      const final = makeResult({personId: 1, ranking: 1, best: 900, average: 1000});
      const events = [{
        id: '333',
        rounds: [
          {id: 'r1', format: 'a', results: [first]},
          {id: 'r2', format: 'a', results: [final]}
        ]
      }] as unknown as Event[];
      const wcif = makeWcif(events, persons);
      const podium = computeFastestNewcomer333R1Podium(wcif, '');
      expect(podium.length).toBe(1);
      expect(podium[0].best).toBe(1200);
    });

    it('should respect countries filter', () => {
      const persons = [
        makePerson('IE', 1, null, 'IE'),
        makePerson('US', 2, null, 'US')
      ];
      const results = [
        Object.assign(makeResult({personId: 1, ranking: 1, best: 800, average: 900}), {countryIso2: 'IE'}),
        Object.assign(makeResult({personId: 2, ranking: 2, best: 900, average: 1000}), {countryIso2: 'US'})
      ];
      const events = [{
        id: '333',
        rounds: [{id: 'r1', format: 'a', results}]
      }] as unknown as Event[];
      const wcif = makeWcif(events, persons);
      const podium = computeFastestNewcomer333R1Podium(wcif, 'IE');
      expect(podium.length).toBe(1);
      expect(podium[0].personId).toBe(1);
    });
  });

  describe('unofficialPodiumWarning', () => {
    it('should mirror official podium messages', () => {
      expect(getPodiumWarning(0)).toBe('Not available yet');
      expect(getPodiumWarning(1)).toBe('Only 1 person on the podium!');
      expect(getPodiumWarning(2)).toBe('Only 2 persons on the podium!');
      expect(getPodiumWarning(3)).toBe('');
    });
  });

  describe('definitions', () => {
    it('should expose unofficial certificate definitions for the UI', () => {
      expect(UNOFFICIAL_CERTIFICATE_DEFINITIONS.length).toBeGreaterThan(0);
      expect(UNOFFICIAL_CERTIFICATE_DEFINITIONS[0].label).toContain('Fastest Newcomer');
    });

    it('should create a disabled selection state for every unofficial certificate', () => {
      const selection = createUnofficialCertificateSelection();
      expect(Object.keys(selection)).toEqual(
        UNOFFICIAL_CERTIFICATE_DEFINITIONS.map(definition => definition.id)
      );
      expect(Object.values(selection)).toEqual(jasmine.arrayWithExactContents([false]));
    });
  });
});
