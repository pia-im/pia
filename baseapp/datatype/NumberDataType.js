import wordsToNumbers from 'words-to-numbers';
import writtenNumber from 'written-number';
import { OpenEndedDataType } from './OpenEndedDataType.js';
import { getConfig } from '../../util/config.js';
import { assert } from '../../util/util.js';

/**
 * An integer
 *
 * E.g. 3, 2013, or 5000000, or 3.14
 *
 * TODO: Other languages than en
 */
export class NumberDataType extends OpenEndedDataType {
  constructor() {
    super("Pia.Number");
  }

  valueIDForTerm(term) {
    // TODO only English supported
    return wordsToNumbers(term, { fuzzy: true });
  }

  get terms() {
    let lang = getConfig().language;
    // TODO German and Italian not supported :-(
    let samples = [];
    for (let i = -1; i < 300; i++) {
      samples.push(writtenNumber(i, { lang: lang }));
    }
    for (let i = 1; i < 10^15; i = i * 10) {
      samples.push(writtenNumber(i, { lang: lang }));
    }
    for (let i = 1; i < 5; i++) {
      samples.push(writtenNumber(i, { lang: lang }));
    }
    return samples;
  }
}