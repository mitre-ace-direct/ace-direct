/**
 * This module is meant to detect if a user's browser has hardware acceleration turned on.
 * Include it wherever this is needed.
 */

import { getGPUTier } from 'detect-gpu';

$(window).on('load', async () => {
  const gpuBannerValue = sessionStorage.getItem('gpu-banner');
  console.log(gpuBannerValue);
  $('#hardware-acc-warning').hide();

  $('#gpu-close').click(() => {
    console.log('close button clicked');
    sessionStorage.setItem('gpu-banner', 'hidden');
  });

  const gpu = await getGPUTier();

  if (gpuBannerValue === 'hidden') {
    $('#hardware-acc-warning').hide();
  } else if (gpu.tier > 1 && gpuBannerValue !== 'hidden') {
    console.log('Hardware Acceleration is on.');
    $('#hardware-acc-warning').show();
    sessionStorage.setItem('gpu-banner', 'shown');
  } else {
    console.log('Hardware Acceleration is off.');
    $('#hardware-acc-warning').hide();
  }
});
