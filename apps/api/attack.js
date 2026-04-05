const autocannon = require('autocannon');

const url = 'http://localhost:3001/reserve';

const instance = autocannon({
  url,
  connections: 50, // High concurrency
  duration: 20,    // 20 seconds of pure chaos
  pipelining: 5,
  method: 'POST',
  body: JSON.stringify({
    seatId: 'A-1',
    eventId: '00000000-0000-0000-0000-000000000000', // Invalid UUID but will still count as a request
    userId: 'attacker-bot'
  }),
  headers: {
    'content-type': 'application/json'
  }
}, (err, result) => {
  if (err) console.error('Attack failed:', err);
  console.log('Attack Finished. Statistics:');
  console.log(result);
});

instance.on('tick', () => console.log('Firing payload...'));
instance.on('response', (client, statusCode) => {
  if (statusCode === 429) {
    console.log('Bot blocked by SHIELD (429 Too Many Requests)');
  }
});
