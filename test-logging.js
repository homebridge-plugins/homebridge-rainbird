// Test script to understand rainbird logging behavior
import { RainBirdService } from 'rainbird';

const rainbird = new RainBirdService({
  address: '192.168.1.105', // Invalid IP to trigger the error
  password: 'test',
  refreshRate: 60,
  showRequestResponse: false,
  syncTime: false,
});

// Listen for log events
rainbird.on('log', (log) => {
  console.log(`EVENT LOG [${log.level}]: ${log.message}`);
});

try {
  console.log('Starting test...');
  await rainbird.init();
} catch (error) {
  console.log(`CAUGHT ERROR: ${error}`);
}