/**
 * This module is meant to detect if a user's browser has hardware acceleration turned on.
 * Include it wherever this is needed.
 */

import { getGPUTier } from 'detect-gpu';

$(window).on('load', async () => {
  const gpuBannerValue = sessionStorage.getItem('gpu-banner');
  console.log(gpuBannerValue);
  // $('#hardware-acc-warning').hide();

  $('#gpu-close').click(() => {
    console.log('close button clicked');
    $('#hardware-acc-warning').addClass('hidden');
    sessionStorage.setItem('gpu-banner', 'hidden');
  });

  const gpu = await getGPUTier();

  if (gpuBannerValue === 'hidden') {
    $('#hardware-acc-warning').addClass('hidden');
  } else if (gpu.tier > 1 && gpuBannerValue !== 'hidden') {
    console.log('Hardware Acceleration is on.');
    $('#hardware-acc-warning').removeClass('hidden');
    sessionStorage.setItem('gpu-banner', 'shown');
  } else {
    console.log('Hardware Acceleration is off.');
    $('#hardware-acc-warning').addClass('hidden');
  }
});
