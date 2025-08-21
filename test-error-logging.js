// Test to reproduce the exact logging issue mentioned in #520
import { RainBirdService, LogLevel } from 'rainbird';

console.log('=== Testing Rainbird Logging Behavior ===');

const rainbird = new RainBirdService({
  address: '192.168.1.999', // Invalid IP to trigger connection errors
  password: 'test',
  refreshRate: 10, // Shorter refresh for testing
  showRequestResponse: false,
  syncTime: false,
});

// Simulate the platform's event listener
let eventCount = 0;
rainbird.on('log', (log) => {
  eventCount++;
  console.log(`[EVENT ${eventCount}] [${log.level}]: ${log.message}`);
});

console.log('Starting init to trigger connection error...');

try {
  await rainbird.init();
} catch (error) {
  console.log(`Main catch: ${error}`);
}

console.log(`Total events received: ${eventCount}`);