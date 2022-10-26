/**
 * New node file
 */
//-----------------------------------------------------------------------

// angular.module('CDM.filterModule', []).filter('CDMshorten', function () {
const filterModule = angular.module('filterModule', []);

filterModule.filter('shorten', () => function ShortenFilter(input, length) {
  let len = 50; // default to 50 chars
  let out = input;
  if (length && length > 0) {
    len = length;
  }
  if (out !== null && out.length > len) {
    out = `${input.substr(0, len)}...`;
  }
  return out;
});
filterModule.filter('ssnfilter', () => function SSNFilter(input) {
  let out = '';
  if (input && input.length > 4) {
    out = input.substring(input.length - 4);
  }

  return `***********${out}`;
});
filterModule.filter('ACRdate', ($filter) => function ACRDateFilter(input, time) {
  if (input == null || input.length === 0) {
    return 'Unavailable';
  }
  const d = new Date(input);
  if (time && time === 't') { // returns time only
    return $filter('date')(d, 'shortTime');
  }
  if (time && time === 'd') { // returns date only
    return $filter('date')(d, 'mediumDate');
  }
  if (time === 'd-or-t') { // returns date or time depending on if it's today
    const today = new Date();
    if (d.getFullYear() === today.getFullYear()
                && d.getMonth() === today.getMonth()
                && d.getDate() === today.getDate()) {
      return $filter('date')(d, 'shortTime');
    }

    return $filter('date')(d, 'mediumDate');
  }
  if (time && time === 'us') { // returns the normal date used in the U.S.
    return $filter('date')(d, 'MM/dd/yyyy HH:mm');
  }
  if (time === 'utc') { // returns whole string in utc format. will add the time offset at end
    return $filter('date')(d, 'yyyy-MM-ddTHH:mmZ');
  }
  if (time === 'iso') { // returns whole string in ISO format. will produce format like yyyy-MM-ddTHH:mmZ
    return d.toISOString();
  }
  return $filter('date')(d, 'MMM dd, yyyy HH:mm');
});
