import { getGPUTier } from 'detect-gpu';

$(document).ready(async () => {
  const gpu = await getGPUTier();

  console.log('gpu tier result', gpu);
});
