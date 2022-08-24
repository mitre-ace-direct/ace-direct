/**
 * This module is meant to detect if a user's browser has hardware acceleration turned on.
 * Include it wherever this is needed.
 */

import { getGPUTier } from 'detect-gpu';

$(document).ready(async () => {
  $('#hardware-acc-warning').hide();

  const gpu = await getGPUTier();

  if (gpu.tier > 1) {
    console.log('Hardware Acceleration is on.');
    $('#hardware-acc-warning').show();
  } else {
    console.log('Hardware Acceleration is off.');
    $('#hardware-acc-warning').hide();
  }
});
