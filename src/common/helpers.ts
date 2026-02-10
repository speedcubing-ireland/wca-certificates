import {Result} from '@wca/helpers/lib/models/result';

export class Helpers {

  public static sortResultsByRanking(results: Result[]) {
    results.sort(function(a, b) {
      return (a.ranking < b.ranking) ? -1 : (a.ranking > b.ranking) ? 1 : 0;
    });
  }

}
